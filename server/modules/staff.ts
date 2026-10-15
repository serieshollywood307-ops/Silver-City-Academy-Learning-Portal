import { createHash, randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { teacherInvites, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const inviteExpiryMs = 7 * 24 * 60 * 60 * 1000;
const inviteDigest = (token: string) => createHash("sha256").update(token.trim()).digest("hex");

export const staffRouter = router({
  redeemInvite: protectedProcedure
    .input(z.object({ token: z.string().trim().min(20).max(100) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "admin" || ctx.user.role === "teacher") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This account already has staff access." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Teacher signup is temporarily unavailable." });
      const digest = inviteDigest(input.token);
      const now = new Date();

      await db.transaction(async tx => {
        const [invite] = await tx.select().from(teacherInvites)
          .where(eq(teacherInvites.tokenHash, digest)).limit(1).for("update");
        if (!invite || invite.redeemedAt || invite.revokedAt || invite.expiresAt.getTime() <= now.getTime()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invite code is invalid, expired, or already used." });
        }
        await tx.update(teacherInvites).set({ redeemedAt: now, redeemedBy: ctx.user.id })
          .where(eq(teacherInvites.id, invite.id));
        await tx.update(users).set({ role: "teacher" }).where(eq(users.id, ctx.user.id));
      });

      return { success: true as const, role: "teacher" as const };
    }),

  issueInvite: adminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Invite management is temporarily unavailable." });
    const now = new Date();
    const openInvites = await db.select({ id: teacherInvites.id }).from(teacherInvites)
      .where(and(
        isNull(teacherInvites.redeemedAt),
        isNull(teacherInvites.revokedAt),
        gt(teacherInvites.expiresAt, now),
      )).limit(25);
    if (openInvites.length >= 25) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Revoke or wait for an unused invite to expire before creating another." });
    }

    const token = `SCA-${randomBytes(32).toString("base64url")}`;
    const [created] = await db.insert(teacherInvites).values({
      tokenHash: inviteDigest(token),
      createdBy: ctx.user.id,
      expiresAt: new Date(now.getTime() + inviteExpiryMs),
    });
    // Return the plaintext only in this issuance response. Listing APIs never return it or its hash.
    return { id: Number(created.insertId), token, expiresAt: new Date(now.getTime() + inviteExpiryMs) };
  }),

  listInvites: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Invite management is temporarily unavailable." });
    return db.select({
      id: teacherInvites.id,
      createdAt: teacherInvites.createdAt,
      expiresAt: teacherInvites.expiresAt,
      redeemedAt: teacherInvites.redeemedAt,
      revokedAt: teacherInvites.revokedAt,
    }).from(teacherInvites).orderBy(desc(teacherInvites.createdAt)).limit(50);
  }),

  revokeInvite: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Invite management is temporarily unavailable." });
      await db.update(teacherInvites).set({ revokedAt: new Date() })
        .where(and(eq(teacherInvites.id, input.id), isNull(teacherInvites.redeemedAt), isNull(teacherInvites.revokedAt)));
      return { success: true as const };
    }),

  listTeachers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Teacher management is temporarily unavailable." });
    return db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
      .from(users).where(eq(users.role, "teacher")).orderBy(desc(users.createdAt)).limit(100);
  }),

  revokeTeacher: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The owner account cannot revoke itself here." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Teacher management is temporarily unavailable." });
      const [target] = await db.select({ id: users.id, role: users.role }).from(users)
        .where(eq(users.id, input.userId)).limit(1);
      if (!target || target.role !== "teacher") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Teacher account was not found." });
      }
      await db.update(users).set({ role: "user" }).where(eq(users.id, input.userId));
      return { success: true as const };
    }),
});
