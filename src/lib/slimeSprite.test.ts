import { describe, expect, it } from "vitest";
import { slimeSvg, SLIME_ATTRS } from "./slimeSprite";

describe("slimeSvg", () => {
  it("모든 속성 × 단계 조합이 유효한 SVG를 만든다", () => {
    for (const attr of SLIME_ATTRS) {
      for (const stage of ["egg", "baby", "teen", "awake"] as const) {
        const svg = slimeSvg(attr, stage, 100);
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg.endsWith("</svg>")).toBe(true);
        // 픽셀 격자가 실제로 채워졌는지 — 몸통이 비면 rect가 거의 없다
        expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThan(50);
      }
    }
  });

  it("알은 속성과 무관하게 동일하다 (부화 전 비공개)", () => {
    expect(slimeSvg("fire", "egg", 100)).toBe(slimeSvg("water", "egg", 100));
  });

  it("몸통 색은 속성별로 다르다", () => {
    const fire = slimeSvg("fire", "teen", 100);
    const water = slimeSvg("water", "teen", 100);
    expect(fire).toContain("#E24B4A");
    expect(water).toContain("#85B7EB");
    expect(fire).not.toBe(water);
  });

  it("각성은 스파클 오라가 있고 틴은 없다", () => {
    expect(slimeSvg("wood", "awake", 100)).toContain("slime-sparkle");
    expect(slimeSvg("wood", "teen", 100)).not.toContain("slime-sparkle");
  });

  it("표정이 얼굴 픽셀을 실제로 바꾼다", () => {
    const normal = slimeSvg("water", "teen", 100, "normal");
    for (const expr of ["laugh", "yawn", "cry", "sleep", "wink", "surprised", "love", "sing"] as const) {
      expect(slimeSvg("water", "teen", 100, expr)).not.toBe(normal);
    }
    // 하트눈 분홍, 노래 음표 보라
    expect(slimeSvg("water", "teen", 100, "love")).toContain("#E85D8A");
    expect(slimeSvg("water", "teen", 100, "sing")).toContain("#534AB7");
    // 하품·웃음은 입 안쪽 분홍, 울음은 눈물색, 졸음은 Z 픽셀
    expect(slimeSvg("water", "teen", 100, "yawn")).toContain("#E2938F");
    expect(slimeSvg("fire", "teen", 100, "cry")).toContain("#85B7EB");
    expect(slimeSvg("water", "teen", 100, "sleep")).toContain("#8C93A0");
  });

  it("알은 표정 파라미터를 무시한다", () => {
    expect(slimeSvg("water", "egg", 100, "laugh")).toBe(slimeSvg("water", "egg", 100));
  });

  it("장비는 틴부터 표시되고, 레전더리는 이펙트가 붙는다", () => {
    const bare = slimeSvg("water", "teen", 100);
    const armed = slimeSvg("water", "teen", 100, "normal", { weapon: "holysword", hat: "crown" });
    expect(armed).not.toBe(bare);
    expect(armed).toContain("slime-sparkle"); // 성검 불꽃 + 왕관 성광
    expect(armed).toContain("#FF8A3D"); // 불꽃 색
    // 베이비는 장비 미표시
    expect(slimeSvg("water", "baby", 100, "normal", { weapon: "holysword" })).toBe(slimeSvg("water", "baby", 100));
  });
});
