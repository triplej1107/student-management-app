import "server-only";
import { supabase } from "./supabase";
import { isWeeklyContentPublished } from "./weeklyContentVisibility";
import { kstToday, nowKST, rollingClinicWeeks, toISODate } from "./weeks";
import type { Student } from "./types";

export const STUDENT_TABS_WITH_DOT = ["lesson", "clinic", "grades", "notices"] as const;
export type StudentTabKey = (typeof STUDENT_TABS_WITH_DOT)[number];

/** 탭 키 → 하단 탭바의 href. BottomTabBar가 href로 점을 찍기 때문에 필요. */
export const TAB_HREF: Record<StudentTabKey, string> = {
  lesson: "/student/lesson",
  clinic: "/student/clinic",
  grades: "/student/grades",
  notices: "/student/notices",
};

function maxIso(values: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (v && (!best || v > best)) best = v;
  }
  return best;
}

/** 학생에게 이미 공개된 수업 주차 중 가장 최근 주차. 아직 공개 전인 주차의
 * 수업을 종주T가 저장했다고 학생 탭에 점이 뜨면 "뭔가 올라왔다"는 힌트를
 * 줘버리므로, 공개된 주차만 대상으로 삼는다. */
function latestPublishedWeekISO(): string | null {
  const todayISO = toISODate(kstToday());
  const hour = nowKST().getUTCHours();
  for (const w of rollingClinicWeeks(8)) {
    const iso = toISODate(w);
    if (isWeeklyContentPublished(iso, todayISO, hour)) return iso;
  }
  return null;
}

/** 탭별 "마지막으로 내용이 바뀐 시각". 값이 없으면 보여줄 게 없다는 뜻. */
async function getLatestUpdates(
  student: Student,
  role: string
): Promise<Record<StudentTabKey, string | null>> {
  const classKey = student.class_key;
  const publishedWeek = latestPublishedWeekISO();

  const [lesson, clinic, school, mock, notices] = await Promise.all([
    classKey && publishedWeek
      ? supabase
          .from("class_plans")
          .select("updated_at")
          .eq("class_key", classKey)
          .lte("week_start", publishedWeek)
          .order("updated_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] }),
    supabase
      .from("clinic_checks")
      .select("updated_at")
      .eq("student_id", student.id)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("school_exams")
      .select("updated_at")
      .eq("student_id", student.id)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("mock_exams")
      .select("updated_at")
      .eq("student_id", student.id)
      .order("updated_at", { ascending: false })
      .limit(1),
    classKey
      ? supabase
          .from("notices")
          .select("created_at")
          .eq("class_key", classKey)
          // 학부모 전용 공지 때문에 학생 탭에 점이 뜨면 안 된다(반대도 마찬가지).
          .in("audience", ["both", role === "parent" ? "parent" : "student"])
          .order("created_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] }),
  ]);

  const first = (r: { data: unknown }, field: string): string | null => {
    const rows = (r.data as Record<string, string>[]) ?? [];
    return rows[0]?.[field] ?? null;
  };

  return {
    lesson: first(lesson, "updated_at"),
    clinic: first(clinic, "updated_at"),
    grades: maxIso([first(school, "updated_at"), first(mock, "updated_at")]),
    notices: first(notices, "created_at"),
  };
}

/**
 * 점을 찍어야 할 탭들. 처음 보는 학생(기록 없음)에게는 점을 찍지 않고
 * "지금 봤다"로 초기화한다 — 기능을 켜자마자 모든 탭에 점이 달려 있으면
 * 새 소식이라는 신호가 무의미해지기 때문.
 */
export async function getStudentTabDots(student: Student, role: string): Promise<string[]> {
  const [updates, { data: seenRows }] = await Promise.all([
    getLatestUpdates(student, role),
    supabase
      .from("student_tab_seen")
      .select("tab, seen_at")
      .eq("student_id", student.id)
      .eq("role", role),
  ]);

  const seen = new Map((seenRows ?? []).map((r: { tab: string; seen_at: string }) => [r.tab, r.seen_at]));

  const dots: string[] = [];
  const toInit: { student_id: number; role: string; tab: string }[] = [];

  for (const tab of STUDENT_TABS_WITH_DOT) {
    const latest = updates[tab];
    if (!latest) continue;
    const seenAt = seen.get(tab);
    if (!seenAt) {
      toInit.push({ student_id: student.id, role, tab });
      continue;
    }
    if (latest > seenAt) dots.push(TAB_HREF[tab]);
  }

  if (toInit.length > 0) {
    await supabase.from("student_tab_seen").upsert(toInit, { onConflict: "student_id,role,tab" });
  }

  return dots;
}

export async function markStudentTabSeen(studentId: number, role: string, tab: StudentTabKey) {
  await supabase
    .from("student_tab_seen")
    .upsert(
      { student_id: studentId, role, tab, seen_at: new Date().toISOString() },
      { onConflict: "student_id,role,tab" }
    );
}
