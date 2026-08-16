"use client";

/**
 * Header — sticky, glassmorphism, RTL.
 * Shows: logo (right) · main nav (center) · user area (left).
 */
import { useEffect, useState } from "react";
import { Bell, Menu, User as UserIcon, LogOut, Settings, Mail } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { useRouterStore } from "@/store/router";
import { useAuthStore } from "@/store/auth";
import { toPersianDigits } from "@/utils/persian-date";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PUBLIC_NAV = [
  { key: "home", label: "خانه" },
  { key: "leaderboard", label: "رتبه‌بندی" },
  { key: "winners", label: "برندگان" },
  { key: "explore", label: "اکسپلور" },
  { key: "search", label: "جستجو" },
] as const;

export function Header({ adminMode = false }: { adminMode?: boolean }) {
  const { view, navigate } = useRouterStore();
  const { user, logout } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goLogin = () => navigate("login");
  const goRegister = () => navigate("register");

  const handleLogout = async () => {
    await logout();
    navigate("home");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled ? "glass-strong shadow-lg" : "glass",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 lg:px-6">
        {/* Right: logo + admin badge */}
        <button
          onClick={() => navigate(user ? (adminMode ? "admin-dashboard" : "dashboard") : "home")}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Logo size={32} withText />
          {adminMode && (
            <Badge className="bg-primary/15 text-primary border border-primary/30">
              پنل مدیریت
            </Badge>
          )}
        </button>

        {/* Center: main nav (desktop lg+) */}
        <nav className="hidden items-center gap-1 lg:flex">
          {PUBLIC_NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={cn(
                "relative px-3 py-2 text-sm font-medium transition-colors",
                view === item.key
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              {view === item.key && (
                <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </nav>

        {/* Left: user area */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <button
                onClick={() => navigate("messages")}
                className="relative grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-secondary/60"
                aria-label="پیام‌ها"
              >
                <Mail className="h-5 w-5 text-foreground/80" />
                <MessageBadge />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-secondary/60">
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback className="bg-secondary text-primary text-xs">
                        {user.displayName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium sm:block">
                      {user.displayName}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      @{user.username}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("profile", user.username)}>
                    <UserIcon className="ml-2 h-4 w-4" />
                    پروفایل من
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("settings")}>
                    <Settings className="ml-2 h-4 w-4" />
                    تنظیمات
                  </DropdownMenuItem>
                  {(user.role === "BOSS" || user.role === "ADMIN") && !adminMode && (
                    <DropdownMenuItem onClick={() => navigate("admin-dashboard")}>
                      <Settings className="ml-2 h-4 w-4" />
                      پنل مدیریت
                    </DropdownMenuItem>
                  )}
                  {adminMode && (
                    <DropdownMenuItem onClick={() => navigate("dashboard")}>
                      <UserIcon className="ml-2 h-4 w-4" />
                      بازگشت به داشبورد
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="ml-2 h-4 w-4" />
                    خروج از حساب
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={goLogin}
                className="hidden border-primary/40 text-primary hover:bg-primary/10 hover:text-primary sm:inline-flex"
              >
                ورود
              </Button>
              <Button
                size="sm"
                onClick={goRegister}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                ثبت‌نام
              </Button>
            </>
          )}

          {/* Mobile/tablet menu toggle (hidden on lg+ where full nav shows) */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-secondary/60 lg:hidden"
            aria-label="منو"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile/tablet dropdown nav */}
      {mobileOpen && (
        <div className="glass-strong border-t border-border lg:hidden">
          <nav className="flex flex-col p-2">
            {PUBLIC_NAV.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  navigate(item.key);
                  setMobileOpen(false);
                }}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-right text-sm font-medium transition-colors",
                  view === item.key
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-secondary/60",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

/** Notification bell with live unread count badge */
function NotificationBell() {
  const { navigate } = useRouterStore();
  const { user } = useAuthStore();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/notifications/unread-count", {
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          setUnread(json.data?.count || 0);
        }
      } catch {
        // noop
      }
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000); // poll every 30s
    return () => clearInterval(id);
  }, [user]);

  return (
    <button
      onClick={() => navigate("notifications")}
      className="relative grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-secondary/60"
      aria-label="اعلان‌ها"
    >
      <Bell className="h-5 w-5 text-foreground/80" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {unread > 99 ? "۹۹+" : toPersianDigits(unread)}
        </span>
      )}
    </button>
  );
}

/** Message badge with live unread count */
function MessageBadge() {
  const { user } = useAuthStore();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/messages/unread-count", {
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          setUnread(json.data?.count || 0);
        }
      } catch {
        // noop
      }
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => clearInterval(id);
  }, [user]);

  if (unread === 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
      {unread > 99 ? "۹۹+" : toPersianDigits(unread)}
    </span>
  );
}
