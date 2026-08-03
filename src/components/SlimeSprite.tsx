import { slimeSvg, type SlimeAttr, type SlimeEquip, type SlimeStage } from "@/lib/slimeSprite";
import { slimeArtSrc, slimeArtWidth, ART_RATIO } from "@/lib/slimeArt";

/**
 * 슬라임 한 마리 — 서버 컴포넌트에서 바로 쓸 수 있다.
 * 알은 코드 렌더러(미스터리 알), 부화 후엔 확정 아트 이미지를 쓴다.
 */
export function SlimeSprite({
  attr,
  stage,
  width,
  equip,
}: {
  attr: SlimeAttr;
  stage: SlimeStage;
  width: number;
  equip?: SlimeEquip;
}) {
  if (stage === "egg") {
    return <span dangerouslySetInnerHTML={{ __html: slimeSvg(attr, stage, width, "normal", equip ?? {}) }} />;
  }
  const w = slimeArtWidth(stage, width);
  return (
    <span style={{ display: "inline-block", width: w }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="slime-art"
        src={slimeArtSrc(attr)}
        alt="슬라임"
        width={w}
        height={Math.round(w / ART_RATIO)}
      />
      <span className="slime-ground-shadow" style={{ display: "block" }} />
    </span>
  );
}
