// Optional: loads the real anonymized sample roster (shipped in the design
// handoff bundle) directly into the DB, so you can test student/parent
// login before setting up the Google Sheets sync. Safe to re-run — skips
// students whose student_code already exists.
//
// Usage: npm run seed:students

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다.");
  process.exit(1);
}
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const samplePath = path.resolve(
  __dirname,
  "../../design_handoff_student_management_app/sample_data/students-data.js"
);
const raw = fs.readFileSync(samplePath, "utf8");
const json = raw.replace(/^window\.STUDENTS\s*=\s*/, "").replace(/;\s*$/, "");
const students = JSON.parse(json);

function classKeyFor(s) {
  if (s.level === "중등") return "예비고1";
  if (s.school === "가락고") return "가락고1";
  if (s.grade === "1") return "배명고1";
  return "배명고2";
}

async function main() {
  const { data: existing } = await supabase.from("students").select("student_code");
  const existingCodes = new Set((existing ?? []).map((r) => r.student_code));

  const rows = students
    .filter((s) => !existingCodes.has(s.studentId))
    .map((s) => ({
      student_code: s.studentId,
      name: s.name,
      nickname: s.nickname || null,
      enrolled: !!s.enrolled,
      level: s.level || null,
      school: s.school || null,
      grade: s.grade || null,
      parent_phone: s.parentPhone || null,
      student_phone: s.studentPhone || null,
      class_day: s.classDay || null,
      class_time: s.classTime || null,
      clinic_day: s.clinicDay || null,
      clinic_time: s.clinicTime || null,
      final_score_label: s.finalScoreLabel || null,
      mid_mock_score: s.midMockScore ?? null,
      mid_score: s.midScore ?? null,
      mid_rank: s.midRank ?? null,
      final_comp_score: s.finalCompScore ?? null,
      final_comp_rank: s.finalCompRank ?? null,
      mock3_label: s.mock3Label || null,
      class_key: classKeyFor(s),
      main_book: !!s.mainBook,
      hw_book: !!s.hwBook,
      mgmt_book: !!s.mgmtBook,
      status: s.status || "",
      note_to_next_ta: s.noteToNextTA || "",
      overrides: {},
    }));

  if (rows.length === 0) {
    console.log("추가할 학생이 없습니다 (이미 모두 존재).");
    return;
  }

  const { error } = await supabase.from("students").insert(rows);
  if (error) throw error;
  console.log(`${rows.length}명의 샘플 학생을 추가했습니다.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
