"use client";

/**
 * RestrictionsDialog — admin dialog to manage per-user restrictions.
 * Sets canPost / canComment / canMessage / canUpload / canCreateTask
 * toggles + a customNote textarea. Uses Switch components.
 */
import { useEffect, useState } from "react";
import { Lock, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { apiFetch } from "@/utils/api-fetch";

type TargetUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type RestrictionsState = {
  canPost: boolean;
  canComment: boolean;
  canMessage: boolean;
  canUpload: boolean;
  canCreateTask: boolean;
  customNote: string;
};

const DEFAULT_RESTRICTIONS: RestrictionsState = {
  canPost: true,
  canComment: true,
  canMessage: true,
  canUpload: true,
  canCreateTask: true,
  customNote: "",
};

const TOGGLE_FIELDS: {
  key: keyof Omit<RestrictionsState, "customNote">;
  label: string;
  description: string;
}[] = [
  {
    key: "canPost",
    label: "اجازه ارسال پست",
    description: "کاربر می‌تواند پست جدید منتشر کند",
  },
  {
    key: "canComment",
    label: "اجازه کامنت‌گذاری",
    description: "کاربر می‌تواند روی پست‌ها کامنت بگذارد",
  },
  {
    key: "canMessage",
    label: "اجازه پیام‌رسانی",
    description: "کاربر می‌تواند پیام خصوصی بفرستد",
  },
  {
    key: "canUpload",
    label: "اجازه آپلود فایل",
    description: "کاربر می‌تواند تصویر و ویدیو آپلود کند",
  },
  {
    key: "canCreateTask",
    label: "اجازه ایجاد تسک",
    description: "کاربر می‌تواند تسک جدید بسازد",
  },
];

/**
 * Parse the raw restrictions string from the API into a state object.
 * Empty / null / invalid → defaults (everything allowed).
 */
export function parseRestrictions(
  raw: string | null | undefined,
): RestrictionsState {
  if (!raw) return { ...DEFAULT_RESTRICTIONS };
  try {
    const parsed = JSON.parse(raw);
    return {
      canPost: parsed.canPost !== false,
      canComment: parsed.canComment !== false,
      canMessage: parsed.canMessage !== false,
      canUpload: parsed.canUpload !== false,
      canCreateTask: parsed.canCreateTask !== false,
      customNote:
        typeof parsed.customNote === "string" ? parsed.customNote : "",
    };
  } catch {
    return { ...DEFAULT_RESTRICTIONS };
  }
}

/**
 * Returns true if any restriction is set (i.e. user is "restricted").
 */
export function hasRestrictions(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const r = parseRestrictions(raw);
  return (
    !r.canPost ||
    !r.canComment ||
    !r.canMessage ||
    !r.canUpload ||
    !r.canCreateTask ||
    r.customNote.trim().length > 0
  );
}

type RestrictionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: TargetUser | null;
  /** Raw restrictions string from API (User.restrictions field). */
  initialRestrictions?: string | null;
  onSaved?: () => void;
};

export function RestrictionsDialog({
  open,
  onOpenChange,
  user,
  initialRestrictions,
  onSaved,
}: RestrictionsDialogProps) {
  const [state, setState] = useState<RestrictionsState>(DEFAULT_RESTRICTIONS);
  const [saving, setSaving] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Sync state when dialog opens or target changes
  useEffect(() => {
    if (!open) return;
    // Defer state reset to escape the effect body
    const t = setTimeout(() => {
      setState(parseRestrictions(initialRestrictions));
    }, 0);
    return () => clearTimeout(t);
  }, [open, initialRestrictions, user?.id]);

  function update<K extends keyof RestrictionsState>(
    key: K,
    value: RestrictionsState[K],
  ) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const res = await apiFetch(`/api/admin/users/${user.id}/restrictions`, {
      method: "PATCH",
      body: JSON.stringify({
        canPost: state.canPost,
        canComment: state.canComment,
        canMessage: state.canMessage,
        canUpload: state.canUpload,
        canCreateTask: state.canCreateTask,
        customNote: state.customNote,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("محدودیت‌های کاربر به‌روزرسانی شد");
      onOpenChange(false);
      onSaved?.();
    } else {
      toast.error(res.error || "خطا در به‌روزرسانی محدودیت‌ها");
    }
  }

  async function handleClearAll() {
    if (!user) return;
    setClearing(true);
    const res = await apiFetch(`/api/admin/users/${user.id}/restrictions`, {
      method: "DELETE",
    });
    setClearing(false);
    if (res.ok) {
      toast.success("همه محدودیت‌های کاربر حذف شد");
      setClearOpen(false);
      setState({ ...DEFAULT_RESTRICTIONS });
      onOpenChange(false);
      onSaved?.();
    } else {
      toast.error(res.error || "خطا در حذف محدودیت‌ها");
    }
  }

  if (!user) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              مدیریت محدودیت‌ها
            </DialogTitle>
            <DialogDescription>
              دسترسی‌های{" "}
              <span className="font-medium text-foreground">
                {user.displayName}
              </span>{" "}
              (@{user.username}) را مدیریت کنید.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* User chip */}
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
              <Avatar className="h-9 w-9">
                {user.avatarUrl && (
                  <AvatarImage
                    src={user.avatarUrl}
                    alt={user.displayName}
                  />
                )}
                <AvatarFallback className="bg-secondary text-xs">
                  {user.displayName?.charAt(0) || "؟"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user.displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{user.username}
                </p>
              </div>
              {hasRestrictions(initialRestrictions) && (
                <Badge
                  variant="outline"
                  className="border-destructive/40 text-destructive"
                >
                  محدود
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              کلیدها را غیرفعال کنید تا دسترسی مربوطه از کاربر گرفته شود.
            </p>

            {/* Toggle list */}
            <div className="space-y-2">
              {TOGGLE_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{field.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {field.description}
                    </p>
                  </div>
                  <Switch
                    checked={state[field.key]}
                    onCheckedChange={(v) => update(field.key, v)}
                  />
                </div>
              ))}
            </div>

            {/* Custom note */}
            <div className="space-y-1.5">
              <Label htmlFor="custom-note">یادداشت ادمین (اختیاری)</Label>
              <Textarea
                id="custom-note"
                value={state.customNote}
                onChange={(e) => update("customNote", e.target.value)}
                placeholder="یادداشت خصوصی درباره این محدودیت…"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                فقط برای ادمین‌ها قابل مشاهده است.
              </p>
            </div>

            {/* Clear all */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-destructive">
                  حذف همه محدودیت‌ها
                </p>
                <p className="text-xs text-muted-foreground">
                  همه دسترسی‌ها به حالت پیش‌فرض برمی‌گردد.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearOpen(true)}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <ShieldOff className="ml-1 h-4 w-4" />
                حذف همه
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              انصراف
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "در حال ذخیره..." : "ذخیره محدودیت‌ها"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear-all confirmation */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف همه محدودیت‌ها</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف تمام محدودیت‌های{" "}
              <span className="font-medium text-foreground">
                {user.displayName}
              </span>{" "}
              مطمئن هستید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleClearAll();
              }}
              disabled={clearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearing ? "در حال حذف..." : "حذف همه"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
