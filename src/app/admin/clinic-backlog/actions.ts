"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { setClinicContact, setClinicContactNote } from "@/lib/clinicContactLog";
import { currentBacklogEvalWeek } from "@/lib/clinicBacklog";

export async function toggleContactAction(studentId: number, contacted: boolean) {
  await requireZongjuSession();
  await setClinicContact(studentId, currentBacklogEvalWeek(), { contacted });
  revalidatePath("/admin/clinic-backlog");
  revalidatePath("/admin");
}

export async function saveContactNoteAction(studentId: number, note: string) {
  await requireZongjuSession();
  await setClinicContactNote(studentId, currentBacklogEvalWeek(), note);
  revalidatePath("/admin/clinic-backlog");
}
