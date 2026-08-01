import type { BulkImportRow } from "./data";

// Column order for pasted bulk-import text. Matches what Excel/Google
// Sheets produces when you copy a range and paste into a plain textarea
// (tab-separated cells, newline-separated rows) — CSV (comma-separated)
// also works since spreadsheet apps rarely put commas inside these fields.
export const IMPORT_COLUMNS = [
  "학번",
  "이름",
  "닉네임",
  "구분",
  "학교",
  "학년",
  "생일",
  "학부모전화번호",
  "학생전화번호",
  "수업요일",
  "수업시간",
  "클리닉요일",
  "클리닉시간",
  "첫수업일",
] as const;

/** "2010.3.5"/"2010/3/5"/"2010-3-5" 등을 "YYYY-MM-DD"로 정규화. 알아볼 수
 * 없는 형식이면 null(= 빈 칸과 동일하게 취급, 기존 값 유지) — 잘못 적힌
 * 날짜 한 칸 때문에 그 학생의 나머지 정보 갱신이 막히지 않도록 한다.
 * 생일과 첫수업일 양쪽에 쓴다. */
function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function splitLine(line: string): string[] {
  const sep = line.includes("\t") ? "\t" : ",";
  return line.split(sep).map((cell) => cell.trim());
}

function cellOrNull(cells: string[], index: number): string | null {
  const value = cells[index];
  return value && value.trim() !== "" ? value.trim() : null;
}

export function parseRosterPaste(text: string): BulkImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const firstCells = splitLine(lines[0]);
  const looksLikeHeader = firstCells[0]?.replace(/\s/g, "") === "학번";
  const dataLines = looksLikeHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cells = splitLine(line);
    return {
      student_code: (cellOrNull(cells, 0) ?? "").replace(/\D/g, ""),
      name: cellOrNull(cells, 1) ?? "",
      nickname: cellOrNull(cells, 2),
      level: cellOrNull(cells, 3),
      school: cellOrNull(cells, 4),
      grade: cellOrNull(cells, 5),
      birthday: normalizeDate(cellOrNull(cells, 6)),
      parent_phone: cellOrNull(cells, 7),
      student_phone: cellOrNull(cells, 8),
      class_day: cellOrNull(cells, 9),
      class_time: cellOrNull(cells, 10),
      clinic_day: cellOrNull(cells, 11),
      clinic_time: cellOrNull(cells, 12),
      first_lesson_date: normalizeDate(cellOrNull(cells, 13)),
    };
  });
}
