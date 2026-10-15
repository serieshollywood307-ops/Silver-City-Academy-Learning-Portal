import { randomInt, createHash } from "node:crypto";
import { z } from "zod";
import questionBank from "../../shared/quiz-bank.json";
import { publicProcedure, router } from "../_core/trpc";

const topics = ["All topics", "Science", "History", "Geography", "India & World", "Mathematics"] as const;
type BankQuestion = (typeof questionBank)[number];

function shuffle<T>(values: T[]): T[] {
  const items = [...values];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function stableId(question: BankQuestion) {
  return createHash("sha256").update(`${question.topic}\n${question.prompt}`).digest("hex").slice(0, 16);
}

export const quizzesRouter = router({
  create: publicProcedure.input(z.object({
    topic: z.enum(topics).default("All topics"),
    recentQuestionIds: z.array(z.string().length(16)).max(35).default([]),
  })).mutation(({ input }) => {
    const scoped = input.topic === "All topics"
      ? [...questionBank]
      : questionBank.filter(item => item.topic === input.topic);
    const recent = new Set(input.recentQuestionIds);
    const fresh = scoped.filter(item => !recent.has(stableId(item)));
    const previouslyUsed = scoped.filter(item => recent.has(stableId(item)));
    const questionCount = Math.min(5, scoped.length);
    const selected = [
      ...shuffle(fresh).slice(0, questionCount),
      ...shuffle(previouslyUsed).slice(0, Math.max(0, questionCount - fresh.length)),
    ];

    return shuffle(selected).map(question => {
      const options = shuffle(question.options);
      return {
        id: stableId(question),
        topic: question.topic,
        prompt: question.prompt,
        options,
        correctIndex: options.indexOf(question.answer),
        explanation: question.explanation,
      };
    });
  }),
});
