import { describe, it, expect } from "vitest";
import { GUIDE_VERSION, isGuideUnread } from "./guideVersion";

describe("isGuideUnread", () => {
  it("한 번도 연 적 없으면 점을 띄운다 — 새로 온 사람에게도 안내서가 있다고 알려준다", () => {
    expect(isGuideUnread(null)).toBe(true);
  });

  it("지금 버전을 봤으면 안 띄운다", () => {
    expect(isGuideUnread(GUIDE_VERSION)).toBe(false);
  });

  it("옛 버전만 봤으면 다시 띄운다", () => {
    expect(isGuideUnread("2026-07-01")).toBe(true);
  });

  it("값이 깨져 있어도 띄운다 — 안 띄우고 놓치는 것보다 낫다", () => {
    expect(isGuideUnread("")).toBe(true);
    expect(isGuideUnread("undefined")).toBe(true);
  });
});
