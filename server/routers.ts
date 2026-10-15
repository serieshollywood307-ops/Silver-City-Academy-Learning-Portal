import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { notesRouter } from "./modules/notes";
import { portalRouter } from "./modules/portal";
import { quizzesRouter } from "./modules/quizzes";
import { staffContentRouter } from "./modules/staffContent";
import { staffRouter } from "./modules/staff";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  portal: portalRouter,
  notes: notesRouter,
  quizzes: quizzesRouter,
  staff: staffRouter,
  staffContent: staffContentRouter,
});

export type AppRouter = typeof appRouter;
