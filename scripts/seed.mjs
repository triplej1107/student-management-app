// One-time setup: seeds the duty checklist items and the 종주T admin
// password hash. Safe to re-run (upserts).
//
// Usage: npm run seed   (reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY /
// ADMIN_PASSWORD from .env.local via Node's --env-file flag)

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!url || !serviceRoleKey) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다.");
  process.exit(1);
}
if (!adminPassword) {
  console.error("ADMIN_PASSWORD가 .env.local에 없습니다.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const DUTY_ITEMS = [
  "학생들에게 존댓말 쓰지 말고 반말쓰기",
  "학생들에게 말 먼저 걸기",
  "출근하면 화장실 문 열기",
  "칠판 닦고 칠판지우개 빨기",
  "로비 포함 강의실 책상 지우개가루 쓸어버리기",
  "싱크대에 분필물 잘 닦고, 혹시 식기 같은 거 있으면 세척하기",
  "바닥에 보이는 쓰레기는 꼭 주우세요(안 주우면 장종주T에게 떠넘기는 것)",
  "택배 온 물건 안으로 들이고 정리하기(박스 뜯고 정리해주세요)",
  "출근 직후/퇴근 직전 책상 줄 맞추고 데스크·싱크대·학생 책상·의자 정리",
  "데스크 컴퓨터 켜고 송파관 카카오톡 로그인, 맥가이 로그인",
  "결제는 앞 키오스크에서 직접 하게 하기",
  "학생이 오면 반갑게 인사하고 핸드폰 제출, 점검표 챙겨가라고 말하기",
  "숙제검사 시 학생 챙겨오고 검사결과를 점검표에 작성",
  '학생상태 좋음/보통/나쁨 반드시 체크 및 특이사항 반드시 "다음 조교에게 전달"란에 기록',
  "맥가이 [기본메뉴-수업관리-수업목록]에 2차 기록 후 알림톡 발송",
  "모든 체크리스트 확인되면 조교칸에 짧은 메시지 작성",
  "모든 자료 챙겨서 원장님 최종 체크 받으라고 안내",
  "최종체크 완료 시 학생에게 점검표 반환",
  "학생 질문은 종주T에게 하라고 안내, 조교는 채점/기록 중심",
  "시간 비면 돌아다니며 학생 진행상황 계속 보기",
  "정수기 컵/분필/여자화장실 휴지 부족 여부 확인 후 채우기",
  "핸드폰 보지 않기",
  "궁금한 건 법인폰 또는 종주T에게 바로 카톡",
  "모든 걸 다 완벽히 못해도 아이들에게 잘해주고 신뢰 얻기",
];

async function main() {
  const { data: existing, error: fetchErr } = await supabase
    .from("duty_items")
    .select("id")
    .limit(1);
  if (fetchErr) throw fetchErr;

  if (!existing || existing.length === 0) {
    const rows = DUTY_ITEMS.map((label, i) => ({ label, sort_order: i }));
    const { error } = await supabase.from("duty_items").insert(rows);
    if (error) throw error;
    console.log(`duty_items: ${rows.length}개 항목 생성됨`);
  } else {
    console.log("duty_items: 이미 데이터가 있어 건너뜀");
  }

  const hash = await bcrypt.hash(adminPassword, 10);
  const { error: adminErr } = await supabase
    .from("admin_config")
    .upsert({ id: 1, password_hash: hash });
  if (adminErr) throw adminErr;
  console.log("admin_config: 종주T 비밀번호 해시 저장됨");
}

main()
  .then(() => {
    console.log("시드 완료");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
