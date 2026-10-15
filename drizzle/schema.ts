import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Manus account identity mapped to this portal's server-enforced role. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "teacher", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** The plaintext invitation is never stored; only its SHA-256 digest is indexed. */
export const teacherInvites = mysqlTable(
  "teacher_invites",
  {
    id: int("id").autoincrement().primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    createdBy: int("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    redeemedAt: timestamp("redeemed_at"),
    redeemedBy: int("redeemed_by").references(() => users.id),
    revokedAt: timestamp("revoked_at"),
  },
  table => [index("teacher_invites_created_by_idx").on(table.createdBy)],
);

/** On-demand original notes, shared by canonical chapter rather than student identity. */
export const chapterNotes = mysqlTable(
  "chapter_notes",
  {
    id: int("id").autoincrement().primaryKey(),
    classKey: varchar("class_key", { length: 16 }).notNull(),
    subject: varchar("subject", { length: 100 }).notNull(),
    bookTitle: varchar("book_title", { length: 180 }).notNull(),
    chapter: varchar("chapter", { length: 180 }).notNull(),
    markdown: text("markdown").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("chapter_notes_canonical_idx").on(table.classKey, table.subject, table.bookTitle, table.chapter),
    index("chapter_notes_updated_idx").on(table.updatedAt),
  ],
);

/** One-time proof that an authorised teacher received a storage PUT URL. */
export const uploadReservations = mysqlTable(
  "upload_reservations",
  {
    id: int("id").autoincrement().primaryKey(),
    objectKey: varchar("object_key", { length: 512 }).notNull().unique(),
    uploadedBy: int("uploaded_by").notNull().references(() => users.id),
    title: varchar("title", { length: 180 }).notNull(),
    classKey: varchar("class_key", { length: 16 }).notNull(),
    subject: varchar("subject", { length: 100 }).notNull(),
    chapter: varchar("chapter", { length: 180 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    byteSize: int("byte_size").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [
    index("upload_reservations_owner_idx").on(table.uploadedBy, table.createdAt),
    index("upload_reservations_expiry_idx").on(table.expiresAt),
  ],
);

/** Teacher uploads stay draft until explicitly published; archive hides but does not erase bytes. */
export const teacherUploads = mysqlTable(
  "teacher_uploads",
  {
    id: int("id").autoincrement().primaryKey(),
    objectKey: varchar("object_key", { length: 512 }).notNull().unique(),
    title: varchar("title", { length: 180 }).notNull(),
    classKey: varchar("class_key", { length: 16 }).notNull(),
    subject: varchar("subject", { length: 100 }).notNull(),
    chapter: varchar("chapter", { length: 180 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    byteSize: int("byte_size").notNull(),
    status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
    uploadedBy: int("uploaded_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("teacher_uploads_status_created_idx").on(table.status, table.createdAt),
    index("teacher_uploads_owner_status_idx").on(table.uploadedBy, table.status),
  ],
);

/** Source-attributed current affairs; only published entries are returned to students. */
export const currentAffairs = mysqlTable(
  "current_affairs",
  {
    id: int("id").autoincrement().primaryKey(),
    eventDate: varchar("event_date", { length: 10 }).notNull(),
    topic: varchar("topic", { length: 100 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    summary: text("summary").notNull(),
    sourceTitle: varchar("source_title", { length: 220 }).notNull(),
    sourceUrl: varchar("source_url", { length: 2048 }).notNull(),
    status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
    createdBy: int("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("current_affairs_status_date_idx").on(table.status, table.eventDate),
    index("current_affairs_created_by_idx").on(table.createdBy),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ChapterNote = typeof chapterNotes.$inferSelect;
export type TeacherUpload = typeof teacherUploads.$inferSelect;
export type CurrentAffair = typeof currentAffairs.$inferSelect;
