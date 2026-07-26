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
