/**
 * 장학금 규칙 — 순수 계산만. DB를 건드리는 조회는 scholarships.ts에 있다.
 * 금액이나 조건을 바꿀 일이 생기면 여기만 고치면 되고, 테스트도 여기에 붙는다.
 */

/** 친구 소개 장학금 (문화상품권). 소개한 학생이 받는다. */
export const REFERRAL_AMOUNT = 50000;
/** 내신 1등급 장학금. */
export const GRADE_AMOUNT = 30000;
/** 1등급 + 전교 3등 이내면 이 금액으로 올라간다(더해지는 게 아니라 대체). */
export const GRADE_TOP_AMOUNT = 50000;
export const GRADE_TOP_RANK = 3;

/**
 * 회원명단 [메모]/[비고] 원문에서 소개한 학생 이름을 뽑는다.
 *
 * 실제 메모는 "이승훈 소개" 한 줄로 끝나기도 하지만 "반규현 소개\n공부 의욕이
 * 많다."처럼 다른 메모가 뒤에 붙기도 해서, 줄 전체를 보지 말고 "소개" 앞의
 * 이름만 집어낸다. "여름 특강 수강"처럼 소개와 무관한 메모는 걸리지 않는다.
 */
export function parseReferrerName(note: string | null | undefined): string | null {
  if (!note) return null;
  // "주환학생 소개"처럼 이름 뒤에 "학생"이 붙는 경우를 먼저 걸러낸다. 이 패턴을
  // 나중에 보면 앞의 일반 패턴이 "주환학생"을 통째로 이름으로 집어간다.
  const withSuffix = note.match(/([가-힣]{2,4})\s*(?:학생|군|양)\s*소개/);
  if (withSuffix) return withSuffix[1];
  const m = note.match(/([가-힣]{2,4})\s*소개/);
  return m ? m[1] : null;
}

/**
 * 소개 장학금을 줄 수 있게 되는 날("YYYY-MM-DD") — 첫수업 다음 달 1일.
 *
 * 원장님과 정한 기준: 첫수업이 8월이면 둘째 달인 9월이 시작되고도 계속 다니면
 * 그 달에 바로 지급 대상. 9월 원비를 냈다는 게 곧 "두 달 연속"이라는 뜻이다.
 */
export function referralDueFromISO(firstLessonISO: string): string {
  const [y, m] = firstLessonISO.split("-").map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return `${nextY}-${String(nextM).padStart(2, "0")}-01`;
}

/** 1등급 장학금 금액 — 전교 3등 이내면 5만원, 아니면 3만원. */
export function gradeScholarshipAmount(rank: number | null): number {
  return rank !== null && rank <= GRADE_TOP_RANK ? GRADE_TOP_AMOUNT : GRADE_AMOUNT;
}

export type ReferralState =
  /** 조건 충족 · 아직 안 줌 */
  | "due"
  /** 아직 두 달이 안 됨 */
  | "waiting"
  | "paid"
  /** 두 달을 못 채우고 퇴원 */
  | "void"
  /** 소개자를 못 찾았거나 첫수업일이 없어 판정 불가 */
  | "unknown";

export function referralState(args: {
  paid: boolean;
  hasReferrer: boolean;
  firstLessonISO: string | null;
  withdrawnAtISO: string | null;
  todayISO: string;
}): ReferralState {
  if (args.paid) return "paid";
  if (!args.hasReferrer || !args.firstLessonISO) return "unknown";
  const dueFrom = referralDueFromISO(args.firstLessonISO);
  // 지급일이 되기 전에 그만뒀으면 두 달을 못 채운 것. 그 뒤에 그만둔 건
  // 이미 두 달을 다닌 뒤라 장학금은 그대로 나간다.
  if (args.withdrawnAtISO && args.withdrawnAtISO.slice(0, 10) < dueFrom) return "void";
  return args.todayISO >= dueFrom ? "due" : "waiting";
}

export const REFERRAL_STATE_LABEL: Record<ReferralState, string> = {
  due: "지급 대상",
  waiting: "대기 중",
  paid: "지급 완료",
  void: "무효(조기 퇴원)",
  unknown: "확인 필요",
};
