// 슬라임 아트 — 원장 확정 디자인(도트 일러스트)을 이미지로 사용한다.
// 원본 시트에서 잘라낸 투명 PNG가 public/slime/{속성}.png 에 있다.
//
// 이전의 코드 렌더러(slimeSprite.ts)는 알 단계와 아이템 도트에 계속 쓰이므로
// 지우지 않는다. 성장 단계는 같은 아트를 배율로 표현한다.

import type { SlimeAttr, SlimeStage } from "./slimeSprite";

/** 성장 단계별 표시 배율 — 같은 아트를 크기로 구분한다. */
const STAGE_SCALE: Record<Exclude<SlimeStage, "egg">, number> = {
  baby: 0.66,
  teen: 1,
  awake: 1.2,
};

/** 원본 PNG의 대략적인 가로:세로 비 (잘라낸 결과 기준, 5속성 평균) */
export const ART_RATIO = 290 / 332;

export function slimeArtSrc(attr: SlimeAttr): string {
  return `/slime/${attr}.png`;
}

/** 단계에 맞춘 실제 표시 폭(px). 알은 이 아트를 쓰지 않는다. */
export function slimeArtWidth(stage: SlimeStage, baseWidth: number): number {
  if (stage === "egg") return baseWidth;
  return Math.round(baseWidth * STAGE_SCALE[stage]);
}
