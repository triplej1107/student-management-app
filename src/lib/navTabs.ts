export interface NavTab {
  href: string;
  label: string;
  icon?: string;
  popped?: boolean;
  /** 활성 판정을 href 자기 자신 prefix 대신 이 목록으로 대체 — 하위 경로가
   * 여러 그룹(예: /admin/students/*, /admin/reports, /admin/clinic-backlog)에
   * 걸쳐 있는 탭에 쓴다. */
  matchPrefixes?: string[];
}

export const STAFF_TABS: NavTab[] = [
  { href: "/staff", label: "홈" },
  { href: "/staff/attendance", label: "출결" },
  { href: "/staff/clinic", label: "클리닉" },
  { href: "/staff/clinic-backlog", label: "밀림" },
  { href: "/staff/checklist", label: "체크리스트" },
];

export const STUDENT_TABS: NavTab[] = [
  { href: "/student/lesson", label: "수업" },
  { href: "/student/clinic", label: "클리닉" },
  { href: "/student", label: "UJC", icon: "UJC", popped: true },
  { href: "/student/grades", label: "성적" },
  { href: "/student/notices", label: "공지" },
];

export const ADMIN_TABS: NavTab[] = [
  { href: "/admin/ujc", label: "UJC 관리" },
  { href: "/admin/staff/profiles", label: "조교 관리", matchPrefixes: ["/admin/staff"] },
  { href: "/admin", label: "홈", icon: "홈", popped: true },
  {
    href: "/admin/students/templates",
    label: "학생 관리",
    matchPrefixes: ["/admin/students", "/admin/reports", "/admin/clinic-backlog"],
  },
  { href: "/admin/exams", label: "시험 관리" },
];
