"use client";

/**
 * ContactView — contact form (frontend only, simulated submission),
 * support email, and FAQ accordion.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  HelpCircle,
  Mail,
  MessageSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "زمان پاسخگویی پشتیبانی چقدر است؟",
    a: "تیم پشتیبانی معمولاً ظرف ۲۴ الی ۴۸ ساعت کاری به پیام‌ها پاسخ می‌دهد.",
  },
  {
    q: "چگونه می‌توانم گزارش تخلف بدهم؟",
    a: "برای گزارش تخلف یا محتوای نامناسب، از فرم تماس با ذکر شناسه کاربری و توضیح موضوع استفاده کنید.",
  },
  {
    q: "آیا امکان همکاری یا اسپانسرشیپ وجود دارد؟",
    a: "بله. برای همکاری‌های تجاری موضوع ایمیل را با «همکاری» آغاز کنید تا به تیم مربوطه ارجاع داده شود.",
  },
  {
    q: "گزارش باگ را چگونه ثبت کنم؟",
    a: "لطفاً در صورت مواجهه با خطا، توضیح دقیق همراه با مراحل بازتولید و در صورت امکان اسکرین‌شات را ارسال کنید.",
  },
];

export function ContactView() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("لطفاً همه فیلدها را پر کنید");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("ایمیل نامعتبر است");
      return;
    }
    setSubmitting(true);
    // Simulate async submit
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    setSubmitted(true);
    toast.success("پیام شما با موفقیت ارسال شد");
    setName("");
    setEmail("");
    setMessage("");
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="تماس و پشتیبانی"
        description="سوالات، پیشنهادها و گزارش‌های خود را با ما در میان بگذارید"
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-academic">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquare className="h-4.5 w-4.5" />
                </span>
                فرم تماس
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <CheckCircle2 className="h-12 w-12 text-accent" />
                  <div>
                    <p className="font-academic text-base font-bold text-foreground">
                      پیام شما ارسال شد
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      تیم پشتیبانی در اسرع وقت پاسخ خواهد داد.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSubmitted(false)}
                  >
                    ارسال پیام جدید
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">نام و نام خانوادگی</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="مثلاً: علی رضایی"
                        maxLength={80}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">ایمیل</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@example.com"
                        dir="ltr"
                        className="text-right"
                        maxLength={120}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="message">پیام شما</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="پیام خود را اینجا بنویسید..."
                      rows={6}
                      maxLength={2000}
                      className="resize-y"
                    />
                    <p className="text-left text-xs text-muted-foreground">
                      {message.length} / ۲۰۰۰
                    </p>
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto"
                  >
                    {submitting ? (
                      "در حال ارسال..."
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        ارسال پیام
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Side panel: support email + FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-academic">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="h-4.5 w-4.5" />
                </span>
                ایمیل پشتیبانی
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href="mailto:support@timeblack.app"
                dir="ltr"
                className="block rounded-lg border border-border/60 bg-secondary/40 p-3 text-center text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-secondary/60"
              >
                support@timeblack.app
              </a>
              <p className="mt-3 text-xs text-muted-foreground">
                برای پاسخ سریع‌تر، در ایمیل خود نام کاربری (در صورت وجود) را
                ذکر کنید.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-academic">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <HelpCircle className="h-4.5 w-4.5" />
                </span>
                سوالات متداول
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
      </div>
    </div>
  );
}

export default ContactView;
