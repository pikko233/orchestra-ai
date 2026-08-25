import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import { db } from "@/db";
import { project } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import z from "zod";

export const projectProcedure = createTRPCRouter({
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const { id, ...rest } = input;
      const [updatedProject] = await db
        .update(project)
        .set({
          ...rest,
        })
        .where(and(eq(project.id, id), eq(project.userId, userId)))
        .returning();

      if (!updatedProject) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "项目修改失败" });
      }

      return updatedProject;
    }),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const { name } = input;

      const [createdProject] = await db
        .insert(project)
        .values({
          name,
          userId,
        })
        .returning();

      if (!createdProject) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "项目创建失败" });
      }

      return createdProject;
    }),

  findOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const { id } = input;

      const [existingProject] = await db
        .select()
        .from(project)
        .where(and(eq(project.id, id), eq(project.userId, userId)));

      if (!existingProject) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "未找到项目" });
      }

      return existingProject;
    }),

  findMany: protectedProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(DEFAULT_PAGE),
          pageSize: z
            .number()
            .min(MIN_PAGE_SIZE)
            .max(MAX_PAGE_SIZE)
            .default(DEFAULT_PAGE_SIZE),
          search: z.string().nullish(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const {
        page = DEFAULT_PAGE,
        pageSize = DEFAULT_PAGE_SIZE,
        search,
      } = input ?? {};
      const condition = and(
        eq(project.userId, userId),
        search ? ilike(project.name, `%${search}%`) : undefined,
      );

      const projects = await db
        .select()
        .from(project)
        .where(condition)
        .orderBy(desc(project.updatedAt), desc(project.id))
        .offset((page - 1) * pageSize)
        .limit(pageSize);

      const [total] = await db
        .select({ count: count() })
        .from(project)
        .where(condition);

      const totalPages = Math.ceil(total.count / pageSize);

      return {
        items: projects,
        total: total.count,
        totalPages,
      };
    }),
});
