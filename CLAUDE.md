# 다로리 관리자 대시보드

## 무엇을 만드는가

청도군 돌봄매니저 양성사업(㈜다로리인 수행)의 **운영 관리 웹**.
매칭 앱이 아니라 **공적 재원 집행 관리 시스템**이다.

**목적:** 현재 담당자가 HWP 활동일지를 받아 엑셀로 집계해 활동비를 정산하는 작업을 대체한다.
성패는 화면이 예쁜지가 아니라 그 반복 작업이 실제로 사라지는지로 결정된다.

**범위:** 관리자 전용 별도 사이트. (기획서 4장에서 "관리자 사이트 별도 개설 → 채택")
매니저·요청자용 화면은 이 프로젝트 범위가 아니다.

## 반드시 먼저 읽을 것

- `docs/관리자대시보드_제작기획.md` — **화면별 명세의 유일한 근거.** 2장이 핵심
- `docs/백엔드_소통가이드.md` — 데이터 구조, 백엔드와의 계약
- `docs/대시보드_재설계.md` — 대시보드(`/`) 전용. 기획서 3탭 구조를 액션 큐 중심으로 바꾸는
  팀 승인 변경안(B안 채택). 2장(누락 추적표)·4장(액션 큐 명세)이 핵심

화면을 만들기 전에 해당 화면의 명세 절을 반드시 확인할 것.
문서에는 🟦확정 / 🟨제안 / 🔴확인필요 표시가 붙어 있다. **🟦은 임의로 바꾸지 않는다.**

## 스택

Next.js (App Router) / TypeScript / Tailwind / shadcn/ui
Recharts / react-simple-maps / TanStack Table / Zod

## 절대 규칙

1. **화면 컴포넌트는 DB를 직접 호출하지 않는다.** 반드시 `lib/data` 의 `db` 경유
2. **금액 계산은 `lib/calc.ts` 안에서만.** 컴포넌트 안에서 계산 금지
3. **상태 문자열을 직접 쓰지 않는다.** `lib/status.ts` 의 상수만 사용
   - ❌ `if (log.status === 'pending')`
   - ✅ `if (log.status === LOG_STATUS.PENDING)`
4. **금액은 정수(원).** 소수점 금지. 나눗셈은 `Math.floor`
5. **가짜 데이터에 실제 개인정보를 넣지 않는다.** 가명만
6. 새 라이브러리를 임의로 추가하지 않는다

## 기획서 규칙 (임의로 바꾸지 말 것)

- **승인된 일지만** 월별 정산 산정에 포함
- **정산 승인은 2단계**: 정산 생성(calculated) → 정산 승인(approved) → 그때 잔액 적립
  일지 승인(`/review`)과 정산 승인(`/payments`)은 별개다
- **재산정은 미승인 건만** 갱신. 이미 승인·지급된 건은 건드리지 않는다
- **승인 취소는 잔액이 음수가 안 될 때만** 허용
- **잔액 = 승인 정산 총액 − (신청 중 + 지급 완료 출금)**
- **잔액 초과 출금 신청은 차단.** 반려된 출금 금액은 잔액으로 복귀
- **예산 카드는 반드시 분리 표시**: 지급 완료액 / 정산 필요(승인 미지급) / 승인 대기 예상액
  하나로 합치지 말 것. "정산 필요"는 주황으로 강조
  → **`/payments` 화면 규칙.** 대시보드(`/`)에는 이 중 "정산 필요(승인 미지급)" 하나만
  액션 큐 항목으로 올라간다 (`docs/대시보드_재설계.md` 2장·4장, Phase 13)
- **비활성·삭제된 매니저도 지급 이력이 있으면 표에 유지** (삭제는 `deletedAt` 표시만)
- **active 매니저만** 요청 배정·활동일지 작성 가능
- **반려에는 사유가 필수** (일지·출금 모두)
- **이번 달 배정 예산이 0이면** 설정 페이지 안내를 노출
- **"도움이 더 필요한 지역" 판정**: 대상자>0 AND (활동가능 매니저 0명 OR 대상자/매니저 ≥ 임계값)

## 하지 말 것

- **자동 승인 / AI 자동 분류 기능 제안** — 사업 요건상 관리자 검토가 필수다
- **일지 다건 일괄 승인** — 검토가 형식화되면 사업 요건 위반
- **요청 유형과 활동 유형을 한 차트에 합치기** — 변환 규칙이 아직 없다
- 요청하지 않은 파일 대량 생성
- 한 번에 여러 화면 만들기. **한 세션에 한 화면**

## 상태값 — 계약서 기준

근거: **「다로리 요청자/돌봄매니저 MVP API 계약서 v1.0.0-draft」 5장**

⚠️ **모든 열거형은 SCREAMING_SNAKE_CASE 대문자다.** 소문자 값을 쓰면 백엔드와 안 맞는다.

🟩 **계약 확정** (백엔드가 실제로 내려주는 값. 절대 바꾸지 말 것)
- 역할: `ADMIN` / `HELPER` / `REQUESTER`
- 매니저: `APPLIED` / `EDUCATED` / `ACTIVE` / `INACTIVE`
- 요청 상태: `REQUESTED` / `PROPOSED` / `CONFIRMED` / `COMPLETED` / `CANCELLED`
- 대상자 유형: `ELDERLY` / `CHILD` (어르신은 ELDER 가 아니라 **ELDERLY**)
- 요청 유형: `HOSPITAL_RIDE` / `COMPANIONSHIP` / `HOME_HELP` / `MEAL_SUPPORT` / `OTHER`
- 읍·면: **문자열 이름** (`"청도읍"`). 법정동 코드 아님

🟨 **관리자 계약 대기** — 계약서 14장에서 관리자 기능은 범위 제외라 아직 확정 전.
같은 대문자 규약을 따라 임시로 정해뒀다. 확답이 오면 `lib/status.ts` 만 고친다.
- 일지 상태: `PENDING` / `APPROVED` / `REJECTED`
- 출금 상태: `REQUESTED` / `PAID` / `REJECTED`
- 정산 상태: `CALCULATED` / `APPROVED`
- 활동 유형이 3종인지 5종인지 미확정

## 백엔드 API

- 로컬 기본 URL `http://localhost:4000`, 프론트는 **DB에 직접 연결하지 않는다**
- 인증: 세션 쿠키 `darori_session` (HttpOnly). 모든 인증 요청에 `credentials: "include"`
- 구현된 엔드포인트는 `/health`, `/auth/login`, `/auth/me`, `/auth/logout` 뿐
- **관리자용 엔드포인트는 아직 계약 자체가 없다.** 그때까지 `lib/data/mock.ts` 유지
- 오류 분기는 영어 `message` 가 아니라 `code` 와 `reason` 으로 한다
- 시간은 RFC3339 UTC로 오고, 화면에 그릴 때 Asia/Seoul 로 변환한다

## 디자인

- 관리자(운영 담당자)용. **어르신용이 아니다.** 정보 밀도를 높인다
- 흰 배경 / 얇은 회색 보더 / 라운드 카드 / 다로리 초록 포인트 / 경고는 주황
- 숫자는 `tabular-nums`. 금액은 `₩20,000,000` 형식, 표에서 축약 금지
- 상태 색: 대기=amber / 진행=blue / 완료=emerald / 반려=rose
- 되돌릴 수 없는 액션(지급 완료, 승인 취소, 삭제, 단가 변경)은 확인 다이얼로그
- 목록 화면은 로딩·정상·빈 상태·에러 4가지를 모두 처리

## 용어

계약서 3.2 기준. **요청자와 대상자는 다른 개념이다.**

| 한국어 | 코드 | 뜻 |
|---|---|---|
| 관리자 | `ADMIN` | 다로리인 운영 담당자. 이 웹의 사용자 |
| 돌봄매니저 | `HELPER` | 실제 돌봄 활동을 하는 지역 주민 |
| **요청자** | `REQUESTER` | 돌봄 요청을 제출하는 **로그인 계정** (보호자 등) |
| **대상자** | `Recipient` 타입 | 실제 돌봄을 **받는 사람** (어르신·아동) |

예전에 요청자를 `recipient` 라고 불렀는데 계약서 기준으로 `REQUESTER` 가 맞다.
`Recipient` 타입은 대상자를 가리키므로 헷갈리지 말 것.

서비스명은 **다로리(DAROLI)**. 포로리·DOUM은 옛 이름이므로 쓰지 않는다.

## 현재 상태

기획서 2장의 10개 화면 전부 구현 완료 (Phase 1~9). **Phase 13·14 완료** — 대시보드(`/`)를
3탭 구조에서 액션 큐 중심 단일 화면으로 재설계했고(`docs/대시보드_재설계.md` B안, 팀 승인됨),
지도(`components/region-map.tsx`)는 `/managers` 화면으로 이동해 "수요 보기/매니저 보기" 토글을
추가했다 (커밋 `726adac`).

**Phase 16 진행 중** — 백엔드 API 계약서를 받아 상태값을 전부 대문자로 전환했다.
`lib/status.ts`·`lib/data/mock.ts`·`app/recipients/page.tsx`·`lib/calc.test.ts` 수정.
관리자용 API 계약은 아직 없어 DB 연결(Phase 17~18)은 시작 못 한다.

상세 로드맵은 `다음단계.md`·`docs/운영투입_로드맵.md` 참고.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
