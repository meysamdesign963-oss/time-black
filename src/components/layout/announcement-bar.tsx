"use client";

/**
 * AnnouncementBar — displays active admin announcements at the top of
 * the main content area. Fetches from /api/announcements on mount.
 */
import { useEffect, useState } from "react";
import { Info, AlertTriangle, CheckCircle, X } from "lucide-react";
import { apiFetch } from "@/utils/api-fetch";
import { cn } from "@/lib/utils";

type Announcement = {
  id: string;
  title: string;
  body: string;
  type: string; // INFO | WARNING | SUCCESS
  createdAt: string;
};

const DISMISS_KEY = "tb_dismissed_announcements";

export function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  // Initialize dismissed from localStorage lazily (avoids set-state-in-effect)
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(DISMISS_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    const run = async () => {
      const res = await apiFetch<{ announcements: Announcement[] }>(
        "/api/announcements",
      );
      if (res.ok && res.data?.announcements) {
        setAnnouncements(res.data.announcements);
      }
    };
    run();
  }, []);

  const visible = announcements.filter((a) => !dismissed.has(a.id));

  const dismiss = (id: string) => {
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
    } catch {
      // ignore
    }
  };

  if (visible.length === 0) return null;

  const top = visible[0];
  const colors = {
    INFO: "border-primary/30 bg-primary/5 text-primary",
    WARNING: "border-amber-500/30 bg-amber-500/5 text-amber-500",
    SUCCESS: "border-accent/30 bg-accent/5 text-accent",
  };
  const Icons = {
    INFO: Info,
    WARNING: AlertTriangle,
    SUCCESS: CheckCircle,
  };
  const Icon = Icons[top.type as keyof typeof Icons] || Info;

  return (
    <div
      className={cn(
        "mx-4 mb-2 mt-1 flex items-start gap-3 rounded-lg border p-3 text-sm lg:mx-8",
        colors[top.type as keyof typeof colors] || colors.INFO,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{top.title}</p>
        <p className="mt-0.5 text-xs opacity-90">{top.body}</p>
      </div>
      <button
        onClick={() => dismiss(top.id)}
        className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
        aria-label="بستن اطلاعیه"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
