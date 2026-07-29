import "server-only";
import ExcelJS from "exceljs";
import { Resend } from "resend";
import { supabase } from "./supabase";
import { listStudents, getClinicTemplatesForWeek, getStaffNameMap } from "./data";
import { toISODate, monthStart, monthEnd } from "./weeks";
import type {
  Student,
  AttendanceRecord,
  ClinicCheck,
  ClinicTemplate,
  ClassKey,
  SchoolExam,
  MockExam,
} from "./types";
import { SCHOOL_EXAMS, MOCK_EXAMS } from "./types";

const UJC_REASON_LABEL: Record<string, string> = {
  clinic_complete: "클리닉 완료",
  manual_grant: "지급",
  exchange: "교환",
  reset: "초기화",
};

interface UjcTransactionRow {
  id: number;
  student_id: number;
  amount: number;
  reason_type: string;
  reason_note: string | null;
  created_at: string;
}

async function fetchAttendance(startISO: string, endISO: string): Promise<AttendanceRecord[]> {
  const { data } = await supabase
    .from("attendance_records")
    .select("*")
    .gte("session_date", startISO)
    .lte("session_date", endISO)
    .order("session_date");
  return (data as AttendanceRecord[]) ?? [];
}

async function fetchClinicChecks(startISO: string, endISO: string): Promise<ClinicCheck[]> {
  const { data } = await supabase
    .from("clinic_checks")
    .select("*")
    .gte("week_start", startISO)
    .lte("week_start", endISO)
    .order("week_start");
  return (data as ClinicCheck[]) ?? [];
}

async function fetchAllSchoolExams(): Promise<SchoolExam[]> {
  const { data } = await supabase.from("school_exams").select("*");
  return (data as SchoolExam[]) ?? [];
}

async function fetchAllMockExams(): Promise<MockExam[]> {
  const { data } = await supabase.from("mock_exams").select("*");
  return (data as MockExam[]) ?? [];
}

async function fetchUjcTransactions(startISO: string, endISO: string): Promise<UjcTransactionRow[]> {
  const { data } = await supabase
    .from("ujc_transactions")
    .select("*")
    .gte("created_at", `${startISO}T00:00:00`)
    .lte("created_at", `${endISO}T23:59:59`)
    .order("created_at");
  return (data as UjcTransactionRow[]) ?? [];
}

function sheetHeader(ws: ExcelJS.Worksheet, cols: { header: string; width?: number }[]) {
  ws.columns = cols.map((c) => ({ header: c.header, width: c.width ?? 16 }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
}

/** 한 달치 전체 학생 기록(출결/클리닉/성적/UJC)을 엑셀 워크북으로 만든다.
 * 학부모 문의·이의제기 대응용 백업이 목적이라 재원 여부와 무관하게
 * 해당 기간에 실제 기록이 있는 모든 학생을 포함한다. */
export async function buildMonthlyReportWorkbook(year: number, month1to12: number): Promise<Buffer> {
  const anchor = new Date(year, month1to12 - 1, 1);
  const start = monthStart(anchor);
  const end = monthEnd(anchor);
  const startISO = toISODate(start);
  const endISO = toISODate(end);

  const [students, attendance, clinicChecks, schoolExams, mockExams, ujcTxns, staffNames] =
    await Promise.all([
      listStudents(),
      fetchAttendance(startISO, endISO),
      fetchClinicChecks(startISO, endISO),
      fetchAllSchoolExams(),
      fetchAllMockExams(),
      fetchUjcTransactions(startISO, endISO),
      getStaffNameMap(),
    ]);

  const studentById = new Map<number, Student>(students.map((s) => [s.id, s]));
  const studentLabel = (id: number) => {
    const s = studentById.get(id);
    return s ? `${s.name}(${s.student_code})` : `학생#${id}`;
  };

  // 이 달에 등장하는 주차들의 반별 점검표 원본(hw/test 라벨) 미리 로드.
  const weekStartsInMonth = Array.from(new Set(clinicChecks.map((c) => c.week_start))).sort();
  const templatesByWeek = new Map<string, Map<ClassKey, ClinicTemplate>>();
  for (const w of weekStartsInMonth) {
    templatesByWeek.set(w, await getClinicTemplatesForWeek(new Date(w + "T00:00:00")));
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "유종의미 국어학원 학생관리 앱";
  wb.created = new Date();

  // 1. 학생명단
  const wsRoster = wb.addWorksheet("학생명단");
  sheetHeader(wsRoster, [
    { header: "학번", width: 10 },
    { header: "이름" },
    { header: "닉네임" },
    { header: "반" },
    { header: "학교" },
    { header: "학년", width: 10 },
    { header: "재원상태", width: 10 },
    { header: "학부모연락처", width: 16 },
    { header: "학생연락처", width: 16 },
    { header: "수업요일/시간", width: 14 },
    { header: "클리닉요일/시간", width: 16 },
  ]);
  for (const s of students) {
    wsRoster.addRow([
      s.student_code,
      s.name,
      s.nickname ?? "",
      s.class_key ?? "",
      s.school ?? "",
      s.grade ?? "",
      s.enrolled ? "재원" : "퇴원",
      s.parent_phone ?? "",
      s.student_phone ?? "",
      [s.class_day, s.class_time].filter(Boolean).join(" "),
      [s.clinic_day, s.clinic_time].filter(Boolean).join(" "),
    ]);
  }

  // 2. 출결
  const wsAtt = wb.addWorksheet("출결");
  sheetHeader(wsAtt, [
    { header: "날짜", width: 12 },
    { header: "학생" },
    { header: "반", width: 10 },
    { header: "상태", width: 10 },
    { header: "담당조교" },
  ]);
  for (const a of attendance) {
    const s = studentById.get(a.student_id);
    wsAtt.addRow([
      a.session_date,
      studentLabel(a.student_id),
      s?.class_key ?? "",
      a.status,
      a.marked_by ? (staffNames.get(a.marked_by) ?? "") : "",
    ]);
  }

  // 3. 클리닉 체크리스트
  const wsClinic = wb.addWorksheet("클리닉체크리스트");
  sheetHeader(wsClinic, [
    { header: "주차", width: 12 },
    { header: "학생" },
    { header: "반", width: 10 },
    { header: "숙제1", width: 22 },
    { header: "숙제2", width: 22 },
    { header: "숙제3", width: 22 },
    { header: "숙제4", width: 22 },
    { header: "숙제5", width: 22 },
    { header: "숙제6", width: 22 },
    { header: "숙제7", width: 22 },
    { header: "테스트1", width: 20 },
    { header: "테스트2", width: 20 },
    { header: "테스트3", width: 20 },
    { header: "테스트4", width: 20 },
    { header: "조교결재", width: 10 },
    { header: "종주T결재", width: 10 },
    { header: "조교T피드백", width: 40 },
    { header: "종주T피드백", width: 40 },
  ]);
  for (const c of clinicChecks) {
    const s = studentById.get(c.student_id);
    const template = s?.class_key ? templatesByWeek.get(c.week_start)?.get(s.class_key) : undefined;
    const hwCells = Array.from({ length: 7 }, (_, i) => {
      const label = template?.hw_labels?.[i];
      if (!label) return "";
      return `${label}: ${c.hw_checks?.[i] ? "완료" : "미완료"}`;
    });
    const testCells = Array.from({ length: 4 }, (_, i) => {
      const label = template?.test_labels?.[i];
      if (!label) return "";
      const t = c.test_scores?.[i];
      const scoreLabel = t?.score || t?.total ? `${t?.score ?? "-"}/${t?.total ?? "-"}` : "-";
      return `${label}: ${scoreLabel}`;
    });
    wsClinic.addRow([
      c.week_start,
      studentLabel(c.student_id),
      s?.class_key ?? "",
      ...hwCells,
      ...testCells,
      c.staff_approved ? "완료" : "대기",
      c.zongju_approved ? "완료" : "대기",
      c.feedback_text ?? "",
      c.zongju_feedback_text ?? "",
    ]);
  }

  // 4. 성적 (현재 스냅샷 — 시험별 고정 슬롯이라 월별로 새로 생기는 데이터가 아님)
  const wsGrades = wb.addWorksheet(`성적(${toISODate(end)} 기준 스냅샷)`);
  sheetHeader(wsGrades, [
    { header: "학생" },
    { header: "반", width: 10 },
    { header: "구분", width: 10 },
    { header: "시험명", width: 16 },
    { header: "점수", width: 10 },
    { header: "등수/백분위", width: 12 },
    { header: "등급", width: 8 },
    { header: "비고", width: 24 },
    { header: "수정일", width: 12 },
  ]);
  const schoolExamLabel = new Map<string, string>(SCHOOL_EXAMS.map((e) => [e.key, e.label]));
  const mockExamLabel = new Map<string, string>(MOCK_EXAMS.map((e) => [e.key, e.label]));
  for (const e of schoolExams) {
    if (e.score === null && e.rank === null && !e.note) continue;
    const s = studentById.get(e.student_id);
    wsGrades.addRow([
      studentLabel(e.student_id),
      s?.class_key ?? "",
      "내신",
      schoolExamLabel.get(e.exam_key) ?? e.exam_key,
      e.score ?? "",
      e.rank ?? "",
      e.grade ?? "",
      e.note ?? "",
      e.updated_at?.slice(0, 10) ?? "",
    ]);
  }
  for (const e of mockExams) {
    if (e.score === null && e.percentile === null && !e.note) continue;
    const s = studentById.get(e.student_id);
    wsGrades.addRow([
      studentLabel(e.student_id),
      s?.class_key ?? "",
      "모의고사",
      mockExamLabel.get(e.exam_key) ?? e.exam_key,
      e.score ?? "",
      e.percentile ?? "",
      e.grade ?? "",
      e.note ?? "",
      e.updated_at?.slice(0, 10) ?? "",
    ]);
  }

  // 5. UJC 내역
  const wsUjc = wb.addWorksheet("UJC내역");
  sheetHeader(wsUjc, [
    { header: "일시", width: 18 },
    { header: "학생" },
    { header: "변동", width: 8 },
    { header: "사유", width: 12 },
    { header: "메모", width: 30 },
  ]);
  for (const t of ujcTxns) {
    wsUjc.addRow([
      t.created_at?.replace("T", " ").slice(0, 19) ?? "",
      studentLabel(t.student_id),
      t.amount,
      UJC_REASON_LABEL[t.reason_type] ?? t.reason_type,
      t.reason_note ?? "",
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function sendMonthlyReportEmail(year: number, month1to12: number) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_RECIPIENT_EMAIL;
  if (!apiKey) throw new Error("RESEND_API_KEY가 설정되지 않았어요.");
  if (!to) throw new Error("REPORT_RECIPIENT_EMAIL이 설정되지 않았어요.");

  const buffer = await buildMonthlyReportWorkbook(year, month1to12);
  const resend = new Resend(apiKey);

  const label = `${year}년 ${month1to12}월`;
  const { error } = await resend.emails.send({
    from: "유종의미 학생관리 <onboarding@resend.dev>",
    to,
    subject: `[유종의미] ${label} 학생 기록 보고서`,
    text: `${label} 학생 기록 전체(출결/클리닉/성적/UJC)를 정리한 엑셀 파일을 첨부합니다.`,
    attachments: [
      {
        filename: `유종의미_학생기록_${year}-${String(month1to12).padStart(2, "0")}.xlsx`,
        content: buffer,
      },
    ],
  });

  if (error) throw new Error(`이메일 발송 실패: ${error.message}`);
}
