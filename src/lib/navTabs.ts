export interface NavTab {
  href: string;
  label: string;
  icon?: string;
  popped?: boolean;
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
