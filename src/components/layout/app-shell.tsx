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

  // Redirect rules:
  // - dashboard/admin views require auth; if not logged in → login
  // - admin views require BOSS/ADMIN role; else → dashboard
  // - login/register views when already logged in → dashboard
  useEffect(() => {
    if (!initialized) return;
    if ((isDashboard() || isAdmin()) && !user) {
      navigate("login");
      return;
    }
    if (isAdmin() && user && user.role === "USER") {
      navigate("dashboard");
      return;
    }
    if ((view === "login" || view === "register") && user) {
      navigate("dashboard");
    }
  }, [view, user, initialized, isDashboard, isAdmin, navigate]);

  const showSidebar = isDashboard() || isAdmin();
  const showFloatingBar = isDashboard();
  const showBottomNav = true;
  const adminMode = isAdmin();
  const compactFooter = showSidebar;

  return (
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
    </div>
  );
}
