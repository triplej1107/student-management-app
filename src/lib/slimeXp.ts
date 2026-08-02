import "server-only";
import { supabase } from "./supabase";
import { mondayOf, toISODate } from "./weeks";
import type { AttendanceStatus, TestScore } from "./types";
import { SLIME_ATTRS, type SlimeAttr, type SlimeStage } from "./slimeSprite";
import {
  computeWeekEvents,
  countPerfectStreak,
  stageForXp,
  streakMultiplier,
  tenureMultiplier,
  type EvolveThresholds,
} from "./slimeXpRules";

// ============================================================
// 슬라임 XP 엔진 — DB 연동부. 규칙(순수 계산)은 slimeXpRules.ts.
// 설계: game-design/CONTEXT.md, 설계-아이템카탈로그.md
//
// 원칙:
//  · XP는 조교의 출결·클리닉 체크에서만 자동 발생. 수동 지급 없음.
//  · 멱등: 한 주의 이벤트는 source_key가 `{weekISO}|...`로 네임스페이스되고,
//    그 주의 원본 데이터가 바뀔 때마다 주 단위로 통째로 재계산(삭제 후 삽입)
//    하므로 체크 해제·수정에도 항상 원본과 일치한다.
//  · 시즌이 없는 기간(시즌0 시작 2026-08-22 전)에는 아무것도 하지 않는다 —
//    이 게이트가 곧 런칭 스위치다.
//  · 이 모듈의 실패가 출결/클리닉 저장을 깨면 안 된다 — syncSlimeWeek는
//    항상 삼켜지고 로그만 남긴다.
// ============================================================

export interface SeasonRow {
  id: number;
  key: string;
  starts_on: string;
  ends_on: string;
  evolve_thresholds: EvolveThresholds;
}

let seasonCache: { at: number; rows: SeasonRow[] } | null = null;

async function listSeasons(): Promise<SeasonRow[]> {
  if (seasonCache && Date.now() - seasonCache.at < 5 * 60 * 1000) return seasonCache.rows;
  const { data } = await supabase.from("game_seasons").select("*");
  const rows = (data ?? []) as SeasonRow[];
  seasonCache = { at: Date.now(), rows };
  return rows;
}

/** 이 주(월~일)와 겹치는 시즌. 없으면 null — XP 없음. */
export async function seasonForWeek(weekStart: Date): Promise<SeasonRow | null> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const ws = toISODate(weekStart);
  const we = toISODate(weekEnd);
  const seasons = await listSeasons();
  return seasons.find((s) => s.starts_on <= we && s.ends_on >= ws) ?? null;
}

export interface SlimeRow {
  id: number;
  student_id: number;
  season_id: number;
  generation: number;
  attribute: SlimeAttr | null;
  stage: SlimeStage | "job";
  xp: number;
  name: string;
  hatched_at: string | null;
}

export async function getOrCreateSlime(studentId: number, season: SeasonRow): Promise<SlimeRow | null> {
  const { data: existing } = await supabase
    .from("slimes")
    .select("*")
    .eq("student_id", studentId)
    .eq("season_id", season.id)
    .maybeSingle();
  if (existing) return existing as SlimeRow;
  const { data: created } = await supabase
    .from("slimes")
    .insert({ student_id: studentId, season_id: season.id, generation: 1, stage: "egg" })
    .select("*")
    .maybeSingle(); // 동시 생성 경합 시 unique 위반 — 아래에서 재조회
  if (created) return created as SlimeRow;
  const { data: retry } = await supabase
    .from("slimes")
    .select("*")
    .eq("student_id", studentId)
    .eq("season_id", season.id)
    .maybeSingle();
  return (retry as SlimeRow) ?? null;
}

/**
 * 한 학생의 한 주(週) XP를 원본 데이터로부터 통째로 재계산해서 반영한다.
 * 출결/클리닉의 어떤 쓰기 경로에서든 호출 — 실패는 삼키고 로그만 남긴다.
 */
export async function syncSlimeWeek(studentId: number, anyDateInWeek: Date): Promise<void> {
  try {
    await doSync(studentId, anyDateInWeek);
  } catch (e) {
    console.error(`[slimeXp] sync 실패 student=${studentId}`, e);
  }
}

async function doSync(studentId: number, anyDateInWeek: Date): Promise<void> {
  const weekStart = mondayOf(anyDateInWeek);
  const season = await seasonForWeek(weekStart);
  if (!season) return;

  const weekISO = toISODate(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const streakFrom = new Date(weekStart);
  streakFrom.setDate(streakFrom.getDate() - 7 * 3); // 이번 주 포함 4주 스트릭 판정

  const [studentRes, attRes, checkRes, prevCheckRes, multRes] = await Promise.all([
    supabase.from("students").select("first_lesson_date").eq("id", studentId).maybeSingle(),
    supabase
      .from("attendance_records")
      .select("session_date, status")
      .eq("student_id", studentId)
      .gte("session_date", toISODate(streakFrom))
      .lte("session_date", toISODate(weekEnd)),
    supabase.from("clinic_checks").select("hw_checks, test_scores").eq("student_id", studentId).eq("week_start", weekISO).maybeSingle(),
    supabase.from("clinic_checks").select("test_scores").eq("student_id", studentId).eq("week_start", toISODate(prevWeek)).maybeSingle(),
    supabase.from("xp_multiplier_events").select("multiplier, starts_on, ends_on"),
  ]);

  const allAtt = (attRes.data ?? []) as { session_date: string; status: AttendanceStatus }[];
  const weekAtt = allAtt.filter((a) => a.session_date >= weekISO);

  const events = computeWeekEvents({
    weekStartISO: weekISO,
    seasonStartISO: season.starts_on,
    attendance: weekAtt.map((a) => ({ dateISO: a.session_date, status: a.status })),
    hwChecks: (checkRes.data?.hw_checks as boolean[] | undefined) ?? null,
    testScores: (checkRes.data?.test_scores as TestScore[] | undefined) ?? null,
    prevTestScores: (prevCheckRes.data?.test_scores as TestScore[] | undefined) ?? null,
  });

  // 배율: 근속 × 스트릭 × 이벤트 (주 단위 스냅샷)
  const weeksDesc: AttendanceStatus[][] = [0, 1, 2, 3].map((back) => {
    const ws = new Date(weekStart);
    ws.setDate(ws.getDate() - 7 * back);
    const wsISO = toISODate(ws);
    const weISO = toISODate(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6));
    return allAtt.filter((a) => a.session_date >= wsISO && a.session_date <= weISO).map((a) => a.status);
  });
  const streak = streakMultiplier(countPerfectStreak(weeksDesc));
  const tenure = tenureMultiplier(studentRes.data?.first_lesson_date ?? null, weekStart);
  const weISO = toISODate(weekEnd);
  const eventMult = Math.max(
    1,
    ...((multRes.data ?? []) as { multiplier: number; starts_on: string; ends_on: string }[])
      .filter((m) => m.starts_on <= weISO && m.ends_on >= weekISO)
      .map((m) => Number(m.multiplier) || 1)
  );
  const mult = tenure * streak * eventMult;

  // 주 단위 재계산: 이 주 네임스페이스의 기존 이벤트를 지우고 다시 넣는다
  await supabase.from("xp_events").delete().eq("student_id", studentId).like("source_key", `${weekISO}|%`);
  if (events.length > 0) {
    await supabase.from("xp_events").insert(
      events.map((e) => ({
        student_id: studentId,
        season_id: season.id,
        kind: e.kind,
        source_key: e.sourceKey,
        base_amount: e.base,
        multiplier: mult,
        amount: Math.round(e.base * mult),
        note: e.note,
      }))
    );
  }

  // 슬라임 갱신: 누적 XP + 진화 (부화 시 랜덤 속성)
  const slime = await getOrCreateSlime(studentId, season);
  if (!slime) return;
  const { data: sumRows } = await supabase.from("xp_events").select("amount").eq("student_id", studentId).eq("season_id", season.id);
  const totalXp = (sumRows ?? []).reduce((sum, r) => sum + (r.amount as number), 0);
  const currentStage: SlimeStage = slime.stage === "job" ? "awake" : slime.stage;
  const nextStage = stageForXp(totalXp, season.evolve_thresholds, currentStage);
  const update: Record<string, unknown> = { xp: totalXp };
  if (slime.stage !== "job" && nextStage !== slime.stage) {
    update.stage = nextStage;
    if (slime.stage === "egg" && nextStage !== "egg" && !slime.attribute) {
      update.attribute = SLIME_ATTRS[Math.floor(Math.random() * SLIME_ATTRS.length)];
      update.hatched_at = new Date().toISOString();
    }
  }
  await supabase.from("slimes").update(update).eq("id", slime.id);
}
