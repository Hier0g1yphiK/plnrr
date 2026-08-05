"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChecklistStateSchema, OrganizerStateSchema } from "@/lib/schemas";
import type { z } from "zod";
import type {
  ChecklistState,
  OrganizerState,
  Template,
  ActiveChecklist,
  TaskCard,
} from "@/lib/types";
import { formatZodError } from "@/lib/format-zod-error";

// === Load User Data ===

export async function loadUserData(): Promise<{
  checklistState: ChecklistState;
  organizerState: OrganizerState;
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  // Fetch templates with categories and items
  const dbTemplates = await prisma.checklistTemplate.findMany({
    where: { userId },
    include: {
      categories: { orderBy: { order: "asc" } },
      items: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Map DB rows to client Template shape
  const templates: Template[] = dbTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    categories: t.categories.map((c) => ({
      id: c.id,
      name: c.name,
      order: c.order,
    })),
    items: t.items.map((i) => ({
      id: i.id,
      text: i.text,
      categoryId: i.categoryId,
      minutesBefore: i.minutesBefore,
    })),
    createdAt: t.createdAt.toISOString(),
  }));

  // Fetch active checklist
  const dbActive = await prisma.activeChecklist.findUnique({
    where: { userId },
  });

  const activeChecklist: ActiveChecklist | null = dbActive
    ? {
        templateId: dbActive.templateId,
        items: dbActive.items as unknown as ActiveChecklist["items"],
        streamTime: dbActive.streamTime,
      }
    : null;

  // Fetch task cards
  const dbTasks = await prisma.taskCard.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const tasks: TaskCard[] = dbTasks.map((t) => ({
    id: t.id,
    title: t.title,
    weekday: t.weekday as TaskCard["weekday"],
    typeTag: t.typeTag as TaskCard["typeTag"],
    completed: t.completed,
    recurring: t.recurring,
    createdAt: t.createdAt.toISOString(),
  }));

  return {
    checklistState: {
      version: 1,
      templates,
      activeChecklist,
    },
    organizerState: {
      version: 1,
      tasks,
    },
  };
}

// === Save Checklist State ===

export async function saveChecklistState(
  payload: unknown
): Promise<{ error?: { fields: Array<{ path: string; message: string }> } }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const result = ChecklistStateSchema.safeParse(payload);
  if (!result.success) return { error: formatZodError(result.error) };

  const data = result.data;

  await prisma.$transaction(async (tx) => {
    // Get existing template IDs for this user
    const existingTemplates = await tx.checklistTemplate.findMany({
      where: { userId },
      select: { id: true },
    });
    const existingTemplateIds = new Set(existingTemplates.map((t) => t.id));
    const incomingTemplateIds = new Set(data.templates.map((t) => t.id));

    // Delete templates no longer present in incoming payload
    const templateIdsToDelete = [...existingTemplateIds].filter(
      (id) => !incomingTemplateIds.has(id)
    );
    if (templateIdsToDelete.length > 0) {
      await tx.checklistTemplate.deleteMany({
        where: { id: { in: templateIdsToDelete }, userId },
      });
    }

    // Upsert each template with its categories and items
    for (const template of data.templates) {
      // Upsert the template
      await tx.checklistTemplate.upsert({
        where: { id: template.id },
        create: {
          id: template.id,
          name: template.name,
          nameLower: template.name.toLowerCase(),
          createdAt: new Date(template.createdAt),
          userId,
        },
        update: {
          name: template.name,
          nameLower: template.name.toLowerCase(),
        },
      });

      // Get existing categories for this template
      const existingCategories = await tx.checklistCategory.findMany({
        where: { templateId: template.id },
        select: { id: true },
      });
      const existingCategoryIds = new Set(existingCategories.map((c) => c.id));
      const incomingCategoryIds = new Set(
        template.categories.map((c) => c.id)
      );

      // Delete categories no longer present
      const categoryIdsToDelete = [...existingCategoryIds].filter(
        (id) => !incomingCategoryIds.has(id)
      );
      if (categoryIdsToDelete.length > 0) {
        await tx.checklistCategory.deleteMany({
          where: { id: { in: categoryIdsToDelete }, templateId: template.id },
        });
      }

      // Upsert categories
      for (const category of template.categories) {
        await tx.checklistCategory.upsert({
          where: { id: category.id },
          create: {
            id: category.id,
            name: category.name,
            order: category.order,
            templateId: template.id,
          },
          update: {
            name: category.name,
            order: category.order,
          },
        });
      }

      // Get existing items for this template
      const existingItems = await tx.checklistItem.findMany({
        where: { templateId: template.id },
        select: { id: true },
      });
      const existingItemIds = new Set(existingItems.map((i) => i.id));
      const incomingItemIds = new Set(template.items.map((i) => i.id));

      // Delete items no longer present
      const itemIdsToDelete = [...existingItemIds].filter(
        (id) => !incomingItemIds.has(id)
      );
      if (itemIdsToDelete.length > 0) {
        await tx.checklistItem.deleteMany({
          where: { id: { in: itemIdsToDelete }, templateId: template.id },
        });
      }

      // Upsert items
      for (const item of template.items) {
        await tx.checklistItem.upsert({
          where: { id: item.id },
          create: {
            id: item.id,
            text: item.text,
            minutesBefore: item.minutesBefore,
            templateId: template.id,
            categoryId: item.categoryId,
          },
          update: {
            text: item.text,
            minutesBefore: item.minutesBefore,
            categoryId: item.categoryId,
          },
        });
      }
    }

    // Sync active checklist
    if (data.activeChecklist) {
      await tx.activeChecklist.upsert({
        where: { userId },
        create: {
          userId,
          templateId: data.activeChecklist.templateId,
          streamTime: data.activeChecklist.streamTime,
          items: data.activeChecklist.items as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
        update: {
          templateId: data.activeChecklist.templateId,
          streamTime: data.activeChecklist.streamTime,
          items: data.activeChecklist.items as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
    } else {
      // If no active checklist in payload, delete existing one
      await tx.activeChecklist.deleteMany({
        where: { userId },
      });
    }
  });

  return {};
}

// === Save Organizer State ===

export async function saveOrganizerState(
  payload: unknown
): Promise<{ error?: { fields: Array<{ path: string; message: string }> } }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const result = OrganizerStateSchema.safeParse(payload);
  if (!result.success) return { error: formatZodError(result.error) };

  const data = result.data;

  await prisma.$transaction(async (tx) => {
    // Get existing task card IDs for this user
    const existingTasks = await tx.taskCard.findMany({
      where: { userId },
      select: { id: true },
    });
    const existingTaskIds = new Set(existingTasks.map((t) => t.id));
    const incomingTaskIds = new Set(data.tasks.map((t) => t.id));

    // Delete task cards no longer present in incoming payload
    const taskIdsToDelete = [...existingTaskIds].filter(
      (id) => !incomingTaskIds.has(id)
    );
    if (taskIdsToDelete.length > 0) {
      await tx.taskCard.deleteMany({
        where: { id: { in: taskIdsToDelete }, userId },
      });
    }

    // Upsert each task card
    for (const task of data.tasks) {
      await tx.taskCard.upsert({
        where: { id: task.id },
        create: {
          id: task.id,
          title: task.title,
          weekday: task.weekday,
          typeTag: task.typeTag,
          completed: task.completed,
          recurring: task.recurring,
          createdAt: new Date(task.createdAt),
          userId,
        },
        update: {
          title: task.title,
          weekday: task.weekday,
          typeTag: task.typeTag,
          completed: task.completed,
          recurring: task.recurring,
        },
      });
    }
  });

  return {};
}

// === Import User Data ===

export async function importUserData(
  checklistData: unknown,
  organizerData: unknown
): Promise<{
  error?: { fields: Array<{ path: string; message: string }> };
  dataset?: "checklist" | "organizer";
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  // Validate both payloads
  const checklistResult = ChecklistStateSchema.safeParse(checklistData);
  if (!checklistResult.success) {
    return { error: formatZodError(checklistResult.error), dataset: "checklist" };
  }

  const organizerResult = OrganizerStateSchema.safeParse(organizerData);
  if (!organizerResult.success) {
    return { error: formatZodError(organizerResult.error), dataset: "organizer" };
  }

  const checklist = checklistResult.data;
  const organizer = organizerResult.data;

  await prisma.$transaction(async (tx) => {
    // Delete all existing data for this user (import replaces everything)
    await tx.activeChecklist.deleteMany({ where: { userId } });
    await tx.checklistItem.deleteMany({
      where: { template: { userId } },
    });
    await tx.checklistCategory.deleteMany({
      where: { template: { userId } },
    });
    await tx.checklistTemplate.deleteMany({ where: { userId } });
    await tx.taskCard.deleteMany({ where: { userId } });

    // Write checklist templates with categories and items
    for (const template of checklist.templates) {
      await tx.checklistTemplate.create({
        data: {
          id: template.id,
          name: template.name,
          nameLower: template.name.toLowerCase(),
          createdAt: new Date(template.createdAt),
          userId,
        },
      });

      for (const category of template.categories) {
        await tx.checklistCategory.create({
          data: {
            id: category.id,
            name: category.name,
            order: category.order,
            templateId: template.id,
          },
        });
      }

      for (const item of template.items) {
        await tx.checklistItem.create({
          data: {
            id: item.id,
            text: item.text,
            minutesBefore: item.minutesBefore,
            templateId: template.id,
            categoryId: item.categoryId,
          },
        });
      }
    }

    // Write active checklist if present
    if (checklist.activeChecklist) {
      await tx.activeChecklist.create({
        data: {
          userId,
          templateId: checklist.activeChecklist.templateId,
          streamTime: checklist.activeChecklist.streamTime,
          items: checklist.activeChecklist.items as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
    }

    // Write task cards
    for (const task of organizer.tasks) {
      await tx.taskCard.create({
        data: {
          id: task.id,
          title: task.title,
          weekday: task.weekday,
          typeTag: task.typeTag,
          completed: task.completed,
          recurring: task.recurring,
          createdAt: new Date(task.createdAt),
          userId,
        },
      });
    }

    // Set importCompleted flag
    await tx.user.update({
      where: { id: userId },
      data: { importCompleted: true },
    });
  });

  return {};
}

// === Check Import Eligibility ===

export async function checkImportEligibility(): Promise<{
  eligible: boolean;
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const [templateCount, taskCount, user] = await Promise.all([
    prisma.checklistTemplate.count({ where: { userId } }),
    prisma.taskCard.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { importCompleted: true },
    }),
  ]);

  return {
    eligible: templateCount === 0 && taskCount === 0 && !user?.importCompleted,
  };
}
