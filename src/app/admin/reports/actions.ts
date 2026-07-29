"use server";

import { requireZongjuSession } from "@/lib/authz";
import { sendMonthlyReportEmail } from "@/lib/monthlyReport";

export async function sendMonthlyReportNowAction(year: number, month: number) {
  await requireZongjuSession();
  await sendMonthlyReportEmail(year, month);
}
