/**
 * 주말 강의 출결 판정 — 순수 계산만. DB 조회는 lectureAttendance.ts에 있다.
 *
 * 앱은 학생마다 강의 요일·시간(class_day/class_time)을 이미 갖고 있다
 * (회원명단 엑셀에서 "종주(고1정규)-일19시[고등국어]"를 읽어 채운 값).
 * 그래서 "오늘 누가 와야 하는지"는 앱이 알고, 맥가이7에서 가져와야 하는
 * 것은 "실제로 누가 찍었는지" 하나뿐이다.
 */

/** 수업 시작 후 이만큼 지나서 찍으면 지각으로 본다. */
export const LATE_AFTER_MINUTES = 10;

/** 수업 시작 후 이만큼 지나도 안 찍혔으면 "안 왔다"고 판단한다.
 * 지각 기준보다 넉넉히 두는 이유 — 키오스크 줄이 밀리거나 동기화가 한 박자
 * 늦을 수 있어서, 실제로 와 있는 학생에게 결석 알림이 가면 안 된다. */
export const MISSING_AFTER_MINUTES = 20;

export interface LectureRosterEntry {
  studentId: number;
  studentCode: string;
  name: string;
  /** "09:00" — 그날 실제로 적용되는 시작 시각(조정됐으면 옮긴 시각) */
  time: string;
  /** 그 주만 시간을 옮긴 학생인지 — 화면에 "조정"으로 표시한다. */
  moved: boolean;
}

/** 그 주만 강의 시간을 옮긴 기록 — 클리닉의 대체 일정과 같은 개념. */
export interface LectureOverride {
  studentId: number;
  movedDay: string;
  movedTime: string;
}

/** "HH:MM" → 자정 기준 분. 못 읽으면 null. */
export function minutesOfTime(hhmm: string): number | null {
  const m = hhmm?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export interface ScheduledStudent {
  id: number;
  student_code: string;
  name: string;
  class_day: string | null;
  class_time: string | null;
}

/**
 * 그 요일에 실제로 와야 하는 학생을 추린다.
 *
 * 그 주만 시간을 옮긴 학생(overrides)은 **원래 날짜 명단에서 빠지고 옮겨간
 * 날짜 명단에 들어간다** — 클리닉 대체 일정과 같은 방식이다. 안 그러면
 * 옮겨준 학생이 원래 날짜에 결석으로 잡혀 애먼 알림이 나간다.
 *
 * 요일이나 시간이 비어 있으면 뺀다 — 시각을 모르면 지각·미출석을 판정할 수
 * 없고, 모르는 채로 결석 알림을 보내는 것이 안 보내는 것보다 훨씬 나쁘다.
 */
export function lectureRosterForDay(
  students: ScheduledStudent[],
  dayLabel: string,
  overrides: Map<number, LectureOverride> = new Map()
): LectureRosterEntry[] {
  const roster: LectureRosterEntry[] = [];
  for (const s of students) {
    const override = overrides.get(s.id);
    const day = override ? override.movedDay : s.class_day;
    const time = override ? override.movedTime : s.class_time;
    if (day !== dayLabel) continue;
    if (minutesOfTime(time ?? "") === null) continue;
    roster.push({
      studentId: s.id,
      studentCode: s.student_code,
      name: s.name,
      time: time!,
      moved: !!override,
    });
  }
  return roster;
}

/**
 * 등원 시각으로 출석/지각을 가른다. 수업 시작보다 일찍 왔으면 당연히 출석,
 * LATE_AFTER_MINUTES를 넘겨 찍었으면 지각.
 * 시각을 못 읽으면 일단 출석으로 둔다 — 찍고 온 학생을 지각으로 몰지 않는다.
 */
export function statusForCheckIn(
  scheduledTime: string,
  checkedInTime: string,
  lateAfterMinutes = LATE_AFTER_MINUTES
): "출석" | "지각" {
  const scheduled = minutesOfTime(scheduledTime);
  const arrived = minutesOfTime(checkedInTime);
  if (scheduled === null || arrived === null) return "출석";
  return arrived > scheduled + lateAfterMinutes ? "지각" : "출석";
}

/**
 * 지금 기준으로 "왔어야 하는데 안 온" 학생.
 *
 * 아직 수업 시작 전이거나 유예 시간 안이면 아무도 안 잡는다 — 9시 수업인데
 * 8시에 크론이 돌았다고 전원을 결석으로 만들면 안 된다.
 */
export function missingStudents(
  roster: LectureRosterEntry[],
  checkedInStudentIds: Set<number>,
  nowMinutes: number,
  missingAfterMinutes = MISSING_AFTER_MINUTES
): LectureRosterEntry[] {
  return roster.filter((entry) => {
    if (checkedInStudentIds.has(entry.studentId)) return false;
    const scheduled = minutesOfTime(entry.time);
    if (scheduled === null) return false;
    return nowMinutes >= scheduled + missingAfterMinutes;
  });
}

/** 학생·학부모에게 가는 미출석 알림 문구. */
export function missingMessage(time: string): string {
  return `${time} 강의 수업인데 아직 등원하지 않았어요.`;
}

export type LectureStatus = "출석" | "지각" | "조정" | "결석";

/**
 * 강의 출결 화면의 묶음 이름 — "토요일 9시" / "일요일 4시".
 *
 * 반 이름("1학년정규")으로 묶으면 같은 반이 여러 시간대로 흩어져 있어
 * 체크할 때 도움이 안 된다. 조교는 지금 눈앞의 그 타임을 보고 있으므로
 * 요일+시각이 곧 묶음 단위다.
 *
 * 시각은 원장님이 부르는 대로 12시간제("16:00" → "4시"). 분이 있으면 붙인다.
 */
export function lectureSlotLabel(dayLabel: string, time: string): string {
  const minutes = minutesOfTime(time);
  if (minutes === null) return `${dayLabel}요일 ${time}`;
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${dayLabel}요일 ${h12}시${m > 0 ? ` ${m}분` : ""}`;
}

/**
 * 키오스크 기록으로 그날 **클리닉** 출결까지 채울지.
 *
 * 학생은 학원에 들어올 때 한 번만 찍는다. 같은 날 강의와 클리닉을 이어서
 * 하는 경우가 많아서(강의 → 클리닉, 또는 클리닉 → 강의), 한 번 찍힌 것으로
 * 그날 클리닉 출결도 잡아준다. 조교가 같은 학생을 두 번 체크할 이유가 없다.
 *
 * 다만 이미 있는 기록을 함부로 덮지는 않는다:
 * - 사람이 눌러둔 것(조정·결석 등)은 사정을 알고 바꾼 것이라 그대로 둔다.
 * - 시스템이 짐작으로 찍은 자동 지각은 키오스크 기록이 더 정확하므로 덮는다.
 */
export function shouldFillClinicFromKiosk(
  hasExistingRecord: boolean,
  existingIsAutoMarked: boolean
): boolean {
  if (!hasExistingRecord) return true;
  return existingIsAutoMarked;
}

/**
 * "보강이 필요한" 학생인지 — 강의는 클리닉과 달리 못 온 주가 밀리는 게
 * 아니라 보강을 잡아줘야 한다.
 *
 * 결석인데 옮겨둔 일정이 아직 없으면 보강 대상이다. 조정(미리 옮긴 것)은
 * 이미 갈 곳이 정해져 있으니 대상이 아니고, 결석이라도 보강 일정을 잡아두면
 * 목록에서 빠진다.
 */
export function needsMakeup(status: LectureStatus, hasScheduledMakeup: boolean): boolean {
  return status === "결석" && !hasScheduledMakeup;
}

/** 조교 업무 체크리스트를 재촉할 시각(KST). 밤 9시 30분. */
export const DUTY_NAG_AT_MINUTES = 21 * 60 + 30;

/** 지금이 재촉할 시각을 지났는지 — 지나기만 하면 계속 true라, 화면을 늦게
 * 열어도 안내를 놓치지 않는다. */
export function isDutyNagTime(nowMinutes: number, nagAt = DUTY_NAG_AT_MINUTES): boolean {
  return nowMinutes >= nagAt;
}

/** 동기화가 이만큼 끊기면 종주T에게 알린다. 주말 강의는 하루에 몰려 있어서
 * 반나절이면 그날 수업이 통째로 비어버린다. */
export const SYNC_STALE_HOURS = 3;

/** 마지막 성공 시각을 보고 "동기화가 죽었는지" 판단. 한 번도 성공한 적이
 * 없으면(null) 죽은 것으로 본다 — 처음부터 안 도는 경우가 제일 흔하다. */
export function isSyncStale(
  lastOkAtISO: string | null,
  nowMs: number,
  staleHours = SYNC_STALE_HOURS
): boolean {
  if (!lastOkAtISO) return true;
  const last = Date.parse(lastOkAtISO);
  if (Number.isNaN(last)) return true;
  return nowMs - last > staleHours * 60 * 60 * 1000;
}
