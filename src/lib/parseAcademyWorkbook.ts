import "server-only";
import ExcelJS from "exceljs";
import {
  normalizeExportDate,
  normalizeStudentCode,
  parseClassSchedule,
  parseGradeLabel,
} from "./academyExport";
import type { BulkImportRow } from "./data";

/** 학원관리 프로그램 "회원명단" 엑셀의 헤더는 1~2행이 제목/생성시각이라
 * 3행에 있다. 열 순서는 버전에 따라 바뀔 수 있어 위치가 아니라 헤더 이름으로
 * 찾는다. */
const HEADER_ROW = 3;

function cellText(ws: ExcelJS.Worksheet, row: number, col: number): string {
  if (col <= 0) return "";
  const v = ws.getCell(row, col).value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    // 엑셀이 날짜형으로 준 경우 — 로컬 기준 Y/M/D를 그대로 쓴다.
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown };
    if (o.text !== undefined) return String(o.text).trim();
    if (o.result !== undefined) return String(o.result).trim();
    return "";
  }
  return String(v).trim();
}

export interface AcademyImportParse {
  rows: BulkImportRow[];
  skipped: { row: number; message: string }[];
  /** 국어 수업을 못 찾아 수업요일·시간을 비워둔 학생 이름 — 화면에 안내한다. */
  noClassSchedule: string[];
}

/**
 * 회원명단 엑셀을 일괄 등록용 행으로 변환한다.
 *
 * 원장님과 정한 규칙:
 * - 재원/퇴원(상태)과 반 배정(class_key)은 **건드리지 않는다** — 앱에서 직접
 *   관리하는 값이라 엑셀이 덮어쓰면 안 된다.
 * - 학급에서는 종주T 국어 수업만 골라 수업요일·시간으로 쓴다.
 * - 빈 칸은 "그대로 유지"로 처리된다(bulkImportStudents가 null인 필드를
 *   건너뛴다) — 이 엑셀은 생년월일·코칭수업 요일/시간이 전부 비어 있어서
 *   앱에 이미 들어있는 생일·클리닉 일정이 지워지지 않는다.
 */
export async function parseAcademyWorkbook(buffer: ArrayBuffer): Promise<AcademyImportParse> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], skipped: [{ row: 0, message: "시트를 찾을 수 없어요." }], noClassSchedule: [] };

  const headers: string[] = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    headers[c] = String(ws.getCell(HEADER_ROW, c).value ?? "").trim();
  }
  const col = (name: string) => headers.indexOf(name);

  const nameCol = col("학생명");
  const codeCol = col("학생번호");
  if (nameCol <= 0 || codeCol <= 0) {
    return {
      rows: [],
      skipped: [
        {
          row: 0,
          message: "회원명단 양식이 아니에요. '학생명'·'학생번호' 열이 있는 파일인지 확인해주세요.",
        },
      ],
      noClassSchedule: [],
    };
  }

  const rows: BulkImportRow[] = [];
  const skipped: { row: number; message: string }[] = [];
  const noClassSchedule: string[] = [];

  for (let r = HEADER_ROW + 1; r <= ws.rowCount; r++) {
    const name = cellText(ws, r, nameCol);
    if (!name) continue; // 빈 줄

    const code = normalizeStudentCode(cellText(ws, r, codeCol));
    if (!code) {
      skipped.push({ row: r, message: `${name}: 학생번호가 없어 건너뛰었어요.` });
      continue;
    }

    const { level, grade } = parseGradeLabel(cellText(ws, r, col("학년")));
    const schedule = parseClassSchedule(cellText(ws, r, col("학급")));
    if (!schedule) noClassSchedule.push(name);

    rows.push({
      student_code: code,
      name,
      school: cellText(ws, r, col("학교")) || null,
      level,
      grade,
      student_phone: cellText(ws, r, col("학생연락처")) || null,
      parent_phone: cellText(ws, r, col("학부모연락처")) || null,
      birthday: normalizeExportDate(cellText(ws, r, col("생년월일"))),
      first_lesson_date: normalizeExportDate(cellText(ws, r, col("첫수업"))),
      class_day: schedule?.day ?? null,
      class_time: schedule?.time ?? null,
      clinic_day: cellText(ws, r, col("코칭수업 요일")) || null,
      clinic_time: cellText(ws, r, col("코칭수업 시간")) || null,
    });
  }

  return { rows, skipped, noClassSchedule };
}
