import { DAY_ORDER } from "./types";

/** 검색어를 담는 주소 칸. 붙이는 쪽(명단 화면)과 읽는 쪽(뒤로가기 주소)이
 * 어긋나면 조용히 안 되므로 한 곳에서 만든다. */
export const SEARCH_QUERY_KEY = "q";

/** 주소에서 받은 검색어를 그대로 믿지 않는다 — 길이를 자르고 공백을 다듬는다.
 * 사람이 친 글자라 무엇이든 들어올 수 있고, 그대로 주소에 되붙이기 때문. */
export function safeSearchQuery(q: string | undefined): string {
  return (q ?? "").trim().slice(0, 60);
}

/** 이미 `?`로 시작하는 주소 뒤에 붙일 검색어 조각. 없으면 빈 문자열. */
export function searchSuffixOf(q: string | undefined): string {
  const v = safeSearchQuery(q);
  return v ? `&${SEARCH_QUERY_KEY}=${encodeURIComponent(v)}` : "";
}

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
  /** 치고 있던 검색어 — 돌아갔을 때 명단이 처음으로 리셋되지 않도록. */
  q?: string;
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
  const day = safeDay(ctx?.day);
  const search = safeSearchQuery(ctx?.q);
  const target = isKnown(from) ? targets[from] : undefined;

  // 출처를 모르면 기본 화면으로 간다. 그래도 **보던 요일 탭과 검색어는 들고
  // 간다** — 목록 화면에서 바로 들어온 경우가 이쪽이고, 여기서 검색이
  // 리셋되는 게 조교들이 제일 자주 겪던 불편이었다.
  //
  // 날짜와 학생 앵커는 안 들고 간다. 그 둘은 "어느 출결 화면의 어느 날"을
  // 가리키는 값이라, 어디로 가는지 모르는 채로 붙이면 엉뚱한 곳을 가리킨다.
  if (!target) {
    const parts = [
      day ? `day=${day}` : "",
      search ? `${SEARCH_QUERY_KEY}=${encodeURIComponent(search)}` : "",
    ].filter(Boolean);
    return `${fallback}${parts.length > 0 ? `?${parts.join("&")}` : ""}`;
  }

  const d = safeDate(ctx?.date);
  // 날짜·요일이 없어도 검색어만으로 ?가 시작될 수 있어 조각을 순서대로 잇는다.
  const parts = [
    d ? `date=${d}` : day ? `day=${day}` : "",
    search ? `${SEARCH_QUERY_KEY}=${encodeURIComponent(search)}` : "",
  ].filter(Boolean);
  const query = parts.length > 0 ? `?${parts.join("&")}` : "";
  return `${target}${query}${safeAnchor(ctx?.studentId)}`;
}

/** 상세 화면 안에서 주차를 바꿔도 출처(와 보던 날짜·요일)가 유지되도록
 * 붙여주는 쿼리 조각. 앞에 이미 ?week=... 이 있다고 보고 &로 시작한다.
 * 학생은 주소(route param)에 이미 있으니 여기서 들고 다닐 필요가 없다. */
export function fromQuery(from: string | undefined, ctx?: BackContext): string {
  if (!isKnown(from)) return "";
  const d = safeDate(ctx?.date);
  const day = safeDay(ctx?.day);
  return `&from=${from}${d ? `&date=${d}` : ""}${day ? `&day=${day}` : ""}${searchSuffixOf(ctx?.q)}`;
}
