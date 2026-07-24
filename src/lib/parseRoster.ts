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
  "학부모전화번호",
  "학생전화번호",
  "수업요일",
  "수업시간",
  "클리닉요일",
  "클리닉시간",
] as const;

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
      parent_phone: cellOrNull(cells, 6),
      student_phone: cellOrNull(cells, 7),
      class_day: cellOrNull(cells, 8),
      class_time: cellOrNull(cells, 9),
      clinic_day: cellOrNull(cells, 10),
      clinic_time: cellOrNull(cells, 11),
    };
  });
}
