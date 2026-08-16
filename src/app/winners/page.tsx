import type { Metadata } from "next";
import Page from "../page";

export const metadata: Metadata = {
  title: "تالار افتخارات — برندگان رقابت | Time Black",
  description:
    "تالار افتخارات پلتفرم Time Black. برندگان دوره‌های قبلی رقابت ماهانه، نفرات برتر و دستاوردهای ویژه را مشاهده کنید.",
  alternates: { canonical: "/winners" },
  openGraph: {
    title: "تالار افتخارات | Time Black",
    description:
      "برندگان رقابت ماهانه Time Black — نفرات برتر، جوایز و دستاوردها.",
    type: "website",
    locale: "fa_IR",
  },
};

export default function WinnersPage() {
  return <Page initialView="winners" initialParam={null} />;
}
