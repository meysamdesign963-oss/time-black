import type { Metadata } from "next";
import Page from "../page";

export const metadata: Metadata = {
  title: "اکسپلور — کشف محتوا و فعالیت کاربران | Time Black",
  description:
    "فید عمومی پست‌های کاربران Time Black. تصاویر، ویدیوها و تجربیات بهره‌وری را کشف کنید. فیلتر بر اساس هشتگ، رسانه و محبوبیت.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "اکسپلور | Time Black",
    description:
      "کشف محتوا و فعالیت کاربران پلتفرم Time Black — تصاویر، ویدیوها و تجربیات بهره‌وری.",
    type: "website",
    locale: "fa_IR",
  },
};

export default function ExplorePage() {
  return <Page initialView="explore" initialParam={null} />;
}
