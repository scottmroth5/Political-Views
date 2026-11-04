/** Browser-side fetch helper for same-origin JSON API calls. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => null)) as
    (T & { error?: { code: string; message: string } }) | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error?.code ?? "UNKNOWN",
      data?.error?.message ?? "Something went wrong. Please try again.",
    );
  }
  return data as T;
}

export function modePath(mode: "GUIDED" | "CONVERSATION"): string {
  return mode === "GUIDED" ? "/discovery/guided" : "/discovery/conversation";
}
