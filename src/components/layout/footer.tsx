"use client";

/**
 * Footer — public pages (full) / dashboard pages (compact).
 * RTL layout: brand column on the right, links flowing left.
 */
import { Logo } from "@/components/common/logo";
import { useRouterStore } from "@/store/router";
import { toPersianDigits } from "@/utils/persian-date";

const NAV_LINKS = [
  { label: "درباره ما", view: "home" as const },
  { label: "قوانین و مقررات", view: "rules" as const },
  { label: "راهنمای پلتفرم", view: "rules" as const },
  { label: "تماس با ما", view: "contact" as const },
];

const SOCIAL_LINKS = ["اینستاگرام", "تلگرام", "توییتر"];

const LEGAL_LINKS = ["حریم خصوصی", "شرایط استفاده"];

export function Footer({ compact = false }: { compact?: boolean }) {
  const { navigate } = useRouterStore();
  const year = toPersianDigits(1404);

  if (compact) {
    return (
      <footer className="mt-auto border-t border-border bg-background/60 px-6 py-4 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span>© {year} Time Black — تمامی حقوق محفوظ است</span>
          <span className="text-border">|</span>
          <button className="hover:text-foreground" onClick={() => navigate("rules")}>
            راهنما
          </button>
          <span className="text-border">|</span>
          <button className="hover:text-foreground" onClick={() => navigate("contact")}>
            تماس با پشتیبانی
          </button>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto border-t border-border bg-sidebar/40 backdrop-blur-sm">
      <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <Logo size={32} withText />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            پلتفرم رقابت تایم‌محور — تسک‌های خود را تعریف کنید، تایمر را فعال
            کنید و در رتبه‌بندی ماهانه با دیگران رقابت کنید.
          </p>
        </div>

        {/* Nav links */}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">دسترسی سریع</h4>
          <ul className="space-y-2">
            {NAV_LINKS.map((l) => (
              <li key={l.label}>
                <button
                  onClick={() => navigate(l.view)}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Social */}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">شبکه‌های اجتماعی</h4>
          <ul className="space-y-2">
            {SOCIAL_LINKS.map((l) => (
              <li key={l}>
                <a
                  href="#"
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">قوانین</h4>
          <ul className="space-y-2">
            {LEGAL_LINKS.map((l) => (
              <li key={l}>
                <button
                  onClick={() => navigate("rules")}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {l}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {year} Time Black — تمامی حقوق محفوظ است
      </div>
    </footer>
  );
}
