// 슬라임 아트 — 원장 확정 디자인(도트 일러스트)을 이미지로 사용한다.
// 원본 시트에서 잘라낸 투명 PNG가 public/slime/ 에 있다.
//   {속성}.png            = 기본 표정
//   {속성}-{표정}.png     = 추가 표정 (있는 것만)
// 시트 임포트는 scratchpad/import_slime_sheet.mjs — 바닥·중앙 기준으로 정렬해
// 저장하므로 표정을 바꿔도 슬라임이 튀지 않는다.
//
// 이전의 코드 렌더러(slimeSprite.ts)는 알 단계와 아이템 도트에 계속 쓰이므로 지우지 않는다.

import type { SlimeAttr, SlimeStage } from "./slimeSprite";

/**
 * 아트 표정 — 코드 렌더러의 SlimeExpression과 별개다.
 * (코드 렌더러는 알 단계에만 쓰이고, 아트는 확정 일러스트 파일 목록을 따른다)
 */
export type ArtExpression =
  | "normal"
  | "laugh" | "cry" | "sleep" | "yawn" | "wink"
  | "surprised" | "sing" | "proud" | "tired" | "teary"
  | "pout" | "think" | "fired" | "dizzy" | "eating"
  | "smirk" | "halo";

/** 표정별 한글 이름 — 도감·디버그 표시에 쓴다. */
export const ART_EXPRESSION_LABELS: Record<ArtExpression, string> = {
  normal: "기본", laugh: "웃기", cry: "울기", sleep: "졸기", yawn: "하품",
  wink: "윙크", surprised: "놀람", sing: "노래", proud: "뿌듯", tired: "지침",
  teary: "눈물 글썽", pout: "뽀로통", think: "골똘히", fired: "씩씩",
  dizzy: "어질어질", eating: "먹는 중", smirk: "찡긋", halo: "후광 뿌듯",
};

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
 *
 * 2026-08-04 1차 시트: 17종이 5속성에 나뉘어 들어왔다. 속성마다 3~4종씩.
 * 속성별 전체 세트를 받으면 여기만 채우면 된다.
 */
export const ART_EXPRESSIONS: Record<SlimeAttr, ArtExpression[]> = {
  water: ["laugh", "surprised", "pout", "smirk"],
  gold: ["cry", "sing", "think", "halo"],
  fire: ["sleep", "proud", "fired"],
  wood: ["yawn", "tired", "dizzy"],
  earth: ["wink", "teary", "eating"],
};

export function hasArtExpression(attr: SlimeAttr, expression: ArtExpression): boolean {
  if (expression === "normal") return true;
  return ART_EXPRESSIONS[attr].includes(expression);
}

/** 표정 이미지가 없으면 기본 표정으로 폴백한다. */
export function slimeArtSrc(attr: SlimeAttr, expression: ArtExpression = "normal"): string {
  return hasArtExpression(attr, expression) && expression !== "normal"
    ? `/slime/${attr}-${expression}.png`
    : `/slime/${attr}.png`;
}

/** 단계에 맞춘 실제 표시 폭(px). 알은 이 아트를 쓰지 않는다. */
export function slimeArtWidth(stage: SlimeStage, baseWidth: number): number {
  if (stage === "egg") return baseWidth;
  return Math.round(baseWidth * STAGE_SCALE[stage]);
}
