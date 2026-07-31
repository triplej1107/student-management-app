export type Role = "student" | "parent" | "staff" | "zongju";

// Current (방학 기간) class names. 학기 중에는 "배명고1"/"배명고2"/"가락고1"/"예비고1"
// 4개 반이었고, 방학 동안은 "1학년정규"(舊 배명고1+가락고1)/"2학년정규"(舊 배명고2)/
// "예비고1" 3개 반으로 합쳐 운영 중 — 2학기 시작하면 다시 4개 반으로 되돌려야 함
// (그때는 students.school 필드로 배명고/가락고를 구분해 되돌릴 수 있음).
export const CLASSES = ["1학년정규", "2학년정규", "예비고1"] as const;
export type ClassKey = (typeof CLASSES)[number];

export const DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"] as const;
export type DayOfWeek = (typeof DAY_ORDER)[number];

export type AttendanceStatus = "출석" | "지각" | "조정" | "결석";

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
  withdrawn_at: string | null; // set when enrolled flips to false; cleared on re-enroll
  level: string | null;
  school: string | null;
  grade: string | null;
  parent_phone: string | null;
  student_phone: string | null;
  class_day: string | null;
  class_time: string | null;
  clinic_day: string | null;
  clinic_time: string | null;
  birthday: string | null; // "YYYY-MM-DD" (연도는 무시하고 월/일만 비교해 생일 판정)
  student_app_seen_at: string | null; // 학생 계정이 standalone(설치) 상태로 접속한 마지막 시각
  parent_app_seen_at: string | null; // 학부모 계정이 standalone(설치) 상태로 접속한 마지막 시각
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
  auto_marked: boolean;
  created_at: string;
}

export interface MakeupSchedule {
  id: number;
  student_id: number;
  session_date: string;
  makeup_day: string;
  makeup_time: string;
  note: string | null; // 조정 사유/다음 조교에게 전달사항
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

/** "아싸신규" 체크리스트 항목 — 순서가 곧 checks 배열의 인덱스라서
 * 중간에 끼워넣거나 순서를 바꾸면 기존 기록의 의미가 어긋난다. 새 항목은
 * 반드시 뒤에 추가할 것. */
export const NEW_STUDENT_CHECKLIST = [
  "입학원서 작성",
  "앱에 정보 등록",
  "닉네임 결정",
  "학부모 밴드 초대",
  "학생·학부모 앱 설치 확인",
  "앞선 교재들 챙겨주기",
] as const;

export interface NewStudentOnboarding {
  id: number;
  name: string;
  school: string | null;
  grade: string | null;
  checks: boolean[];
  created_at: string;
  completed_at: string | null;
}

/** "잊지마" — 조교/종주T가 입력하는 돌발 일정(보강, 교재 픽업, 학부모 방문
 * 상담 등). event_date 당일 홈 화면 상단에 배지로 계속 뜨고, 하루 전·1시간
 * 전에 조교·종주T 전원에게 푸시 알림이 간다. */
export interface Reminder {
  id: number;
  event_date: string; // "YYYY-MM-DD"
  event_time: string; // "HH:MM"
  content: string;
  day_before_pushed_at: string | null;
  hour_before_pushed_at: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface TestScore {
  score?: string;
  total?: string;
}

// 클리닉 테스트 자동채점(OMR) — 문항당 선택지 수는 국어 내신 표준인
// 오지선다(5지선다)로 고정한다.
export const OMR_CHOICE_COUNT = 5;

export interface ClinicAnswerKey {
  id: number;
  class_key: ClassKey;
  week_start: string;
  test_index: number;
  round: number;
  answers: string[];
  // 문항별 배점(모의고사처럼 2점/3점 등으로 다를 때) — 비어있거나 answers와
  // 길이가 다르면 문항당 1점(=맞힌 문항 수 채점, 내신 클리닉테스트 방식)으로 본다.
  points: number[];
  updated_at: string;
}

export interface ClinicOmrSubmission {
  id: number;
  student_id: number;
  week_start: string;
  test_index: number;
  round: number;
  answers: string[];
  score: number;
  total: number;
  // 마킹 중 화면을 벗어나(다른 앱 전환 등) 그 시점 답안으로 강제 자동 제출됐는지.
  left_app: boolean;
  submitted_at: string;
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
  feedback_tags: FeedbackTags | null;
  feedback_text: string | null;
  feedback_updated_at: string | null;
  zongju_feedback_text: string | null;
  updated_at: string;
}

// 주간 태도 피드백 — 조교가 태그만 선택하면 서버에서 문장으로 다듬어줌.
// 학부모만 볼 수 있고 학생에게는 노출하지 않는다.
export const FEEDBACK_CATEGORIES = [
  {
    key: "attendance",
    label: "출결/시간",
    options: ["지각 잦음", "결석 잦음", "시간 엄수", "지각 개선됨"],
  },
  {
    key: "participation",
    label: "수업 참여",
    options: ["적극적 질문", "소극적 참여", "산만함", "참여도 향상됨"],
  },
  {
    key: "homework",
    label: "숙제 이행",
    options: ["기한 준수", "잦은 미제출", "부분 완료", "성실도 향상됨", "클리닉을 한번에 마치지 않고 미루는 습관이 있음"],
  },
  {
    key: "focus",
    label: "집중력",
    options: ["수업 중 집중 유지", "쉽게 산만해짐", "조는 경우 있음", "집중력 개선됨"],
  },
  {
    key: "attitude",
    label: "태도/매너",
    options: ["협조적", "지시 따르기 어려워함", "또래관계 양호", "예의바름", "연락이 잘 안 됨"],
  },
] as const;
export type FeedbackCategoryKey = (typeof FEEDBACK_CATEGORIES)[number]["key"];
export type FeedbackTags = Partial<Record<FeedbackCategoryKey, string>>;

// 내신 시험 슬롯 — 고정된 순서/코드. 학생별로 슬롯당 한 행씩 upsert.
// "종합" 슬롯은 중간+기말을 합산한 학기 전체 등수/등급만 기록 — 점수는 없음(scoreless).
export const SCHOOL_EXAMS = [
  { key: "g1s1mid", label: "1학년 1학기 중간" },
  { key: "g1s1fin", label: "1학년 1학기 기말" },
  { key: "g1s1sum", label: "1학년 1학기 종합", scoreless: true },
  { key: "g1s2mid", label: "1학년 2학기 중간" },
  { key: "g1s2fin", label: "1학년 2학기 기말" },
  { key: "g1s2sum", label: "1학년 2학기 종합", scoreless: true },
  { key: "g2s1mid", label: "2학년 1학기 중간" },
  { key: "g2s1fin", label: "2학년 1학기 기말" },
  { key: "g2s1sum", label: "2학년 1학기 종합", scoreless: true },
  { key: "g2s2mid", label: "2학년 2학기 중간" },
  { key: "g2s2fin", label: "2학년 2학기 기말" },
  { key: "g2s2sum", label: "2학년 2학기 종합", scoreless: true },
  { key: "g3s1mid", label: "3학년 1학기 중간" },
  { key: "g3s1fin", label: "3학년 1학기 기말" },
  { key: "g3s1sum", label: "3학년 1학기 종합", scoreless: true },
] as const;
export type SchoolExamKey = (typeof SCHOOL_EXAMS)[number]["key"];

// 모의고사 슬롯.
export const MOCK_EXAMS = [
  { key: "g1_03", label: "고1 3월" },
  { key: "g1_06", label: "고1 6월" },
  { key: "g1_09", label: "고1 9월" },
  { key: "g1_10", label: "고1 10월" },
  { key: "g2_03", label: "고2 3월" },
  { key: "g2_06", label: "고2 6월" },
  { key: "g2_09", label: "고2 9월" },
  { key: "g2_10", label: "고2 10월" },
  { key: "g3_03", label: "고3 3월" },
  { key: "g3_06", label: "고3 6월" },
] as const;
export type MockExamKey = (typeof MOCK_EXAMS)[number]["key"];

export interface SchoolExam {
  id: number;
  student_id: number;
  exam_key: string;
  score: number | null;
  rank: number | null;
  grade: number | null;
  note: string | null;
  updated_at: string;
}

export interface MockExam {
  id: number;
  student_id: number;
  exam_key: string;
  score: number | null;
  percentile: number | null;
  grade: number | null;
  note: string | null;
  updated_at: string;
}

/** One week's point on the 클리닉 테스트 백분위 trend — derived on read from
 * `clinic_checks.test_scores` across the student's class_key cohort, never
 * persisted. `value` is the percentile (higher = better, for TrendChart);
 * `topPercent`/`rank`/`cohortSize` back the "상위 O%" summary and the
 * exact-rank detail shown only when a point is tapped. */
export interface ClinicPercentilePoint {
  label: string;
  value: number | null;
  grade: null;
  note: string | null;
  topPercent: number | null;
  rank: number | null;
  cohortSize: number | null;
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
  end_date: string;
  class_keys: ClassKey[] | null; // null/empty = 전체 반
  content: string;
  created_at: string;
}

// 클리닉 2주+ 밀림 학생에 대한 전화 연락 기록. week_start는 밀림 관리
// 대시보드가 평가한 "최신 클리닉 주"를 가리킨다 — 밀림이 다음 주까지
// 이어지면 새 row가 생겨 다시 미확인 상태로 노출된다.
export interface ClinicContactLog {
  id: number;
  student_id: number;
  week_start: string;
  contacted: boolean;
  note: string | null;
  contacted_by: number | null;
  contacted_at: string | null;
  updated_at: string;
}

// 유종코인(UJC) — 교환 단위. 클라이언트 컴포넌트에서도 참조하므로
// server-only인 ujc.ts가 아니라 여기 둔다.
export const UJC_EXCHANGE_UNITS = [10, 20, 30] as const;
export type UjcExchangeAmount = (typeof UJC_EXCHANGE_UNITS)[number];

// UJC 마켓 품목 — DB(ujc_market_items)에서 관리, 종주T가 /admin/ujc에서
// 품목·가격을 직접 수정할 수 있다. brand는 실제 로고 이미지가 있는
// 것만 허용(UjcBrandBadge 참고) — 새 브랜드를 추가하려면 로고 이미지와
// 코드(BRAND_ICON, 이 union, DB check 제약)를 함께 늘려야 한다.
export type UjcMarketBrand = "GS25" | "GOOGLE_PLAY" | "OLIVE_YOUNG";

export const UJC_MARKET_BRANDS: { value: UjcMarketBrand; label: string }[] = [
  { value: "GS25", label: "GS25" },
  { value: "GOOGLE_PLAY", label: "구글플레이" },
  { value: "OLIVE_YOUNG", label: "올리브영" },
];

export interface UjcMarketItem {
  id: number;
  tier: UjcExchangeAmount;
  brand: UjcMarketBrand;
  brandLabel: string;
  priceValue: number;
}

// 학부모가 종주T에게 남기는 질문 — week_start(수요일 기준)마다 학생당 한
// row. 새 질문 주가 시작되면 그 주의 row가 없으므로 화면이 자동으로
// 빈 상태(리셋)로 보인다.
export interface ParentQuestion {
  id: number;
  student_id: number;
  week_start: string;
  question_text: string;
  answer_text: string | null;
  answered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionData {
  role?: Role;
  studentId?: number; // student & parent both resolve to a student row
  staffId?: number;
}
