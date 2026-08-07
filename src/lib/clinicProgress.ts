import type { ClinicCheck, ClinicTemplate } from "./types";

/** Non-empty (filled-in) hw label slots — empty slots are hidden everywhere. */
export function filledHwSlots(template: ClinicTemplate | undefined): number[] {
  if (!template) return [];
  return template.hw_labels
    .map((label, i) => (label.trim() ? i : -1))
    .filter((i) => i >= 0);
}

export function filledTestSlots(template: ClinicTemplate | undefined): number[] {
  if (!template) return [];
  return template.test_labels
    .map((label, i) => (label.trim() ? i : -1))
    .filter((i) => i >= 0);
}

export function clinicProgressLabel(
  template: ClinicTemplate | undefined,
  check: ClinicCheck | undefined
): string {
  if (!template) return "원본 없음";
  const slots = filledHwSlots(template);
  if (slots.length === 0) return "원본 없음";
  const done = slots.filter((i) => check?.hw_checks?.[i]).length;
  return `${done}/${slots.length} 체크`;
}

export function testProgressLabel(
  template: ClinicTemplate | undefined,
  check: ClinicCheck | undefined
): string | null {
  const slots = filledTestSlots(template);
  if (slots.length === 0) return null;
  const done = slots.filter((i) => {
    const t = check?.test_scores?.[i];
    return !!(t?.score || t?.total);
  }).length;
  return `${done}/${slots.length} 테스트`;
}

export function isClinicComplete(
  template: ClinicTemplate | undefined,
  check: ClinicCheck | undefined
): boolean {
  const slots = filledHwSlots(template);
  if (slots.length === 0) return false;
  return slots.every((i) => check?.hw_checks?.[i]);
}

/** testProgressLabel과 같은 기준(score 또는 total 중 하나라도 입력됨)으로
 * 테스트 슬롯이 전부 채워졌는지 — 뱃지 색을 그 라벨과 일치시키기 위해 씀. */
export function isTestComplete(
  template: ClinicTemplate | undefined,
  check: ClinicCheck | undefined
): boolean {
  const slots = filledTestSlots(template);
  if (slots.length === 0) return false;
  return slots.every((i) => {
    const t = check?.test_scores?.[i];
    return !!(t?.score || t?.total);
  });
}

/** 숙제뿐 아니라 그 주에 배정된 테스트 슬롯까지 전부 채워져야 "완료"로
 * 본다 — isClinicComplete(숙제만 기준)와 달리 밀림 관리/UJC 적립처럼
 * "그 주가 정말 끝났는지"를 판단해야 하는 곳에서 쓴다. */
export function isClinicFullyDone(
  template: ClinicTemplate | undefined,
  check: ClinicCheck | undefined
): boolean {
  if (!template) return false;
  const hwSlots = filledHwSlots(template);
  const testSlots = filledTestSlots(template);
  const hwDone = hwSlots.every((i) => check?.hw_checks?.[i]);
  const testDone = testSlots.every((i) => !!check?.test_scores?.[i]?.score);
  return hwDone && testDone;
}

/**
 * "그 주가 정말 끝났는가" — 밀림 관리가 쓰는 단 하나의 기준.
 *
 * 숙제·테스트를 다 채운 것만으로는 안 되고 **종주T 최종결재까지** 나야
 * 끝난 것으로 본다. 출결 카드가 노랑/빨강으로 뜨는 기준도 이것이라, 여기서
 * 갈라지면 "카드는 빨간데 주차는 초록"처럼 앞뒤가 안 맞는 화면이 나온다.
 */
export function isWeekSettled(
  template: ClinicTemplate | undefined,
  check: ClinicCheck | undefined
): boolean {
  return isClinicFullyDone(template, check) && !!check?.zongju_approved;
}

/** 점검표 주차 알약의 색 — 초록(끝남) / 빨강(안 끝남) / 해당 없음. */
export type WeekStatus = "done" | "todo" | "none";

/**
 * 그 주차를 무슨 색으로 보여줄지.
 *
 * 그 반에 그 주 클리닉 원본이 아예 없거나 학생이 아직 입학 전이면 "안 됐다"고
 * 빨갛게 칠하면 안 된다 — 할 일이 없었던 주라서 밀림에도 안 잡힌다.
 */
export function weekStatus(
  template: ClinicTemplate | undefined,
  check: ClinicCheck | undefined,
  opts?: { enrolled?: boolean }
): WeekStatus {
  if (opts?.enrolled === false) return "none";
  if (!template) return "none";
  return isWeekSettled(template, check) ? "done" : "todo";
}

export type ApprovalStatus = "no-template" | "unchecked" | "staff-approved" | "zongju-approved";

export function approvalStatus(
  template: ClinicTemplate | undefined,
  check: ClinicCheck | undefined
): ApprovalStatus {
  if (!template) return "no-template";
  if (check?.zongju_approved) return "zongju-approved";
  if (check?.staff_approved) return "staff-approved";
  return "unchecked";
}

export function approvalLabel(status: ApprovalStatus): string {
  switch (status) {
    case "no-template":
      return "원본 없음";
    case "zongju-approved":
      return "결재 완료";
    case "staff-approved":
      return "조교 확인 · 결재 대기";
    case "unchecked":
      return "미확인";
  }
}
