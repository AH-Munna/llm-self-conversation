import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const roomRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        scenario: z.string().min(1),
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.room.create({
        data: {
          name: input.name,
          scenario: input.scenario,
          isPublic: input.isPublic,
        },
      });
    }),

  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.room.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        participants: {
          include: {
            identity: true,
          },
        },
      },
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.room.findUnique({
        where: { id: input.id },
        include: {
          participants: {
            include: {
              identity: true,
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
               identity: true
            }
          },
        },
      });
    }),

  addParticipant: publicProcedure
    .input(
      z.object({
        roomId: z.string(),
        identityId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.roomParticipant.create({
        data: {
          roomId: input.roomId,
          identityId: input.identityId,
        },
      });
    }),
});
