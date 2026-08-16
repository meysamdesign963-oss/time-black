"use client";

/**
 * StatCard — small KPI tile used in dashboards.
 */
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  hint?: React.ReactNode;
  accent?: "primary" | "accent" | "destructive";
  className?: string;
}) {
  const accentClass = {
    primary: "text-primary",
    accent: "text-accent",
    destructive: "text-destructive",
  }[accent];

  return (
    <div
      className={cn(
        "glass card-lift rounded-xl border border-border/60 p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 font-academic text-2xl font-bold text-foreground">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary/50",
              accentClass,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
