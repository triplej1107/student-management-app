export interface SubTab {
  href: string;
  label: string;
}

export interface SubTabGroup {
  label: string;
  tabs: SubTab[];
}

/**
 * 학생 탭 하위 화면을 성격별 폴더로 묶은 것 — 12개가 한 줄에 다 늘어서면
 * 두 줄로 넘치고 원하는 걸 찾기 어려워서 2단으로 나눴다.
 *
 * 폴더 순서와 각 폴더의 첫 항목이 곧 "기본 착지점"이다. 매일 쓰는 출결이
 * 맨 앞에 오도록 운영 폴더를 첫째로 두고, 하단 학생 탭도 출결로 연결해서
 * 제일 자주 쓰는 화면은 예전처럼 한 번만 눌러도 닿게 했다.
 */
export const STUDENT_TAB_GROUPS: SubTabGroup[] = [
  {
    label: "운영",
    tabs: [
      { href: "/admin/students/attendance", label: "출결" },
      { href: "/admin/students/plans", label: "수업" },
      { href: "/admin/students/templates", label: "점검표" },
      { href: "/admin/students/approvals", label: "결재" },
      { href: "/admin/clinic-backlog", label: "밀림" },
    ],
  },
  {
    label: "학생부",
    tabs: [
      { href: "/admin/students/roster", label: "명단" },
      { href: "/admin/students/individual", label: "개별" },
      { href: "/admin/students/leaderboard", label: "순위" },
      { href: "/admin/reports", label: "보고서" },
    ],
  },
  {
    label: "안내",
    tabs: [
      { href: "/admin/students/notices", label: "공지" },
      { href: "/admin/students/calendar", label: "달력" },
      { href: "/admin/students/questions", label: "학부모" },
    ],
  },
];
