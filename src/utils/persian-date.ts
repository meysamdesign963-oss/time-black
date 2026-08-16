/**
 * Persian (Jalali / Shamsi) date utilities — used across the whole app.
 * Based on jalaali-js for conversion.
 */
import {
  toJalaali,
  jalaaliToDateObject,
  jalaaliMonthLength,
} from "jalaali-js";

export const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export const PERSIAN_WEEKDAYS = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];

export const PERSIAN_WEEKDAYS_SHORT = ["ی", "د", "س", "چ", "پ", "ج", "ش"];

/** Convert a digit string to Persian digits */
export function toPersianDigits(input: string | number): string {
  const fa = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/\d/g, (d) => fa[Number(d)]);
}

/** Convert Persian digits back to latin */
export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
  );
}

export type JalaliDate = {
  jy: number;
  jm: number;
  jd: number;
};

/** Get Jalali date parts for a Date (defaults to now) */
export function toJalali(date: Date = new Date()): JalaliDate {
  return toJalaali(date);
}

/** Format a Date as a full Persian string: "شنبه ۱۲ مهر ۱۴۰۳" */
export function formatPersianDate(date: Date = new Date()): string {
  const j = toJalali(date);
  const weekday = PERSIAN_WEEKDAYS[date.getDay()];
  return `${weekday} ${toPersianDigits(j.jd)} ${PERSIAN_MONTHS[j.jm - 1]} ${toPersianDigits(
    j.jy,
  )}`;
}

/** Format a Date as short Persian: "۱۴۰۳/۰۷/۱۲" */
export function formatPersianDateShort(date: Date = new Date()): string {
  const j = toJalali(date);
  return `${toPersianDigits(j.jy)}/${toPersianDigits(
    String(j.jm).padStart(2, "0"),
  )}/${toPersianDigits(String(j.jd).padStart(2, "0"))}`;
}

/** Format time: "۱۴:۳۲" */
export function formatPersianTime(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return toPersianDigits(`${h}:${m}`);
}

/** Format a relative time like "۵ دقیقه پیش" */
export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "همین الان";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${toPersianDigits(min)} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${toPersianDigits(hr)} ساعت پیش`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${toPersianDigits(days)} روز پیش`;
  return formatPersianDateShort(date);
}

/** Format seconds as "HH:MM:SS" (Persian digits) */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return toPersianDigits(
    h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`,
  );
}

/** Format seconds as a human friendly Persian string: "۲ ساعت و ۱۵ دقیقه" */
export function formatDurationHuman(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0 && m === 0) return `${toPersianDigits(seconds)} ثانیه`;
  if (h === 0) return `${toPersianDigits(m)} دقیقه`;
  if (m === 0) return `${toPersianDigits(h)} ساعت`;
  return `${toPersianDigits(h)} ساعت و ${toPersianDigits(m)} دقیقه`;
}

/** Start of the current Jalali month as a Date */
export function startOfJalaliMonth(date: Date = new Date()): Date {
  const j = toJalali(date);
  return jalaaliToDateObject(j.jy, j.jm, 1);
}

/** Start of the current Jalali week (Saturday) */
export function startOfJalaliWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  // shift so Saturday is the first day
  const diff = (day + 1) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get the number of days in a Jalali month */
export function jalaliMonthLength(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm);
}
