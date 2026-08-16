/**
 * Tasks API
 * ---------
 * GET  /api/tasks?status=&category=&priority=&parentId=
 * POST /api/tasks  — create task with enhanced fields
 */
import { db } from "@/lib/db";
import { sanitizeText, rateLimit } from "@/utils/validation";
import { ok, fail, unauthorized } from "@/utils/api-response";
import { getAuth, parseJsonBody } from "@/lib/route-helpers";

const VALID_STATUSES = new Set(["ACTIVE", "DONE", "CANCELLED"]);
const VALID_CATEGORIES = new Set([
  "general",
  "study",
  "work",
  "exercise",
  "reading",
  "personal",
  "project",
]);
const VALID_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const VALID_RECURRENCE = new Set(["none", "daily", "weekly", "monthly"]);

const MAX_TASKS_PER_MIN = 20;

export async function GET(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const category = url.searchParams.get("category") || undefined;
  const priority = url.searchParams.get("priority") || undefined;
  const parentId = url.searchParams.get("parentId") || undefined;
  const withSubtasks = url.searchParams.get("withSubtasks") === "true";

  const where: Record<string, unknown> = { userId: user.id };
  if (status && VALID_STATUSES.has(status)) where.status = status;
  if (category && VALID_CATEGORIES.has(category)) where.category = category;
  if (priority && VALID_PRIORITIES.has(priority)) where.priority = priority;
  if (parentId) {
    where.parentId = parentId === "null" ? null : parentId;
  } else {
    // By default, only top-level tasks (no parent) — subtasks fetched separately
    where.parentId = null;
  }

  const tasks = await db.task.findMany({
    where,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      targetSeconds: true,
      status: true,
      totalSeconds: true,
      color: true,
      category: true,
      priority: true,
      tags: true,
      dueDate: true,
      recurrence: true,
      parentId: true,
      order: true,
      pomodoroCount: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { timeEntries: { where: { status: "COMPLETED" } } } },
      ...(withSubtasks
        ? {
            subtasks: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                status: true,
                totalSeconds: true,
                color: true,
                priority: true,
                order: true,
              },
            },
          }
        : {}),
    },
  });

  const res = ok({ tasks });
  return applyRefresh(res);
}

export async function POST(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const rl = rateLimit(`task:${user.id}`, MAX_TASKS_PER_MIN, 60 * 1000);
  if (!rl.ok) {
    return fail("در حال ایجاد تسک‌های زیاد. کمی صبر کنید.", 429, {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const body = await parseJsonBody<{
    title?: string;
    description?: string;
    targetSeconds?: number;
    color?: string;
    category?: string;
    priority?: string;
    tags?: string[];
    dueDate?: string;
    recurrence?: string;
    parentId?: string;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const title = sanitizeText(body.title || "").slice(0, 100);
  if (!title) return fail("عنوان الزامی است", 400);

  const description = body.description
    ? sanitizeText(body.description).slice(0, 1000)
    : null;
  const targetSeconds =
    typeof body.targetSeconds === "number" && body.targetSeconds > 0
      ? Math.min(body.targetSeconds, 24 * 3600)
      : 0;
  const color =
    typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)
      ? body.color
      : "#e0cba8";
  const category = VALID_CATEGORIES.has(body.category || "")
    ? body.category!
    : "general";
  const priority = VALID_PRIORITIES.has(body.priority || "")
    ? body.priority!
    : "medium";
  const tags = Array.isArray(body.tags)
    ? body.tags
        .map((t) => sanitizeText(t).toLowerCase())
        .filter((t) => t.length >= 2 && t.length <= 30)
        .slice(0, 10)
        .join(",")
    : "";
  const dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (dueDate && (Number.isNaN(dueDate.getTime()) || dueDate < new Date(0))) {
    return fail("تاریخ سررسید نامعتبر است", 400);
  }
  const recurrence = VALID_RECURRENCE.has(body.recurrence || "")
    ? body.recurrence!
    : "none";
  const parentId = body.parentId || null;

  // If parentId is provided, verify it belongs to the user
  if (parentId) {
    const parent = await db.task.findUnique({
      where: { id: parentId },
      select: { userId: true },
    });
    if (!parent || parent.userId !== user.id)
      return fail("تسک والد نامعتبر است", 400);
  }

  const task = await db.task.create({
    data: {
      userId: user.id,
      title,
      description,
      targetSeconds,
      color,
      category,
      priority,
      tags,
      dueDate,
      recurrence,
      parentId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      targetSeconds: true,
      status: true,
      totalSeconds: true,
      color: true,
      category: true,
      priority: true,
      tags: true,
      dueDate: true,
      recurrence: true,
      parentId: true,
      order: true,
      pomodoroCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const res = ok({ task });
  return applyRefresh(res);
}
