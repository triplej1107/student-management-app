// 슬라임 픽셀 렌더러 — game-design/slime-design.v3.json 확정 스펙 (2026-08-02)
//
// 서버 컴포넌트에서도 돌아야 하므로 브라우저 API(isPointInFill)를 쓰지 않고,
// 몸통 베지어를 폴리곤으로 근사한 뒤 point-in-polygon으로 픽셀 격자를 뽑는다.
// 디자인 튜닝은 game-design/슬라임랩.html에서 하고, 확정값만 여기 상수로 반영한다.

export type SlimeAttr = "fire" | "water" | "wood" | "gold" | "earth";
export type SlimeStage = "egg" | "baby" | "teen" | "awake";
// 표정 — 눈·입 픽셀이 실제로 바뀐다. 행동 연출은 SlimeIdle 컴포넌트가 담당.
export type SlimeExpression =
  | "normal"
  | "laugh"
  | "yawn"
  | "cry"
  | "sleep"
  | "wink"
  | "surprised"
  | "love"
  | "sing";

export const SLIME_ATTRS: SlimeAttr[] = ["fire", "water", "wood", "gold", "earth"];

export const ATTR_LABELS: Record<SlimeAttr, string> = {
  fire: "화 · 불티",
  water: "수 · 이슬",
  wood: "목 · 새싹",
  gold: "금 · 별빛",
  earth: "토 · 바위",
};

const BASELINE = 145;
const VIEWBOX = "-96 -26 192 200";
const CELL = 7;

// v3 확정 파라미터 (틴 기준형)
const P = {
  bodyW: 48,
  bodyH: 89,
  stemLen: 9,
  tipLean: 2,
  eyeSize: 10,
  eyeGap: 30,
  eyeY: 102,
  mouthW: 7,
  mouthY: 121,
};

const STAGE_TUNING = { eggW: 38, eggH: 85, babyScale: 0.68, babyTip: 0.5, babyMouth: 0.6, awakeScale: 1.14 };

const COLORS: Record<SlimeAttr, { fill: string; stroke: string; eye: string }> = {
  fire: { fill: "#E24B4A", stroke: "#A32D2D", eye: "#501313" },
  water: { fill: "#85B7EB", stroke: "#378ADD", eye: "#042C53" },
  wood: { fill: "#97C459", stroke: "#639922", eye: "#173404" },
  gold: { fill: "#FAC775", stroke: "#EF9F27", eye: "#412402" },
  earth: { fill: "#A97155", stroke: "#7A4B33", eye: "#3B2114" },
};

const EGG_SHELL = "#FDF8EF";
const EGG_LINE = "#B9AD9B";
const EGG_SPECKLE = "#DACFBC";

function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = t > 0 ? 255 : 0;
  const a = Math.abs(t);
  const mix = (v: number) => Math.round(v + (target - v) * a);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

type Pt = [number, number];

function sampleCubic(pts: Pt[], p0: Pt, p1: Pt, p2: Pt, p3: Pt) {
  const STEPS = 16;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
}

// 랩 bodyPath와 동일한 만두(dome) 실루엣의 폴리곤 근사
function bodyPolygon(W: number, H: number): Pt[] {
  const B = BASELINE;
  const pts: Pt[] = [[0, B]];
  sampleCubic(pts, [0, B], [-0.62 * W, B], [-0.94 * W, B - 0.16 * H], [-0.99 * W, B - 0.45 * H]);
  sampleCubic(pts, [-0.99 * W, B - 0.45 * H], [-1.02 * W, B - 0.72 * H], [-0.62 * W, B - H], [0, B - H]);
  sampleCubic(pts, [0, B - H], [0.62 * W, B - H], [1.02 * W, B - 0.72 * H], [0.99 * W, B - 0.45 * H]);
  sampleCubic(pts, [0.99 * W, B - 0.45 * H], [0.94 * W, B - 0.16 * H], [0.62 * W, B], [0, B]);
  return pts;
}

// 랩 eggSVG와 동일한 알 실루엣
function eggPolygon(w: number, h: number): Pt[] {
  const B = BASELINE;
  const pts: Pt[] = [[0, B]];
  sampleCubic(pts, [0, B], [-w * 0.85, B], [-w * 1.1, B - h * 0.27], [-w, B - h * 0.58]);
  sampleCubic(pts, [-w, B - h * 0.58], [-w * 0.9, B - h * 0.88], [-w * 0.5, B - h], [0, B - h]);
  sampleCubic(pts, [0, B - h], [w * 0.5, B - h], [w * 0.9, B - h * 0.88], [w, B - h * 0.58]);
  sampleCubic(pts, [w, B - h * 0.58], [w * 1.1, B - h * 0.27], [w * 0.85, B], [0, B]);
  return pts;
}

function pointInPolygon(poly: Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

interface Derived {
  bodyW: number;
  bodyH: number;
  stemLen: number;
  tipLean: number;
  eyeSize: number;
  eyeGap: number;
  eyeY: number;
  mouthW: number;
  mouthY: number;
}

function derive(stage: SlimeStage): Derived {
  if (stage === "teen" || stage === "egg") return { ...P };
  const scale = stage === "baby" ? STAGE_TUNING.babyScale : STAGE_TUNING.awakeScale;
  const bodyH = P.bodyH * scale;
  const sh = BASELINE - P.bodyH;
  const sh2 = BASELINE - bodyH;
  const mapY = (y: number) => sh2 + (y - sh) * scale;
  return {
    bodyW: P.bodyW * scale,
    bodyH,
    stemLen: stage === "baby" ? P.stemLen * STAGE_TUNING.babyTip : P.stemLen * 1.1,
    tipLean: stage === "baby" ? P.tipLean * 0.6 : P.tipLean,
    eyeSize: stage === "baby" ? P.eyeSize * 0.9 : P.eyeSize,
    eyeGap: P.eyeGap * scale,
    eyeY: mapY(P.eyeY),
    mouthW: stage === "baby" ? P.mouthW * STAGE_TUNING.babyMouth : P.mouthW,
    mouthY: mapY(P.mouthY),
  };
}

function rect(x: number, y: number, cell: number, fill: string, opacity?: number): string {
  return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fill}"${opacity ? ` opacity="${opacity}"` : ""}/>`;
}

// 미소/울상 곡선을 격자에 스냅해서 그린다 (dir: 1=미소, -1=울상)
function mouthCurve(p: Derived, c: { eye: string }, cell: number, grid: Set<string>, dir: number): string {
  let s = "";
  const seen = new Set<string>();
  for (let t = 0; t <= 1.001; t += 0.1) {
    const mx = (1 - t) * (1 - t) * -p.mouthW + t * t * p.mouthW;
    const my = (1 - t) * (1 - t) * p.mouthY + 2 * t * (1 - t) * (p.mouthY + dir * p.mouthW * 0.7) + t * t * p.mouthY;
    const gx = Math.floor(mx / cell) * cell;
    const gy = Math.floor(my / cell) * cell;
    const key = gx + "_" + gy;
    if (!seen.has(key) && grid.has(key)) {
      seen.add(key);
      s += rect(gx, gy, cell, c.eye);
    }
  }
  return s;
}

// 표정별 눈·입 픽셀 오버레이
function faceOverlay(
  p: Derived,
  c: { fill: string; stroke: string; eye: string },
  cell: number,
  expression: SlimeExpression,
  grid: Set<string>
): string {
  const snap = (v: number) => Math.floor(v / cell) * cell;
  const eyeY = snap(p.eyeY) - cell;
  let s = "";
  const happyEye = (x: number) =>
    rect(x - cell, eyeY + cell, cell, c.eye) + rect(x, eyeY, cell, c.eye) + rect(x + cell, eyeY + cell, cell, c.eye);
  const closedEye = (x: number) =>
    rect(x - cell, eyeY + cell, cell, c.eye) + rect(x, eyeY + cell, cell, c.eye) + rect(x + cell, eyeY + cell, cell, c.eye);
  const lineEye = (x: number) =>
    rect(x, eyeY, cell, c.eye) + rect(x, eyeY + cell, cell, c.eye) + rect(x, eyeY + 2 * cell, cell, c.eye);
  const wideEye = (x: number) => {
    let e = "";
    for (let j = 0; j < 3; j++) e += rect(x - cell, eyeY + j * cell, cell, c.eye) + rect(x, eyeY + j * cell, cell, c.eye);
    e += rect(x - cell, eyeY, cell, "#FFFFFF", 0.65);
    return e;
  };
  const heartEye = (x: number) => {
    const hc = 5;
    const rows = ["HH.HH", "HHHHH", ".HHH.", "..H.."];
    let e = "";
    rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        if (ch === ".") return;
        e += rect(x - 2 * hc + i * hc, eyeY + j * hc, hc, "#E85D8A");
      });
    });
    return e;
  };
  for (const side of [-1, 1]) {
    const x = snap(side * (p.eyeGap / 2));
    if (expression === "laugh" || expression === "sing") s += happyEye(x);
    else if (expression === "yawn" || expression === "sleep") s += closedEye(x);
    else if (expression === "wink") s += side === -1 ? closedEye(x) : lineEye(x);
    else if (expression === "surprised") s += wideEye(x);
    else if (expression === "love") s += heartEye(x);
    else {
      s += lineEye(x);
      if (expression === "cry") {
        s += rect(x, eyeY + 3 * cell, cell, "#85B7EB", 0.95) + rect(x, eyeY + 4 * cell, cell, "#B5D4F4", 0.9);
      }
    }
  }
  const mx = snap(0);
  const my = snap(p.mouthY);
  const topY = BASELINE - p.bodyH;
  if (expression === "laugh") {
    s += rect(mx - cell, my, cell, c.eye) + rect(mx, my, cell, c.eye) + rect(mx + cell, my, cell, c.eye) +
      rect(mx, my + cell, cell, "#E2938F");
  } else if (expression === "yawn") {
    for (const dx of [-cell, 0, cell]) {
      s += rect(mx + dx, my - cell, cell, c.eye) + rect(mx + dx, my, cell, c.eye);
    }
    s += rect(mx, my + cell, cell, c.eye) + rect(mx, my, cell, "#E2938F");
  } else if (expression === "cry") {
    s += mouthCurve(p, c, cell, grid, -1);
  } else if (expression === "sleep") {
    s += rect(mx, my, cell, c.eye);
    const zTop = topY - p.stemLen - 20;
    s += pixelZ(p.bodyW * 0.55, zTop, 5) + pixelZ(p.bodyW * 0.75, zTop - 16, 3.5);
  } else if (expression === "surprised") {
    s += rect(mx - cell, my, cell, c.eye) + rect(mx, my, cell, c.eye) +
      rect(mx - cell, my + cell, cell, c.eye) + rect(mx, my + cell, cell, c.eye);
  } else if (expression === "sing") {
    s += rect(mx, my, cell, c.eye) + rect(mx, my + cell, cell, "#E2938F");
    s += pixelNote(p.bodyW * 0.6, topY + 2, 4) + pixelNote(p.bodyW * 0.85, topY - 14, 3);
  } else {
    s += mouthCurve(p, c, cell, grid, 1);
  }
  return s;
}

// 8분음표 픽셀 (노래 표정용)
function pixelNote(x0: number, y0: number, cell: number): string {
  const rows = ["..NN", "..N.", "..N.", "NNN.", "NNN."];
  let s = "";
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === ".") return;
      s += rect(x0 + i * cell, y0 + j * cell, cell, "#534AB7", 0.85);
    });
  });
  return s;
}

function pixelZ(x0: number, y0: number, cell: number): string {
  const rows = ["ZZZ", ".Z.", "ZZZ"];
  let s = "";
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === ".") return;
      s += rect(x0 + i * cell, y0 + j * cell, cell, "#8C93A0", 0.85);
    });
  });
  return s;
}

function pixelSparkle(x: number, y: number, col: string, cell: number): string {
  let s = "";
  const arms: Pt[] = [[0, 0], [cell, 0], [-cell, 0], [0, cell], [0, -cell]];
  for (const [dx, dy] of arms) {
    s += rect(x + dx, y + dy, cell, col, dx === 0 && dy === 0 ? 0.95 : 0.7);
  }
  return s;
}

function eggSvg(): string {
  const cell = 5;
  const w = STAGE_TUNING.eggW;
  const h = STAGE_TUNING.eggH;
  const poly = eggPolygon(w, h);
  const x1 = Math.ceil((w + 6) / cell) * cell;
  const y0 = Math.floor((BASELINE - h - 6) / cell) * cell;
  const grid = new Set<string>();
  for (let y = y0; y < BASELINE; y += cell) {
    for (let x = -x1; x < x1; x += cell) {
      if (pointInPolygon(poly, x + cell / 2, y + cell / 2)) grid.add(x + "_" + y);
    }
  }
  let rects = "";
  for (const k of grid) {
    const [x, y] = k.split("_").map(Number);
    const edge = !(grid.has(x - cell + "_" + y) && grid.has(x + cell + "_" + y) && grid.has(x + "_" + (y - cell)) && grid.has(x + "_" + (y + cell)));
    rects += rect(x, y, cell, edge ? EGG_LINE : EGG_SHELL);
  }
  const sp = (fx: number, fy: number, col: string, o?: number) =>
    rect(Math.round(fx / cell) * cell, Math.round(fy / cell) * cell, cell, col, o);
  rects += sp(-w * 0.34, BASELINE - h * 0.38, EGG_SPECKLE) + sp(w * 0.3, BASELINE - h * 0.24, EGG_SPECKLE) +
    sp(w * 0.12, BASELINE - h * 0.55, EGG_SPECKLE) +
    sp(-w * 0.38, BASELINE - h * 0.78, "#FFFFFF", 0.85) + sp(-w * 0.38 + cell, BASELINE - h * 0.78 + cell, "#FFFFFF", 0.55);
  return `<ellipse cx="0" cy="148" rx="${w * 0.9}" ry="6" fill="#000" opacity="0.08"/>` +
    `<g class="slime-wobble">` + rects + `</g>`;
}

/**
 * 슬라임 한 마리의 SVG 마크업을 돌려준다 (서버/클라이언트 공용).
 * 알 단계는 attr 무관하게 공통 미스터리 알을 그린다.
 */
export function slimeSvg(
  attr: SlimeAttr,
  stage: SlimeStage,
  width: number,
  expression: SlimeExpression = "normal"
): string {
  let inner: string;
  if (stage === "egg") {
    inner = eggSvg();
  } else {
    const p = derive(stage);
    const c = COLORS[attr];
    const cell = CELL;
    const poly = bodyPolygon(p.bodyW, p.bodyH);
    const x1 = Math.ceil((p.bodyW + 6) / cell) * cell;
    const y0 = Math.floor((BASELINE - p.bodyH - 6) / cell) * cell;
    const grid = new Set<string>();
    for (let y = y0; y < BASELINE; y += cell) {
      for (let x = -x1; x < x1; x += cell) {
        if (pointInPolygon(poly, x + cell / 2, y + cell / 2)) grid.add(x + "_" + y);
      }
    }
    // 꼭지(안테나): 줄기 + 방울 2x2
    const topY = BASELINE - p.bodyH;
    const stemX = Math.round((p.tipLean * 0.5) / cell) * cell;
    const stemCells = Math.max(1, Math.round(p.stemLen / cell));
    let rects = "";
    for (let i = 1; i <= stemCells; i++) rects += rect(stemX, topY - i * cell, cell, c.stroke);
    for (const [dx, dy] of [[-cell / 2, 1], [cell / 2, 1], [-cell / 2, 2], [cell / 2, 2]] as Pt[]) {
      rects += rect(stemX + dx, topY - (stemCells + dy) * cell - 2, cell, c.stroke);
    }
    for (const k of grid) {
      const [x, y] = k.split("_").map(Number);
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const edge = !(grid.has(x - cell + "_" + y) && grid.has(x + cell + "_" + y) && grid.has(x + "_" + (y - cell)) && grid.has(x + "_" + (y + cell)));
      let fill = edge ? c.stroke : c.fill;
      if (!edge) {
        if (cy < BASELINE - p.bodyH * 0.5 && cx < -p.bodyW * 0.1) fill = shade(c.fill, 0.2);
        else if (cy > BASELINE - 18) fill = shade(c.fill, -0.16);
      }
      rects += rect(x, y, cell, fill);
    }
    // 광택 2셀
    const sx = Math.round((-p.bodyW * 0.5) / cell) * cell;
    const sy = Math.round((BASELINE - p.bodyH * 0.72) / cell) * cell;
    rects += rect(sx, sy, cell, "#FFFFFF", 0.85) + rect(sx + cell, sy + cell, cell, "#FFFFFF", 0.55);
    // 얼굴 (표정별 눈·입 오버레이)
    rects += faceOverlay(p, c, cell, expression, grid);
    let aura = "";
    if (stage === "awake") {
      const snap = (v: number) => Math.round(v / cell) * cell;
      aura = `<g class="slime-sparkle">` +
        pixelSparkle(snap(-(p.bodyW + 18)), snap(BASELINE - p.bodyH * 0.65), c.fill, cell) +
        pixelSparkle(snap(p.bodyW + 18), snap(BASELINE - p.bodyH * 0.95), c.fill, cell) +
        pixelSparkle(snap(p.bodyW + 22), snap(BASELINE - 18), c.stroke, cell) +
        `</g>`;
    }
    inner = `<ellipse cx="0" cy="148" rx="${p.bodyW * 0.8}" ry="6" fill="#000" opacity="0.08"/>` +
      aura +
      `<g class="slime-breathe">` + rects + `</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" width="${width}" role="img" aria-label="슬라임">` + inner + `</svg>`;
}
