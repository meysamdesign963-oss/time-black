/**
 * SPA view-routing store with URL sync
 * -------------------------------------
 * Since the platform lives on `/`, we manage the current "page" via a
 * zustand store AND sync it to the URL query string so URLs are shareable
 * and SEO-friendly:
 *   /?view=profile&param=admin
 *   /?view=post&param=my-post-slug
 *   /?view=leaderboard
 *
 * On mount, the store reads the URL to restore state (deep-linking).
 * On navigate, the URL is updated via history.replaceState (no page reload).
 */
import { create } from "zustand";

export type ViewKey =
  // public
  | "home"
  | "leaderboard"
  | "explore"
  | "search"
  | "profile"
  | "post"
  | "rules"
  | "contact"
  | "login"
  | "register"
  | "winners"
  // user dashboard
  | "dashboard"
  | "timer"
  | "tasks"
  | "stats"
  | "content"
  | "social"
  | "notifications"
  | "settings"
  | "messages"
  | "messages-with"
  | "report"
  | "post-analytics"
  // admin
  | "admin-dashboard"
  | "admin-users"
  | "admin-times"
  | "admin-content"
  | "admin-files"
  | "admin-rankings"
  | "admin-reports"
  | "admin-violations"
  | "admin-settings"
  | "admin-awards";

type RouterState = {
  view: ViewKey;
  /** Optional route param (e.g. profile username, post slug) */
  param: string | null;
  /** Navigation history for back button */
  history: ViewKey[];
  navigate: (view: ViewKey, param?: string | null) => void;
  back: () => void;
  /** Restore state from URL query string (call on mount) */
  initFromUrl: () => void;
  /** Whether the current view is a dashboard (requires auth) */
  isDashboard: () => boolean;
  /** Whether the current view is an admin panel */
  isAdmin: () => boolean;
  /** Whether the current view is public (no auth needed) */
  isPublic: () => boolean;
};

const DASHBOARD_VIEWS: ViewKey[] = [
  "dashboard",
  "timer",
  "tasks",
  "stats",
  "content",
  "social",
  "notifications",
  "settings",
  "messages",
  "report",
  "post-analytics",
];

const ADMIN_VIEWS: ViewKey[] = [
  "admin-dashboard",
  "admin-users",
  "admin-times",
  "admin-content",
  "admin-files",
  "admin-rankings",
  "admin-reports",
  "admin-violations",
  "admin-settings",
  "admin-awards",
];

/** Valid view keys for URL validation */
const ALL_VIEWS = new Set<string>([
  ...DASHBOARD_VIEWS,
  ...ADMIN_VIEWS,
  "home",
  "leaderboard",
  "explore",
  "search",
  "profile",
  "post",
  "rules",
  "contact",
  "login",
  "register",
  "winners",
  "messages-with",
]);

/** Read view + param from URL path or query string */
function readFromUrl(): { view: ViewKey; param: string | null } {
  if (typeof window === "undefined") return { view: "home", param: null };
  const path = window.location.pathname;

  // Clean URL paths: /profile/xxx, /post/xxx, /leaderboard, etc.
  if (path === "/" || path === "") return { view: "home", param: null };
  if (path === "/leaderboard") return { view: "leaderboard", param: null };
  if (path === "/explore") return { view: "explore", param: null };
  if (path === "/winners") return { view: "winners", param: null };
  if (path === "/search") return { view: "search", param: null };
  if (path === "/rules") return { view: "rules", param: null };
  if (path === "/contact") return { view: "contact", param: null };

  const profileMatch = path.match(/^\/profile\/([^/]+)$/);
  if (profileMatch) return { view: "profile", param: decodeURIComponent(profileMatch[1]) };

  const postMatch = path.match(/^\/post\/([^/]+)$/);
  if (postMatch) return { view: "post", param: decodeURIComponent(postMatch[1]) };

  // Fallback: query string ?view=xxx&param=yyy
  const params = new URLSearchParams(window.location.search);
  const viewStr = params.get("view") || "home";
  const view = (ALL_VIEWS.has(viewStr) ? viewStr : "home") as ViewKey;
  const param = params.get("param") || params.get("slug") || params.get("username") || null;
  return { view, param };
}

/** Map view+param to a clean URL path (for shareable URLs) */
function viewToPath(view: ViewKey, param: string | null): string {
  switch (view) {
    case "home":
      return "/";
    case "leaderboard":
      return "/leaderboard";
    case "explore":
      return "/explore";
    case "winners":
      return "/winners";
    case "search":
      return "/search";
    case "profile":
      return param ? `/profile/${param}` : "/explore";
    case "post":
      return param ? `/post/${param}` : "/explore";
    case "rules":
      return "/rules";
    case "contact":
      return "/contact";
    default:
      // Dashboard/admin views stay as ?view= (not public-shareable)
      return `/?view=${view}${param ? `&param=${param}` : ""}`;
  }
}

/** Write view + param to URL (pushState for clean URLs, replaceState for ?view=) */
function writeToUrl(view: ViewKey, param: string | null) {
  if (typeof window === "undefined") return;
  const path = viewToPath(view, param);
  // Use pushState so browser back works with clean URLs
  window.history.pushState({ view, param }, "", path);
}

export const useRouterStore = create<RouterState>((set, get) => ({
  view: "home",
  param: null,
  history: [],
  navigate: (view, param = null) => {
    const current = get().view;
    if (current === view && get().param === param) return;
    set((s) => ({
      view,
      param,
      history: [...s.history, current].slice(-20),
    }));
    // Sync to URL
    writeToUrl(view, param);
    // Scroll main content to top on navigation
    if (typeof window !== "undefined") {
      const main = document.getElementById("main-scroll");
      if (main) main.scrollTo({ top: 0, behavior: "smooth" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }
  },
  back: () => {
    // Use browser history (works with pushState clean URLs)
    if (typeof window !== "undefined") window.history.back();
  },
  initFromUrl: () => {
    const { view, param } = readFromUrl();
    set({ view, param });
  },
  isDashboard: () => DASHBOARD_VIEWS.includes(get().view),
  isAdmin: () => ADMIN_VIEWS.includes(get().view),
  isPublic: () =>
    !DASHBOARD_VIEWS.includes(get().view) && !ADMIN_VIEWS.includes(get().view),
}));

export const DASHBOARD_VIEW_LIST = DASHBOARD_VIEWS;
export const ADMIN_VIEW_LIST = ADMIN_VIEWS;
