export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createRequestOptions(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  };
}

export async function parseApiError(json: unknown, status = 400): Promise<ApiError> {
  const errorObj = (json && typeof json === "object" && "error" in json ? (json as { error: Record<string, unknown> }).error : json) as Record<string, unknown> | null;
  const code = (typeof errorObj?.code === "string" ? errorObj.code : "UNKNOWN_ERROR");
  const reason = (typeof errorObj?.reason === "string" ? errorObj.reason : undefined);
  const message = (typeof errorObj?.message === "string" ? errorObj.message : "An unexpected error occurred.");
  return new ApiError(status, code, message, reason);
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const requestOptions = createRequestOptions(options);

  const res = await fetch(url, requestOptions);
  let data: unknown = null;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  }

  if (!res.ok) {
    throw await parseApiError(data, res.status);
  }

  return data as T;
}

