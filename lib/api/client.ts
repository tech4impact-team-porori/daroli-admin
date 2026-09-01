export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}

export const API_BASE_URL = getApiBaseUrl();

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
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (init.body) {
    headers["Content-Type"] = "application/json";
  }
  return {
    ...init,
    credentials: "include",
    headers,
  };
}


const KOREAN_REASON_MAP: Record<string, string> = {
  HELPER_HAS_ACTIVE_DEPENDENCIES:
    "담당 중인 대상자 또는 진행 중인 돌봄 요청이 있어 처리할 수 없습니다. 대상자 관리에서 먼저 담당 매니저를 변경하거나 해제해 주세요.",
  INVALID_HELPER_STATUS_TRANSITION:
    "올바르지 않은 매니저 상태 변경입니다.",
  HELPER_NOT_ELIGIBLE:
    "활동 승인(ACTIVE) 상태의 매니저만 배정할 수 있습니다.",
  HELPER_SERVICE_REGION_MISMATCH:
    "매니저의 활동 지역과 대상자의 거주 지역이 일치하지 않습니다.",
  RECIPIENT_ARCHIVED:
    "보관(삭제) 처리된 대상자입니다.",
  RECIPIENT_ALREADY_ARCHIVED:
    "이미 보관(삭제) 처리된 대상자입니다.",
  RECIPIENT_NOT_ARCHIVED:
    "보관되지 않은 대상자입니다.",
  RECIPIENT_HAS_ACTIVE_ASSIGNMENTS:
    "담당 매니저가 배정되어 있어 보관(삭제) 처리할 수 없습니다. 먼저 배정을 해제해 주세요.",
  RECIPIENT_HAS_ACTIVE_REQUESTS:
    "진행 중인 돌봄 요청이 있어 보관(삭제) 처리할 수 없습니다.",
  NO_ACTIVE_ASSIGNMENT:
    "현재 배정된 매니저가 없습니다.",
  BUDGET_NOT_CONFIGURED:
    "활동 단가 또는 예산이 설정되지 않았습니다. 설정 페이지에서 먼저 설정해 주세요.",
  SETTLEMENT_NOT_PENDING:
    "검토 대기(PENDING) 상태의 정산만 승인할 수 있습니다.",
  INSUFFICIENT_BALANCE:
    "출금 가능 잔액이 부족하여 처리할 수 없습니다.",
  ALREADY_APPROVED:
    "이미 승인된 항목입니다.",
  NOT_APPROVED:
    "승인되지 않은 항목입니다.",
  WITHDRAWAL_NOT_REQUESTED:
    "신청 대기(REQUESTED) 상태의 출금 건만 처리할 수 있습니다.",
  REJECTION_REASON_REQUIRED:
    "반려 사유를 반드시 입력해 주세요.",
  INVALID_CREDENTIALS:
    "이메일 또는 비밀번호가 올바르지 않습니다.",
  USER_DISABLED:
    "비활성화된 계정입니다. 관리자에게 문의해 주세요.",
  UNAUTHENTICATED:
    "로그인이 필요하거나 세션이 만료되었습니다. 다시 로그인해 주세요.",
  FORBIDDEN:
    "해당 작업을 수행할 권한이 없습니다.",
  NOT_FOUND:
    "요청하신 정보를 찾을 수 없습니다.",
  VALIDATION_ERROR:
    "입력값이 올바르지 않습니다. 확인 후 다시 시도해 주세요.",
  CONFLICT:
    "요청을 처리할 수 없는 상태입니다.",
  INTERNAL_ERROR:
    "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

const KOREAN_MESSAGE_MAP: Record<string, string> = {
  "Cannot deactivate helper with active assignments or requests":
    "담당 중인 대상자 또는 진행 중인 돌봄 요청이 있어 비활성화할 수 없습니다. 대상자 관리에서 먼저 담당 매니저를 변경하거나 해제해 주세요.",
  "Cannot archive recipient with active helper assignments":
    "담당 매니저가 배정되어 있어 보관(삭제) 처리할 수 없습니다. 먼저 배정을 해제해 주세요.",
  "Cannot archive recipient with active requests":
    "진행 중인 돌봄 요청이 있어 보관(삭제) 처리할 수 없습니다.",
  "Activity unit price not configured":
    "활동 단가가 설정되지 않았습니다. 설정 페이지에서 단가를 먼저 입력해 주세요.",
  "Rejection reason is required":
    "반려 사유를 반드시 입력해 주세요.",
  "The request is invalid.":
    "입력 형식이 올바르지 않습니다.",
  "The login request is invalid.":
    "로그인 정보 입력이 올바르지 않습니다.",
  "Email or password is incorrect.":
    "이메일 또는 비밀번호가 올바르지 않습니다.",
  "This user account is disabled.":
    "비활성화된 계정입니다. 관리자에게 문의해 주세요.",
  "Authentication is required.":
    "로그인이 필요합니다. 다시 로그인해 주세요.",
  "You do not have access to this resource.":
    "해당 기능에 접근할 수 있는 권한이 없습니다.",
  "An unexpected error occurred.":
    "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  "NetworkError when attempting to fetch resource.":
    "서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.",
  "Failed to fetch":
    "서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.",
};

export function toKoreanErrorMessage(rawMessage?: string, reason?: string, code?: string, status?: number): string {
  if (reason && KOREAN_REASON_MAP[reason]) {
    return KOREAN_REASON_MAP[reason];
  }
  if (rawMessage && KOREAN_MESSAGE_MAP[rawMessage]) {
    return KOREAN_MESSAGE_MAP[rawMessage];
  }
  if (code && KOREAN_REASON_MAP[code]) {
    return KOREAN_REASON_MAP[code];
  }
  if (status === 401) {
    return "로그인이 필요하거나 세션이 만료되었습니다. 다시 로그인해 주세요.";
  }
  if (status === 403) {
    return "접근 권한이 없습니다.";
  }
  if (status === 404) {
    return "요청하신 정보를 찾을 수 없습니다.";
  }
  if (status && status >= 500) {
    return "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
  return rawMessage || "오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

export async function parseApiError(json: unknown, status = 400): Promise<ApiError> {
  const errorObj = (json && typeof json === "object" && "error" in json ? (json as { error: Record<string, unknown> }).error : json) as Record<string, unknown> | null;
  const code = (typeof errorObj?.code === "string" ? errorObj.code : "UNKNOWN_ERROR");
  const reason = (typeof errorObj?.reason === "string" ? errorObj.reason : undefined);
  const rawMessage = (typeof errorObj?.message === "string" ? errorObj.message : undefined);
  const message = toKoreanErrorMessage(rawMessage, reason, code, status);
  return new ApiError(status, code, message, reason);
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const requestOptions = createRequestOptions(options);

  try {
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
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const rawMsg = err instanceof Error ? err.message : String(err);
    const koreanMsg = toKoreanErrorMessage(rawMsg, undefined, undefined, undefined);
    throw new ApiError(0, "NETWORK_ERROR", koreanMsg);
  }
}


