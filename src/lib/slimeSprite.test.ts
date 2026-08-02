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
});
