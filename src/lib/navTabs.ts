export interface NavTab {
  href: string;
  label: string;
  icon?: string;
  popped?: boolean;
  /** 활성 판정을 href 자기 자신 prefix 대신 이 목록으로 대체 — 하위 경로가
   * 여러 그룹(예: /admin/students/*, /admin/reports, /admin/clinic-backlog)에
   * 걸쳐 있는 탭에 쓴다. */
  matchPrefixes?: string[];
  /** popped 홈 버튼 아래 라벨 텍스트를 생략 — 원형 아이콘만 보여준다. */
  hideLabel?: boolean;
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
  { href: "/admin/ujc", label: "UJC" },
  { href: "/admin/staff/profiles", label: "조교", matchPrefixes: ["/admin/staff"] },
  { href: "/admin", label: "홈", icon: "왕관", popped: true, hideLabel: true },
  {
    // 하위탭을 폴더로 묶으면서 착지점을 출결로 옮겼다 — 매일 쓰는 화면이라
    // 폴더를 한 번 더 누르지 않고 바로 닿아야 한다.
    href: "/admin/students/attendance",
    label: "학생",
    matchPrefixes: ["/admin/students", "/admin/reports", "/admin/clinic-backlog"],
  },
  { href: "/admin/exams", label: "시험" },
];
