export type Role = "student" | "parent" | "staff" | "zongju";

// Current (방학 기간) class names. 학기 중에는 "배명고1"/"배명고2"/"가락고1"/"예비고1"
// 4개 반이었고, 방학 동안은 "1학년정규"(舊 배명고1+가락고1)/"2학년정규"(舊 배명고2)/
// "예비고1" 3개 반으로 합쳐 운영 중 — 2학기 시작하면 다시 4개 반으로 되돌려야 함
// (그때는 students.school 필드로 배명고/가락고를 구분해 되돌릴 수 있음).
export const CLASSES = ["1학년정규", "2학년정규", "예비고1"] as const;
export type ClassKey = (typeof CLASSES)[number];

export const DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"] as const;
export type DayOfWeek = (typeof DAY_ORDER)[number];

export type AttendanceStatus = "출석" | "지각" | "연기" | "결석";

export interface StudentOverrides {
  midScore?: number | null;
  midRank?: number | null;
  finalCompScore?: number | null;
  finalCompRank?: number | null;
  mock3Label?: string | null;
}

export interface Student {
  id: number;
  student_code: string;
  name: string;
  nickname: string | null;
  enrolled: boolean;
  level: string | null;
  school: string | null;
  grade: string | null;
  parent_phone: string | null;
  student_phone: string | null;
  class_day: string | null;
  class_time: string | null;
  clinic_day: string | null;
  clinic_time: string | null;
  final_score_label: string | null;
  mid_mock_score: number | null;
  mid_score: number | null;
  mid_rank: number | null;
  final_comp_score: number | null;
  final_comp_rank: number | null;
  mock3_label: string | null;
  class_key: ClassKey | null;
  main_book: boolean;
  hw_book: boolean;
  mgmt_book: boolean;
  status: string;
  note_to_next_ta: string;
  overrides: StudentOverrides;
  created_at: string;
  updated_at: string;
}

/** Merges admin overrides on top of the roster-sourced score fields. */
export function effectiveStudentFields(student: Student) {
  const o = student.overrides ?? {};
  return {
    midScore: o.midScore ?? student.mid_score,
    midRank: o.midRank ?? student.mid_rank,
    finalCompScore: o.finalCompScore ?? student.final_comp_score,
    finalCompRank: o.finalCompRank ?? student.final_comp_rank,
    mock3Label: o.mock3Label ?? student.mock3_label,
  };
}

export interface Staff {
  id: number;
  name: string;
  work_days: string[];
  work_time: string | null;
  work_period: string | null;
  note: string | null;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: number;
  student_id: number;
  session_date: string;
  status: AttendanceStatus;
  marked_by: number | null;
  created_at: string;
}

export interface MakeupSchedule {
  id: number;
  student_id: number;
  session_date: string;
  makeup_day: string;
  makeup_time: string;
  note: string | null; // 연기 사유/다음 조교에게 전달사항
  created_at: string;
}

export interface ClinicTemplate {
  id: number;
  class_key: ClassKey;
  week_start: string;
  month: string;
  round: string;
  hw_labels: string[]; // 7 slots
  test_labels: string[]; // 4 slots
  updated_at: string;
}

export interface TestScore {
  score?: string;
  total?: string;
}

export interface ClinicCheck {
  id: number;
  student_id: number;
  week_start: string;
  hw_checks: boolean[]; // 7 slots
  test_scores: TestScore[]; // 4 slots
  staff_approved: boolean;
  staff_approved_by: number | null;
  staff_approved_at: string | null;
  zongju_approved: boolean;
  zongju_approved_at: string | null;
  updated_at: string;
}

export interface Notice {
  id: number;
  class_key: ClassKey;
  title: string;
  notice_date: string;
  tag: string;
  content: string;
  created_at: string;
}

export interface DutyItem {
  id: number;
  label: string;
  sort_order: number;
}

export interface DutyCheck {
  id: number;
  staff_id: number;
  item_id: number;
  check_date: string;
  checked: boolean;
}

export interface ClassPlan {
  id: number;
  class_key: ClassKey;
  week_start: string;
  progress_content: string;
  clinic_content: string;
  homework_content: string;
  updated_at: string;
}

export interface CalendarNote {
  id: number;
  note_date: string;
  class_key: ClassKey | null; // null = 전체 반
  content: string;
  created_at: string;
}

export interface SessionData {
  role?: Role;
  studentId?: number; // student & parent both resolve to a student row
  staffId?: number;
}
