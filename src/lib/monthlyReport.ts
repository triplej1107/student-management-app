import "server-only";
import ExcelJS from "exceljs";
import { Resend } from "resend";
import { supabase } from "./supabase";
import { listStudents, getClinicTemplatesForWeek, getStaffNameMap } from "./data";
import { toISODate, monthStart, monthEnd } from "./weeks";
import { activeClasses } from "./types";
import type {
  Student,
  AttendanceRecord,
  ClinicCheck,
  ClinicTemplate,
  ClassKey,
  SchoolExam,
  MockExam,
  MakeupSchedule,
} from "./types";
import { SCHOOL_EXAMS, MOCK_EXAMS } from "./types";

const UJC_REASON_LABEL: Record<string, string> = {
  clinic_complete: "클리닉 완료",
  manual_grant: "지급",
  exchange: "교환",
  reset: "초기화",
  birthday_gift: "생일 축하",
};

interface UjcTransactionRow {
  id: number;
  student_id: number;
  amount: number;
  reason_type: string;
  reason_note: string | null;
  created_at: string;
}

// ── 반별 시트 정렬/색 헬퍼 ────────────────────────────────────────────
const koreanCollator = new Intl.Collator("ko");
const TAB_COLOR_PALETTE = ["FF4472C4", "FFED7D31", "FF70AD47", "FF9E480E", "FF636363"];
const UNASSIGNED_SHEET = "반 미배정";

function tabColorForIndex(idx: number): string {
  return TAB_COLOR_PALETTE[idx % TAB_COLOR_PALETTE.length];
}

// ── 상담 시 눈에 띄어야 할 항목(결석/조정/60%이하 성적) 강조 스타일 ──────
const FILL_BAD: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
const FONT_BAD = { color: { argb: "FF9C0006" } };
const FILL_WARN: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEB9C" } };
const FONT_WARN = { color: { argb: "FF9C6500" } };

function isLowScore(scoreStr?: string, totalStr?: string): boolean {
  if (!scoreStr || !totalStr) return false;
  const score = Number(scoreStr);
  const total = Number(totalStr);
  return Number.isFinite(score) && Number.isFinite(total) && total > 0 && score / total <= 0.6;
}
function clinicHasLowScore(c: ClinicCheck): boolean {
  return (c.test_scores ?? []).some((t) => isLowScore(t.score, t.total));
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

async function fetchMakeupSchedules(startISO: string, endISO: string): Promise<MakeupSchedule[]> {
  const { data } = await supabase
    .from("makeup_schedules")
    .select("*")
    .gte("session_date", startISO)
    .lte("session_date", endISO);
  return (data as MakeupSchedule[]) ?? [];
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

async function fetchUjcTransactions(endISO: string): Promise<UjcTransactionRow[]> {
  // 월말까지의 전체 내역 — 이번 달 적립/사용 계산과 월말 잔액 계산에 함께 쓴다.
  const { data } = await supabase
    .from("ujc_transactions")
    .select("*")
    .lte("created_at", `${endISO}T23:59:59`)
    .order("created_at");
  return (data as UjcTransactionRow[]) ?? [];
}

function sheetHeader(ws: ExcelJS.Worksheet, headers: string[], widths: number[]) {
  const row = ws.addRow(headers);
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  });
  ws.columns = widths.map((w) => ({ width: w }));
}

function sectionTitle(ws: ExcelJS.Worksheet, title: string) {
  const row = ws.addRow([title]);
  row.font = { bold: true, size: 12 };
  ws.mergeCells(row.number, 1, row.number, Math.max(ws.columnCount, 6));
}

/** Excel 시트명 제약(31자, : \ / ? * [ ] 금지) + 중복 방지. */
function makeSheetName(base: string, used: Set<string>): string {
  const cleaned = base.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
  let name = cleaned || "학생";
  let i = 2;
  while (used.has(name)) {
    const suffix = `_${i}`;
    name = cleaned.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  used.add(name);
  return name;
}

/** 한 달치 전체 학생 기록을 "학생별로" 엑셀 워크북으로 만든다. 학부모
 * 문의·이의제기 대응이 목적이라, 표를 항목별로 죽 나열하는 대신 학생
 * 한 명당 시트 하나에 그 학생의 그 달 이야기(출결→클리닉→UJC)를
 * 순서대로 볼 수 있게 구성한다. 재원 여부와 무관하게 그 달에 실제
 * 기록이 있었던 학생은 모두 포함한다. */
export async function buildMonthlyReportWorkbook(year: number, month1to12: number): Promise<Buffer> {
  const anchor = new Date(year, month1to12 - 1, 1);
  const start = monthStart(anchor);
  const end = monthEnd(anchor);
  const startISO = toISODate(start);
  const endISO = toISODate(end);

  const [students, attendance, makeups, clinicChecks, schoolExams, mockExams, ujcAllUpToEnd, staffNames] =
    await Promise.all([
      listStudents(),
      fetchAttendance(startISO, endISO),
      fetchMakeupSchedules(startISO, endISO),
      fetchClinicChecks(startISO, endISO),
      fetchAllSchoolExams(),
      fetchAllMockExams(),
      fetchUjcTransactions(endISO),
      getStaffNameMap(),
    ]);

  const studentById = new Map<number, Student>(students.map((s) => [s.id, s]));
  const schoolExamLabel = new Map<string, string>(SCHOOL_EXAMS.map((e) => [e.key, e.label]));
  const mockExamLabel = new Map<string, string>(MOCK_EXAMS.map((e) => [e.key, e.label]));

  // 이 달에 등장하는 주차들의 반별 점검표(hw/test 라벨) 미리 로드.
  const weekStartsInMonth = Array.from(new Set(clinicChecks.map((c) => c.week_start))).sort();
  const templatesByWeek = new Map<string, Map<ClassKey, ClinicTemplate>>();
  for (const w of weekStartsInMonth) {
    templatesByWeek.set(w, await getClinicTemplatesForWeek(new Date(w + "T00:00:00")));
  }

  // student_id -> 그달 기록들 묶기
  const attByStudent = new Map<number, AttendanceRecord[]>();
  for (const a of attendance) {
    (attByStudent.get(a.student_id) ?? attByStudent.set(a.student_id, []).get(a.student_id)!).push(a);
  }
  const makeupByStudentDate = new Map<string, MakeupSchedule>();
  for (const m of makeups) makeupByStudentDate.set(`${m.student_id}_${m.session_date}`, m);

  const clinicByStudent = new Map<number, ClinicCheck[]>();
  for (const c of clinicChecks) {
    (clinicByStudent.get(c.student_id) ?? clinicByStudent.set(c.student_id, []).get(c.student_id)!).push(c);
  }

  const ujcThisMonthByStudent = new Map<number, UjcTransactionRow[]>();
  const ujcBalanceAtEndByStudent = new Map<number, number>();
  for (const t of ujcAllUpToEnd) {
    ujcBalanceAtEndByStudent.set(t.student_id, (ujcBalanceAtEndByStudent.get(t.student_id) ?? 0) + t.amount);
    if (t.created_at >= `${startISO}T00:00:00` && t.created_at <= `${endISO}T23:59:59`) {
      (ujcThisMonthByStudent.get(t.student_id) ?? ujcThisMonthByStudent.set(t.student_id, []).get(t.student_id)!).push(t);
    }
  }

  const schoolExamsByStudent = new Map<number, SchoolExam[]>();
  for (const e of schoolExams) {
    if (e.score === null && e.rank === null && !e.note) continue;
    (schoolExamsByStudent.get(e.student_id) ?? schoolExamsByStudent.set(e.student_id, []).get(e.student_id)!).push(e);
  }
  const mockExamsByStudent = new Map<number, MockExam[]>();
  for (const e of mockExams) {
    if (e.score === null && e.percentile === null && !e.note) continue;
    (mockExamsByStudent.get(e.student_id) ?? mockExamsByStudent.set(e.student_id, []).get(e.student_id)!).push(e);
  }

  const includedStudents = students.filter(
    (s) =>
      s.enrolled ||
      attByStudent.has(s.id) ||
      clinicByStudent.has(s.id) ||
      (ujcThisMonthByStudent.get(s.id)?.length ?? 0) > 0
  );

  // 재원생이 200명을 넘어가는 규모라 학생 한 명당 시트를 만들면 탭이 200개가
  // 넘어 아무것도 못 찾는다. **반별로 시트 하나**를 만들고 그 안에 학생 기록을
  // 차례로 쌓는다 — 탭은 "전체 요약 + 반 수"로 줄고, 상담 때 그 반만 열면 된다.
  const sortedStudents = includedStudents.slice().sort((a, b) => koreanCollator.compare(a.name, b.name));

  // 반 순서는 CLASSES 정의 순서를 따르고, 반이 없는 학생은 맨 뒤 별도 시트로.
  const studentsByClass = new Map<string, typeof sortedStudents>();
  for (const s of sortedStudents) {
    const key = s.class_key ?? UNASSIGNED_SHEET;
    const list = studentsByClass.get(key) ?? [];
    list.push(s);
    studentsByClass.set(key, list);
  }
  const classOrder = [
    ...activeClasses().filter((c: string) => studentsByClass.has(c)),
    ...(studentsByClass.has(UNASSIGNED_SHEET) ? [UNASSIGNED_SHEET] : []),
  ];

  const wb = new ExcelJS.Workbook();
  wb.creator = "유종의미 국어학원 학생관리 앱";
  wb.created = new Date();

  // ── 1. 전체 요약: 한눈에 훑어보는 학생별 요약표 ──────────────────────
  const wsSummary = wb.addWorksheet("전체 요약");
  sheetHeader(
    wsSummary,
    ["이름", "학번", "반", "재원상태", "출석", "지각", "조정", "결석", "클리닉완료", "클리닉대상", "UJC적립", "UJC사용", "UJC월말잔액", "성적경고"],
    [10, 10, 10, 8, 6, 6, 6, 6, 10, 10, 8, 8, 10, 8]
  );

  // ── 2. 반별 시트 — 그 반 학생 기록을 차례로 쌓는다 ────────────────────
  //
  // 예전에는 학생 한 명당 시트였는데, 200명이 넘어가면 탭만 200개라 정작
  // 찾고 싶은 학생을 못 찾는다. 반별로 묶으면 탭은 대여섯 개로 줄고,
  // 상담할 때도 그 반 시트 하나만 열면 된다. 전체 요약의 이름을 누르면
  // 그 학생 기록 위치로 바로 뛴다.
  const usedNames = new Set<string>(["전체 요약"]);
  const anchorByStudent = new Map<number, { sheet: string; row: number }>();

  classOrder.forEach((classKey, classIdx) => {
    const ws = wb.addWorksheet(makeSheetName(classKey, usedNames));
    ws.properties.tabColor = { argb: tabColorForIndex(classIdx) };
    ws.getColumn(1).width = 14;
    for (let c = 2; c <= 8; c++) ws.getColumn(c).width = 18;

    const classStudents = studentsByClass.get(classKey) ?? [];
    for (const s of classStudents) {
      // 전체 요약에서 이 학생으로 뛰어올 위치. 블록을 쓰기 직전 행 번호다.
      anchorByStudent.set(s.id, { sheet: ws.name, row: ws.rowCount + 1 });

    const backRow = ws.addRow([{ text: "◀ 전체 요약으로", hyperlink: "#'전체 요약'!A1" }]);
    backRow.getCell(1).font = { color: { argb: "FF1155CC" }, underline: true, bold: true };

    const titleRow = ws.addRow([
      `${s.name} (${s.student_code}) · ${s.class_key ?? "반 미배정"} · ${s.enrolled ? "재원" : "퇴원"}`,
    ]);
    titleRow.font = { bold: true, size: 14 };
    ws.mergeCells(titleRow.number, 1, titleRow.number, 8);
    ws.addRow([
      `${s.school ?? ""} ${s.grade ?? ""}`.trim(),
      "학부모연락처",
      s.parent_phone ?? "",
      "학생연락처",
      s.student_phone ?? "",
    ]);
    ws.addRow([`대상 기간: ${startISO} ~ ${endISO}`]);
    ws.addRow([]);

    // 출결
    sectionTitle(ws, "출결");
    const attHeaderRow = ws.addRow(["날짜", "상태", "담당조교", "비고(조정/보강)"]);
    attHeaderRow.font = { bold: true };
    const att = (attByStudent.get(s.id) ?? []).slice().sort((a, b) => a.session_date.localeCompare(b.session_date));
    if (att.length === 0) {
      ws.addRow(["이 기간 출결 기록 없음"]);
    }
    for (const a of att) {
      const makeup = makeupByStudentDate.get(`${s.id}_${a.session_date}`);
      const note =
        a.status === "조정" && makeup
          ? `→ 보강: ${makeup.makeup_day} ${makeup.makeup_time}${makeup.note ? ` (${makeup.note})` : ""}`
          : "";
      const attRow = ws.addRow([
        a.session_date,
        a.status,
        a.marked_by ? (staffNames.get(a.marked_by) ?? "") : "",
        note,
      ]);
      if (a.status === "결석") {
        attRow.eachCell((cell) => {
          cell.fill = FILL_BAD;
          cell.font = FONT_BAD;
        });
      } else if (a.status === "조정") {
        attRow.eachCell((cell) => {
          cell.fill = FILL_WARN;
          cell.font = FONT_WARN;
        });
      }
    }
    ws.addRow([]);

    // 클리닉
    sectionTitle(ws, "클리닉 체크리스트");
    const clinicHeaderRow = ws.addRow([
      "주차",
      "숙제 완료",
      "테스트 결과",
      "조교결재",
      "종주T결재",
      "최종수정",
      "조교T피드백",
      "종주T피드백",
    ]);
    clinicHeaderRow.font = { bold: true };
    const clinics = (clinicByStudent.get(s.id) ?? []).slice().sort((a, b) => a.week_start.localeCompare(b.week_start));
    if (clinics.length === 0) {
      ws.addRow(["이 기간 클리닉 기록 없음"]);
    }
    for (const c of clinics) {
      const template = s.class_key ? templatesByWeek.get(c.week_start)?.get(s.class_key) : undefined;
      const hwDone = (template?.hw_labels ?? [])
        .map((label, i) => (label ? `${label}: ${c.hw_checks?.[i] ? "완료" : "미완료"}` : null))
        .filter(Boolean)
        .join(" / ");
      const testResult = (template?.test_labels ?? [])
        .map((label, i) => {
          if (!label) return null;
          const t = c.test_scores?.[i];
          const scoreLabel = t?.score || t?.total ? `${t?.score ?? "-"}/${t?.total ?? "-"}` : "-";
          return `${label}: ${scoreLabel}`;
        })
        .filter(Boolean)
        .join(" / ");
      const clinicRow = ws.addRow([
        c.week_start,
        hwDone || "-",
        testResult || "-",
        c.staff_approved ? "완료" : "대기",
        c.zongju_approved ? "완료" : "대기",
        c.updated_at?.slice(0, 10) ?? "",
        c.feedback_text ?? "",
        c.zongju_feedback_text ?? "",
      ]);
      if (clinicHasLowScore(c)) {
        clinicRow.getCell(3).fill = FILL_BAD;
        clinicRow.getCell(3).font = FONT_BAD;
      }
    }
    ws.addRow([]);

    // UJC
    sectionTitle(ws, "UJC 내역");
    const ujcHeaderRow = ws.addRow(["일시", "변동", "사유", "메모"]);
    ujcHeaderRow.font = { bold: true };
    const ujc = (ujcThisMonthByStudent.get(s.id) ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (ujc.length === 0) {
      ws.addRow(["이 기간 UJC 변동 없음"]);
    }
    for (const t of ujc) {
      ws.addRow([
        t.created_at?.replace("T", " ").slice(0, 19) ?? "",
        t.amount,
        UJC_REASON_LABEL[t.reason_type] ?? t.reason_type,
        t.reason_note ?? "",
      ]);
    }
    const earned = ujc.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const spent = ujc.filter((t) => t.amount < 0).reduce((sum, t) => sum + -t.amount, 0);
    const summaryRow = ws.addRow([
      `이번 달 적립 ${earned} / 사용 ${spent} · 월말 잔액 ${ujcBalanceAtEndByStudent.get(s.id) ?? 0}`,
    ]);
    summaryRow.font = { bold: true };
    ws.addRow([]);

    // 성적 (있을 때만)
    const grades = [
      ...(schoolExamsByStudent.get(s.id) ?? []).map((e) => ({
        구분: "내신",
        시험명: schoolExamLabel.get(e.exam_key) ?? e.exam_key,
        점수: e.score,
        등수백분위: e.rank,
        등급: e.grade,
        비고: e.note,
        수정일: e.updated_at?.slice(0, 10),
      })),
      ...(mockExamsByStudent.get(s.id) ?? []).map((e) => ({
        구분: "모의고사",
        시험명: mockExamLabel.get(e.exam_key) ?? e.exam_key,
        점수: e.score,
        등수백분위: e.percentile,
        등급: e.grade,
        비고: e.note,
        수정일: e.updated_at?.slice(0, 10),
      })),
    ];
    if (grades.length > 0) {
      sectionTitle(ws, `성적 (${endISO} 기준 스냅샷)`);
      const gradeHeaderRow = ws.addRow(["구분", "시험명", "점수", "등수/백분위", "등급", "비고", "수정일"]);
      gradeHeaderRow.font = { bold: true };
      for (const g of grades) {
        const gradeRow = ws.addRow([g.구분, g.시험명, g.점수 ?? "", g.등수백분위 ?? "", g.등급 ?? "", g.비고 ?? "", g.수정일 ?? ""]);
        if (g.점수 !== null && g.점수 <= 60) {
          gradeRow.getCell(3).fill = FILL_BAD;
          gradeRow.getCell(3).font = { ...FONT_BAD, bold: true };
        }
      }
    }

      // 학생과 학생 사이 구분선 — 한 시트에 여러 명이 이어지므로 경계가 없으면
      // 어디서 끊기는지 알 수 없다.
      const dividerRow = ws.addRow([]);
      ws.mergeCells(dividerRow.number, 1, dividerRow.number, 8);
      dividerRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" },
      };
      ws.addRow([]);
    }
  });


  // ── 3. 전체 요약 채우기 — 반별 시트의 위치를 알아야 링크가 걸리므로 마지막에.
  for (const s of sortedStudents) {
    const att = attByStudent.get(s.id) ?? [];
    const countBy = (status: string) => att.filter((a) => a.status === status).length;
    const clinics = clinicByStudent.get(s.id) ?? [];
    const doneCount = clinics.filter((c) => c.zongju_approved).length;
    const ujc = ujcThisMonthByStudent.get(s.id) ?? [];
    const earned = ujc.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const spent = ujc.filter((t) => t.amount < 0).reduce((sum, t) => sum + -t.amount, 0);
    const absentCount = countBy("결석");
    const adjustedCount = countBy("조정");
    const hasLowGrade =
      clinics.some(clinicHasLowScore) ||
      (schoolExamsByStudent.get(s.id) ?? []).some((e) => e.score !== null && e.score <= 60) ||
      (mockExamsByStudent.get(s.id) ?? []).some((e) => e.score !== null && e.score <= 60);
    const anchor = anchorByStudent.get(s.id);
    const row = wsSummary.addRow([
      anchor ? { text: s.name, hyperlink: `#'${anchor.sheet}'!A${anchor.row}` } : s.name,
      s.student_code,
      s.class_key ?? "",
      s.enrolled ? "재원" : "퇴원",
      countBy("출석"),
      countBy("지각"),
      adjustedCount,
      absentCount,
      doneCount,
      clinics.length,
      earned,
      spent,
      ujcBalanceAtEndByStudent.get(s.id) ?? 0,
      hasLowGrade ? "⚠" : "",
    ]);
    row.getCell(1).font = { color: { argb: "FF1155CC" }, underline: true };
    if (absentCount > 0) {
      row.getCell(8).fill = FILL_BAD;
      row.getCell(8).font = FONT_BAD;
    }
    if (adjustedCount > 0) {
      row.getCell(7).fill = FILL_WARN;
      row.getCell(7).font = FONT_WARN;
    }
    if (hasLowGrade) {
      row.getCell(14).fill = FILL_BAD;
      row.getCell(14).font = { ...FONT_BAD, bold: true };
    }
  }
  wsSummary.views = [{ state: "frozen", ySplit: 1 }];

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
    from: "유종의미 학생관리 <report@kaujm.kr>",
    to,
    subject: `[유종의미] ${label} 학생 기록 보고서`,
    text: `${label} 학생별 기록(출결/클리닉/UJC/성적)을 정리한 엑셀 파일을 첨부합니다. 학생 한 명당 시트 하나로 구성되어 있어요.`,
    attachments: [
      {
        filename: `유종의미_학생기록_${year}-${String(month1to12).padStart(2, "0")}.xlsx`,
        content: buffer,
      },
    ],
  });

  if (error) throw new Error(`이메일 발송 실패: ${error.message}`);
}
