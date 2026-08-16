import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { generateSiteJsonLd } from "@/utils/seo";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

const siteUrl = "https://timeblack.ir";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Time Black | رقابت تایم‌محور و بهره‌وری",
    template: "%s | Time Black",
  },
  description:
    "پلتفرم رقابتی تایم‌محور — تسک‌های خود را تعریف کنید، تایمر را فعال کنید و در رتبه‌بندی ماهانه با دیگران رقابت کنید. جامعه‌ای از افراد بهره‌گر برای رشد روزانه.",
  keywords: [
    "Time Black",
    "تایم بلک",
    "بهره‌وری",
    "رقابت تایم",
    "تایمر پومودورو",
    "مدیریت زمان",
    "تسک‌منیجمنت",
    "رتبه‌بندی ماهانه",
    "شبکه اجتماعی بهره‌وری",
    "Pomodoro",
    "time tracking",
    "productivity",
  ],
  authors: [{ name: "Time Black Team" }],
  creator: "Time Black",
  publisher: "Time Black",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: siteUrl,
    siteName: "Time Black",
    title: "Time Black | رقابت تایم‌محور و بهره‌وری",
    description:
      "پلتفرم رقابتی تایم‌محور — تسک‌های خود را تعریف کنید، تایمر را فعال کنید و در رتبه‌بندی ماهانه با دیگران رقابت کنید.",
    images: [
      {
        url: "/logo.svg",
        width: 1200,
        height: 630,
        alt: "Time Black",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Time Black | رقابت تایم‌محور",
    description:
      "پلتفرم رقابتی تایم‌محور — تسک، تایمر، رتبه‌بندی ماهانه",
    images: ["/logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "productivity",
};

/**
 * JSON-LD structured data injected into <head> for SEO.
 * Helps search engines understand the site is a productivity platform.
 */
const siteJsonLd = generateSiteJsonLd();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
      <body
        className={`${vazirmatn.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="top-left" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
