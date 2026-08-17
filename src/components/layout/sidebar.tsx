"use client";

/**
 * Sidebar — right side (RTL), collapsible.
 * Used in dashboard + admin pages. Hidden on mobile (uses bottom nav).
 */
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Timer,
  ListTodo,
  LineChart,
  PenLine,
  Users,
  Bell,
  Settings,
  Trophy,
  AlertTriangle,
  FileText,
  PieChart,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  LifeBuoy,
  Award,
  FolderOpen,
} from "lucide-react";
import { useRouterStore, type ViewKey } from "@/store/router";
import { useAuthStore } from "@/store/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type NavItem = {
  key: ViewKey;
  label: string;
  icon: React.ElementType;
  badge?: number;
};

const USER_NAV: NavItem[] = [
  { key: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { key: "timer", label: "تایمر", icon: Timer },
  { key: "tasks", label: "تسک‌ها", icon: ListTodo },
  { key: "stats", label: "آمار و گزارش", icon: LineChart },
  { key: "content", label: "محتوا", icon: PenLine },
  { key: "social", label: "شبکه اجتماعی", icon: Users },
  { key: "messages", label: "پیام‌ها", icon: MessageCircle },
  { key: "notifications", label: "اعلان‌ها", icon: Bell },
  { key: "report", label: "ارتباط با ادمین", icon: LifeBuoy },
  { key: "settings", label: "تنظیمات", icon: Settings },
];

const ADMIN_NAV: NavItem[] = [
  { key: "admin-dashboard", label: "داشبورد مدیریت", icon: LayoutDashboard },
  { key: "admin-users", label: "مدیریت کاربران", icon: Users },
  { key: "admin-times", label: "مدیریت تایم‌ها", icon: Timer },
  { key: "admin-content", label: "مدیریت محتوا", icon: FileText },
  { key: "admin-files", label: "مدیریت فایل‌ها", icon: FolderOpen },
  { key: "admin-rankings", label: "رتبه‌بندی و دوره‌ها", icon: Trophy },
  { key: "admin-awards", label: "مدیریت جوایز", icon: Award },
  { key: "admin-reports", label: "گزارش‌های تحلیلی", icon: PieChart },
  { key: "admin-violations", label: "گزارش تخلفات", icon: AlertTriangle },
  { key: "admin-settings", label: "تنظیمات سیستم", icon: Settings },
];

export function Sidebar({ adminMode = false }: { adminMode?: boolean }) {
  const { view, navigate } = useRouterStore();
  const { user } = useAuthStore();
  // Auto-collapse on small desktops (1024-1279px) per canvas spec 10.1
  const [collapsed, setCollapsed] = useState(false);
  const [userToggled, setUserToggled] = useState(false);

  useEffect(() => {
    if (userToggled) return; // respect manual toggles
    const onResize = () => {
      const w = window.innerWidth;
      // lg breakpoint: 1024-1279px → collapse; xl (≥1280) → expand
      setCollapsed(w >= 1024 && w < 1280);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [userToggled]);

  const toggle = () => {
    setUserToggled(true);
    setCollapsed((c) => !c);
  };

  const items = adminMode ? ADMIN_NAV : USER_NAV;

  // Responsive breakpoints per canvas spec section 10.1:
  //  >= 1280px (xl): sidebar expanded (260px), toggle to collapse
  //  1024-1279px (lg): sidebar collapsed to icon-only (68px) by default
  //  < 1024px (md and below): sidebar hidden (use hamburger/bottom nav)
  return (
    <aside
      className={cn(
        "sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col border-l border-border bg-sidebar/60 backdrop-blur-sm transition-all duration-300 lg:flex",
        collapsed ? "w-[68px]" : "w-[260px]",
        "xl:w-[260px]",
      )}
    >
      {/* Mini profile / admin label */}
      <div className="border-b border-border p-4">
        {adminMode ? (
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Trophy className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">پنل مدیریت</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.role === "BOSS" ? "مدیر ارشد" : "مدیر"}
                </p>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => user && navigate("profile", user.username)}
            className="flex w-full items-center gap-3 text-right"
          >
            <Avatar className="h-12 w-12 shrink-0 border border-border">
              <AvatarImage src={user?.avatarUrl || undefined} />
              <AvatarFallback className="bg-secondary text-primary">
                {user?.displayName?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {user?.displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{user?.username}
                </p>
              </div>
            )}
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = view === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                collapsed && "justify-center",
              )}
            >
              {active && (
                <span className="absolute right-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-l-full bg-primary" />
              )}
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="flex-1 text-right">{item.label}</span>}
              {!collapsed && item.badge ? (
                <Badge className="bg-primary/15 text-primary">
                  {item.badge}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className="flex items-center justify-center gap-2 border-t border-border py-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
      >
        {collapsed ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <>
            <span>جمع کردن</span>
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </aside>
  );
}
