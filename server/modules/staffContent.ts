import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import catalog from "../../client/src/data/ncert-catalog.json";
import { currentAffairs, teacherUploads, uploadReservations, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { storageCreateUploadTarget, storageGetSignedUrl } from "../storage";
import { adminProcedure, router, teacherProcedure } from "../_core/trpc";

const classKeys = ["class-9", "class-10", "class-11", "class-12"] as const;
const studyMeta = z.object({
  classKey: z.enum(classKeys),
  subject: z.string().trim().min(1).max(100),
  title: z.string().trim().min(3).max(180),
  chapter: z.string().trim().min(1).max(180),
});
const isListedSubject = (classKey: string, subject: string) => catalog.books.some(book => book.classKey === classKey && book.subject === subject);

export const staffContentRouter = router({
  myUploads: teacherProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Staff files are temporarily unavailable." });
    const selection = {
      id: teacherUploads.id,
      title: teacherUploads.title,
      classKey: teacherUploads.classKey,
      subject: teacherUploads.subject,
      chapter: teacherUploads.chapter,
      mimeType: teacherUploads.mimeType,
      byteSize: teacherUploads.byteSize,
      status: teacherUploads.status,
      uploadedBy: teacherUploads.uploadedBy,
      uploadedAt: teacherUploads.createdAt,
      uploaderName: users.name,
    };
    if (ctx.user.role === "admin") {
      return db.select(selection).from(teacherUploads).leftJoin(users, eq(teacherUploads.uploadedBy, users.id))
        .orderBy(desc(teacherUploads.createdAt)).limit(100);
    }
    return db.select(selection).from(teacherUploads).leftJoin(users, eq(teacherUploads.uploadedBy, users.id))
      .where(eq(teacherUploads.uploadedBy, ctx.user.id)).orderBy(desc(teacherUploads.createdAt)).limit(100);
  }),

  beginUpload: teacherProcedure.input(studyMeta.extend({
    fileName: z.string().trim().min(5).max(180).regex(/^[A-Za-z0-9 _().-]+\.pdf$/i, "Only PDF files are accepted."),
    mimeType: z.literal("application/pdf"),
    byteSize: z.number().int().min(1).max(25 * 1024 * 1024),
  })).mutation(async ({ ctx, input }) => {
    if (!isListedSubject(input.classKey, input.subject)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Select a subject listed for this class." });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Uploads are temporarily unavailable." });
    const objectKey = `study-resources/${ctx.user.id}/${randomUUID()}.pdf`;
    let target: { key: string; uploadUrl: string };
    try {
      target = await storageCreateUploadTarget(objectKey);
    } catch {
      throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Secure file storage is temporarily unavailable." });
    }
    await db.insert(uploadReservations).values({
      objectKey: target.key,
      uploadedBy: ctx.user.id,
      title: input.title,
      classKey: input.classKey,
      subject: input.subject,
      chapter: input.chapter,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    return { objectKey: target.key, uploadUrl: target.uploadUrl, expiresInSeconds: 600 };
  }),

  completeUpload: teacherProcedure.input(z.object({ objectKey: z.string().min(1).max(512) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Uploads are temporarily unavailable." });
    const now = new Date();
    // Validate actual stored bytes, not only the browser-declared MIME/size. Signed
    // download URLs are transient and are never logged or returned to the browser.
    const [pending] = await db.select({ byteSize: uploadReservations.byteSize, expiresAt: uploadReservations.expiresAt })
      .from(uploadReservations).where(and(
        eq(uploadReservations.objectKey, input.objectKey),
        eq(uploadReservations.uploadedBy, ctx.user.id),
        isNull(uploadReservations.completedAt),
        gt(uploadReservations.expiresAt, now),
      )).limit(1);
    if (!pending) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload session expired or was already used. Start the upload again." });
    let fileBytes: ArrayBuffer;
    try {
      const signedUrl = await storageGetSignedUrl(input.objectKey);
      const response = await fetch(signedUrl, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error("Object unavailable");
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > 25 * 1024 * 1024 || (declaredLength > 0 && declaredLength !== pending.byteSize)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded PDF size does not match the allowed file size." });
      }
      fileBytes = await response.arrayBuffer();
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded file could not be verified. Please restart the upload." });
    }
    if (fileBytes.byteLength < 5 || fileBytes.byteLength > 25 * 1024 * 1024 || fileBytes.byteLength !== pending.byteSize) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded file size is invalid. Please restart the upload." });
    }
    if (new TextDecoder().decode(fileBytes.slice(0, 5)) !== "%PDF-") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded content is not a valid PDF file." });
    }
    let createdId: number | undefined;
    try {
      await db.transaction(async tx => {
        const [reservation] = await tx.select().from(uploadReservations).where(and(
          eq(uploadReservations.objectKey, input.objectKey),
          eq(uploadReservations.uploadedBy, ctx.user.id),
          isNull(uploadReservations.completedAt),
          gt(uploadReservations.expiresAt, now),
        )).limit(1).for("update");
        if (!reservation) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload session expired or was already used. Start the upload again." });
        const [inserted] = await tx.insert(teacherUploads).values({
          objectKey: reservation.objectKey,
          title: reservation.title,
          classKey: reservation.classKey,
          subject: reservation.subject,
          chapter: reservation.chapter,
          mimeType: reservation.mimeType,
          byteSize: reservation.byteSize,
          status: "draft",
          uploadedBy: reservation.uploadedBy,
        });
        await tx.update(uploadReservations).set({ completedAt: now })
          .where(and(eq(uploadReservations.id, reservation.id), isNull(uploadReservations.completedAt)));
        createdId = Number(inserted.insertId);
      });
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The uploaded file could not be registered. Please contact the portal owner." });
    }
    return { success: true as const, id: createdId };
  }),

  publishUpload: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Staff files are temporarily unavailable." });
    await db.update(teacherUploads).set({ status: "published" })
      .where(and(eq(teacherUploads.id, input.id), eq(teacherUploads.status, "draft")));
    return { success: true as const };
  }),

  archiveUpload: teacherProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Staff files are temporarily unavailable." });
    const conditions = [eq(teacherUploads.id, input.id), eq(teacherUploads.status, "draft" as const)];
    if (ctx.user.role !== "admin") conditions.push(eq(teacherUploads.uploadedBy, ctx.user.id));
    await db.update(teacherUploads).set({ status: "archived" }).where(and(...conditions));
    return { success: true as const };
  }),

  myCurrentAffairs: teacherProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Editorial content is temporarily unavailable." });
    const selection = {
      id: currentAffairs.id,
      eventDate: currentAffairs.eventDate,
      topic: currentAffairs.topic,
      title: currentAffairs.title,
      summary: currentAffairs.summary,
      sourceTitle: currentAffairs.sourceTitle,
      sourceUrl: currentAffairs.sourceUrl,
      status: currentAffairs.status,
      createdAt: currentAffairs.createdAt,
      createdBy: currentAffairs.createdBy,
      creatorName: users.name,
    };
    if (ctx.user.role === "admin") {
      return db.select(selection).from(currentAffairs).leftJoin(users, eq(currentAffairs.createdBy, users.id))
        .orderBy(desc(currentAffairs.eventDate), desc(currentAffairs.createdAt)).limit(100);
    }
    return db.select(selection).from(currentAffairs).leftJoin(users, eq(currentAffairs.createdBy, users.id))
      .where(eq(currentAffairs.createdBy, ctx.user.id)).orderBy(desc(currentAffairs.eventDate), desc(currentAffairs.createdAt)).limit(100);
  }),

  createCurrentAffair: teacherProcedure.input(z.object({
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    topic: z.string().trim().min(2).max(100),
    title: z.string().trim().min(8).max(180),
    summary: z.string().trim().min(30).max(1800),
    sourceTitle: z.string().trim().min(3).max(220),
    sourceUrl: z.string().url().max(2048).refine(value => new URL(value).protocol === "https:", "Use an HTTPS source link."),
  })).mutation(async ({ ctx, input }) => {
    const date = new Date(`${input.eventDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.eventDate) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid event date." });
    }
    if (date.getTime() > Date.now() + 86_400_000) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "The event date cannot be in the future. Label forecasts in the summary instead." });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Editorial content is temporarily unavailable." });
    const [inserted] = await db.insert(currentAffairs).values({ ...input, status: "draft", createdBy: ctx.user.id });
    return { success: true as const, id: Number(inserted.insertId), status: "draft" as const };
  }),

  setCurrentAffairStatus: teacherProcedure.input(z.object({
    id: z.number().int().positive(),
    status: z.enum(["published", "archived"]),
  })).mutation(async ({ ctx, input }) => {
    if (input.status === "published" && ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only the portal owner can publish current affairs." });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Editorial content is temporarily unavailable." });
    const [item] = await db.select().from(currentAffairs).where(eq(currentAffairs.id, input.id)).limit(1);
    if (!item || (ctx.user.role !== "admin" && item.createdBy !== ctx.user.id)) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Editorial item was not found." });
    }
    if (item.status === "archived") throw new TRPCError({ code: "BAD_REQUEST", message: "Archived items cannot be republished." });
    await db.update(currentAffairs).set({ status: input.status }).where(eq(currentAffairs.id, input.id));
    return { success: true as const };
  }),
});
