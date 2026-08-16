import type { Metadata } from "next";
import Page from "../page";

export const metadata: Metadata = {
  title: "جستجوی کاربران و محتوا | Time Black",
  description:
    "جستجوی کاربران، پست‌ها و هشتگ‌ها در پلتفرم Time Black. به‌سرعت افراد و محتوای مورد نظر خود را پیدا کنید.",
  alternates: { canonical: "/search" },
  openGraph: {
    title: "جستجو | Time Black",
    description: "جستجوی کاربران، پست‌ها و هشتگ‌ها در Time Black.",
    type: "website",
    locale: "fa_IR",
  },
};

export default function SearchPage() {
  return <Page initialView="search" initialParam={null} />;
}
