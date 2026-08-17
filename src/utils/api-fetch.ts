/**
 * Thin fetch wrapper that always sends credentials and returns parsed JSON.
 */
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
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      return { ok: false, error: json.error || "خطای ناشناخته" };
    }
    return { ok: true, data: json.data as T };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
