// 학생 일괄 등록(엑셀/시트에서 붙여넣기) 기능에 그대로 붙여넣을 수 있는
// 입력용 엑셀 양식을 생성한다. 열 순서/이름은 src/lib/parseRoster.ts의
// IMPORT_COLUMNS와 반드시 일치해야 한다 — 그 파일을 바꾸면 이 스크립트도
// 같이 업데이트할 것.
//
// Usage: node scripts/generate-roster-template.mjs [출력경로.xlsx]

import ExcelJS from "exceljs";

const COLUMNS = [
  { header: "학번", width: 10 },
  { header: "이름", width: 10 },
  { header: "닉네임", width: 10 },
  { header: "구분", width: 8 },
  { header: "학교", width: 14 },
  { header: "학년", width: 6 },
  { header: "생일", width: 12 },
  { header: "학부모전화번호", width: 16 },
  { header: "학생전화번호", width: 16 },
  { header: "수업요일", width: 9 },
  { header: "수업시간", width: 9 },
  { header: "클리닉요일", width: 9 },
  { header: "클리닉시간", width: 9 },
];

const DAY_OPTIONS = ["월", "화", "수", "목", "금", "토", "일"];
const LEVEL_OPTIONS = ["고등", "중등"];
const MAX_ROWS = 200; // 입력 가능한 최대 학생 수(드롭다운 적용 범위)

const EXAMPLE_ROW = [
  "95641",
  "권서율",
  "차재봉",
  "고등",
  "배명고",
  "2",
  "2010-05-12",
  "010-1234-5678",
  "010-2222-3333",
  "일",
  "13:00",
  "목",
  "15:00",
];

async function main() {
  const outPath = process.argv[2] ?? "학생_정보_입력_양식.xlsx";

  const wb = new ExcelJS.Workbook();
  wb.creator = "유종의미 국어학원 학생관리 앱";
  wb.created = new Date();

  // ── 1. 입력 시트 ─────────────────────────────────────────────────
  const ws = wb.addWorksheet("입력");
  ws.columns = COLUMNS.map((c) => ({ width: c.width }));

  const headerRow = ws.addRow(COLUMNS.map((c) => c.header));
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const levelColIdx = COLUMNS.findIndex((c) => c.header === "구분") + 1;
  const classDayColIdx = COLUMNS.findIndex((c) => c.header === "수업요일") + 1;
  const clinicDayColIdx = COLUMNS.findIndex((c) => c.header === "클리닉요일") + 1;

  for (let row = 2; row <= MAX_ROWS + 1; row++) {
    ws.getRow(row).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
      };
    });
    ws.getCell(row, levelColIdx).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${LEVEL_OPTIONS.join(",")}"`],
    };
    ws.getCell(row, classDayColIdx).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${DAY_OPTIONS.join(",")}"`],
    };
    ws.getCell(row, clinicDayColIdx).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${DAY_OPTIONS.join(",")}"`],
    };
  }

  // ── 2. 작성 안내 시트 ────────────────────────────────────────────
  const guide = wb.addWorksheet("작성 안내");
  guide.columns = [{ width: 16 }, { width: 70 }];

  const title = guide.addRow(["학생 정보 입력 안내"]);
  title.font = { bold: true, size: 14 };
  guide.addRow([]);

  const notes = [
    ["학번", "5자리 숫자. 기존 학생은 원래 쓰던 학번 그대로, 신규 학생은 종주T가 배정한 번호."],
    ["이름", "학생 실명."],
    ["닉네임", "리더보드 등에서 실명 대신 보여줄 이름(선택, 비워도 됨)."],
    ["구분", `"${LEVEL_OPTIONS.join(" 또는 ")}" 중 하나.`],
    ["학교 / 학년", "학교명 자유 입력, 학년은 숫자만(예: 2)."],
    ["생일", '"YYYY-MM-DD" 형식(예: 2010-05-12). 모르면 비워둬도 됨.'],
    ["학부모전화번호 / 학생전화번호", "숫자만 또는 010-1234-5678 형식."],
    ["수업요일 / 클리닉요일", `"${DAY_OPTIONS.join("/")}" 중 하나.`],
    ["수업시간 / 클리닉시간", '24시간 기준 "HH:MM" 형식(예: 16:00).'],
  ];
  for (const [label, desc] of notes) {
    const r = guide.addRow([label, desc]);
    r.getCell(1).font = { bold: true };
    r.alignment = { vertical: "top", wrapText: true };
  }

  guide.addRow([]);
  const safetyTitle = guide.addRow(["붙여넣을 때 주의할 점"]);
  safetyTitle.font = { bold: true, size: 12 };
  const safetyNotes = [
    "이미 등록된 학번은 정보만 갱신되고, 출결·클리닉·성적 등 다른 기록은 전혀 건드리지 않아요(완전히 별도로 저장되는 정보라서요).",
    "빈 칸으로 둔 항목은 '지운다'가 아니라 '기존 값 그대로 유지'로 처리돼요. 바뀐 항목만 채워도 안전해요.",
    "목록에 없는 새 학번을 넣으면 새 학생으로 등록돼요.",
    "이 '입력' 시트의 데이터만(첫 줄 포함해도 됨) 복사해서 '학생 일괄 등록' 붙여넣기 칸에 그대로 붙여넣으면 돼요.",
  ];
  for (const n of safetyNotes) {
    const r = guide.addRow(["", `· ${n}`]);
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  guide.addRow([]);
  const exTitle = guide.addRow(["작성 예시 (참고용 — 실제로 붙여넣지 마세요)"]);
  exTitle.font = { bold: true, size: 12 };
  guide.addRow(COLUMNS.map((c) => c.header)).font = { bold: true };
  guide.addRow(EXAMPLE_ROW);

  await wb.xlsx.writeFile(outPath);
  console.log(`생성됨: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
