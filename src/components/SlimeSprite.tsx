import { slimeSvg, type SlimeAttr, type SlimeStage } from "@/lib/slimeSprite";

/** 슬라임 한 마리 — 서버 컴포넌트에서 바로 쓸 수 있는 정적 SVG 렌더. */
export function SlimeSprite({
  attr,
  stage,
  width,
}: {
  attr: SlimeAttr;
  stage: SlimeStage;
  width: number;
}) {
  return <span dangerouslySetInnerHTML={{ __html: slimeSvg(attr, stage, width) }} />;
}
