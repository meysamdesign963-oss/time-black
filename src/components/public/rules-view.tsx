"use client";

/**
 * RulesView — static rules & guide page (Persian, RTL).
 * Sections: participation conditions, time tracking rules, content rules,
 * top-ranker determination, FAQ.
 */
import { motion } from "framer-motion";
import {
  Award,
  BookOpen,
  Clock,
  FileText,
  HelpCircle,
  ScrollText,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const SECTIONS = [
  {
    id: "participation",
    icon: ShieldCheck,
    title: "شرایط شرکت در رقابت",
    body: (
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          کاربر باید حساب کاربری معتبر و تأییدشده داشته باشد.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          هر کاربر فقط با یک حساب می‌تواند در رقابت‌ها شرکت کند.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          رقابت ماهانه به‌صورت خودکار برای همه کاربران فعال آغاز می‌شود.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          کاربران مسدودشده نمی‌توانند در رقابت شرکت کنند.
        </li>
      </ul>
    ),
  },
  {
    id: "tracking",
    icon: Clock,
    title: "نحوه ثبت و محاسبه تایم‌ها",
    body: (
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          زمان تنها از طریق تایمر رسمی پلتفرم روی یک تسک ثبت می‌شود.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          در هر لحظه فقط یک تایمر می‌تواند فعال باشد؛ شروع تایمر جدید، تایمر
          قبلی را متوقف و ثبت می‌کند.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          مدت زمان ثبت‌شده بر اساس ساعت و دقیقه واقعی محاسبه می‌شود.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          تایم‌های لغوشده در رتبه‌بندی لحاظ نمی‌شوند.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          فعالیت‌های کمتر از ۶۰ ثانیه ممکن است در محاسبات نادیده گرفته شوند.
        </li>
      </ul>
    ),
  },
  {
    id: "content",
    icon: FileText,
    title: "قوانین تولید محتوا",
    body: (
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          محتوای توهین‌آمیز، نژادپرستانه یا خلاف قوانین کشور ممنوع است.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          هرزنامه و تبلیغات تجاری بدون هماهنگی ممنوع است.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          انتشار اطلاعات شخصی دیگران ممنوع است.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          تیم پشتیبانی حق حذف یا مخفی‌سازی محتوای نامناسب را دارد.
        </li>
      </ul>
    ),
  },
  {
    id: "ranking",
    icon: Trophy,
    title: "نحوه تعیین نفرات برتر",
    body: (
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          رتبه‌بندی بر اساس مجموع ثانیه‌های تایم تکمیل‌شده در بازه مربوطه
          (روزانه، هفتگی، ماهانه) تعیین می‌شود.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          در صورت تساوی زمان، تعداد تسک‌های تکمیل‌شده ملاک خواهد بود.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          سه نفر برتر هر ماه با نشان مخصوص (طلا، نقره، برنز) مشخص می‌شوند.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          در پایان هر ماه، رتبه جدید برای ماه بعد بازنشانی می‌شود.
        </li>
      </ul>
    ),
  },
];

const FAQS = [
  {
    q: "آیا شرکت در رقابت رایگان است؟",
    a: "بله، ثبت‌نام و شرکت در رقابت‌های ماهانه کاملاً رایگان است.",
  },
  {
    q: "اگر تایمر را فراموش کنم متوقف کنم چه می‌شود؟",
    a: "تایمر فعال در داشبورد شما قابل مشاهده است و می‌توانید در هر زمان آن را متوقف یا لغو کنید. تایم‌های طولانی‌مدت ممکن است توسط تیم پشتیبانی بررسی شوند.",
  },
  {
    q: "آیا می‌توانم تایم‌های ثبت‌شده را ویرایش کنم؟",
    a: "خیر. برای حفظ اعتبار رقابت، تایم‌های ثبت‌شده قابل ویرایش نیستند. در صورت بروز خطای فنی، با پشتیبانی تماس بگیرید.",
  },
  {
    q: "چگونه می‌توانم حساب خود را حذف کنم؟",
    a: "برای حذف حساب کاربری به بخش تنظیمات مراجعه کنید یا با پشتیبانی در ارتباط باشید. حذف حساب به‌صورت نرم برای ۳۰ روز قابل بازگشت است.",
  },
];

export function RulesView() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="قوانین و راهنما"
        description="قوانین رقابت، ثبت تایم، تولید محتوا و سوالات رایج"
      />

      {/* Intro card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6"
      >
        <Card className="border-primary/30 bg-card/60">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="font-academic text-base font-bold text-foreground">
                خوش آمدید به Time Black
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                این صفحه شامل قوانین رسمی رقابت و راهنمای استفاده از پلتفرم
                است. با ادامه فعالیت در پلتفرم، شما این قوانین را پذیرفته‌اید.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sections grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SECTIONS.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.08, 0.4) }}
          >
            <Card className="card-lift h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-academic">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary/60 text-primary">
                    <s.icon className="h-4.5 w-4.5" />
                  </span>
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent>{s.body}</CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* FAQ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-academic">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary/60 text-primary">
                <HelpCircle className="h-4.5 w-4.5" />
              </span>
              سوالات رایج
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-right">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-right text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </motion.div>

      {/* Footer note */}
      <div className="mt-6 flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 p-4 text-xs text-muted-foreground">
        <ScrollText className="h-4 w-4 shrink-0 text-primary" />
        این قوانین ممکن است به‌روزرسانی شوند. تغییرات از طریق اعلان‌های سیستم
        به اطلاع کاربران خواهد رسید.
      </div>

      {/* Decorative icons strip */}
      <div className="mt-6 flex items-center justify-center gap-6 text-muted-foreground/40">
        <Award className="h-6 w-6" />
        <Clock className="h-6 w-6" />
        <Trophy className="h-6 w-6" />
        <ShieldCheck className="h-6 w-6" />
        <BookOpen className="h-6 w-6" />
      </div>
    </div>
  );
}

export default RulesView;
