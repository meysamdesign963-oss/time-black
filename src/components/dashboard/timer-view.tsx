"use client";

/**
 * TimerView — premium timer experience for Time Black.
 *
 * Features:
 *  - 4 display modes (circle, flip clock, digital, minimal)
 *  - Fullscreen mode (CSS .timer-fullscreen overlay)
 *  - Pomodoro mode (focus/break cycles, sound, auto-start)
 *  - Settings persisted to localStorage (tb_timer_settings)
 *  - Today's summary with task breakdown bar chart + entries table
 *  - Restores an active running entry on mount
 *
 * All display digits use Persian numerals via toPersianDigits.
 * Internal logic stays in latin digits.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle as CircleIcon,
  Clock,
  Coffee,
  FastForward,
  Layers,
  ListTodo,
  Maximize2,
  Minimize2,
  Monitor,
  Play,
  Settings as SettingsIcon,
  Square,
  TimerIcon,
  Apple,
  Type,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouterStore } from "@/store/router";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatDuration,
  formatDurationHuman,
  formatPersianTime,
  toPersianDigits,
} from "@/utils/persian-date";
import { cn } from "@/lib/utils";

/* ============================================================
   Types
   ============================================================ */
type Task = {
  id: string;
  title: string;
  description: string | null;
  color: string;
  status: string;
};

type TasksResp = { tasks: Task[] };

type ActiveEntry = {
  id: string;
  taskId: string;
  startedAt: string;
  task: { id: string; title: string; color: string };
} | null;

type ActiveResp = { entry: ActiveEntry };

type TimeEntry = {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  status: string;
  task: { id: string; title: string; color: string };
};

type EntriesResp = { entries: TimeEntry[]; totalSeconds: number };

type DisplayMode = "circle" | "flip" | "digital" | "minimal";
type TimerMode = "free" | "pomodoro";
type PomodoroPhase = "focus" | "break";
type RingColorKey = "gold" | "sage" | "terracotta" | "violet";

type TimerSettings = {
  displayMode: DisplayMode;
  focusMin: number;
  breakMin: number;
  sessionsCount: number;
  soundOn: boolean;
  autoStart: boolean;
  ringColor: RingColorKey;
};

/* ============================================================
   Constants
   ============================================================ */
const STORAGE_KEY = "tb_timer_settings";

const DEFAULT_SETTINGS: TimerSettings = {
  displayMode: "circle",
  focusMin: 25,
  breakMin: 5,
  sessionsCount: 4,
  soundOn: true,
  autoStart: true,
  ringColor: "gold",
};

const RING_COLORS: Record<
  RingColorKey,
  { hex: string; glowClass: string; label: string }
> = {
  gold: { hex: "#e0cba8", glowClass: "timer-ring-glow", label: "طلایی" },
  sage: { hex: "#8fbc8f", glowClass: "timer-ring-glow-sage", label: "سبز" },
  terracotta: { hex: "#c97064", glowClass: "", label: "تراکوتا" },
  violet: { hex: "#a78bfa", glowClass: "", label: "بنفش" },
};

const RADIUS = 130;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/* ============================================================
   Helpers — sound + localStorage
   ============================================================ */
function playBeep(soundOn: boolean) {
  if (!soundOn) return;
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playTone = (freq: number, start: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = "sine";
      oscillator.frequency.value = freq;
      const t0 = ctx.currentTime + start;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.3, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      oscillator.start(t0);
      oscillator.stop(t0 + duration);
    };

    // Pleasant two-tone bell
    playTone(880, 0, 0.35);
    playTone(660, 0.18, 0.45);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        /* noop */
      }
    }, 1000);
  } catch {
    /* noop */
  }
}

function loadSettings(): TimerSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<TimerSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: TimerSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

/* ============================================================
   FlipDigit — single Persian digit card that flips on change
   ============================================================ */
function FlipDigit({
  digit,
  size = "md",
}: {
  digit: string;
  size?: "md" | "lg" | "xl";
}) {
  const [animating, setAnimating] = useState(false);
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      if (prevRef.current === null) {
        prevRef.current = digit;
        return;
      }
      if (prevRef.current !== digit) {
        prevRef.current = digit;
        setAnimating(true);
        await new Promise<void>((resolve) => {
          timeoutId = setTimeout(resolve, 600);
        });
        setAnimating(false);
      }
    })();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [digit]);

  const sizeClasses: Record<string, string> = {
    md: "w-12 h-16 text-3xl sm:w-14 sm:h-20 sm:text-4xl",
    lg: "w-16 h-24 text-5xl sm:w-20 sm:h-28 sm:text-6xl",
    xl: "w-20 h-28 text-6xl sm:w-28 sm:h-40 sm:text-7xl",
  };

  return (
    <div className={cn("flip-card", sizeClasses[size])}>
      <div
        className={cn(
          "flip-card-inner relative w-full h-full",
          animating && "animate-flip-down",
        )}
      >
        <div className="flip-card-front absolute inset-0 flex w-full h-full items-center justify-center rounded-lg border border-border bg-card shadow-md">
          <span className="font-mono font-bold text-foreground fa-num">
            {digit}
          </span>
        </div>
        <div className="flip-card-back absolute inset-0 flex w-full h-full items-center justify-center rounded-lg border border-border bg-card shadow-md">
          <span className="font-mono font-bold text-foreground fa-num">
            {digit}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FlipClockDisplay — renders HH:MM:SS (or MM:SS) as flip cards
   ============================================================ */
function FlipClockDisplay({
  seconds,
  size = "md",
}: {
  seconds: number;
  size?: "md" | "lg" | "xl";
}) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  const persianTime = toPersianDigits(timeStr);

  const colonSize: Record<string, string> = {
    md: "text-3xl sm:text-4xl",
    lg: "text-5xl sm:text-6xl",
    xl: "text-6xl sm:text-7xl",
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2" dir="ltr">
      {persianTime.split("").map((char, i) =>
        char === ":" ? (
          <span
            key={`sep-${i}`}
            className={cn(
              "font-mono font-bold text-muted-foreground",
              colonSize[size],
            )}
          >
            :
          </span>
        ) : (
          <FlipDigit key={`d-${i}`} digit={char} size={size} />
        ),
      )}
    </div>
  );
}

/* ============================================================
   CircleDisplay — SVG ring + time in center
   ============================================================ */
function CircleDisplay({
  seconds,
  total,
  isRunning,
  colorHex,
  glowClass,
  size = 300,
}: {
  seconds: number;
  total: number;
  isRunning: boolean;
  colorHex: string;
  glowClass: string;
  size?: number;
}) {
  const progress = total > 0 ? (seconds % total) / total : 0;
  const dash = CIRCUMFERENCE * (1 - progress);
  const fontSize = size > 320 ? "text-6xl" : "text-5xl";

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 300 300"
        className={cn(isRunning && "animate-soft-pulse", isRunning && glowClass)}
      >
        {/* Track */}
        <circle
          cx="150"
          cy="150"
          r={RADIUS}
          fill="none"
          stroke="rgba(58,58,75,0.4)"
          strokeWidth="10"
        />
        {/* Progress arc */}
        <circle
          cx="150"
          cy="150"
          r={RADIUS}
          fill="none"
          stroke={isRunning ? colorHex : "rgba(154,154,170,0.4)"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={isRunning ? dash : CIRCUMFERENCE}
          transform="rotate(-90 150 150)"
          style={{ transition: "stroke-dashoffset 0.5s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <TimerIcon
          className={cn(
            "mb-2 h-5 w-5",
            isRunning ? "text-primary" : "text-muted-foreground",
          )}
        />
        <p
          className={cn(
            "font-mono font-bold text-foreground fa-num",
            fontSize,
          )}
          dir="ltr"
        >
          {formatDuration(seconds)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {isRunning ? "در حال ثبت زمان" : "آماده برای شروع"}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   DigitalDisplay — big LED-style monospace
   ============================================================ */
function DigitalDisplay({
  seconds,
  colorHex,
  isRunning,
}: {
  seconds: number;
  colorHex: string;
  isRunning: boolean;
}) {
  return (
    <div
      className={cn(
        "font-mono font-bold text-foreground fa-num text-center",
        "text-6xl sm:text-7xl lg:text-8xl",
      )}
      dir="ltr"
      style={{
        textShadow: isRunning
          ? `0 0 28px ${colorHex}55, 0 0 8px ${colorHex}33`
          : "none",
        transition: "text-shadow 0.4s ease",
      }}
    >
      {formatDuration(seconds)}
    </div>
  );
}

/* ============================================================
   MinimalDisplay — clean text only
   ============================================================ */
function MinimalDisplay({ seconds }: { seconds: number }) {
  return (
    <p
      className="font-mono font-bold text-foreground fa-num text-center text-6xl sm:text-7xl lg:text-8xl"
      dir="ltr"
    >
      {formatDuration(seconds)}
    </p>
  );
}

/* ============================================================
   SettingsDialog — modal with all timer preferences
   ============================================================ */
function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: TimerSettings;
  onSave: (s: TimerSettings) => void;
}) {
  // Draft is initialized from settings on mount. Parent uses a `key` that
  // changes each time the dialog opens, so we get a fresh draft per open
  // without needing setState-in-effect.
  const [draft, setDraft] = useState<TimerSettings>(settings);

  const update = <K extends keyof TimerSettings>(
    key: K,
    value: TimerSettings[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const handleSave = () => {
    // Clamp numeric inputs
    const cleaned: TimerSettings = {
      ...draft,
      focusMin: Math.max(1, Math.min(120, Number(draft.focusMin) || 25)),
      breakMin: Math.max(1, Math.min(60, Number(draft.breakMin) || 5)),
      sessionsCount: Math.max(1, Math.min(12, Number(draft.sessionsCount) || 4)),
    };
    onSave(cleaned);
    onOpenChange(false);
  };

  const displayModeOptions: { value: DisplayMode; label: string; icon: React.ReactNode }[] = [
    { value: "circle", label: "حلقه", icon: <CircleIcon className="h-5 w-5" /> },
    { value: "flip", label: "فلیپ", icon: <Layers className="h-5 w-5" /> },
    { value: "digital", label: "دیجیتال", icon: <Monitor className="h-5 w-5" /> },
    { value: "minimal", label: "مینیمال", icon: <Type className="h-5 w-5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-academic text-xl">
            تنظیمات تایمر
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-6 py-2">
          {/* Display mode */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">نوع نمایش</Label>
            <div className="grid grid-cols-4 gap-2">
              {displayModeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("displayMode", opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-smooth",
                    draft.displayMode === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary/40",
                  )}
                >
                  {opt.icon}
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pomodoro settings */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">تنظیمات پومودورو</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  تمرکز (دقیقه)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={String(draft.focusMin)}
                  onChange={(e) =>
                    update("focusMin", Number(e.target.value))
                  }
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  استراحت (دقیقه)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={String(draft.breakMin)}
                  onChange={(e) =>
                    update("breakMin", Number(e.target.value))
                  }
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">جلسات</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={String(draft.sessionsCount)}
                  onChange={(e) =>
                    update("sessionsCount", Number(e.target.value))
                  }
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          {/* Ring color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">رنگ حلقه</Label>
            <div className="flex items-center gap-2">
              {(Object.keys(RING_COLORS) as RingColorKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => update("ringColor", key)}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition-smooth",
                    draft.ringColor === key
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: RING_COLORS[key].hex }}
                  aria-label={RING_COLORS[key].label}
                  title={RING_COLORS[key].label}
                />
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-2">
                {draft.soundOn ? (
                  <Volume2 className="h-4 w-4 text-primary" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">صدای اتمام جلسه</p>
                  <p className="text-xs text-muted-foreground">
                    پخش صدا در پایان هر جلسه
                  </p>
                </div>
              </div>
              <Switch
                checked={draft.soundOn}
                onCheckedChange={(v) => update("soundOn", v)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-2">
                <FastForward className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">شروع خودکار</p>
                  <p className="text-xs text-muted-foreground">
                    شروع خودکار جلسه بعدی
                  </p>
                </div>
              </div>
              <Switch
                checked={draft.autoStart}
                onCheckedChange={(v) => update("autoStart", v)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(DEFAULT_SETTINGS);
            }}
          >
            بازنشانی پیش‌فرض
          </Button>
          <Button onClick={handleSave}>ذخیره</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   Main TimerView
   ============================================================ */
export function TimerView() {
  const router = useRouterStore();
  const preselectedTaskId = router.param;
  const navigate = router.navigate;

  /* ---- data state ---- */
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    preselectedTaskId,
  );
  const [activeEntry, setActiveEntry] = useState<ActiveEntry>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  /* ---- UI state ---- */
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Counter increments each time settings opens — used as key to remount
  // the SettingsDialog so its draft state re-initializes from latest settings.
  const [settingsOpenCount, setSettingsOpenCount] = useState(0);
  const [timerMode, setTimerMode] = useState<TimerMode>("free");

  const openSettings = useCallback(() => {
    setSettingsOpenCount((c) => c + 1);
    setShowSettings(true);
  }, []);

  /* ---- pomodoro state (client-side) ---- */
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase | null>(
    null,
  );
  const [pomodoroStartedAt, setPomodoroStartedAt] = useState<number | null>(
    null,
  );
  const [pomodoroDuration, setPomodoroDuration] = useState(0);
  const [pomodoroSession, setPomodoroSession] = useState(1);

  /* ---- settings (persisted) ---- */
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const settingsLoadedRef = useRef(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    settingsLoadedRef.current = true;
  }, []);

  /* ============================================================
     Initial data fetch — tasks + active entry + today's entries
     ============================================================ */
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [tasksRes, activeRes, entriesRes] = await Promise.all([
        apiFetch<TasksResp>("/api/tasks?status=ACTIVE"),
        apiFetch<ActiveResp>("/api/time-entries/active"),
        apiFetch<EntriesResp>("/api/time-entries?range=today"),
      ]);
      if (!active) return;
      if (tasksRes.ok && tasksRes.data?.tasks) {
        setTasks(tasksRes.data.tasks);
        if (!preselectedTaskId && tasksRes.data.tasks.length > 0) {
          setSelectedTaskId(tasksRes.data.tasks[0].id);
        }
      }
      if (activeRes.ok && activeRes.data) {
        setActiveEntry(activeRes.data.entry);
        if (activeRes.data.entry) {
          // Active entry present — make sure we're in free mode
          setTimerMode("free");
        }
      }
      if (entriesRes.ok && entriesRes.data?.entries) {
        setEntries(entriesRes.data.entries);
        setTotalToday(entriesRes.data.totalSeconds || 0);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [preselectedTaskId]);

  /* ============================================================
     Tick — every second while something is running
     ============================================================ */
  const isRunning = !!activeEntry || pomodoroPhase !== null;
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [isRunning]);
  // tick is read in elapsed memo — keep reference
  void tick;

  /* ============================================================
     Elapsed / remaining seconds
     ============================================================ */
  const isPomodoroActive = pomodoroPhase !== null && pomodoroStartedAt !== null;

  const elapsed = useMemo(() => {
    if (isPomodoroActive && pomodoroStartedAt) {
      return Math.max(
        0,
        Math.floor((Date.now() - pomodoroStartedAt) / 1000),
      );
    }
    if (activeEntry?.startedAt) {
      return Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000,
        ),
      );
    }
    return 0;
  }, [activeEntry, pomodoroStartedAt, isPomodoroActive, tick]);

  const remaining = isPomodoroActive
    ? Math.max(0, pomodoroDuration - elapsed)
    : 0;
  const displaySeconds = isPomodoroActive ? remaining : elapsed;

  /* ============================================================
     Pomodoro phase completion — scheduled via setTimeout
     (avoids set-state-in-effect via setInterval polling)
     ============================================================ */
  const pomodoroPhaseRef = useRef<PomodoroPhase | null>(null);
  const pomodoroStartedAtRef = useRef<number | null>(null);
  const pomodoroDurationRef = useRef(0);
  const pomodoroSessionRef = useRef(1);
  const activeEntryRef = useRef<ActiveEntry>(null);
  const settingsRef = useRef(settings);
  const selectedTaskIdRef = useRef(selectedTaskId);

  // Keep refs in sync
  useEffect(() => {
    pomodoroPhaseRef.current = pomodoroPhase;
  }, [pomodoroPhase]);
  useEffect(() => {
    pomodoroStartedAtRef.current = pomodoroStartedAt;
  }, [pomodoroStartedAt]);
  useEffect(() => {
    pomodoroDurationRef.current = pomodoroDuration;
  }, [pomodoroDuration]);
  useEffect(() => {
    pomodoroSessionRef.current = pomodoroSession;
  }, [pomodoroSession]);
  useEffect(() => {
    activeEntryRef.current = activeEntry;
  }, [activeEntry]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  const refreshTodayEntries = useCallback(async () => {
    const e = await apiFetch<EntriesResp>("/api/time-entries?range=today");
    if (e.ok && e.data?.entries) {
      setEntries(e.data.entries);
      setTotalToday(e.data.totalSeconds || 0);
    }
  }, []);

  const startPomodoroFocus = useCallback(async () => {
    const taskId = selectedTaskIdRef.current;
    if (!taskId) {
      toast.error("ابتدا یک تسک انتخاب کنید");
      return;
    }
    setBusy(true);
    const res = await apiFetch<ActiveResp>("/api/time-entries/start", {
      method: "POST",
      body: JSON.stringify({ taskId }),
    });
    setBusy(false);
    if (res.ok && res.data?.entry) {
      setActiveEntry(res.data.entry);
      const duration = settingsRef.current.focusMin * 60;
      setPomodoroPhase("focus");
      setPomodoroStartedAt(Date.now());
      setPomodoroDuration(duration);
      toast.success(
        `پومودورو ${toPersianDigits(pomodoroSessionRef.current)} از ${toPersianDigits(
          settingsRef.current.sessionsCount,
        )} شروع شد`,
      );
    } else {
      toast.error(res.error || "خطا در شروع پومودورو");
    }
  }, []);

  const startPomodoroBreak = useCallback(() => {
    const duration = settingsRef.current.breakMin * 60;
    setPomodoroPhase("break");
    setPomodoroStartedAt(Date.now());
    setPomodoroDuration(duration);
    setActiveEntry(null);
  }, []);

  const endPomodoro = useCallback(() => {
    setPomodoroPhase(null);
    setPomodoroStartedAt(null);
    setPomodoroDuration(0);
    setPomodoroSession(1);
  }, []);

  // Scheduled phase completion
  const handlePomodoroPhaseComplete = useCallback(async () => {
    const s = settingsRef.current;
    playBeep(s.soundOn);
    const phase = pomodoroPhaseRef.current;
    if (phase === "focus") {
      // Stop the API entry (records focus time)
      const entry = activeEntryRef.current;
      if (entry) {
        const stopRes = await apiFetch<{ entry: TimeEntry; durationSec: number }>(
          `/api/time-entries/${entry.id}/stop`,
          { method: "POST" },
        );
        if (stopRes.ok && stopRes.data?.entry) {
          toast.success(
            `تمرکز تمام شد — ${formatDurationHuman(stopRes.data.durationSec)} ثبت شد`,
          );
        }
        setActiveEntry(null);
        await refreshTodayEntries();
      } else {
        toast.success("تمرکز تمام شد! وقت استراحت");
      }
      startPomodoroBreak();
    } else if (phase === "break") {
      toast.info("استراحت تمام شد!");
      const nextSession = pomodoroSessionRef.current + 1;
      if (nextSession > s.sessionsCount) {
        toast.success(
          `پومودورو تکمیل شد! 🎉 ${toPersianDigits(s.sessionsCount)} جلسه تمام شد`,
        );
        endPomodoro();
        return;
      }
      setPomodoroSession(nextSession);
      if (s.autoStart) {
        await startPomodoroFocus();
      } else {
        endPomodoro();
      }
    }
  }, [startPomodoroBreak, endPomodoro, startPomodoroFocus, refreshTodayEntries]);

  // Schedule the next phase completion
  useEffect(() => {
    if (!isPomodoroActive || !pomodoroStartedAt || pomodoroDuration <= 0)
      return;
    const msRemaining =
      pomodoroDuration * 1000 - (Date.now() - pomodoroStartedAt);
    const ms = Math.max(0, msRemaining);
    const t = setTimeout(() => {
      void handlePomodoroPhaseComplete();
    }, ms);
    return () => clearTimeout(t);
  }, [
    isPomodoroActive,
    pomodoroStartedAt,
    pomodoroDuration,
    handlePomodoroPhaseComplete,
  ]);

  /* ============================================================
     Selected task + accent color
     ============================================================ */
  const selectedTask = useMemo(() => {
    return (
      tasks.find((t) => t.id === selectedTaskId) ||
      (activeEntry
        ? {
            id: activeEntry.task.id,
            title: activeEntry.task.title,
            color: activeEntry.task.color,
            description: null,
            status: "ACTIVE",
          }
        : null)
    );
  }, [tasks, selectedTaskId, activeEntry]);

  const accentColorHex =
    selectedTask?.color || RING_COLORS[settings.ringColor].hex;
  const ringColorCfg = RING_COLORS[settings.ringColor];
  // Use task color for ring if no explicit override — but settings.ringColor is the user preference.
  // For the ring, we prefer the user's ring color setting; the task color is shown as a dot elsewhere.
  const ringHex = ringColorCfg.hex;
  const ringGlow = ringColorCfg.glowClass;

  /* ============================================================
     Control handlers
     ============================================================ */
  const handleStart = useCallback(async () => {
    if (timerMode === "pomodoro") {
      await startPomodoroFocus();
      return;
    }
    // Free mode
    if (!selectedTaskId) {
      toast.error("ابتدا یک تسک انتخاب کنید");
      return;
    }
    setBusy(true);
    const res = await apiFetch<ActiveResp>("/api/time-entries/start", {
      method: "POST",
      body: JSON.stringify({ taskId: selectedTaskId }),
    });
    setBusy(false);
    if (res.ok && res.data?.entry) {
      setActiveEntry(res.data.entry);
      toast.success("تایمر شروع شد");
      await refreshTodayEntries();
    } else {
      toast.error(res.error || "خطا در شروع تایمر");
    }
  }, [timerMode, selectedTaskId, startPomodoroFocus, refreshTodayEntries]);

  const handleStop = useCallback(async () => {
    // Pomodoro mode stop — end the whole pomodoro
    if (pomodoroPhase !== null) {
      // If in focus phase, stop the API entry too
      if (pomodoroPhase === "focus" && activeEntry) {
        setBusy(true);
        const res = await apiFetch<{ entry: TimeEntry; durationSec: number }>(
          `/api/time-entries/${activeEntry.id}/stop`,
          { method: "POST" },
        );
        setBusy(false);
        if (res.ok) {
          toast.success(
            `پومودورو متوقف شد — ${formatDurationHuman(res.data.durationSec)} ثبت شد`,
          );
          setActiveEntry(null);
          await refreshTodayEntries();
        } else {
          toast.error(res.error || "خطا در توقف تایمر");
          return;
        }
      } else {
        toast.info("پومودورو متوقف شد");
      }
      endPomodoro();
      return;
    }

    if (!activeEntry) return;
    setBusy(true);
    const res = await apiFetch<{ entry: TimeEntry; durationSec: number }>(
      `/api/time-entries/${activeEntry.id}/stop`,
      { method: "POST" },
    );
    setBusy(false);
    if (res.ok && res.data?.entry) {
      toast.success(
        `تایمر متوقف و ثبت شد — ${formatDurationHuman(res.data.durationSec)}`,
      );
      setActiveEntry(null);
      await refreshTodayEntries();
    } else {
      toast.error(res.error || "خطا در توقف تایمر");
    }
  }, [pomodoroPhase, activeEntry, endPomodoro, refreshTodayEntries]);

  const handleCancel = useCallback(async () => {
    // Pomodoro mode cancel — discard current entry, end pomodoro
    if (pomodoroPhase !== null) {
      if (pomodoroPhase === "focus" && activeEntry) {
        setBusy(true);
        const res = await apiFetch<{ entry: TimeEntry }>(
          `/api/time-entries/${activeEntry.id}/cancel`,
          { method: "POST" },
        );
        setBusy(false);
        if (res.ok) {
          toast.info("جلسه تمرکز لغو شد");
          setActiveEntry(null);
        } else {
          toast.error(res.error || "خطا در لغو");
          return;
        }
      } else {
        toast.info("پومودورو لغو شد");
      }
      endPomodoro();
      return;
    }

    if (!activeEntry) return;
    setBusy(true);
    const res = await apiFetch<{ entry: TimeEntry }>(
      `/api/time-entries/${activeEntry.id}/cancel`,
      { method: "POST" },
    );
    setBusy(false);
    if (res.ok) {
      toast.info("تایمر لغو شد");
      setActiveEntry(null);
    } else {
      toast.error(res.error || "خطا در لغو تایمر");
    }
  }, [pomodoroPhase, activeEntry, endPomodoro]);

  const handleSkip = useCallback(async () => {
    if (pomodoroPhase === null) return;
    await handlePomodoroPhaseComplete();
  }, [pomodoroPhase, handlePomodoroPhaseComplete]);

  const handleSettingsSave = useCallback((s: TimerSettings) => {
    setSettings(s);
    saveSettings(s);
    toast.success("تنظیمات ذخیره شد");
  }, []);

  /* ============================================================
     Today's summary — task breakdown
     ============================================================ */
  const taskBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { task: TimeEntry["task"]; seconds: number }
    >();
    for (const e of entries) {
      if (e.status !== "COMPLETED") continue;
      const existing = map.get(e.taskId);
      if (existing) {
        existing.seconds += e.durationSec;
      } else {
        map.set(e.taskId, { task: e.task, seconds: e.durationSec });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.seconds - a.seconds);
  }, [entries]);

  const maxTaskSeconds = useMemo(
    () => Math.max(1, ...taskBreakdown.map((t) => t.seconds)),
    [taskBreakdown],
  );

  /* ============================================================
     Loading state
     ============================================================ */
  if (loading) {
    return (
      <div className="mx-auto max-w-[900px] space-y-6 px-4 py-6">
        <PageHeader title="تایمر" description="ثبت دقیق زمان فعالیت‌های شما" />
        <Skeleton className="h-80 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  /* ============================================================
     Derived display values
     ============================================================ */
  const ringTotal = isPomodoroActive ? pomodoroDuration : 3600;
  const phaseLabel =
    pomodoroPhase === "focus"
      ? "تمرکز"
      : pomodoroPhase === "break"
        ? "استراحت"
        : null;

  const displayModeOptions: { value: DisplayMode; icon: React.ReactNode; label: string }[] = [
    { value: "circle", icon: <CircleIcon className="h-4 w-4" />, label: "حلقه" },
    { value: "flip", icon: <Layers className="h-4 w-4" />, label: "فلیپ" },
    { value: "digital", icon: <Monitor className="h-4 w-4" />, label: "دیجیتال" },
    { value: "minimal", icon: <Type className="h-4 w-4" />, label: "مینیمال" },
  ];

  /* ============================================================
     Timer display + controls (shared between normal & fullscreen)
     ============================================================ */
  const renderTimerDisplay = (sizeMultiplier: "normal" | "fullscreen") => {
    const isFs = sizeMultiplier === "fullscreen";
    if (settings.displayMode === "circle") {
      return (
        <CircleDisplay
          seconds={displaySeconds}
          total={ringTotal}
          isRunning={isRunning}
          colorHex={ringHex}
          glowClass={ringGlow}
          size={isFs ? 380 : 300}
        />
      );
    }
    if (settings.displayMode === "flip") {
      return (
        <FlipClockDisplay
          seconds={displaySeconds}
          size={isFs ? "xl" : "lg"}
        />
      );
    }
    if (settings.displayMode === "digital") {
      return (
        <DigitalDisplay
          seconds={displaySeconds}
          colorHex={ringHex}
          isRunning={isRunning}
        />
      );
    }
    return <MinimalDisplay seconds={displaySeconds} />;
  };

  const renderControls = (variant: "normal" | "fullscreen") => {
    const isFs = variant === "fullscreen";
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-3",
          isFs && "gap-4",
        )}
      >
        {!isRunning ? (
          <Button
            size={isFs ? "lg" : "lg"}
            onClick={handleStart}
            disabled={busy || (!selectedTaskId && timerMode === "free")}
            className="min-w-[140px]"
          >
            <Play className="h-5 w-5" />
            {timerMode === "pomodoro" ? "شروع پومودورو" : "شروع"}
          </Button>
        ) : (
          <Button
            size="lg"
            variant="secondary"
            onClick={handleStop}
            disabled={busy}
            className="min-w-[140px]"
          >
            <Square className="h-5 w-5" />
            {timerMode === "pomodoro" ? "توقف پومودورو" : "توقف و ثبت"}
          </Button>
        )}
        {isRunning && (
          <Button
            variant="ghost"
            size="lg"
            onClick={handleCancel}
            disabled={busy}
            className="text-destructive hover:text-destructive"
          >
            <XCircle className="h-5 w-5" />
            انصراف
          </Button>
        )}
        {timerMode === "pomodoro" && pomodoroPhase !== null && (
          <Button variant="outline" size="lg" onClick={handleSkip} disabled={busy}>
            <FastForward className="h-5 w-5" />
            رد کردن جلسه
          </Button>
        )}
      </div>
    );
  };

  const renderTaskPill = () => {
    if (!selectedTask) return null;
    return (
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: selectedTask.color || ringHex }}
        />
        <p className="text-sm font-medium text-foreground">
          {selectedTask.title}
        </p>
      </div>
    );
  };

  const renderPomodoroStatus = () => {
    if (timerMode !== "pomodoro") return null;
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "border-primary/40 text-primary",
            pomodoroPhase === "focus" && "animate-soft-pulse",
          )}
        >
          {pomodoroPhase === "focus" ? (
            <>
              <TimerIcon className="h-3 w-3" />
              تمرکز
            </>
          ) : pomodoroPhase === "break" ? (
            <>
              <Coffee className="h-3 w-3" />
              استراحت
            </>
          ) : (
            <>
              <Apple className="h-3 w-3" />
              آماده
            </>
          )}
        </Badge>
        <Badge variant="secondary" className="font-mono text-primary">
          پومودورو {toPersianDigits(pomodoroSession)} از{" "}
          {toPersianDigits(settings.sessionsCount)}
        </Badge>
      </div>
    );
  };

  /* ============================================================
     Fullscreen render
     ============================================================ */
  if (isFullscreen) {
    return (
      <>
        <div
          className="timer-fullscreen flex-col gap-6 p-6"
          style={{
            background:
              "radial-gradient(circle at 50% 30%, rgba(224,203,168,0.06) 0%, var(--background) 60%)",
          }}
        >
          {/* Top bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {renderTaskPill()}
              {phaseLabel && (
                <Badge
                  variant="outline"
                  className="border-primary/40 text-primary"
                >
                  {phaseLabel}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={openSettings}
                aria-label="تنظیمات"
              >
                <SettingsIcon className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(false)}
                aria-label="خروج از تمام صفحه"
              >
                <Minimize2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Display mode selector */}
          <div className="flex items-center justify-center gap-1 rounded-lg bg-card/60 p-1">
            {displayModeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setSettings((s) => {
                    const updated = { ...s, displayMode: opt.value };
                    saveSettings(updated);
                    return updated;
                  })
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-smooth",
                  settings.displayMode === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50",
                )}
              >
                {opt.icon}
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Timer display */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-1 items-center justify-center"
          >
            {renderTimerDisplay("fullscreen")}
          </motion.div>

          {/* Pomodoro status */}
          {renderPomodoroStatus()}

          {/* Controls */}
          {renderControls("fullscreen")}
        </div>

        <SettingsDialog
          key={`fs-settings-${settingsOpenCount}`}
          open={showSettings}
          onOpenChange={setShowSettings}
          settings={settings}
          onSave={handleSettingsSave}
        />
      </>
    );
  }

  /* ============================================================
     Normal render
     ============================================================ */
  return (
    <div className="mx-auto max-w-[900px] space-y-6 px-4 py-6">
      <PageHeader
        title="تایمر"
        description="ثبت دقیق زمان فعالیت‌های شما"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={openSettings}
              aria-label="تنظیمات"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsFullscreen(true)}
              aria-label="تمام صفحه"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Task selector */}
      <Card>
        <CardContent className="p-5">
          <label className="mb-2 block text-xs text-muted-foreground">
            انتخاب تسک
          </label>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-card/30 py-8 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
                <ListTodo className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  هنوز تسکی نساخته‌اید
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  برای شروع تایمر ابتدا یک تسک بسازید
                </p>
              </div>
              <Button size="sm" onClick={() => navigate("tasks")}>
                ایجاد تسک
              </Button>
            </div>
          ) : (
            <Select
              value={selectedTaskId || undefined}
              onValueChange={setSelectedTaskId}
              disabled={isRunning}
            >
              <SelectTrigger className="w-full" dir="rtl">
                <SelectValue placeholder="یک تسک انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.title}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedTask && (
            <p className="mt-3 text-xs text-muted-foreground">
              تسک انتخاب‌شده:{" "}
              <span className="font-medium text-foreground">
                {selectedTask.title}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Mode tabs (free / pomodoro) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (pomodoroPhase !== null) {
              toast.info("ابتدا پومودورو را متوقف کنید");
              return;
            }
            setTimerMode("free");
          }}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-smooth",
            timerMode === "free"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-secondary/40",
          )}
        >
          <TimerIcon className="h-4 w-4" />
          تایمر آزاد
        </button>
        <button
          type="button"
          onClick={() => {
            if (activeEntry) {
              toast.info("ابتدا تایمر فعلی را متوقف کنید");
              return;
            }
            setTimerMode("pomodoro");
          }}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-smooth",
            timerMode === "pomodoro"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-secondary/40",
          )}
        >
          <Apple className="h-4 w-4" />
          پومودورو
        </button>
      </div>

      {/* Big timer card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="animate-fade-in-up"
      >
        <Card
          className={cn(
            "card-lift",
            isRunning && "card-glow-gold",
          )}
        >
          <CardContent className="flex flex-col items-center gap-6 p-6 sm:p-8">
            {/* Display mode selector */}
            <div className="flex items-center gap-1 rounded-lg bg-secondary/40 p-1">
              {displayModeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setSettings((s) => {
                      const updated = { ...s, displayMode: opt.value };
                      saveSettings(updated);
                      return updated;
                    })
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-smooth",
                    settings.displayMode === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary/60",
                  )}
                  aria-label={opt.label}
                >
                  {opt.icon}
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Pomodoro status (if applicable) */}
            {renderPomodoroStatus()}

            {/* Timer display */}
            <div className="grid place-items-center py-2">
              {renderTimerDisplay("normal")}
            </div>

            {/* Task pill */}
            {renderTaskPill()}

            {/* Controls */}
            {renderControls("normal")}
          </CardContent>
        </Card>
      </motion.div>

      {/* Today's summary */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Big total + sessions */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 font-academic text-lg font-bold text-foreground">
              خلاصه امروز
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-4xl font-bold text-primary fa-num">
                {formatDuration(totalToday)}
              </span>
              <span className="text-sm text-muted-foreground">ثبت‌شده</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-secondary/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">تعداد جلسات</p>
                <p className="font-mono text-lg font-bold text-foreground fa-num">
                  {toPersianDigits(entries.filter((e) => e.status === "COMPLETED").length)}
                </p>
              </div>
              <div className="rounded-lg bg-secondary/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">تسک‌های فعال</p>
                <p className="font-mono text-lg font-bold text-foreground fa-num">
                  {toPersianDigits(taskBreakdown.length)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task breakdown bar chart */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 font-academic text-lg font-bold text-foreground">
              تفکیک بر اساس تسک
            </h3>
            {taskBreakdown.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">
                  هنوز زمانی ثبت نشده است
                </p>
              </div>
            ) : (
              <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
                {taskBreakdown.map(({ task, seconds }) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2"
                  >
                    <div className="flex w-28 shrink-0 items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: task.color }}
                      />
                      <span className="truncate text-xs text-foreground">
                        {task.title}
                      </span>
                    </div>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary/30">
                      <div
                        className="h-full rounded-full transition-smooth"
                        style={{
                          width: `${(seconds / maxTaskSeconds) * 100}%`,
                          backgroundColor: task.color,
                        }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-left font-mono text-xs text-muted-foreground fa-num">
                      {formatDuration(seconds)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent entries table */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-academic text-lg font-bold text-foreground">
              ثبت‌های امروز
            </h3>
            <Badge variant="secondary" className="font-mono text-primary">
              <Clock className="h-3 w-3" />
              مجموع: {formatDurationHuman(totalToday)}
            </Badge>
          </div>

          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/30 py-8 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
                <Clock className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">
                هنوز زمانی برای امروز ثبت نشده
              </p>
              <p className="text-xs text-muted-foreground">
                با شروع تایمر، اولین فعالیت امروز را ثبت کنید
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام تسک</TableHead>
                    <TableHead>مدت زمان</TableHead>
                    <TableHead>ساعت شروع</TableHead>
                    <TableHead>وضعیت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.slice(0, 8).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor: e.task.color || ringHex,
                            }}
                          />
                          <span className="text-sm font-medium text-foreground">
                            {e.task.title}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-primary fa-num">
                        {e.status === "COMPLETED"
                          ? formatDuration(e.durationSec)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground fa-num">
                        {formatPersianTime(new Date(e.startedAt))}
                      </TableCell>
                      <TableCell>
                        {e.status === "COMPLETED" ? (
                          <Badge
                            variant="outline"
                            className="border-accent/40 text-accent"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            تکمیل‌شده
                          </Badge>
                        ) : e.status === "RUNNING" ? (
                          <Badge variant="secondary" className="text-primary">
                            در حال انجام
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            لغوشده
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {entries.length > 8 && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  نمایش {toPersianDigits(8)} از {toPersianDigits(entries.length)} ثبت
                </p>
              )}

              <div className="mt-4 flex items-center justify-between rounded-lg bg-secondary/30 px-4 py-2">
                <span className="text-xs text-muted-foreground">
                  تعداد کل ثبت‌ها: {toPersianDigits(entries.length)}
                </span>
                <span className="font-mono text-sm font-bold text-primary fa-num">
                  مجموع: {formatDuration(totalToday)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings dialog */}
      <SettingsDialog
        key={`main-settings-${settingsOpenCount}`}
        open={showSettings}
        onOpenChange={setShowSettings}
        settings={settings}
        onSave={handleSettingsSave}
      />
    </div>
  );
}

export default TimerView;
