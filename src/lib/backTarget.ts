import { DAY_ORDER } from "./types";

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

/** 출결 화면으로 돌아갈 때 "보던 자리"를 되살리는 데 필요한 것들.
 * 전부 주소에 그대로 붙는 값이라 하나씩 모양을 확인하고 넘긴다. */
export interface BackContext {
  /** 강의 출결이 보고 있던 날짜 "YYYY-MM-DD". */
  date?: string;
  /** 클리닉 출결이 보고 있던 요일 탭 "수". */
  day?: string;
  /** 눌렀던 학생 — 돌아갔을 때 그 카드로 바로 내려가도록 앵커를 만든다. */
  studentId?: number;
}

/** 강의 출결은 **날짜별** 화면이라, 그냥 돌아가면 보고 있던 날이 아니라
 * 오늘로 튄다. 그래서 날짜를 같이 들고 다닌다. */
function safeDate(date: string | undefined): string | null {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/** 클리닉 출결은 **요일 탭** 화면이라 마찬가지로 오늘 탭으로 튄다.
 * 요일은 정해진 7개뿐이라 목록으로 확인한다. */
function safeDay(day: string | undefined): string | null {
  return day && (DAY_ORDER as readonly string[]).includes(day) ? day : null;
}

/** 출결 화면의 학생 카드에 붙는 id — 뒤로가기 앵커가 이걸 찾아 내려간다.
 * 붙이는 쪽과 찾는 쪽이 어긋나면 조용히 최상단으로 가버리므로 한 곳에서 만든다. */
export function studentAnchorId(studentId: number): string {
  return `s${studentId}`;
}

function safeAnchor(studentId: number | undefined): string {
  return Number.isInteger(studentId) && studentId! > 0 ? `#${studentAnchorId(studentId!)}` : "";
}

/** targets는 역할별 실제 주소 — 같은 "출결"이라도 조교는 /staff/attendance,
 * 종주T는 /admin/students/attendance라 호출부가 넘겨준다.
 *
 * 돌아갈 때 보던 날짜·요일 탭과 **눌렀던 학생 카드 위치**까지 되살린다 —
 * 화면 최상단으로 떨어지면 명단을 다시 스크롤해 내려와야 한다. */
export function resolveBackHref(
  from: string | undefined,
  fallback: string,
  targets: Partial<Record<BackFrom, string>>,
  ctx?: BackContext
): string {
  const target = isKnown(from) ? targets[from] : undefined;
  if (!target) return fallback;
  const d = safeDate(ctx?.date);
  const day = safeDay(ctx?.day);
  const query = d ? `?date=${d}` : day ? `?day=${day}` : "";
  return `${target}${query}${safeAnchor(ctx?.studentId)}`;
}

/** 상세 화면 안에서 주차를 바꿔도 출처(와 보던 날짜·요일)가 유지되도록
 * 붙여주는 쿼리 조각. 앞에 이미 ?week=... 이 있다고 보고 &로 시작한다.
 * 학생은 주소(route param)에 이미 있으니 여기서 들고 다닐 필요가 없다. */
export function fromQuery(from: string | undefined, ctx?: BackContext): string {
  if (!isKnown(from)) return "";
  const d = safeDate(ctx?.date);
  const day = safeDay(ctx?.day);
  return `&from=${from}${d ? `&date=${d}` : ""}${day ? `&day=${day}` : ""}`;
}
