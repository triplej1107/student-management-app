"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/authz";
import { setClinicContact, setClinicContactNote } from "@/lib/clinicContactLog";
import { currentBacklogEvalWeek } from "@/lib/clinicBacklog";

export async function toggleContactAction(studentId: number, contacted: boolean) {
  const session = await requireStaffSession();
  await setClinicContact(studentId, currentBacklogEvalWeek(), { contacted, staffId: session.staffId });
  revalidatePath("/staff/clinic-backlog");
  revalidatePath("/admin/clinic-backlog");
}

export async function saveContactNoteAction(studentId: number, note: string) {
  await requireStaffSession();
  await setClinicContactNote(studentId, currentBacklogEvalWeek(), note);
  revalidatePath("/staff/clinic-backlog");
  revalidatePath("/admin/clinic-backlog");
}
