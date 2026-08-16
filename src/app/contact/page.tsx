import type { Metadata } from "next";
import Page from "../page";

export const metadata: Metadata = {
  title: "تماس با ما و پشتیبانی | Time Black",
  description:
    "راه‌های ارتباطی با تیم مدیریت Time Black. فرم تماس، ایمیل پشتیبانی و سوالات متداول.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "تماس با ما | Time Black",
    description: "راه‌های ارتباطی با تیم مدیریت Time Black.",
    type: "website",
    locale: "fa_IR",
  },
};

export default function ContactPage() {
  return <Page initialView="contact" initialParam={null} />;
}
