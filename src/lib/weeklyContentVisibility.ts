import { parseISODate, toISODate } from "./weeks";

/** 주차 콘텐츠(수업 내용·클리닉 점검표)가 학생에게 공개되는 시각 =
 * 그 주차(월요일 기준)의 일요일 22시.
 *
 * 종주T가 토요일 수업을 마치고 수업 내용과 점검표를 한자리에서 바로
 * 정리해둘 수 있게 하되, 학생에게는 그 주가 끝나는 일요일 밤에 한꺼번에
 * 열어준다. 주차 표기는 "수업을 한 주"의 월요일이므로(weeks.ts 참고),
 * 공개일은 week_start + 6일이 된다.
 *
 * 점검표에도 이 시각이 딱 맞는다 — 그 주차 클리닉은 다음 주에 진행되므로
 * (rollingClinicWeeks 참고) 일요일 밤 공개면 클리닉 주가 시작되기 직전이다. */
export function publishDateISO(weekStartISO: string): string {
  const d = parseISODate(weekStartISO);
  d.setDate(d.getDate() + 6);
  return toISODate(d);
}

export const PUBLISH_HOUR = 22;

/** 지금(KST 기준 날짜·시)에 그 주차 콘텐츠가 공개 상태인지.
 *
 * 날짜 문자열끼리 비교한다 — Date 객체로 시각을 다루면 서버 타임존(UTC)이
 * 섞여 하루가 밀린다(today.ts 참고). 호출부가 KST 기준 날짜와 시를 넘긴다. */
export function isWeeklyContentPublished(
  weekStartISO: string,
  todayISO: string,
  kstHour: number
): boolean {
  const publish = publishDateISO(weekStartISO);
  if (todayISO > publish) return true;
  if (todayISO === publish) return kstHour >= PUBLISH_HOUR;
  return false;
}
