"use client";

/**
 * Bottom Navigation — mobile only (below md breakpoint).
 * 5 icons: Home · Timer · Feed · Notifications · Profile
 */
import { Home, Clock, Newspaper, Bell, User as UserIcon } from "lucide-react";
import { useRouterStore, type ViewKey } from "@/store/router";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

const ITEMS: { key: ViewKey; label: string; icon: React.ElementType }[] = [
  { key: "home", label: "خانه", icon: Home },
  { key: "timer", label: "تایمر", icon: Clock },
  { key: "explore", label: "فید", icon: Newspaper },
  { key: "notifications", label: "اعلان‌ها", icon: Bell },
  { key: "profile", label: "پروفایل", icon: UserIcon },
];

export function BottomNav() {
  const { view, navigate } = useRouterStore();
  const { user } = useAuthStore();

  const handleClick = (key: ViewKey) => {
    if ((key === "timer" || key === "notifications") && !user) {
      navigate("login");
      return;
    }
    if (key === "profile" && user) {
      navigate("profile", user.username);
    } else {
      navigate(key);
    }
  };

  return (
    <nav className="glass-strong fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border md:hidden">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = view === item.key;
        return (
          <button
            key={item.key}
            onClick={() => handleClick(item.key)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2 text-[10px] transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
