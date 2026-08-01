import { notFound } from "next/navigation";
import { requireStudentSession } from "@/lib/authz";
import { getStudentById } from "@/lib/data";
import { getStudentGradeTrends } from "@/lib/gradeTrends";
import { ScreenTitle } from "@/components/ui";
import { StudentGradeCharts } from "@/components/StudentGradeCharts";
import { TabSeenBeacon } from "@/components/TabSeenBeacon";

export default async function StudentGradesPage() {
  const session = await requireStudentSession();
  const student = await getStudentById(session.studentId);
  if (!student) notFound();

  const trends = await getStudentGradeTrends(student.id);

  return (
    <div className="box-border px-5 pt-2 pb-7">
      <TabSeenBeacon tab="grades" />
      <ScreenTitle>성적</ScreenTitle>

      <div className="mt-4">
        <StudentGradeCharts {...trends} />
      </div>
    </div>
  );
}
