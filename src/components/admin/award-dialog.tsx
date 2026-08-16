"use client";

/**
 * AwardDialog — shared dialog for awarding a user.
 * Used in AdminUsersView (preselected user) and AdminAwardsView (with user picker).
 */
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
  Award as AwardIcon,
  Crown,
  Medal,
  Star,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/utils/api-fetch";
import { toPersianDigits } from "@/utils/persian-date";
import { cn } from "@/lib/utils";

export type AwardDialogHandle = {
  reset: () => void;
};

type AwardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselected target user (e.g. from admin users table row). */
  preselectedUser?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  /** Called after a successful create. */
  onCreated?: () => void;
};

type UserSearchItem = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type AwardType =
  | "MONTHLY_WINNER"
  | "WEEKLY_WINNER"
  | "TOP_3"
  | "SPECIAL"
  | "ACHIEVEMENT";

type AwardIcon = "trophy" | "medal" | "crown" | "star" | "award";

const TYPE_OPTIONS: { value: AwardType; label: string }[] = [
  { value: "MONTHLY_WINNER", label: "برنده ماهانه" },
  { value: "WEEKLY_WINNER", label: "برنده هفتگی" },
  { value: "TOP_3", label: "نفر برتر" },
  { value: "SPECIAL", label: "دستاورد ویژه" },
  { value: "ACHIEVEMENT", label: "دستاورد" },
];

const ICON_OPTIONS: {
  value: AwardIcon;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "trophy", label: "جام", icon: Trophy },
  { value: "medal", label: "مدال", icon: Medal },
  { value: "crown", label: "تاج", icon: Crown },
  { value: "star", label: "ستاره", icon: Star },
  { value: "award", label: "نشان", icon: AwardIcon },
];

const COLOR_SWATCHES = [
  { name: "طلایی", value: "#e0cba8" },
  { name: "نقره‌ای", value: "#C0C0C0" },
  { name: "برنزی", value: "#CD7F32" },
  { name: "سبز ساجی", value: "#8FBC8F" },
  { name: "تراکوتا", value: "#E89A4F" },
  { name: "بنفش", value: "#C589E8" },
];

const DEFAULT_FORM = {
  userId: "",
  type: "ACHIEVEMENT" as AwardType,
  title: "",
  description: "",
  period: "",
  rank: 1,
  icon: "trophy" as AwardIcon,
  color: "#e0cba8",
};

export const AwardDialog = forwardRef<AwardDialogHandle, AwardDialogProps>(
  function AwardDialog({ open, onOpenChange, preselectedUser, onCreated }, ref) {
    const [form, setForm] = useState({ ...DEFAULT_FORM });
    const [saving, setSaving] = useState(false);

    // User search (when no preselectedUser)
    const [searchQ, setSearchQ] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<UserSearchItem[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserSearchItem | null>(
      null,
    );

    useImperativeHandle(ref, () => ({
      reset: () => {
        setForm({ ...DEFAULT_FORM });
        setSelectedUser(null);
        setSearchQ("");
        setSearchResults([]);
      },
    }));

    // Reset form + sync with preselectedUser when opening
    useEffect(() => {
      if (!open) return;
      // Defer state reset to escape the effect body (avoids set-state-in-effect warnings)
      const t = setTimeout(() => {
        setForm({ ...DEFAULT_FORM });
        setSearchQ("");
        setSearchResults([]);
        if (preselectedUser) {
          setSelectedUser({
            id: preselectedUser.id,
            username: preselectedUser.username,
            displayName: preselectedUser.displayName,
            avatarUrl: preselectedUser.avatarUrl,
          });
        } else {
          setSelectedUser(null);
        }
      }, 0);
      return () => clearTimeout(t);
    }, [open, preselectedUser]);

    // Debounced user search
    useEffect(() => {
      if (!open || preselectedUser) return;
      if (!searchQ.trim()) {
        // Defer to escape effect body
        const t = setTimeout(() => setSearchResults([]), 0);
        return () => clearTimeout(t);
      }
      const t = setTimeout(async () => {
        setSearching(true);
        const res = await apiFetch<{ users: UserSearchItem[] }>(
          `/api/admin/users?q=${encodeURIComponent(searchQ.trim())}&limit=10`,
        );
        if (res.ok && res.data?.users) {
          setSearchResults(res.data.users);
        } else {
          setSearchResults([]);
        }
        setSearching(false);
      }, 300);
      return () => clearTimeout(t);
    }, [searchQ, open, preselectedUser]);

    function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
      setForm((f) => ({ ...f, [key]: value }));
    }

    async function handleSave() {
      const targetUser = preselectedUser || selectedUser;
      if (!targetUser) {
        toast.error("یک کاربر برای اعطای جایزه انتخاب کنید");
        return;
      }
      if (!form.title.trim()) {
        toast.error("عنوان جایزه الزامی است");
        return;
      }
      setSaving(true);
      const res = await apiFetch("/api/admin/awards", {
        method: "POST",
        body: JSON.stringify({
          userId: targetUser.id,
          type: form.type,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          period: form.period.trim() || undefined,
          rank: form.rank,
          icon: form.icon,
          color: form.color,
        }),
      });
      setSaving(false);
      if (res.ok) {
        toast.success("جایزه با موفقیت اعطا شد");
        onOpenChange(false);
        onCreated?.();
      } else {
        toast.error(res.error || "خطا در اعطای جایزه");
      }
    }

    const targetUser = preselectedUser || selectedUser;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              اعطای جایزه
            </DialogTitle>
            <DialogDescription>
              یک نشان افتخار به کاربر انتخابی اعطا کنید. کاربر از طریق اعلان‌ها
              مطلع خواهد شد.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* User picker / preselected */}
            {preselectedUser ? (
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
                <Avatar className="h-10 w-10">
                  {preselectedUser.avatarUrl && (
                    <AvatarImage
                      src={preselectedUser.avatarUrl}
                      alt={preselectedUser.displayName}
                    />
                  )}
                  <AvatarFallback className="bg-secondary text-xs">
                    {preselectedUser.displayName?.charAt(0) || "؟"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {preselectedUser.displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{preselectedUser.username}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  کاربر انتخاب‌شده
                </Badge>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>انتخاب کاربر</Label>
                {selectedUser ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
                    <Avatar className="h-9 w-9">
                      {selectedUser.avatarUrl && (
                        <AvatarImage
                          src={selectedUser.avatarUrl}
                          alt={selectedUser.displayName}
                        />
                      )}
                      <AvatarFallback className="bg-secondary text-xs">
                        {selectedUser.displayName?.charAt(0) || "؟"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {selectedUser.displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{selectedUser.username}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setSelectedUser(null);
                        setSearchQ("");
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                      placeholder="نام یا نام کاربری را جستجو کنید…"
                    />
                    {searching && (
                      <p className="text-xs text-muted-foreground">
                        در حال جستجو…
                      </p>
                    )}
                    {searchResults.length > 0 && (
                      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-1.5">
                        {searchResults.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              setSelectedUser(u);
                              setSearchQ("");
                              setSearchResults([]);
                            }}
                            className="flex w-full items-center gap-2 rounded-md p-2 text-right transition-colors hover:bg-secondary/60"
                          >
                            <Avatar className="h-7 w-7">
                              {u.avatarUrl && (
                                <AvatarImage
                                  src={u.avatarUrl}
                                  alt={u.displayName}
                                />
                              )}
                              <AvatarFallback className="bg-secondary text-[10px]">
                                {u.displayName?.charAt(0) || "؟"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">
                                {u.displayName}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                @{u.username}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Type */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>نوع جایزه</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => update("type", v as AwardType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>رتبه</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.rank}
                  onChange={(e) =>
                    update("rank", Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label>عنوان جایزه</Label>
              <Input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="مثلاً: برنده ماه مرداد ۱۴۰۵"
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>توضیحات (اختیاری)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="دلیل یا توضیح جایزه را بنویسید…"
                rows={3}
                maxLength={1000}
              />
            </div>

            {/* Period */}
            <div className="space-y-1.5">
              <Label>دوره (اختیاری)</Label>
              <Input
                value={form.period}
                onChange={(e) => update("period", e.target.value)}
                placeholder="مثلاً: 1405-05"
                dir="ltr"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                برای فیلتر و نمایش در تالار برندگان استفاده می‌شود.
              </p>
            </div>

            {/* Icon */}
            <div className="space-y-1.5">
              <Label>آیکون</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = form.icon === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update("icon", opt.value)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-secondary/50",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label>رنگ نشان</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((sw) => {
                  const active = form.color.toLowerCase() === sw.value.toLowerCase();
                  return (
                    <button
                      key={sw.value}
                      type="button"
                      onClick={() => update("color", sw.value)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        active
                          ? "border-foreground bg-secondary/60"
                          : "border-border hover:bg-secondary/40",
                      )}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-black/20"
                        style={{ backgroundColor: sw.value }}
                      />
                      {sw.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live preview */}
            {targetUser && form.title && (
              <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                <p className="mb-2 text-xs text-muted-foreground">پیش‌نمایش:</p>
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-lg"
                    style={{
                      backgroundColor: `${form.color}20`,
                      color: form.color,
                      border: `1px solid ${form.color}60`,
                    }}
                  >
                    {(() => {
                      const Icon =
                        ICON_OPTIONS.find((o) => o.value === form.icon)?.icon ||
                        Trophy;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {form.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {targetUser.displayName} · رتبه{" "}
                      {toPersianDigits(form.rank)}
                    </p>
                  </div>
                </div>
              </div>
            )}
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
              disabled={saving || !targetUser || !form.title.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "در حال اعطا..." : "اعطای جایزه"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);
