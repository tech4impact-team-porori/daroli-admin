import { API_BASE_URL, ApiError, createRequestOptions, parseApiError } from "../api/client";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "HELPER" | "REQUESTER";
}

export interface SessionResponse {
  user: AdminUser;
  helper?: { status: string };
}

export async function requireAdminSession(
  fetcher: typeof fetch = fetch,
): Promise<SessionResponse> {
  const url = `${API_BASE_URL}/auth/me`;
  const res = await fetcher(url, createRequestOptions({ method: "GET" }));

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Ignore JSON parse error
  }

  if (!res.ok) {
    throw await parseApiError(data, res.status);
  }

  const sessionData = data as SessionResponse | null;
  if (!sessionData?.user || sessionData.user.role !== "ADMIN") {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "관리자 권한이 필요합니다. 관리자 계정으로 로그인해 주세요.",
    );
  }

  return sessionData;
}

export async function loginAdmin(
  email: string,
  password: string,
  fetcher: typeof fetch = fetch,
): Promise<AdminUser> {
  const url = `${API_BASE_URL}/auth/login`;
  const res = await fetcher(
    url,
    createRequestOptions({
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  );

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Ignore JSON parse error
  }

  if (!res.ok) {
    throw await parseApiError(data, res.status);
  }

  const sessionData = data as SessionResponse | null;
  if (!sessionData?.user || sessionData.user.role !== "ADMIN") {
    // Immediately log out if non-admin
    try {
      await fetcher(`${API_BASE_URL}/auth/logout`, createRequestOptions({ method: "POST" }));
    } catch {
      // Ignore logout error
    }
    throw new ApiError(
      403,
      "FORBIDDEN",
      "관리자 권한이 필요합니다. 관리자 계정으로 로그인해 주세요.",
    );
  }

  return sessionData.user;
}


export async function logoutAdmin(fetcher: typeof fetch = fetch): Promise<void> {
  const url = `${API_BASE_URL}/auth/logout`;
  await fetcher(url, createRequestOptions({ method: "POST" }));
}
