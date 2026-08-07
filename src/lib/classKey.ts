import { activeClasses, type ClassKey } from "./types";
import { classForSlot } from "./lectureRules";

interface ClassKeyInput {
  level: string | null;
  school: string | null;
  grade: string | null;
  /** 회원명단 엑셀에서 읽은 강의 요일·시각. 있으면 이걸로 반이 정해진다. */
  class_day?: string | null;
  class_time?: string | null;
}

/**
 * 학생의 반을 정한다.
 *
 * **1순위는 강의 타임이다.** 타임 하나가 반 하나를 정하기 때문에
 * (토9=가락고1, 토4=배명고1, …), 회원명단 엑셀이 갱신해준 수업 요일·시각만
 * 있으면 반이 자동으로 나온다. 학기가 바뀌어도 원장님이 엑셀 한 번 올리면
 * 전교생 반 배정이 따라 옮겨간다.
 *
 * 타임을 못 읽거나 표에 없는 시각이면 예전처럼 학년·학교로 짐작한다.
 * class_key는 계산값이 아니라 저장값이라, 짐작이 틀려도 종주T가 언제든
 * 개별 수정할 수 있다.
 */
export function classKeyFor(student: ClassKeyInput): ClassKey {
  const classes = activeClasses();

  const fromSlot = classForSlot(student.class_day ?? null, student.class_time ?? null, classes);
  if (fromSlot) return fromSlot;

  // 중학생은 어느 학기든 예비고1.
  if (student.level === "중등") return "예비고1";

  // 타임을 모를 때의 대비책 — 학기별 반 이름이 달라 갈라서 짐작한다.
  if (classes.includes("배명고1")) {
    const isGarak = (student.school ?? "").includes("가락");
    if (student.grade === "1") return isGarak ? "가락고1" : "배명고1";
    return "배명고2";
  }
  if (student.grade === "1") return "1학년정규";
  return "2학년정규";
}

/**
 * 지금 학기에 없는 반에 남아 있는 학생인지 — 회원명단 엑셀을 올릴 때
 * "이 학생 반을 새 학기 반으로 옮겨야 하나"를 판단하는 데 쓴다.
 *
 * 종주T가 개별로 손봐둔 반 배정을 매번 덮지 않으려면, **지난 학기 이름이
 * 그대로 남아 있을 때만** 새로 정해야 한다.
 */
export function isStaleClassKey(classKey: string | null): boolean {
  if (!classKey) return true;
  return !activeClasses().includes(classKey as ClassKey);
}
