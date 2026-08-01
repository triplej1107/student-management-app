import "server-only";
import { supabase } from "./supabase";
import { listStudents } from "./data";
import { SCHOOL_EXAMS, type SchoolExam, type Student } from "./types";
import { kstToday, toISODate } from "./weeks";
import {
  REFERRAL_AMOUNT,
  gradeScholarshipAmount,
  parseReferrerName,
  referralDueFromISO,
  referralState,
  type ReferralState,
} from "./scholarshipRules";

// ============================================================
// 체크 상태 (사람이 누른 것만 저장 — 목록 자체는 매번 다시 계산)
// ============================================================

export type ScholarshipKind = "referral" | "grade";

interface ScholarshipCheck {
  kind: ScholarshipKind;
  ref_key: string;
  review_done: boolean;
  paid: boolean;
}

async function getChecks(kind: ScholarshipKind): Promise<Map<string, ScholarshipCheck>> {
  const { data } = await supabase.from("scholarship_checks").select("*").eq("kind", kind);
  const map = new Map<string, ScholarshipCheck>();
  for (const row of (data as ScholarshipCheck[]) ?? []) map.set(row.ref_key, row);
  return map;
}

export async function setScholarshipCheck(
  kind: ScholarshipKind,
  refKey: string,
  field: "review_done" | "paid",
  value: boolean
) {
  const { data: existing } = await supabase
    .from("scholarship_checks")
    .select("review_done, paid")
    .eq("kind", kind)
    .eq("ref_key", refKey)
    .maybeSingle();
  await supabase.from("scholarship_checks").upsert(
    {
      kind,
      ref_key: refKey,
      review_done: existing?.review_done ?? false,
      paid: existing?.paid ?? false,
      [field]: value,
      ...(field === "paid" ? { paid_at: value ? new Date().toISOString() : null } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "kind,ref_key" }
  );
}

// ============================================================
// 목록 만들기
// ============================================================

interface StudentRef {
  id: number;
  name: string;
  student_code: string;
}

export interface ReferralRow {
  /** scholarship_checks.ref_key — 소개받아 온 학생 id */
  refKey: string;
  /** 소개받아 온 신규생 */
  referred: StudentRef;
  /** 장학금을 받을 사람(소개한 학생). 이름을 못 찾으면 null. */
  referrer: StudentRef | null;
  /** 메모에서 읽어낸 이름 원문 — 매칭 실패 시 화면에 그대로 보여준다. */
  referrerName: string | null;
  /** 동명이인이라 누구인지 특정 못 함 */
  ambiguous: boolean;
  firstLessonISO: string | null;
  /** 지급 가능해지는 날 */
  dueFromISO: string | null;
  state: ReferralState;
  amount: number;
}

export interface GradeRow {
  /** scholarship_checks.ref_key — "<학생id>:<시험슬롯>" */
  refKey: string;
  student: StudentRef;
  rank: number | null;
  amount: number;
  reviewDone: boolean;
}

export interface GradeGroup {
  examKey: string;
  label: string;
  rows: GradeRow[];
}

function toRef(s: Student): StudentRef {
  return { id: s.id, name: s.name, student_code: s.student_code };
}

/**
 * 친구 소개 장학금 목록.
 *
 * 소개 메모는 "소개받아 온 학생" 쪽에 붙어 있고 장학금은 "소개한 학생"이
 * 받는다. 이름만 적혀 있어서 학생 매칭은 이름으로 하는데, 동명이인이면
 * 임의로 고르지 않고 "확인 필요"로 남겨 사람이 판단하게 한다.
 */
export async function getReferralScholarships(todayISO = toISODate(kstToday())): Promise<ReferralRow[]> {
  const [students, checks] = await Promise.all([listStudents(), getChecks("referral")]);

  const byName = new Map<string, Student[]>();
  for (const s of students) {
    const list = byName.get(s.name);
    if (list) list.push(s);
    else byName.set(s.name, [s]);
  }

  /** 메모에 적힌 이름으로 학생을 찾는다. 성을 빼고 "주환 소개"처럼 이름만
   * 적어둔 경우가 있어서, 정확히 일치하는 사람이 없으면 이름 끝이 같은
   * 사람까지 찾아본다. 여러 명이면 고르지 않고 "확인 필요"로 넘긴다. */
  function findReferrer(referrerName: string, selfId: number): Student[] {
    const exact = (byName.get(referrerName) ?? []).filter((m) => m.id !== selfId);
    if (exact.length > 0) return exact;
    return students.filter((m) => m.id !== selfId && m.name.endsWith(referrerName));
  }

  const rows: ReferralRow[] = [];
  for (const s of students) {
    const referrerName = parseReferrerName(s.referral_note);
    if (!referrerName) continue;

    const matches = findReferrer(referrerName, s.id);
    const ambiguous = matches.length > 1;
    const referrer = matches.length === 1 ? toRef(matches[0]) : null;
    const check = checks.get(String(s.id));
    const paid = check?.paid ?? false;

    rows.push({
      refKey: String(s.id),
      referred: toRef(s),
      referrer,
      referrerName,
      ambiguous,
      firstLessonISO: s.first_lesson_date,
      dueFromISO: s.first_lesson_date ? referralDueFromISO(s.first_lesson_date) : null,
      state: referralState({
        paid,
        hasReferrer: referrer !== null,
        firstLessonISO: s.first_lesson_date,
        withdrawnAtISO: s.withdrawn_at,
        todayISO,
      }),
      amount: REFERRAL_AMOUNT,
    });
  }

  // 지급일이 임박한(=오래된) 순. 첫수업일이 없는 건 맨 뒤로.
  rows.sort((a, b) => (a.firstLessonISO ?? "9999").localeCompare(b.firstLessonISO ?? "9999"));
  return rows;
}

/** 중간·기말만 대상. "종합"은 중간+기말을 합산한 값일 뿐이라 같은 학기에
 * 장학금이 두 번 나가면 안 된다. */
const GRADED_EXAMS = SCHOOL_EXAMS.filter((e) => !("scoreless" in e && e.scoreless));

const EXAM_LABEL = new Map(SCHOOL_EXAMS.map((e) => [e.key as string, e.label]));

/**
 * 챙길 시험은 학년별로 "그 학년 1학기 기말" 하나뿐이다.
 *
 * 지난 학년과 중간고사까지 다 띄우면 목록이 감당이 안 된다는 원장님 판단.
 * 2학년은 2학년 1학기 기말만, 1학년은 1학년 1학기 기말만 본다.
 */
const FINAL_EXAM_BY_GRADE: Record<string, string> = {
  "1": "g1s1fin",
  "2": "g2s1fin",
  "3": "g3s1fin",
};

/** "2", "2학년" 등 어떻게 적혀 있든 학년 숫자만 뽑아 슬롯을 고른다. */
function currentFinalExamKey(grade: string | null): string | null {
  const digit = grade?.match(/[123]/)?.[0];
  return digit ? FINAL_EXAM_BY_GRADE[digit] : null;
}

export interface PaidEntry {
  kind: ScholarshipKind;
  /** 되돌리기용 — scholarship_checks.ref_key */
  refKey: string;
  /** "2학년 1학기 기말" 또는 "친구 소개" */
  context: string;
  name: string;
  /** "전교 11등" 같은 사유 한 줄 */
  reason: string;
  amount: number;
}

export interface GradeScholarshipData {
  /** 아직 안 준 것만. 학년에 맞는 1학기 기말 하나만 본다. */
  groups: GradeGroup[];
  /** 지급 내역 — 이건 학년 필터를 걸지 않는다. 학년이 올라가도 예전에 준
   * 기록은 그대로 남아야 하니까. */
  paid: PaidEntry[];
}

export async function getGradeScholarships(): Promise<GradeScholarshipData> {
  const [{ data: examRows }, students, checks] = await Promise.all([
    supabase
      .from("school_exams")
      .select("student_id, exam_key, rank, grade")
      .eq("grade", 1)
      .in(
        "exam_key",
        GRADED_EXAMS.map((e) => e.key)
      ),
    listStudents(),
    getChecks("grade"),
  ]);

  const studentById = new Map(students.map((s) => [s.id, s]));
  const byExam = new Map<string, GradeRow[]>();
  const paid: PaidEntry[] = [];

  for (const row of (examRows as Pick<SchoolExam, "student_id" | "exam_key" | "rank">[]) ?? []) {
    const student = studentById.get(row.student_id);
    if (!student) continue;
    const refKey = `${row.student_id}:${row.exam_key}`;
    const check = checks.get(refKey);
    const amount = gradeScholarshipAmount(row.rank);

    if (check?.paid) {
      paid.push({
        kind: "grade",
        refKey,
        context: EXAM_LABEL.get(row.exam_key) ?? row.exam_key,
        name: student.name,
        reason: row.rank !== null ? `전교 ${row.rank}등` : "1등급",
        amount,
      });
      continue;
    }

    if (row.exam_key !== currentFinalExamKey(student.grade)) continue;

    const list = byExam.get(row.exam_key) ?? [];
    list.push({
      refKey,
      student: toRef(student),
      rank: row.rank,
      amount,
      reviewDone: check?.review_done ?? false,
    });
    byExam.set(row.exam_key, list);
  }

  const groups: GradeGroup[] = [];
  for (const exam of [...GRADED_EXAMS].reverse()) {
    const rows = byExam.get(exam.key);
    if (!rows || rows.length === 0) continue;
    // 금액 큰 사람(전교 3등 이내)이 위로, 그 다음 등수 순.
    rows.sort((a, b) => b.amount - a.amount || (a.rank ?? 999) - (b.rank ?? 999));
    groups.push({ examKey: exam.key, label: exam.label, rows });
  }
  return { groups, paid };
}
