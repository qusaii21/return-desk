export class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

// Calls the API and turns its JSON error body into a thrown error with the
// server's own message, so the UI can show exactly why something was refused.
export async function api<T = void>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiClientError("Could not reach the server. Check your connection and try again.", "NETWORK_ERROR");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(
      body?.error?.message ?? `The server returned an unexpected response (${res.status}).`,
      body?.error?.code ?? "UNKNOWN",
      body?.error?.details,
    );
  }
  return body as T;
}
