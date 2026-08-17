/**
 * Thin fetch wrapper with 401 session-expiry handling.
 * On 401, clears auth state and navigates to login.
 */
let _handling401 = false;

export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const { headers: optHeaders, ...rest } = options || {};
    const method = (rest.method || "GET").toUpperCase();
    const res = await fetch(url, {
      credentials: "include",
      ...rest,
      headers: {
        ...(method !== "GET" && method !== "HEAD"
          ? { "Content-Type": "application/json" }
          : {}),
        ...(optHeaders || {}),
      },
    });

    // Handle 401 — session expired
    if (res.status === 401 && !_handling401) {
      _handling401 = true;
      try {
        const { useAuthStore } = await import("@/store/auth");
        const { useRouterStore } = await import("@/store/router");
        useAuthStore.getState().setUser(null);
        useRouterStore.getState().navigate("login");
      } catch {
        if (typeof window !== "undefined") window.location.href = "/?view=login";
      } finally {
        _handling401 = false;
      }
      return { ok: false, error: "سشن منقضی شده. دوباره وارد شوید." };
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      return { ok: false, error: json.error || "خطای ناشنخته" };
    }
    return { ok: true, data: json.data as T };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
