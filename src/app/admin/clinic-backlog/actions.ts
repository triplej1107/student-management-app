"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { setClinicContact, setClinicContactNote } from "@/lib/clinicContactLog";
import { currentBacklogEvalWeek, clearClinicBacklogEntry } from "@/lib/clinicBacklog";
import { parseISODate } from "@/lib/weeks";

export async function toggleContactAction(studentId: number, contacted: boolean) {
  await requireZongjuSession();
  await setClinicContact(studentId, currentBacklogEvalWeek(), { contacted });
  revalidatePath("/admin/clinic-backlog");
  revalidatePath("/admin");
  revalidatePath("/staff/clinic-backlog");
}

export async function saveContactNoteAction(studentId: number, note: string) {
  await requireZongjuSession();
  await setClinicContactNote(studentId, currentBacklogEvalWeek(), note);
  revalidatePath("/admin/clinic-backlog");
  revalidatePath("/staff/clinic-backlog");
}

/** 종주T 전용 — 밀림을 실제로 해소하지 않고도 목록에서 청산 처리. */
export async function clearBacklogAction(studentId: number, weekStartISO: string) {
  await requireZongjuSession();
  await clearClinicBacklogEntry(studentId, parseISODate(weekStartISO));
  revalidatePath("/admin/clinic-backlog");
  revalidatePath("/admin");
  revalidatePath("/staff/clinic-backlog");
}
