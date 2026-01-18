import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const identityRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        bio: z.string().min(1),
        avatar: z.string().optional(),
        modelProvider: z.string().default("openai"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.identity.create({
        data: {
          name: input.name,
          bio: input.bio,
          avatar: input.avatar,
          modelProvider: input.modelProvider,
        },
      });
    }),

  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.identity.findMany({
      orderBy: { createdAt: "desc" },
    });
  }),
});
