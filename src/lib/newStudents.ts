import "server-only";
import { supabase } from "./supabase";
import { NEW_STUDENT_CHECKLIST, type NewStudentOnboarding } from "./types";

/** DB에 저장된 checks 배열이 항목 수보다 짧거나 길어도(항목을 나중에 추가한
 * 경우) 화면이 깨지지 않도록 항상 정해진 길이로 맞춰서 돌려준다. */
function normalize(row: NewStudentOnboarding): NewStudentOnboarding {
  const checks = Array.from(
    { length: NEW_STUDENT_CHECKLIST.length },
    (_, i) => row.checks?.[i] ?? false
  );
  return { ...row, checks };
}

/** 아직 6개를 다 못 챙긴 신규 학생 — 조교·종주T 홈 화면에 계속 떠 있는 목록. */
export async function listOpenOnboardings(): Promise<NewStudentOnboarding[]> {
  const { data } = await supabase
    .from("new_student_onboardings")
    .select("*")
    .is("completed_at", null)
    .order("created_at");
  return ((data as NewStudentOnboarding[]) ?? []).map(normalize);
}

/** 완료된 건까지 전부 — [아싸신규] 관리 탭에서 쓴다. */
export async function listAllOnboardings(): Promise<NewStudentOnboarding[]> {
  const { data } = await supabase
    .from("new_student_onboardings")
    .select("*")
    .order("created_at", { ascending: false });
  return ((data as NewStudentOnboarding[]) ?? []).map(normalize);
}

export async function createOnboarding(name: string, school: string | null, grade: string | null) {
  await supabase.from("new_student_onboardings").insert({
    name,
    school,
    grade,
    checks: NEW_STUDENT_CHECKLIST.map(() => false),
  });
}

export async function deleteOnboarding(id: number) {
  await supabase.from("new_student_onboardings").delete().eq("id", id);
}

/** 체크 하나를 켜고 끈다. 6개가 전부 켜지면 completed_at을 찍어 홈 화면
 * 목록에서 빠지고, 하나라도 다시 꺼지면 completed_at을 비워 되살린다. */
export async function toggleOnboardingCheck(id: number, index: number, value: boolean) {
  const { data } = await supabase
    .from("new_student_onboardings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  const current = normalize(data as NewStudentOnboarding);
  if (index < 0 || index >= NEW_STUDENT_CHECKLIST.length) return;

  const checks = [...current.checks];
  checks[index] = value;
  const allDone = checks.every(Boolean);

  await supabase
    .from("new_student_onboardings")
    .update({ checks, completed_at: allDone ? new Date().toISOString() : null })
    .eq("id", id);
}
