"use client";

/**
 * AppShell — composes Header + Sidebar + main content + Footer/FloatingBar
 * based on the current view (public / dashboard / admin).
 */
import { useEffect } from "react";
import { useRouterStore } from "@/store/router";
import { useAuthStore } from "@/store/auth";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";
import { FloatingBar } from "./floating-bar";
import { BottomNav } from "./bottom-nav";
import { AnnouncementBar } from "./announcement-bar";

export function AppShell({
  children,
  initialView,
  initialParam,
}: {
  children: React.ReactNode;
  initialView?: string;
  initialParam?: string | null;
}) {
  const { view, isAdmin, isDashboard, navigate, initFromUrl } = useRouterStore();
  const { user, initialized, fetchMe } = useAuthStore();

  // Initialize session once on mount + restore view from URL (deep-linking)
  useEffect(() => {
    // If a clean-URL initial view is provided, use it (overrides ?view=)
    if (initialView) {
      navigate(initialView as Parameters<typeof navigate>[0], initialParam ?? null);
    } else {
      initFromUrl();
    }
    if (!initialized) fetchMe();
  }, [initialized, fetchMe, initFromUrl, initialView, initialParam, navigate]);

  // Listen to browser back/forward (popstate) to sync store with URL
  useEffect(() => {
    const onPopState = () => {
      initFromUrl();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initFromUrl]);

  // Memoize view-type checks to prevent effect churn
  const isDashView = isDashboard();
  const isAdminView = isAdmin();

  // Redirect rules
  useEffect(() => {
    if (!initialized) return;
    if ((isDashView || isAdminView) && !user) {
      navigate("login");
      return;
    }
    if (isAdminView && user && user.role === "USER") {
      navigate("dashboard");
      return;
    }
    if ((view === "login" || view === "register") && user) {
      navigate("dashboard");
    }
  }, [view, user, initialized, isDashView, isAdminView, navigate]);

  const showSidebar = isDashView || isAdminView;
  const showFloatingBar = isDashView;
  const showBottomNav = !isAdminView && !(view === "login" || view === "register");
  const adminMode = isAdmin();
  const compactFooter = showSidebar;

  return (
    <>
    <a href="#main-scroll" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[9999] rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">رد کرن به محتوا</a>
    <div className="flex min-h-screen flex-col">
      <Header adminMode={adminMode} />

      <div className="flex flex-1">
        {showSidebar && <Sidebar adminMode={adminMode} />}

        <main
          id="main-scroll"
          className="flex flex-1 flex-col"
          style={{ minHeight: "calc(100vh - 4rem)" }}
        >
          <AnnouncementBar />
          <div className="flex flex-1 flex-col">{children}</div>

          {showFloatingBar && <FloatingBar />}
          <Footer compact={compactFooter} />
        </main>
      </div>

      {showBottomNav && <BottomNav />}
      {/* spacer for bottom nav on mobile */}
      <div className="h-14 md:hidden" />
      {/* Extra spacer for floating bar on dashboard mobile */}
      {showFloatingBar && <div className="h-20 md:hidden" />}
    </div>
    </>
  );
}
