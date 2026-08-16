import type { Metadata } from "next";
import Page from "../page";

export const metadata: Metadata = {
  title: "قوانین و راهنمای پلتفرم | Time Black",
  description:
    "قوانین کامل پلتفرم Time Black: شرایط شرکت در رقابت ماهانه، نحوه ثبت تایم، قوانین محتوا، و سوالات رایج.",
  alternates: { canonical: "/rules" },
  openGraph: {
    title: "قوانین و راهنما | Time Black",
    description: "قوانین و راهنمای کامل پلتفرم Time Black.",
    type: "article",
    locale: "fa_IR",
  },
};

export default function RulesPage() {
  return <Page initialView="rules" initialParam={null} />;
}
