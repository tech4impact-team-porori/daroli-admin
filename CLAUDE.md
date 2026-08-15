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

## 아직 확정되지 않은 것

`lib/status.ts` 에 🟨로 표시된 값들은 백엔드 담당자 확답 전 임시값이다.
확답이 오면 **그 파일만 고친다.** 화면 코드는 손대지 않는다.

- 일지 상태: `pending` / `approved` / `rejected` (임시)
- 출금 상태: `requested` / `paid` / `rejected` (임시)
- 정산 상태: `calculated` / `approved` (임시)
- 매니저 비활성: `inactive` (임시)
- 활동 유형이 3종인지 5종인지 미확정

확정된 것 (기획서 원문 명시, 바꾸지 말 것):
- 매니저: `applied` / `educated` / `active`
- 요청: `requested` / `proposed` / `confirmed` / `completed` / `cancelled`

## 디자인

- 관리자(운영 담당자)용. **어르신용이 아니다.** 정보 밀도를 높인다
- 흰 배경 / 얇은 회색 보더 / 라운드 카드 / 다로리 초록 포인트 / 경고는 주황
- 숫자는 `tabular-nums`. 금액은 `₩20,000,000` 형식, 표에서 축약 금지
- 상태 색: 대기=amber / 진행=blue / 완료=emerald / 반려=rose
- 되돌릴 수 없는 액션(지급 완료, 승인 취소, 삭제, 단가 변경)은 확인 다이얼로그
- 목록 화면은 로딩·정상·빈 상태·에러 4가지를 모두 처리

## 용어

관리자 = admin (다로리인 운영 담당자) / 매니저 = helper / 요청자 = recipient
서비스명은 **다로리(DAROLI)**. 포로리·DOUM은 옛 이름이므로 쓰지 않는다.

## 현재 상태

Phase 0 완료 — `lib/status.ts`, `lib/types.ts`, `lib/calc.ts`, `lib/data/index.ts` 작성됨.
**다음: Phase 1** (Next.js 셋업 + 앱 껍데기). `다음단계.md` 참고.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
