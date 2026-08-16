"use client";

/**
 * AdminUsersView — paginated user management.
 * Search + role filter + status filter, table of users with role/status
 * badges, dropdown action menu (edit role / block-unblock), confirm
 * dialogs for destructive actions, mask phone/email.
 */
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Key,
  Lock,
  MoreHorizontal,
  Pencil,
  Search,
  ShieldUser,
  Trophy,
  UserCog,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/utils/api-fetch";
import { formatPersianDateShort, toPersianDigits } from "@/utils/persian-date";
import { useAuthStore } from "@/store/auth";
import { RestrictionsDialog, hasRestrictions } from "@/components/admin/restrictions-dialog";
import { AwardDialog } from "@/components/admin/award-dialog";

type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: "BOSS" | "ADMIN" | "USER";
  status: "ACTIVE" | "BLOCKED";
  authMethod: string;
  totalSeconds: number;
  currentRank: number;
  createdAt: string;
  restrictions?: string | null;
  _count: {
    tasks: number;
    timeEntries: number;
    posts: number;
    followers: number;
    followees: number;
    awards?: number;
  };
};

type UsersResp = { users: AdminUser[]; total: number; page: number; limit: number };

const PAGE_SIZE = 20;

function maskValue(v: string | null): string {
  if (!v) return "—";
  if (v.length <= 4) return "•".repeat(v.length);
  return v.slice(0, 2) + "•".repeat(Math.min(v.length - 4, 6)) + v.slice(-2);
}

function roleBadge(role: AdminUser["role"]) {
  if (role === "BOSS") {
    return (
      <Badge className="bg-primary/20 text-primary border border-primary/40">
        رئیس
      </Badge>
    );
  }
  if (role === "ADMIN") {
    return (
      <Badge className="bg-accent/20 text-accent border border-accent/40">
        مدیر
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-muted/40 text-muted-foreground">
      کاربر
    </Badge>
  );
}

function statusBadge(status: AdminUser["status"]) {
  return status === "ACTIVE" ? (
    <Badge className="bg-accent/15 text-accent border border-accent/40 gap-1">
      <CheckCircle2 className="h-3 w-3" />
      فعال
    </Badge>
  ) : (
    <Badge className="bg-destructive/15 text-destructive border border-destructive/40 gap-1">
      <Ban className="h-3 w-3" />
      مسدود
    </Badge>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.35, ease: "easeOut" as const },
  }),
};

export function AdminUsersView() {
  const me = useAuthStore((s) => s.user);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | AdminUser["role"]>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AdminUser["status"]>(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [debouncedQ, setDebouncedQ] = useState("");

  // role edit dialog
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<AdminUser["role"]>("USER");
  const [saving, setSaving] = useState(false);

  // Full profile edit dialog
  const [profileEdit, setProfileEdit] = useState<AdminUser | null>(null);
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    bio: "",
    email: "",
    phone: "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [revokeSessions, setRevokeSessions] = useState(false);

  // block/confirm dialog
  const [confirmTarget, setConfirmTarget] = useState<AdminUser | null>(null);
  const [confirmMode, setConfirmMode] = useState<"block" | "unblock">("block");

  // Restrictions + award dialogs
  const [restrictionsTarget, setRestrictionsTarget] = useState<AdminUser | null>(null);
  const [awardTarget, setAwardTarget] = useState<AdminUser | null>(null);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    const res = await apiFetch<UsersResp>(`/api/admin/users?${params.toString()}`);
    if (res.ok && res.data) {
      // client-side filter for role/status (server doesn't support these filters)
      let users = res.data.users;
      if (roleFilter !== "ALL") users = users.filter((u) => u.role === roleFilter);
      if (statusFilter !== "ALL")
        users = users.filter((u) => u.status === statusFilter);
      setData({ ...res.data, users });
    } else {
      setData(null);
      if (res.error) toast.error(res.error);
    }
    setLoading(false);
  }, [page, debouncedQ, roleFilter, statusFilter]);

  useEffect(() => {
    (async () => {
      await fetchUsers();
    })();
  }, [fetchUsers]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  async function patchUser(
    id: string,
    payload: Record<string, unknown>,
  ) {
    setSaving(true);
    const res = await apiFetch<{ user: AdminUser }>(
      `/api/admin/users/${id}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    setSaving(false);
    if (res.ok) {
      toast.success("کاربر با موفقیت به‌روزرسانی شد");
      await fetchUsers();
    } else {
      toast.error(res.error || "خطا در به‌روزرسانی کاربر");
    }
  }

  function openEdit(u: AdminUser) {
    setEditTarget(u);
    setEditRole(u.role);
  }

  function openProfileEdit(u: AdminUser) {
    setProfileEdit(u);
    setProfileForm({
      displayName: u.displayName,
      bio: "",
      email: u.email || "",
      phone: u.phone || "",
    });
    setNewPassword("");
    setRevokeSessions(false);
  }

  async function saveProfileEdit() {
    if (!profileEdit) return;
    const payload: Record<string, unknown> = {
      displayName: profileForm.displayName,
      bio: profileForm.bio,
      email: profileForm.email || null,
      phone: profileForm.phone || null,
    };
    if (newPassword && newPassword.length >= 8) {
      payload.newPassword = newPassword;
    }
    if (revokeSessions) payload.revokeSessions = true;
    setSaving(true);
    const res = await apiFetch<{ user: AdminUser }>(
      `/api/admin/users/${profileEdit.id}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    setSaving(false);
    if (res.ok) {
      toast.success(
        newPassword
          ? "پروفایل به‌روزرسانی و رمز عبور تغییر کرد — همه سشن‌ها باطل شد"
          : "پروفایل کاربر به‌روزرسانی شد",
      );
      setProfileEdit(null);
      await fetchUsers();
    } else {
      toast.error(res.error || "خطا در به‌روزرسانی پروفایل");
    }
  }

  function openConfirm(u: AdminUser, mode: "block" | "unblock") {
    setConfirmTarget(u);
    setConfirmMode(mode);
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 space-y-6">
      <PageHeader
        title="مدیریت کاربران"
        description="جستجو، فیلتر و مدیریت نقش و وضعیت اعضای پلتفرم"
      />

      {/* Filters */}
      <Card className="glass border-border/60">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجو بر اساس نام، نام کاربری، ایمیل یا موبایل…"
              className="pr-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                setRoleFilter(v as typeof roleFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="نقش" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه نقش‌ها</SelectItem>
                <SelectItem value="BOSS">رئیس</SelectItem>
                <SelectItem value="ADMIN">مدیر</SelectItem>
                <SelectItem value="USER">کاربر</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as typeof statusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="وضعیت" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
                <SelectItem value="ACTIVE">فعال</SelectItem>
                <SelectItem value="BLOCKED">مسدود</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-right">نام</TableHead>
                  <TableHead className="text-right">ایمیل / موبایل</TableHead>
                  <TableHead className="text-right">نقش</TableHead>
                  <TableHead className="text-right">وضعیت</TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    محدودیت / جوایز
                  </TableHead>
                  <TableHead className="text-right">تاریخ عضویت</TableHead>
                  <TableHead className="text-right">اقدامات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-6 w-full rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data || data.users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12">
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/40">
                          <Users className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          هیچ کاربری مطابق با فیلترهای انتخاب‌شده یافت نشد
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.users.map((u, idx) => {
                    const isSelf = me?.id === u.id;
                    const isBossTarget = u.role === "BOSS" && me?.role !== "BOSS";
                    return (
                      <motion.tr
                        key={u.id}
                        custom={idx}
                        variants={fadeUp}
                        initial="hidden"
                        animate="show"
                        className="border-b border-border/40 transition-colors hover:bg-card/40"
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              {u.avatarUrl && (
                                <AvatarImage src={u.avatarUrl} alt={u.displayName} />
                              )}
                              <AvatarFallback className="bg-secondary text-xs">
                                {u.displayName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {u.displayName}
                                {isSelf && (
                                  <span className="mr-1 text-[10px] text-muted-foreground">
                                    (شما)
                                  </span>
                                )}
                              </p>
                              <p className="font-mono text-xs text-muted-foreground">
                                @{u.username}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="font-mono">{maskValue(u.email)}</div>
                          <div className="font-mono">{maskValue(u.phone)}</div>
                        </TableCell>
                        <TableCell>{roleBadge(u.role)}</TableCell>
                        <TableCell>{statusBadge(u.status)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {hasRestrictions(u.restrictions) && (
                              <Badge
                                variant="outline"
                                className="border-destructive/40 text-destructive gap-1"
                              >
                                <Lock className="h-3 w-3" />
                                محدود
                              </Badge>
                            )}
                            {u._count.awards && u._count.awards > 0 ? (
                              <Badge
                                variant="outline"
                                className="border-primary/40 text-primary gap-1"
                              >
                                <Trophy className="h-3 w-3" />
                                {toPersianDigits(u._count.awards)} جایزه
                              </Badge>
                            ) : null}
                            {!hasRestrictions(u.restrictions) &&
                              (!u._count.awards || u._count.awards === 0) && (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatPersianDateShort(new Date(u.createdAt))}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={isBossTarget}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>اقدامات</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openProfileEdit(u)}>
                                <Pencil className="ml-2 h-4 w-4" />
                                ویرایش پروفایل
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(u)}>
                                <UserCog className="ml-2 h-4 w-4" />
                                تغییر نقش
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setRestrictionsTarget(u)}
                              >
                                <Lock className="ml-2 h-4 w-4" />
                                مدیریت محدودیت‌ها
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setAwardTarget(u)}
                              >
                                <Trophy className="ml-2 h-4 w-4" />
                                اعطای جایزه
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {u.status === "ACTIVE" ? (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  disabled={isSelf}
                                  onClick={() => openConfirm(u, "block")}
                                >
                                  <UserX className="ml-2 h-4 w-4" />
                                  مسدودسازی
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-accent focus:text-accent"
                                  onClick={() => openConfirm(u, "unblock")}
                                >
                                  <CheckCircle2 className="ml-2 h-4 w-4" />
                                  فعال‌سازی
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            نمایش{" "}
            <span className="font-mono text-foreground">
              {toPersianDigits(data.users.length)}
            </span>{" "}
            از{" "}
            <span className="font-mono text-foreground">
              {toPersianDigits(data.total)}
            </span>{" "}
            کاربر
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronRight className="h-4 w-4" />
              قبلی
            </Button>
            <span className="font-mono text-xs text-muted-foreground">
              {toPersianDigits(page)} / {toPersianDigits(totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              بعدی
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Role edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldUser className="h-5 w-5 text-primary" />
              ویرایش نقش کاربر
            </DialogTitle>
            <DialogDescription>
              نقش فعلی{" "}
              <span className="font-medium text-foreground">
                {editTarget?.displayName}
              </span>{" "}
              را تغییر دهید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>نقش جدید</Label>
            <Select
              value={editRole}
              onValueChange={(v) => setEditRole(v as AdminUser["role"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">کاربر</SelectItem>
                <SelectItem value="ADMIN">مدیر</SelectItem>
                {me?.role === "BOSS" && <SelectItem value="BOSS">رئیس</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>
              انصراف
            </Button>
            <Button
              disabled={
                saving || !editTarget || editTarget.role === editRole
              }
              onClick={() => {
                if (!editTarget) return;
                patchUser(editTarget.id, { role: editRole });
                setEditTarget(null);
              }}
            >
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile edit dialog */}
      <Dialog
        open={!!profileEdit}
        onOpenChange={(o) => !o && setProfileEdit(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              ویرایش پروفایل کاربر
            </DialogTitle>
            <DialogDescription>
              ویرایش اطلاعات{" "}
              <span className="font-medium text-foreground">
                {profileEdit?.displayName}
              </span>{" "}
              (@{profileEdit?.username})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>نام نمایشی</Label>
              <Input
                value={profileForm.displayName}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, displayName: e.target.value })
                }
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label>بیوگرافی</Label>
              <Input
                value={profileForm.bio}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, bio: e.target.value })
                }
                placeholder="بیوگرافی کاربر..."
                maxLength={500}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ایمیل</Label>
                <Input
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, email: e.target.value })
                  }
                  dir="ltr"
                  placeholder="example@gmail.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>موبایل</Label>
                <Input
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, phone: e.target.value })
                  }
                  dir="ltr"
                  placeholder="09123456789"
                  maxLength={11}
                />
              </div>
            </div>
            <div className="space-y-1.5 border-t border-border pt-3">
              <Label className="flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                بازنشانی رمز عبور (اختیاری)
              </Label>
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                در صورت وارد کردن رمز جدید، همه سشن‌های کاربر باطل می‌شود
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 p-2.5">
              <input
                type="checkbox"
                id="revoke-sessions"
                checked={revokeSessions}
                onChange={(e) => setRevokeSessions(e.target.checked)}
                className="h-4 w-4"
              />
              <Label
                htmlFor="revoke-sessions"
                className="cursor-pointer text-xs"
              >
                ابطال همه سشن‌های فعال این کاربر (خروج اجباری از همه دستگاه‌ها)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setProfileEdit(null)}
              disabled={saving}
            >
              انصراف
            </Button>
            <Button onClick={saveProfileEdit} disabled={saving}>
              {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block / unblock confirmation */}
      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(o) => !o && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmMode === "block"
                ? "مسدودسازی کاربر"
                : "فعال‌سازی کاربر"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMode === "block" ? (
                <>
                  آیا از مسدودسازی{" "}
                  <span className="font-medium text-foreground">
                    {confirmTarget?.displayName}
                  </span>{" "}
                  مطمئن هستید؟ این کاربر دیگر نمی‌تواند وارد سیستم شود.
                </>
              ) : (
                <>
                  آیا از فعال‌سازی{" "}
                  <span className="font-medium text-foreground">
                    {confirmTarget?.displayName}
                  </span>{" "}
                  مطمئن هستید؟
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmTarget) return;
                patchUser(confirmTarget.id, {
                  status: confirmMode === "block" ? "BLOCKED" : "ACTIVE",
                });
                setConfirmTarget(null);
              }}
            >
              {confirmMode === "block" ? "مسدود کن" : "فعال کن"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restrictions dialog */}
      <RestrictionsDialog
        open={!!restrictionsTarget}
        onOpenChange={(o) => !o && setRestrictionsTarget(null)}
        user={
          restrictionsTarget
            ? {
                id: restrictionsTarget.id,
                username: restrictionsTarget.username,
                displayName: restrictionsTarget.displayName,
                avatarUrl: restrictionsTarget.avatarUrl,
              }
            : null
        }
        initialRestrictions={restrictionsTarget?.restrictions ?? null}
        onSaved={() => {
          void fetchUsers();
        }}
      />

      {/* Award dialog */}
      <AwardDialog
        open={!!awardTarget}
        onOpenChange={(o) => !o && setAwardTarget(null)}
        preselectedUser={
          awardTarget
            ? {
                id: awardTarget.id,
                username: awardTarget.username,
                displayName: awardTarget.displayName,
                avatarUrl: awardTarget.avatarUrl,
              }
            : null
        }
        onCreated={() => {
          void fetchUsers();
        }}
      />
    </div>
  );
}

export default AdminUsersView;
