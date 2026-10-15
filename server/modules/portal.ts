import { desc, eq } from "drizzle-orm";
import { chapterNotes, currentAffairs, teacherUploads } from "../../drizzle/schema";
import { getDb } from "../db";
import { publicProcedure, router } from "../_core/trpc";

export const portalRouter = router({
  feed: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { uploads: [], currentAffairs: [] };

    const uploads = await db.select({
      id: teacherUploads.id,
      title: teacherUploads.title,
      classKey: teacherUploads.classKey,
      subject: teacherUploads.subject,
      chapter: teacherUploads.chapter,
      byteSize: teacherUploads.byteSize,
      createdAt: teacherUploads.createdAt,
      objectKey: teacherUploads.objectKey,
    }).from(teacherUploads).where(eq(teacherUploads.status, "published"))
      .orderBy(desc(teacherUploads.createdAt)).limit(40);

    const currentAffairsRows = await db.select({
      id: currentAffairs.id,
      eventDate: currentAffairs.eventDate,
      topic: currentAffairs.topic,
      title: currentAffairs.title,
      summary: currentAffairs.summary,
      sourceTitle: currentAffairs.sourceTitle,
      sourceUrl: currentAffairs.sourceUrl,
    }).from(currentAffairs).where(eq(currentAffairs.status, "published"))
      .orderBy(desc(currentAffairs.eventDate), desc(currentAffairs.createdAt)).limit(40);

    return {
      uploads: uploads.map(({ objectKey, ...record }) => ({ ...record, url: `/manus-storage/${objectKey}` })),
      currentAffairs: currentAffairsRows,
    };
  }),

  recentNotes: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      id: chapterNotes.id,
      classKey: chapterNotes.classKey,
      subject: chapterNotes.subject,
      bookTitle: chapterNotes.bookTitle,
      chapter: chapterNotes.chapter,
      updatedAt: chapterNotes.updatedAt,
    }).from(chapterNotes).orderBy(desc(chapterNotes.updatedAt)).limit(12);
  }),
});
