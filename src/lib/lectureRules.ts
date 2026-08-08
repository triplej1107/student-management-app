/**
 * 주말 강의 출결 판정 — 순수 계산만. DB 조회는 lectureAttendance.ts에 있다.
 *
 * 앱은 학생마다 강의 요일·시간(class_day/class_time)을 이미 갖고 있다
 * (회원명단 엑셀에서 "종주(고1정규)-일19시[고등국어]"를 읽어 채운 값).
 * 그래서 "오늘 누가 와야 하는지"는 앱이 알고, 맥가이7에서 가져와야 하는
 * 것은 "실제로 누가 찍었는지" 하나뿐이다.
 */

import type { ClassKey } from "./types";

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
 *
 * 그 주만 시간을 옮긴 학생(moved)도 똑같이 본다. 한동안은 뺐었는데, 맥가이7
 * **학급별** 조회로는 토요일 반 학생이 일요일에 찍은 기록이 안 잡혀서(일요일
 * 반 소속이 아니라서) 정작 온 학생에게 "안 왔어요"가 나갈 뻔했기 때문이다.
 * 지금은 학급에 안 묶인 등하원 로그를 같이 읽으므로 찍기만 하면 잡힌다.
 * 그래서 옮겨온 학생도 안 오면 제대로 알린다 — 뺀 채로 두면 옮겨놓고 안 온
 * 학생을 아무도 모르게 된다.
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

export interface LectureSlot {
  day: string;
  /** "HH:MM" */
  time: string;
}

/**
 * 반별 강의 타임표 — 방학 반과 2학기 반을 **한 표에** 담는다.
 *
 * 학기가 바뀌어도 날짜로 표를 갈아끼울 필요가 없다: 반 이름이 학기마다 달라
 * 서로 겹치지 않기 때문이다(예비고1만 양쪽에 있는데 타임이 일 4시로 같다).
 * 그래서 학생의 반만 보면 그 학기의 타임이 자동으로 나온다.
 *
 * 조정·보강은 결국 **그 반의 다른 타임**으로 옮기는 것이라, 조교가 요일과
 * 시각을 손으로 칠 이유가 없다. 버튼으로 바로 고르게 하려고 여기에 둔다.
 *
 * ClassKey를 키로 쓰므로 반이 새로 생기면 타입 검사가 바로 걸린다 —
 * 표를 같이 채우라는 뜻이다.
 */
export const LECTURE_SLOTS: Record<ClassKey, LectureSlot[]> = {
  // ── 여름방학 (~2026-08-21) ──
  "1학년정규": [
    { day: "토", time: "09:00" },
    { day: "토", time: "16:00" },
    { day: "일", time: "19:00" },
  ],
  "2학년정규": [
    { day: "토", time: "19:00" },
    { day: "일", time: "13:00" },
  ],
  // ── 2학기 (2026-08-22~) ──
  가락고1: [
    { day: "토", time: "09:00" },
    { day: "일", time: "10:00" },
  ],
  배명고1: [
    { day: "토", time: "16:00" },
    { day: "일", time: "19:00" },
  ],
  배명고2: [
    { day: "토", time: "19:00" },
    { day: "일", time: "13:00" },
  ],
  // 양쪽 학기에 다 있고 타임도 같다.
  예비고1: [{ day: "일", time: "16:00" }],
};

/**
 * 그 타임에 해당하는 반 — 2학기에는 타임 하나가 반 하나를 정한다.
 *
 * 회원명단 엑셀이 학생의 수업 요일·시각을 갱신해주므로, 이걸로 반 배정까지
 * 자동으로 맞출 수 있다(classKeyFor 참고). 방학 반과 2학기 반이 같은 타임을
 * 공유하는 경우가 있어서(토9 = 1학년정규 & 가락고1) **찾는 범위를 지금 쓰는
 * 반으로 좁혀서** 부른다.
 */
export function classForSlot(
  day: string | null,
  time: string | null,
  candidates: readonly ClassKey[]
): ClassKey | null {
  if (!day || !time) return null;
  const hits = candidates.filter((c) =>
    (LECTURE_SLOTS[c] ?? []).some((s) => s.day === day && s.time === time)
  );
  return hits.length === 1 ? hits[0] : null;
}

/**
 * 그 학생이 옮겨갈 수 있는 타임 — 자기 반의 다른 타임들.
 * 지금 있는 타임(같은 요일·시각)은 옮길 이유가 없으니 뺀다.
 */
export function makeupSlotsFor(
  classKey: ClassKey | null,
  currentDay: string,
  currentTime: string
): LectureSlot[] {
  if (!classKey) return [];
  return (LECTURE_SLOTS[classKey] ?? []).filter(
    (s) => !(s.day === currentDay && s.time === currentTime)
  );
}

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

/**
 * "멈췄어요" 알림을 지금 보내도 되는지 — 죽었는지 + **너무 자주 울리지 않는지.**
 *
 * 죽었는지만 보고 보내면 안 된다. 동기화는 5분마다 도는데 끊기면 매번 죽은
 * 상태이므로, 그대로 두면 종주T 폰이 **시간당 12번** 울린다. 실제로 그렇게
 * 될 뻔했다 — 예전엔 크론이 하루 5~8번만 돌아서 티가 안 났을 뿐이다.
 *
 * 어디에도 "언제 알렸는지"를 안 남기고 막으려고 시계를 쓴다. **매시 첫
 * 5분 안에만** 보낸다. 5분 간격으로 부르면 그 창에 정확히 한 번 걸리므로
 * 시간당 한 번이 된다. 부르는 간격이 밀려 그 시간에 한 번도 안 걸리면 그
 * 시간은 건너뛰는데, 조건이 그대로 남아 다음 시간에 울린다 — 덜 울리는 쪽이
 * 더 울리는 쪽보다 낫다.
 */
export function shouldNotifyStale(
  lastOkAtISO: string | null,
  nowMs: number,
  kstMinute: number,
  staleHours = SYNC_STALE_HOURS
): boolean {
  if (!isSyncStale(lastOkAtISO, nowMs, staleHours)) return false;
  return kstMinute < 5;
}
