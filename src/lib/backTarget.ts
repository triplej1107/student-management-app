/** 클리닉 점검표 상세는 여러 화면(결재/클리닉 목록, 밀림 관리, 클리닉 출결,
 * 강의 출결)에서 들어온다. 뒤로가기가 항상 같은 곳으로 가면 엉뚱한 화면으로
 * 나가므로, 링크에 ?from=... 을 붙여 출처를 알려준다.
 *
 * 임의의 URL을 그대로 받지 않고 정해진 키만 해석한다 — 쿼리스트링으로 들어온
 * 주소로 그냥 이동시키면 외부 사이트로 튕겨보낼 수 있기 때문. */
export const BACK_FROM_KEYS = ["backlog", "attendance", "lecture"] as const;
export type BackFrom = (typeof BACK_FROM_KEYS)[number];

function isKnown(from: string | undefined): from is BackFrom {
  return !!from && (BACK_FROM_KEYS as readonly string[]).includes(from);
}

/** 강의 출결은 **날짜별** 화면이라, 그냥 돌아가면 보고 있던 날이 아니라
 * 오늘로 튄다. 그래서 날짜를 같이 들고 다닌다. 주소에 그대로 붙는 값이므로
 * from과 같은 이유로 YYYY-MM-DD 모양만 통과시킨다. */
function safeDate(date: string | undefined): string | null {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/** targets는 역할별 실제 주소 — 같은 "출결"이라도 조교는 /staff/attendance,
 * 종주T는 /admin/students/attendance라 호출부가 넘겨준다. */
export function resolveBackHref(
  from: string | undefined,
  fallback: string,
  targets: Partial<Record<BackFrom, string>>,
  date?: string
): string {
  const target = isKnown(from) ? targets[from] : undefined;
  if (!target) return fallback;
  const d = safeDate(date);
  return d ? `${target}?date=${d}` : target;
}

/** 상세 화면 안에서 주차를 바꿔도 출처(와 보던 날짜)가 유지되도록 붙여주는
 * 쿼리 조각. 앞에 이미 ?week=... 이 있다고 보고 &로 시작한다. */
export function fromQuery(from: string | undefined, date?: string): string {
  if (!isKnown(from)) return "";
  const d = safeDate(date);
  return `&from=${from}${d ? `&date=${d}` : ""}`;
}
