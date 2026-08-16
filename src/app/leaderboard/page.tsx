import type { Metadata } from "next";
import Page from "../page";

export const metadata: Metadata = {
  title: "رتبه‌بندی ماهانه | Time Black",
  description:
    "جدول کامل رتبه‌بندی کاربران پلتفرم Time Black بر اساس مجموع تایم‌های ثبت‌شده. رتبه خود را در رقابت ماهانه ببینید و با دیگران رقابت کنید.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: "رتبه‌بندی ماهانه | Time Black",
    description:
      "جدول کامل رتبه‌بندی کاربران بر اساس مجموع تایم‌های ثبت‌شده در ماه جاری.",
    type: "website",
    locale: "fa_IR",
  },
};

export default function LeaderboardPage() {
  return <Page initialView="leaderboard" initialParam={null} />;
}
