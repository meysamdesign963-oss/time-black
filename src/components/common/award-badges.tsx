"use client";

/**
 * AwardBadges — displays user's prize/winner badges.
 * Shows as small colored badges with icons, used in profile header.
 */
import { Trophy, Medal, Crown, Star, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toPersianDigits } from "@/utils/persian-date";
import { formatRelativeTime } from "@/utils/persian-date";

export type Award = {
  id: string;
  type: string; // MONTHLY_WINNER | WEEKLY_WINNER | TOP_3 | SPECIAL | ACHIEVEMENT
  title: string;
  description: string | null;
  period: string | null;
  rank: number;
  icon: string; // trophy | medal | crown | star | award
  color: string;
  awardedAt: string;
};

const ICON_MAP: Record<string, React.ElementType> = {
  trophy: Trophy,
  medal: Medal,
  crown: Crown,
  star: Star,
  award: Award,
};

const TYPE_LABELS: Record<string, string> = {
  MONTHLY_WINNER: "برنده ماه",
  WEEKLY_WINNER: "برنده هفته",
  TOP_3: "نفر برتر",
  SPECIAL: "ویژه",
  ACHIEVEMENT: "دستاورد",
};

export function AwardBadges({ awards }: { awards: Award[] }) {
  if (!awards || awards.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap gap-1.5">
        {awards.slice(0, 8).map((award) => {
          const Icon = ICON_MAP[award.icon] || Trophy;
          const label = TYPE_LABELS[award.type] || "جایزه";
          return (
            <Tooltip key={award.id}>
              <TooltipTrigger asChild>
                <Badge
                  className="cursor-help border gap-1 px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: `${award.color}20`,
                    borderColor: `${award.color}60`,
                    color: award.color,
                  }}
                >
                  <Icon className="h-3 w-3" />
                  {award.title.length > 25
                    ? award.title.slice(0, 25) + "…"
                    : award.title}
                  {award.rank > 1 && (
                    <span className="opacity-70">
                      #{toPersianDigits(award.rank)}
                    </span>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-1 text-right">
                  <p className="font-medium" style={{ color: award.color }}>
                    {award.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {award.description && (
                    <p className="text-xs">{award.description}</p>
                  )}
                  {award.period && (
                    <p className="text-xs text-muted-foreground">
                      دوره: {award.period}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(new Date(award.awardedAt))}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {awards.length > 8 && (
          <Badge variant="secondary" className="text-xs">
            +{toPersianDigits(awards.length - 8)}
          </Badge>
        )}
      </div>
    </TooltipProvider>
  );
}
