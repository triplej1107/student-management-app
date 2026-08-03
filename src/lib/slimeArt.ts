// 슬라임 아트 — 원장 확정 디자인(도트 일러스트)을 이미지로 사용한다.
// 원본 시트에서 잘라낸 투명 PNG가 public/slime/ 에 있다.
//   {속성}.png            = 기본 표정
//   {속성}-{표정}.png     = 추가 표정 (있는 것만)
// 시트 임포트는 scratchpad/import_slime_sheet.mjs — 바닥·중앙 기준으로 정렬해
// 저장하므로 표정을 바꿔도 슬라임이 튀지 않는다.
//
// 이전의 코드 렌더러(slimeSprite.ts)는 알 단계와 아이템 도트에 계속 쓰이므로 지우지 않는다.

import type { SlimeAttr, SlimeExpression, SlimeStage } from "./slimeSprite";

/** 성장 단계별 표시 배율 — 같은 아트를 크기로 구분한다. */
const STAGE_SCALE: Record<Exclude<SlimeStage, "egg">, number> = {
  baby: 0.66,
  teen: 1,
  awake: 1.2,
};

/** 원본 PNG의 대략적인 가로:세로 비 */
export const ART_RATIO = 290 / 332;

/**
 * 속성별로 실제 파일이 있는 표정만 등록한다.
 * 표정 이미지를 추가하면 여기에 이름을 넣어야 렌더러가 쓴다.
 * (없는 표정을 요청하면 기본 표정으로 자동 폴백)
 */
export const ART_EXPRESSIONS: Partial<Record<SlimeAttr, SlimeExpression[]>> = {
  // 예) water: ["laugh", "cry", "sleep"],
};

export function hasArtExpression(attr: SlimeAttr, expression: SlimeExpression): boolean {
  if (expression === "normal") return true;
  return ART_EXPRESSIONS[attr]?.includes(expression) ?? false;
}

/** 표정 이미지가 없으면 기본 표정으로 폴백한다. */
export function slimeArtSrc(attr: SlimeAttr, expression: SlimeExpression = "normal"): string {
  return hasArtExpression(attr, expression) && expression !== "normal"
    ? `/slime/${attr}-${expression}.png`
    : `/slime/${attr}.png`;
}

/** 단계에 맞춘 실제 표시 폭(px). 알은 이 아트를 쓰지 않는다. */
export function slimeArtWidth(stage: SlimeStage, baseWidth: number): number {
  if (stage === "egg") return baseWidth;
  return Math.round(baseWidth * STAGE_SCALE[stage]);
}
