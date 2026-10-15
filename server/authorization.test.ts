import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "user" | "teacher" | "admin" | null): TrpcContext {
  const now = new Date();
  return {
    user: role ? {
      id: 42,
      openId: "local-authorization-test",
      email: "authorization-test@example.invalid",
      name: "Authorization Test",
      loginMethod: "manus",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    } : null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("staff authorization boundaries (no database writes)", () => {
  it("denies a normal signed-in user invitation and upload privileges", async () => {
    const caller = appRouter.createCaller(contextFor("user"));

    await expect(caller.staff.issueInvite()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.staffContent.beginUpload({
      classKey: "class-9",
      subject: "English",
      title: "Practice worksheet",
      chapter: "Sample chapter",
      fileName: "worksheet.pdf",
      mimeType: "application/pdf",
      byteSize: 100,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.staffContent.completeUpload({ objectKey: "study-resources/not-owned.pdf" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.staffContent.publishUpload({ id: 1 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies unauthenticated invite access", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.staff.issueInvite()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lets only the portal owner publish teacher-submitted current affairs", async () => {
    const caller = appRouter.createCaller(contextFor("teacher"));
    await expect(caller.staffContent.setCurrentAffairStatus({ id: 1, status: "published" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
