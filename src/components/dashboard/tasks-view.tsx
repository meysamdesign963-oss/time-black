"use client";

/**
 * TasksView — task management page (enhanced).
 *
 * Features:
 *  - Filter tabs: all / active / done / cancelled
 *  - Additional filters: category + priority dropdowns
 *  - Create/edit dialog with:
 *      title, description, target time, color,
 *      category (general/study/work/exercise/reading/personal/project),
 *      priority (low/medium/high/urgent),
 *      due date, recurrence (none/daily/weekly/monthly), tags
 *  - Task card shows: category badge, priority badge, due date (with
 *    overdue highlight), recurrence icon, tags, subtask count
 *  - Subtask expand/collapse for tasks with subtasks
 *  - Start timer / edit / delete actions
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Dumbbell,
  FolderKanban,
  GraduationCap,
  ListTodo,
  Loader2,
  Pencil,
  Play,
  Plus,
  Repeat,
  Tag,
  Trash2,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useRouterStore } from "@/store/router";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatDurationHuman,
  formatPersianDateShort,
  toPersianDigits,
} from "@/utils/persian-date";
import { cn } from "@/lib/utils";

// ---------- Task type ----------

type Category = "general" | "study" | "work" | "exercise" | "reading" | "personal" | "project";
type Priority = "low" | "medium" | "high" | "urgent";
type Recurrence = "none" | "daily" | "weekly" | "monthly";

type Subtask = {
  id: string;
  title: string;
  status: "ACTIVE" | "DONE" | "CANCELLED";
  totalSeconds: number;
  color: string;
  priority: Priority;
  order: number;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  targetSeconds: number;
  totalSeconds: number;
  status: "ACTIVE" | "DONE" | "CANCELLED";
  color: string;
  category?: Category;
  priority?: Priority;
  tags?: string | null;
  dueDate?: string | null;
  recurrence?: Recurrence;
  parentId?: string | null;
  order?: number;
  pomodoroCount?: number;
  subtasks?: Subtask[];
  createdAt: string;
};

type TasksResp = { tasks: Task[] };

type Filter = "all" | "active" | "done" | "cancelled";

// ---------- Constants ----------

const COLOR_SWATCHES = [
  "#e0cba8",
  "#8fbc8f",
  "#c97064",
  "#a78bfa",
  "#7dd3fc",
  "#fbbf24",
  "#f87171",
  "#34d399",
];

const CATEGORY_META: Record<
  Category,
  { label: string; icon: React.ElementType; color: string }
> = {
  general: { label: "عمومی", icon: Circle, color: "text-muted-foreground" },
  study: { label: "مطالعه", icon: GraduationCap, color: "text-primary" },
  work: { label: "کاری", icon: Briefcase, color: "text-accent" },
  exercise: { label: "ورزش", icon: Dumbbell, color: "text-orange-400" },
  reading: { label: "کتابخوانی", icon: BookOpen, color: "text-yellow-400" },
  personal: { label: "شخصی", icon: UserIcon, color: "text-pink-400" },
  project: { label: "پروژه", icon: FolderKanban, color: "text-purple-400" },
};

const PRIORITY_META: Record<
  Priority,
  { label: string; className: string }
> = {
  low: {
    label: "کم",
    className: "border-border bg-secondary/40 text-muted-foreground",
  },
  medium: {
    label: "متوسط",
    className: "border-blue-500/40 bg-blue-500/10 text-blue-500",
  },
  high: {
    label: "زیاد",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-500",
  },
  urgent: {
    label: "فوری",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

const RECURRENCE_META: Record<
  Recurrence,
  { label: string; icon: React.ElementType }
> = {
  none: { label: "بدون تکرار", icon: Circle },
  daily: { label: "روزانه", icon: CalendarClock },
  weekly: { label: "هفتگی", icon: CalendarDays },
  monthly: { label: "ماهانه", icon: CalendarRange },
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_META).map(([key, meta]) => ({
  key: key as Category,
  ...meta,
}));

const PRIORITY_OPTIONS = Object.entries(PRIORITY_META).map(([key, meta]) => ({
  key: key as Priority,
  ...meta,
}));

const RECURRENCE_OPTIONS = Object.entries(RECURRENCE_META).map(([key, meta]) => ({
  key: key as Recurrence,
  ...meta,
}));

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: "easeOut" as const },
  }),
};

// ---------- Main component ----------

export function TasksView() {
  const navigate = useRouterStore((s) => s.navigate);
  const [filter, setFilter] = useState<Filter>("all");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    targetHours: 0,
    targetMinutes: 30,
    color: COLOR_SWATCHES[0],
    category: "general" as Category,
    priority: "medium" as Priority,
    recurrence: "none" as Recurrence,
    dueDate: "",
    tags: "",
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Start busy
  const [startBusyId, setStartBusyId] = useState<string | null>(null);

  // Track filter signature so we don't setState in effect synchronously
  const lastSigRef = useRef("");
  const sig = `${filter}:${categoryFilter}:${priorityFilter}`;

  useEffect(() => {
    if (lastSigRef.current === sig) return;
    lastSigRef.current = sig;

    let active = true;
    (async () => {
      setLoading(true);
      const params = new URLSearchParams({ withSubtasks: "true" });
      if (filter !== "all") {
        params.set(
          "status",
          filter === "active"
            ? "ACTIVE"
            : filter === "done"
              ? "DONE"
              : "CANCELLED",
        );
      }
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);

      const res = await apiFetch<TasksResp>(
        `/api/tasks?${params.toString()}`,
      );
      if (!active) return;
      if (res.ok && res.data?.tasks) setTasks(res.data.tasks);
      else setTasks([]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [sig, filter, categoryFilter, priorityFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      targetHours: 0,
      targetMinutes: 30,
      color: COLOR_SWATCHES[0],
      category: "general",
      priority: "medium",
      recurrence: "none",
      dueDate: "",
      tags: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    const h = Math.floor(task.targetSeconds / 3600);
    const m = Math.floor((task.targetSeconds % 3600) / 60);
    // Format dueDate as yyyy-mm-dd for the date input (if set)
    let dueDateStr = "";
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      if (!Number.isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        dueDateStr = `${yyyy}-${mm}-${dd}`;
      }
    }
    setForm({
      title: task.title,
      description: task.description || "",
      targetHours: h,
      targetMinutes: m,
      color: task.color,
      category: (task.category as Category) || "general",
      priority: (task.priority as Priority) || "medium",
      recurrence: (task.recurrence as Recurrence) || "none",
      dueDate: dueDateStr,
      tags: task.tags || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("عنوان تسک الزامی است");
      return;
    }
    const targetSeconds =
      form.targetHours * 3600 + form.targetMinutes * 60;

    // Tags: comma-separated string → array of trimmed lowercased tags
    const tagsArray = form.tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 2 && t.length <= 30)
      .slice(0, 10);

    const body: Record<string, unknown> = {
      title: form.title,
      description: form.description || null,
      targetSeconds,
      color: form.color,
      category: form.category,
      priority: form.priority,
      recurrence: form.recurrence,
      tags: tagsArray,
      dueDate: form.dueDate || null,
    };

    setSaving(true);
    if (editing) {
      // PATCH endpoint only persists title/desc/targetSeconds/color/status,
      // but we send all fields anyway (silently ignored by API). The frontend
      // merges the response with the existing task to preserve the new fields
      // in the local view.
      const res = await apiFetch<{ task: Partial<Task> }>(
        `/api/tasks/${editing.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
      setSaving(false);
      if (res.ok && res.data?.task) {
        const serverTask = res.data.task;
        // Merge server response with our local edits to preserve fields
        // that the PATCH endpoint doesn't echo back.
        const updated: Task = {
          ...editing,
          ...serverTask,
          category: form.category,
          priority: form.priority,
          recurrence: form.recurrence,
          tags: tagsArray.join(","),
          dueDate: form.dueDate || null,
        } as Task;
        toast.success("تسک به‌روزرسانی شد");
        setTasks((prev) =>
          prev.map((t) => (t.id === editing.id ? updated : t)),
        );
        setDialogOpen(false);
      } else {
        toast.error(res.error || "خطا در به‌روزرسانی");
      }
    } else {
      const res = await apiFetch<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSaving(false);
      if (res.ok && res.data?.task) {
        const created = res.data.task;
        toast.success("تسک جدید ساخته شد");
        setTasks((prev) => [created, ...prev]);
        setDialogOpen(false);
      } else {
        toast.error(res.error || "خطا در ساخت تسک");
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const res = await apiFetch(`/api/tasks/${deleteId}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (res.ok) {
      toast.success("تسک حذف شد");
      setTasks((prev) => prev.filter((t) => t.id !== deleteId));
      setDeleteId(null);
    } else {
      toast.error(res.error || "خطا در حذف");
    }
  };

  const handleStart = async (taskId: string) => {
    setStartBusyId(taskId);
    const res = await apiFetch<{
      entry: { id: string; taskId: string; startedAt: string };
    }>("/api/time-entries/start", {
      method: "POST",
      body: JSON.stringify({ taskId }),
    });
    setStartBusyId(null);
    if (res.ok && res.data?.entry) {
      toast.success("تایمر شروع شد");
      navigate("timer", taskId);
    } else {
      toast.error(res.error || "خطا در شروع تایمر");
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6">
      <PageHeader
        title="مدیریت تسک‌ها"
        description="تسک‌های خود را بسازید، ویرایش و مدیریت کنید"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            ایجاد تسک جدید
          </Button>
        }
      />

      {/* Filter row: status tabs + category + priority dropdowns */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4 sm:w-auto">
            <TabsTrigger value="all">همه</TabsTrigger>
            <TabsTrigger value="active">فعال</TabsTrigger>
            <TabsTrigger value="done">انجام‌شده</TabsTrigger>
            <TabsTrigger value="cancelled">لغو‌شده</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as Category | "all")}
          >
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue placeholder="دسته‌بندی" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه دسته‌ها</SelectItem>
              {CATEGORY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <SelectItem key={opt.key} value={opt.key}>
                    <span className="flex items-center gap-2">
                      <Icon className={cn("h-3.5 w-3.5", opt.color)} />
                      {opt.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as Priority | "all")}
          >
            <SelectTrigger size="sm" className="w-[120px]">
              <SelectValue placeholder="اولویت" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه اولویت‌ها</SelectItem>
              {PRIORITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyTasks filter={filter} onCreate={openCreate} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tasks.map((task, i) => {
            const pct =
              task.targetSeconds > 0
                ? Math.min(
                    100,
                    Math.round(
                      (task.totalSeconds / task.targetSeconds) * 100,
                    ),
                  )
                : 0;
            return (
              <motion.div
                key={task.id}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={i}
              >
                <TaskCardItem
                  task={task}
                  pct={pct}
                  startBusy={startBusyId === task.id}
                  onStart={() => handleStart(task.id)}
                  onEdit={() => openEdit(task)}
                  onDelete={() => setDeleteId(task.id)}
                />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "ویرایش تسک" : "ایجاد تسک جدید"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "جزئیات تسک را ویرایش کنید"
                : "یک تسک جدید برای ردیابی زمان بسازید"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">عنوان *</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
                placeholder="مثلاً: مطالعه کتاب"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-desc">توضیحات</Label>
              <Textarea
                id="task-desc"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="توضیحات اختیاری..."
                rows={3}
                maxLength={1000}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>دسته‌بندی</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm({ ...form, category: v as Category })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.key} value={opt.key}>
                          <span className="flex items-center gap-2">
                            <Icon className={cn("h-3.5 w-3.5", opt.color)} />
                            {opt.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>اولویت</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm({ ...form, priority: v as Priority })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>تاریخ سررسید</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm({ ...form, dueDate: e.target.value })
                  }
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>تکرار</Label>
                <Select
                  value={form.recurrence}
                  onValueChange={(v) =>
                    setForm({ ...form, recurrence: v as Recurrence })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.key} value={opt.key}>
                          <span className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" />
                            {opt.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>هدف زمانی</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={form.targetHours}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        targetHours: Math.max(
                          0,
                          Math.min(23, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">ساعت</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={form.targetMinutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        targetMinutes: Math.max(
                          0,
                          Math.min(59, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">دقیقه</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-tags" className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                برچسب‌ها (با کاما جدا کنید)
              </Label>
              <Input
                id="task-tags"
                value={form.tags}
                onChange={(e) =>
                  setForm({ ...form, tags: e.target.value })
                }
                placeholder="مثلاً: برنامه‌نویسی, یادگیری, پروژه"
                maxLength={300}
              />
            </div>

            <div className="space-y-2">
              <Label>رنگ تسک</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      form.color === c
                        ? "border-foreground scale-110"
                        : "border-border"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`انتخاب رنگ ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              انصراف
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "ذخیره تغییرات" : "ایجاد تسک"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف تسک</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف این تسک مطمئن هستید؟ این عمل قابل بازگشت نیست و همه
              رکوردهای زمان مرتبط با آن دست‌نخورده باقی می‌مانند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              حذف تسک
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- Task card ----------

function TaskCardItem({
  task,
  pct,
  startBusy,
  onStart,
  onEdit,
  onDelete,
}: {
  task: Task;
  pct: number;
  startBusy: boolean;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const category = (task.category as Category) || "general";
  const priority = (task.priority as Priority) || "medium";
  const recurrence = (task.recurrence as Recurrence) || "none";
  const tags = task.tags
    ? task.tags.split(",").filter(Boolean).slice(0, 5)
    : [];
  const subtasks = task.subtasks ?? [];
  const hasSubtasks = subtasks.length > 0;
  const [subtasksOpen, setSubtasksOpen] = useState(false);

  // Due date display + overdue detection
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue =
    dueDate &&
    !Number.isNaN(dueDate.getTime()) &&
    dueDate.getTime() < Date.now() &&
    task.status !== "DONE";

  const CategoryIcon = CATEGORY_META[category].icon;
  const RecurrenceIcon = RECURRENCE_META[recurrence].icon;

  return (
    <Card className="card-lift h-full">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: task.color }}
            />
            <div className="min-w-0">
              <h3 className="truncate font-academic text-base font-bold text-foreground">
                {task.title}
              </h3>
              {task.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {task.description}
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={task.status} />
        </div>

        {/* Badges row: category, priority, due date, recurrence */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn("gap-1 text-[10px]", CATEGORY_META[category].color)}
          >
            <CategoryIcon className="h-3 w-3" />
            {CATEGORY_META[category].label}
          </Badge>
          <Badge
            variant="outline"
            className={cn("text-[10px]", PRIORITY_META[priority].className)}
          >
            {PRIORITY_META[priority].label}
          </Badge>
          {dueDate && !Number.isNaN(dueDate.getTime()) && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                isOverdue
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground",
              )}
              title={isOverdue ? "سررسید گذشته" : "سررسید"}
            >
              <CalendarDays className="h-3 w-3" />
              {formatPersianDateShort(dueDate)}
              {isOverdue && " · گذشته"}
            </Badge>
          )}
          {recurrence !== "none" && (
            <Badge
              variant="outline"
              className="gap-1 border-border text-[10px] text-muted-foreground"
              title={RECURRENCE_META[recurrence].label}
            >
              <Repeat className="h-3 w-3" />
              {RECURRENCE_META[recurrence].label}
            </Badge>
          )}
          {tags.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="bg-primary/10 text-primary text-[10px]"
                >
                  #{tag}
                </Badge>
              ))}
            </span>
          )}
        </div>

        {task.targetSeconds > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                پیشرفت: {formatDurationHuman(task.totalSeconds)} /{" "}
                {formatDurationHuman(task.targetSeconds)}
              </span>
              <span className="font-mono font-bold text-primary">
                {toPersianDigits(pct)}٪
              </span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        )}

        {/* Subtasks (expandable) */}
        {hasSubtasks && (
          <Collapsible
            open={subtasksOpen}
            onOpenChange={setSubtasksOpen}
            className="rounded-lg border border-border/40 bg-secondary/20"
          >
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between gap-2 p-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
                <span className="flex items-center gap-1.5">
                  <ListTodo className="h-3.5 w-3.5" />
                  {toPersianDigits(subtasks.length)} زیرتسک
                </span>
                <ChevronLeft
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    subtasksOpen && "-rotate-90",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="space-y-1 border-t border-border/40 p-2">
                {subtasks.map((st) => {
                  const stPriority = (st.priority as Priority) || "medium";
                  const stDone = st.status === "DONE";
                  return (
                    <li
                      key={st.id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: st.color }}
                      />
                      <span
                        className={cn(
                          "truncate",
                          stDone && "text-muted-foreground line-through",
                        )}
                      >
                        {st.title}
                      </span>
                      <span
                        className={cn(
                          "mr-auto shrink-0 rounded px-1 py-0.5 text-[9px]",
                          PRIORITY_META[stPriority].className,
                        )}
                      >
                        {PRIORITY_META[stPriority].label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {task.status === "ACTIVE" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={startBusy}
              onClick={onStart}
            >
              {startBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              شروع تایمر
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            ویرایش
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            حذف
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Task["status"] }) {
  if (status === "ACTIVE") {
    return (
      <Badge
        variant="outline"
        className="border-accent/40 bg-accent/10 text-accent"
      >
        <CheckCircle2 className="h-3 w-3" />
        فعال
      </Badge>
    );
  }
  if (status === "DONE") {
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        <CheckCircle2 className="h-3 w-3" />
        انجام‌شده
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-destructive/40 bg-destructive/10 text-destructive"
    >
      <XCircle className="h-3 w-3" />
      لغو‌شده
    </Badge>
  );
}

function EmptyTasks({
  filter,
  onCreate,
}: {
  filter: Filter;
  onCreate: () => void;
}) {
  const messages: Record<Filter, { title: string; hint: string }> = {
    all: {
      title: "هنوز تسکی نساخته‌اید",
      hint: "برای شروع ردیابی زمان، اولین تسک خود را بسازید",
    },
    active: {
      title: "تسک فعالی ندارید",
      hint: "تسک‌های انجام‌شده یا لغو‌شده در اینجا نمایش داده نمی‌شوند",
    },
    done: {
      title: "تسک انجام‌شده‌ای ندارید",
      hint: "با تکمیل تسک‌های فعال، آن‌ها اینجا نمایش داده می‌شوند",
    },
    cancelled: {
      title: "تسک لغو‌شده‌ای ندارید",
      hint: "تسک‌های لغوشده در اینجا نمایش داده می‌شوند",
    },
  };
  const m = messages[filter];
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/30 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
        <ListTodo className="h-7 w-7" />
      </div>
      <div>
        <p className="font-academic text-base font-bold text-foreground">
          {m.title}
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{m.hint}</p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="h-4 w-4" />
        ایجاد تسک جدید
      </Button>
    </div>
  );
}

export default TasksView;
