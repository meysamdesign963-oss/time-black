"use client";

/**
 * Time Black — single-route SPA entry point.
 * -------------------------------------------
 * The whole platform lives on `/`. View switching is driven by the
 * zustand router store. The AppShell provides header/sidebar/footer
 * context-aware scaffolding; this component just renders the active view.
 */
import { useEffect, useMemo, Component, type ReactNode, type ErrorInfo } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useRouterStore } from "@/store/router";
import { useAuthStore } from "@/store/auth";

// Public views
import { HomeView } from "@/components/public/home-view";
import { LeaderboardView } from "@/components/public/leaderboard-view";
import { ExploreView } from "@/components/public/explore-view";
import { SearchView } from "@/components/public/search-view";
import { PublicProfileView } from "@/components/public/public-profile-view";
import { PostDetailView } from "@/components/public/post-detail-view";
import { RulesView } from "@/components/public/rules-view";
import { ContactView } from "@/components/public/contact-view";
import { WinnersView } from "@/components/public/winners-view";

// Auth views
import { LoginView } from "@/components/auth/login-view";
import { RegisterView } from "@/components/auth/register-view";

// Dashboard views
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { TimerView } from "@/components/dashboard/timer-view";
import { TasksView } from "@/components/dashboard/tasks-view";
import { StatsView } from "@/components/dashboard/stats-view";
import { ContentView } from "@/components/dashboard/content-view";
import { SocialView } from "@/components/dashboard/social-view";
import { NotificationsView } from "@/components/dashboard/notifications-view";
import { SettingsView } from "@/components/dashboard/settings-view";
import { MessagesView } from "@/components/dashboard/messages-view";
import { ReportView } from "@/components/dashboard/report-view";
import { PostAnalyticsView } from "@/components/dashboard/post-analytics-view";

// Admin views
import { AdminDashboardView } from "@/components/admin/admin-dashboard-view";
import { AdminUsersView } from "@/components/admin/admin-users-view";
import { AdminTimesView } from "@/components/admin/admin-times-view";
import { AdminContentView } from "@/components/admin/admin-content-view";
import { AdminFilesView } from "@/components/admin/admin-files-view";
import { AdminRankingsView } from "@/components/admin/admin-rankings-view";
import { AdminReportsView } from "@/components/admin/admin-reports-view";
import { AdminViolationsView } from "@/components/admin/admin-violations-view";
import { AdminSettingsView } from "@/components/admin/admin-settings-view";
import { AdminAwardsView } from "@/components/admin/admin-awards-view";

/** Lightweight full-page loader shown while session resolves */
function FullPageLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
      </div>
    </div>
  );
}

// Simple Error Boundary to prevent white-screen crashes
class ViewErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error, info: ErrorInfo) {
    console.error("[ViewErrorBoundary]", e, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      const { navigate } = useRouterStore.getState();
      return (
        <div className="grid min-h-[60vh] place-items-center px-4">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            </div>
            <h3 className="mb-2 text-lg font-bold text-foreground">خطایی رخ داد</h3>
            <p className="mb-4 text-sm text-muted-foreground">در بارگذاری محتوای این بخش مشکلی دارد.</p>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
              onClick={() => { this.setState({ hasError: false }); navigate("dashboard"); }}
            >بازگشت به داشبورد</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ViewSwitch() {
  const { view, param, isDashboard, isAdmin } = useRouterStore();
  const { user, initialized } = useAuthStore();

  // While session is resolving on a protected view, show loader
  const waitingForAuth =
    !initialized && (isDashboard() || isAdmin());

  const node = useMemo(() => {
    if (waitingForAuth) return <FullPageLoader />;

    switch (view) {
      // Public
      case "home":
        return <HomeView />;
      case "leaderboard":
        return <LeaderboardView />;
      case "explore":
        return <ExploreView />;
      case "search":
        return <SearchView />;
      case "profile":
        return <PublicProfileView />;
      case "post":
        return <PostDetailView />;
      case "rules":
        return <RulesView />;
      case "contact":
        return <ContactView />;
      case "winners":
        return <WinnersView />;

      // Auth
      case "login":
        return <LoginView />;
      case "register":
        return <RegisterView />;

      // User dashboard
      case "dashboard":
        return user ? <DashboardView /> : <LoginView />;
      case "timer":
        return user ? <TimerView /> : <LoginView />;
      case "tasks":
        return user ? <TasksView /> : <LoginView />;
      case "stats":
        return user ? <StatsView /> : <LoginView />;
      case "content":
        return user ? <ContentView /> : <LoginView />;
      case "social":
        return user ? <SocialView /> : <LoginView />;
      case "notifications":
        return user ? <NotificationsView /> : <LoginView />;
      case "settings":
        return user ? <SettingsView /> : <LoginView />;
      case "messages":
        return user ? <MessagesView /> : <LoginView />;
      case "messages-with":
        return user ? (
          <MessagesView initialPartnerUsername={param ?? undefined} />
        ) : (
          <LoginView />
        );
      case "report":
        return user ? <ReportView /> : <LoginView />;
      case "post-analytics":
        return user ? <PostAnalyticsView /> : <LoginView />;

      // Admin
      case "admin-dashboard":
        return user && user.role !== "USER" ? (
          <AdminDashboardView />
        ) : (
          <DashboardView />
        );
      case "admin-users":
        return user && user.role !== "USER" ? (
          <AdminUsersView />
        ) : (
          <DashboardView />
        );
      case "admin-times":
        return user && user.role !== "USER" ? (
          <AdminTimesView />
        ) : (
          <DashboardView />
        );
      case "admin-content":
        return user && user.role !== "USER" ? (
          <AdminContentView />
        ) : (
          <DashboardView />
        );
      case "admin-files":
        return user && user.role !== "USER" ? (
          <AdminFilesView />
        ) : (
          <DashboardView />
        );
      case "admin-rankings":
        return user && user.role !== "USER" ? (
          <AdminRankingsView />
        ) : (
          <DashboardView />
        );
      case "admin-reports":
        return user && user.role !== "USER" ? (
          <AdminReportsView />
        ) : (
          <DashboardView />
        );
      case "admin-violations":
        return user && user.role !== "USER" ? (
          <AdminViolationsView />
        ) : (
          <DashboardView />
        );
      case "admin-settings":
        return user && user.role !== "USER" ? (
          <AdminSettingsView />
        ) : (
          <DashboardView />
        );
      case "admin-awards":
        return user && user.role !== "USER" ? (
          <AdminAwardsView />
        ) : (
          <DashboardView />
        );

      default:
        return <HomeView />;
    }
  }, [view, user, waitingForAuth, param]);

  return <ViewErrorBoundary>{node}</ViewErrorBoundary>;
}

export default function Page({
  initialView,
  initialParam,
}: {
  initialView?: string;
  initialParam?: string | null;
}) {
  return (
    <AppShell initialView={initialView} initialParam={initialParam}>
      <ViewSwitch />
    </AppShell>
  );
}
