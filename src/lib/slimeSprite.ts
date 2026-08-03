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

export const STAGE_LABELS: Record<SlimeStage | "job", string> = {
  egg: "알",
  baby: "베이비 슬라임",
  teen: "틴 슬라임",
  awake: "각성 슬라임",
  job: "전직 슬라임",
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

// 알 팔레트 — 연둣빛 껍질 + 큼직한 얼룩무늬 (포켓몬 알 문법, 원장 레퍼런스 2026-08-02)
const EGG_SHELL = "#F1F6E4";
const EGG_SHADE = "#DDE8C6";
const EGG_SPOT = "#9BC26B";
const EGG_LINE = "#5C7C3A";

// 얼룩 배치 (fx: 폭 비율, fy: 높이 비율(바닥 기준), r: 폭 비율 반지름)
const EGG_SPOTS = [
  { fx: -0.5, fy: 0.78, r: 0.42 },
  { fx: 0.62, fy: 0.4, r: 0.4 },
  { fx: -0.08, fy: 0.16, r: 0.17 },
  { fx: 0.12, fy: 0.62, r: 0.1 },
];

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
  const spots = EGG_SPOTS.map((s) => ({ cx: s.fx * w, cy: BASELINE - s.fy * h, r: s.r * w }));
  let rects = "";
  for (const k of grid) {
    const [x, y] = k.split("_").map(Number);
    const edge = !(grid.has(x - cell + "_" + y) && grid.has(x + cell + "_" + y) && grid.has(x + "_" + (y - cell)) && grid.has(x + "_" + (y + cell)));
    const cx = x + cell / 2;
    const cy = y + cell / 2;
    let fill: string;
    if (edge) fill = EGG_LINE;
    else {
      fill = cy > BASELINE - h * 0.22 ? EGG_SHADE : EGG_SHELL;
      for (const s of spots) {
        if ((cx - s.cx) * (cx - s.cx) + (cy - s.cy) * (cy - s.cy) < s.r * s.r) fill = EGG_SPOT;
      }
    }
    rects += rect(x, y, cell, fill);
  }
  const sp = (fx: number, fy: number, col: string, o?: number) =>
    rect(Math.round(fx / cell) * cell, Math.round(fy / cell) * cell, cell, col, o);
  rects += sp(-w * 0.3, BASELINE - h * 0.88, "#FFFFFF", 0.85) + sp(-w * 0.3 + cell, BASELINE - h * 0.88 + cell, "#FFFFFF", 0.55);
  return `<ellipse cx="0" cy="148" rx="${w * 0.9}" ry="6" fill="#000" opacity="0.08"/>` +
    `<g class="slime-wobble">` + rects + `</g>`;
}

// ============================================================
// 도트 장비 — game-design/슬라임랩.html의 스프라이트를 그대로 이식.
// 레전더리는 셀 3.5(2배 해상도) + 전용 이펙트 ("1%는 픽셀을 아끼지 말 것").
// ============================================================
export type EquipSlot = "weapon" | "shield" | "hat" | "eyewear" | "effect";
export type SlimeEquip = Partial<Record<EquipSlot, string>>;

const PIXEL_PAL: Record<string, string> = {
  K: "#33302B", F: "#FFFFFF", S: "#D7DBE0", s: "#9AA1AC",
  G: "#F2C14E", g: "#C9922E", W: "#C9A24E", w: "#8B6B35",
  A: "#A97155", a: "#7A4B33", R: "#E24B4A", r: "#A32D2D",
  B: "#378ADD", b: "#185FA5", P: "#7F77DD", p: "#534AB7", Y: "#EFD489",
  O: "#FF8A3D", L: "#FFD166",
  N: "#F7A8C1", n: "#E0759B", V: "#79B94C", v: "#557F2E",
  T: "#5BC8E8", E: "#F3D9A9", H: "#FFF4C9", D: "#7E1717",
};

const PIXEL_SPRITES: Record<string, string[]> = {
  woodsword: ["..K..", ".KWK.", ".KWK.", ".KWK.", ".KWK.", "KwwwK", ".KAK.", ".KaK."],
  knightsword: ["..K..", ".KFK.", ".KSK.", ".KSK.", ".KSK.", ".KSK.", "KGGGK", ".KPK.", ".KPK.", ".KBK."],
  staff: ["..K..", ".KPK.", "KPFPK", ".KPK.", ".KAK.", ".KAK.", ".KAK.", ".KAK.", ".KaK."],
  woodshield: ["..KKK..", ".KWWWK.", "KWWwWWK", "KWwswWK", "KWWwWWK", ".KwwwK.", "..KKK.."],
  kite: [".KKKKK.", "KSBBBSK", "KBBGBBK", "KBGGGBK", "KBBGBBK", ".KBBBK.", "..KBK..", "...K..."],
  spellbook: ["KKKKKK", "KpPPPK", "KpPGPK", "KpPPPK", "KKKKKK"],
  straw: ["...KKKKK...", "..KYYYYYK..", ".KKRRRRRKK.", "KYYYYYYYYYK", "KKKKKKKKKKK"],
  wizard: ["...G...", "...K...", "..KPK..", ".KPFPK.", ".KPPPK.", "KpPPPpK", "KKKKKKK"],

  // ---------- 노말 33종 (카탈로그 v5) — 오른손 ----------
  // 연필: 흑심-나무-노란 몸통-분홍 지우개
  pencil: ["..K..", ".KWK.", ".KLK.", ".KLK.", ".KLK.", ".KLK.", ".KNK.", ".KnK."],
  // 샤프: 가는 금속 촉 + 파란 몸통 + 흰 그립
  sharp: ["..K..", ".KsK.", ".KBK.", ".KBK.", ".KFK.", ".KFK.", ".KBK.", ".KsK."],
  // 커터칼: 은색 날(눈금) + 노란 손잡이
  cutter: ["..K..", ".KSK.", ".KsK.", ".KSK.", ".KsK.", "KYYYK", ".KYK.", ".KYK."],
  // 스마트폰: 검은 베젤 + 밝은 화면
  smartphone: ["KKKKK", "KBBBK", "KBFBK", "KBBBK", "KBBBK", "KKKKK"],
  // 볼펜: 국민 흰 몸통 볼펜 — 검은 촉꼭지와 클릭
  ballpen: ["..K..", ".KKK.", ".KFK.", ".KFK.", ".KFK.", ".KFK.", ".KKK.", ".KsK."],
  // 만년필: 금촉 + 검은 몸통 + 금 밴드
  fountain: ["..K..", ".KGK.", ".KgK.", ".KKK.", ".KKK.", ".KGK.", ".KKK.", ".KKK."],
  // 물총: 주황 배럴 + 하늘색 물탱크 (워터밤 느낌)
  watergun: ["..KK..", ".KOOK.", ".KOOK.", "..KOK.", "..KOK.", ".KTTK.", ".KTTK.", "..KK.."],
  // 작은 나뭇가지: 잎 달린 잔가지
  twig: ["...VV", "..KAV", ".KAK.", ".KAK.", ".KAK.", ".KaK."],

  // ---------- 노말 — 왼손 ----------
  // 책: 파란 하드커버 + 페이지 단면 (교과서)
  book: ["KKKKKK", "KBBBSK", "KBBBSK", "KBbBSK", "KBBBSK", "KKKKKK"],
  // 가방: 빨간 백팩 + 앞주머니 (파란 슬라임에도 묻히지 않게)
  backpack: ["..KK..", ".KRRK.", "KRRRRK", "KRrrRK", "KRrrRK", "KKKKKK"],
  // 핸드백: 분홍 + 손잡이 고리
  handbag: ["..KK..", ".K..K.", "KNNNNK", "KNnNnK", "KNNNNK", ".KKKK."],
  // 노트북: 파란 화면 + 은색 키보드
  laptop: ["KKKKKK", "KBFFBK", "KBBFBK", "KKKKKK", "KSSSSK", ".KKKK."],
  // 아이패드: 흰 화면 태블릿 + 위쪽 연회색 로고 점 (사과는 위에 있으니까)
  tablet: ["KKKKK", "KFFFK", "KFSFK", "KFFFK", "KFFFK", "KKKKK"],
  // 핸드폰: 레트로 폴더폰 (오른손 스마트폰과 구분)
  flipphone: [".KKK.", ".KTK.", ".KTK.", "KKKKK", ".KSK.", ".KsK.", ".KKK."],
  // 노트: 스프링 노트 (윗줄 스프링 링)
  note: ["s.s.s.", "KKKKKK", "KYYYYK", "KYYYYK", "KKKKKK"],
  // 소설책: 보라 표지 + 빨간 책갈피 끈
  novel: ["KKKKKK", "KPPRSK", "KPPRSK", "KPPPSK", "KPPPSK", "KKKKKK"],
  // 에코백: 크림 천가방 + 초록 잎 프린트 (손잡이 위를 이어 닫은 아치)
  ecobag: [".KKKK.", ".K..K.", "KEEEEK", "KEVVEK", "KEEEEK", "KKKKKK"],

  // ---------- 노말 — 머리 ----------
  // 야구모자: 파란 돔 + 앞챙 (마지막 줄 = 챙 아래 경계선, HAT_DROP으로 한 칸 하강)
  cap: ["...KKK...", "..KBBBK..", ".KBbBBBK.", ".KKKKKKK.", "..KBBBBBK", "..KKKKKKK"],
  // 챙모자: 크림 챙 넓은 모자 + 분홍 리본 (챙 양옆 한 픽셀 확장)
  sunhat: ["...KKKKK...", "..KFFFFFK..", ".KKNNNNNKK.", "KFFFFFFFFFK", "KKKKKKKKKKK"],
  // 비니: 두상에 딱 붙는 니트 — 옆으로 퍼진 실루엣 + 립 접단 + 경계선
  beanie: ["..KKKKK..", ".KRRRRRK.", "KRRRRRRRK", "KrRrRrRrK", "KKKKKKKKK"],
  // 메쉬캡: 흰 전면 + 회색 메쉬 + 앞챙 (HAT_DROP으로 한 칸 하강)
  meshcap: ["...KKK...", "..KFFsK..", ".KFFFssK.", ".KKKKKKK.", "..KSSSSSK", "..KKKKKKK"],
  // 헤어밴드: 분홍 밴드 + 작은 리본 (밴드 아래 경계선)
  hairband: ["....KNK", ".KKKKK.", "KNNNNNK", ".KKKKK."],

  // ---------- 레어 — 전설의 용사(hero): 검=knightsword, 방패=kite 재사용 ----------
  // 푸른 깃털 투구
  hero_head: ["..KB.....", ".KBB.....", "..KKKKK..", ".KSSSSSK.", "KSSFSSSSK", "KKKKKKKKK"],

  // ---------- 레어 — 정령술사(spirit) ----------
  // 꽃잎 화관
  spirit_head: ["..N.P.Y..", ".KVVVVVK.", "..KKKKK.."],
  // 이슬 나뭇가지 (이슬방울 T)
  spirit_right: ["...VV", "..KAV", ".KAKT", ".KAK.", ".KAK.", ".KaK."],
  // 요정 램프
  spirit_left: [".KK..", ".KK..", "KLLLK", "KLFLK", "KLLLK", ".KKK."],

  // ---------- 레어 — 엘프 레인저(ranger) ----------
  // 잎사귀 후드
  ranger_head: ["..KKK..", ".KVvVK.", "KVVVVVK", "KvVvVvK", "KKKKKKK"],
  // 요정의 활
  ranger_right: [".KK..", "KWKK.", "KW.K.", "KW.K.", "KW.K.", "KWKK.", ".KK.."],
  // 깃털 화살통
  ranger_left: ["Y.Y..", "K.K..", "KAAK.", "KAAK.", "KAAK.", "KKKK."],

  // ---------- 매직 — 정의의 변호사(lawyer) ----------
  // 단정한 가르마 머리
  lawyer_head: ["...KKKK..", ".KKKKKKK.", "KKKKsKKKK", "KKKKKKKKK"],
  // 정의의 법봉
  lawyer_right: ["KKKKK", "KAAAK", "KKKKK", ".KAK.", ".KAK.", ".KaK."],
  // 육법전서 (금박 문양)
  lawyer_left: ["KKKKKK", "KbGbSK", "KbbbSK", "KbGbSK", "KbbbSK", "KKKKKK"],

  // ---------- 매직 — 천재 과학자(scientist) ----------
  // 폭탄 머리
  scientist_head: ["K.K.K.K.K", "KKKKKKKKK", ".KKKKKKK.", "KKKKKKKKK"],
  // 형광 플라스크
  scientist_right: ["..K..", ".KFK.", ".KFK.", "KFVVK", "KVVVK", "KKKKK"],
  // 설계도 클립보드
  scientist_left: [".KKK.", "KKSKK", "KFBFK", "KFFBK", "KFBFK", "KKKKK"],

  // ---------- 매직 — 여행 유튜버(youtuber) ----------
  // 버킷햇
  youtuber_head: ["..KKKKK..", ".KTTTTTK.", ".KTTTTTK.", "KKKKKKKKK", "KTTTTTTTK", "KKKKKKKKK"],
  // 셀카봉
  youtuber_right: ["KKKKK", "KBFBK", "KKKKK", "..K..", "..K..", "..K..", ".KsK."],
  // 여행 캐리어 (스티커)
  youtuber_left: [".K..K.", "KKKKKK", "KTTNTK", "KTYTTK", "KTTTVK", "KKKKKK"],

  // ---------- 매직 — 군인(soldier) ----------
  // 위장 철모
  soldier_head: ["..KKK..", ".KVVVK.", "KVvVvVK", "KVVvVVK", "KKKKKKK"],
  // 야전삽 (밈 파워)
  soldier_right: [".KSK.", "KSSSK", "KSSSK", ".KAK.", ".KAK.", ".KAK.", "KAAAK"],
  // 위장 방패
  soldier_left: ["..KKK..", ".KVVVK.", "KVvVvVK", "KVVvVVK", "KVvVvVK", ".KVVVK.", "..KKK.."],

  // ---------- 매직 — 명의(doctor) 세트 ----------
  // 수술 캡: 두상 밀착 흰 캡 + 초록 십자
  doctor_head: ["..KKKKK..", ".KFFFFFK.", "KFFFVFFFK", "KKKKKKKKK"],
  // 청진기: 귀꽂이 두 갈래 + 은색 체스트피스
  doctor_right: ["K...K", ".K.K.", "..K..", "..K..", ".KSK.", ".KsK."],
  // 진료 차트: 클립 달린 화이트보드 + 기록 줄
  doctor_left: [".KKK.", "KKSKK", "KFFFK", "KFsFK", "KFFFK", "KFsFK", "KKKKK"],
};

const PIXEL_FINE: Record<string, { cls: string; body: string[]; fx?: string[] }> = {
  holysword: {
    cls: "slime-sparkle",
    body: [
      "......K......", ".....KGK.....", "....KGFGK....", "....KGFGK....", "....KGFGK....",
      "....KGFGK....", "....KGFGK....", "....KGFGK....", "....KGFGK....", "....KGFGK....",
      "....KGFGK....", "....KGGGK....", "...KKGGGKK...", "KGGGgGGGgGGGK", ".KK.KKRKK.KK.",
      ".....KRK.....", ".....KRK.....", ".....KrK.....", "....KKrKK....", "....KRRRK....", "....KKKKK....",
    ],
    fx: [
      "....L..L.....", "..O......O...", "...L.O..L....", ".O........O..", "..L......L...",
      ".............", "O..........O.", "..L......L...", ".............", ".O........O..",
    ],
  },
  dragonscale: {
    cls: "slime-sparkle",
    body: [
      "....KKKKKKK....", "..KKGGGGGGGKK..", ".KGGrrrrrrrGGK.", ".KGrRRrrrRRrGK.", ".KGrrrrrrrrrGK.",
      ".KGrrRRrRRrrGK.", ".KGrrrrrrrrrGK.", ".KGGrRRrRRrGGK.", "..KGrrrrrrrGK..", "..KGGrRRrRGGK..",
      "...KGrrrrrGK...", "....KGrrrGK....", ".....KGrGK.....", "......KGK......", ".......K.......",
    ],
    fx: [
      "O.............L", "...............", "L.............O", "...............", "...............",
      "O.............L", "...............", "...............", ".L...........O.",
    ],
  },
  crown: {
    cls: "slime-sparkle",
    body: [
      ".K.....K.....K.", "KRK...KGK...KBK", "KGK...KGK...KGK", "KGGK.KKGKK.KGGK",
      "KGGGKKGGGKKGGGK", "KGGGGGGGGGGGGGK", "KGgGGgGGGgGGgGK", "KGGGGGGGGGGGGGK", "KKKKKKKKKKKKKKK",
    ],
    fx: ["F.............F", "...............", "......F........", "...............", "F.............F"],
  },

  // ---------- 레전더리 — 대천사(archangel) ----------
  // 성광의 헤일로: 머리 위를 덮는 초대형 금빛 고리 — 두꺼운 2셀 밴드
  archangel_head: {
    cls: "slime-sparkle",
    body: [
      "......KGGGGGGGGGK......",
      "...KGGGGLLLLLLLGGGGK...",
      ".KGG...............GGK.",
      "..KGG.............GGK..",
      "...KGGGGLLLLLLLGGGGK...",
      "......KGGGGGGGGGK......",
      ".......................",
      ".......................",
      ".......................",
    ],
    fx: ["F.....................F", ".......................", "...........F..........."],
  },
  // 심판의 양손검: 길고 넓은 백은 날 + 온빛 코어 + 대형 금 십자 가드
  archangel_right: {
    cls: "slime-sparkle",
    body: [
      ".......K.......", "......KFK......", ".....KFHFK.....", ".....KFHFK.....", ".....KFHFK.....",
      ".....KFHFK.....", ".....KFHFK.....", ".....KFHFK.....", ".....KFHFK.....", ".....KFHFK.....",
      ".....KFHFK.....", ".....KFHFK.....", ".....KFHFK.....", ".....KFHFK.....", ".....KFFFK.....",
      "....KKFFFKK....", "KGGGGgGGGgGGGGK", ".KK..KGLGK..KK.", "......KGK......", "......KGK......",
      "......KgK......", "......KGK......", "......KgK......", ".....KKgKK.....", ".....KGLGK.....", ".....KKKKK.....",
    ],
    fx: [
      "....L....F.....", "..F.........L..", ".L....F........", "............F..", ".F....L........",
      "...............", "L.............L", "..F........F...", "...............", "...L........F..",
    ],
  },
  // 성광 방패: 빛으로 짜인 대형 방패 + 금빛 문양 코어
  archangel_left: {
    cls: "slime-sparkle",
    body: [
      "......KKKKKKK......", "....KKHHHHHHHKK....", "...KHHHHHHHHHHHK...", "..KHHHHGGGGGHHHHK..",
      "..KHHHGGFFFGGHHHK..", "..KHHGGFFFFFGGHHK..", "..KHHGFFFFFFFGHHK..", "..KHHGGFFFFFGGHHK..",
      "..KHHHGGFFFGGHHHK..", "...KHHHGGGGGHHHK...", "...KHHHHHHHHHHHK...", "....KHHHHHHHHHK....",
      ".....KHHHHHHHK.....", "......KHHHHHK......", ".......KHHHK.......", "........KHK........", ".........K.........",
    ],
    fx: ["F.................L", "...................", ".........F.........", "L.................F", "..................."],
  },

  // ---------- 레전더리 — 심연의 대악마(archdemon) ----------
  // 흑요석 마왕뿔: 바깥으로 벌어졌다가 끝이 안쪽으로 휘어드는 두꺼운 뿔
  archdemon_head: {
    cls: "slime-sparkle",
    body: [
      "...KKK.........KKK...",
      "..KKOKK.......KKOKK..",
      ".KKOK...........KOKK.",
      ".KROK...........KORK.",
      ".KKROK.........KORKK.",
      "..KKROK.......KORKK..",
      "...KKROOK...KOORKK...",
      "....KKKOOK.KOOKKK....",
      "......KKKK.KKKK......",
    ],
    fx: ["O...................O", ".....................", "......O.......O......"],
  },
  // 지옥의 삼지창: 길고 날 선 보랏빛 세 갈래 창
  archdemon_right: {
    cls: "slime-sparkle",
    body: [
      ".K.....K.....K.", "KPK...KPK...KPK", "KPK...KPK...KPK", "KPK...KPK...KPK", "KPK...KPK...KPK",
      ".KPK.KKPKK.KPK.", "..KPPPPPPPPPK..", "......KPK......", "......KpK......", "......KPK......",
      "......KpK......", "......KPK......", "......KpK......", "......KPK......", "......KpK......",
      "......KPK......", "......KpK......", "......KPK......", "......KpK......", "......KPK......",
      ".....KKpKK.....", ".....KPPPK.....", ".....KKKKK.....",
    ],
    fx: ["P.............O", "...............", ".....P.........", ".............P.", "O.............."],
  },
  // ---------- 에픽 — 엔진의 악마(chainsaw) ----------
  // 핏빛 기계톱 헬름: 머리를 감싸는 핏빛 후드 + 정수리에서 솟은 굵은 톱날
  chainsaw_head: {
    cls: "slime-sparkle",
    body: [
      ".........KSSSK.......",
      ".........KSSSKK......",
      ".........KSSSK.......",
      ".........KSSSKK......",
      ".........KSSSK.......",
      "......KKKKSSSKKKK....",
      "....KKRRRRRRRRRRKK...",
      "..KKRRRRRRRRRRRRRRK..",
      ".KRRRDRRRRRRRRDRRRK..",
      ".KKKKKKKKKKKKKKKKKKK.",
    ],
  },
  // 미니 기계톱: 굵은 세로 톱날 + 붉은 엔진 몸통 + 시동 손잡이
  chainsaw_right: {
    cls: "slime-sparkle",
    body: [
      "....KSSSK......", "....KSSSKK.....", "....KSSSK......", "....KSSSKK.....", "....KSSSK......",
      "....KSSSKK.....", "...KKSSSKK.....", "..KRRRRRRRK....", "..KRRDDRRRKKKK.", "..KRRRRRRRK.KK.",
      "...KKKKKKK.....",
    ],
  },
  // 엔진 시동 줄: 노란 T자 손잡이 + 늘어진 스타터 코드
  chainsaw_left: {
    cls: "slime-sparkle",
    body: [
      "KKKKKKK....", "KYYYYYK....", "KKKKKKK....", "......KK...", ".......KK..", "......KK...",
      ".....KK....", "......KK...", ".....KSK...", ".....KsK...",
    ],
  },

  // ---------- 에픽 — 대나무를 문 혈귀(bamboo) ----------
  // 흑발 분홍 리본: 머리를 폭 감싸는 검은 머리칼 + 길게 흘러내린 옆머리 + 분홍 리본
  bamboo_head: {
    cls: "slime-sparkle",
    body: [
      "....KKKKKKKKKKKKK....",
      "..KKKKKKKKKKKKKKKKK..",
      ".KKKKKKKKKKKKKKKNNNK.",
      ".KKKKKKKKKKKKKKKNnNK.",
      "KKKKK...........KKKKK",
      ".KKKK...........KKKK.",
      ".KKK.............KKK.",
      "..KKK...........KKK..",
      "..KK.............KK..",
      "...KK...........KK...",
    ],
  },
  // 혈귀의 붉은 손톱: 세 갈래로 길게 뻗은 붉은 손톱
  bamboo_right: {
    cls: "slime-sparkle",
    body: [
      ".K.....K.....K.", "KRK...KRK...KRK", "KRK...KRK...KRK", "KRK...KRK...KRK",
      ".KRK..KRK..KRK.", ".KRRK.KRK.KRRK.", "..KRRKKRKKRRK..", "...KRRRRRRRK...",
      "....KDRRRDK....", ".....KKKKK.....",
    ],
  },
  // 수호의 손톱: 방어 자세로 펼친 손톱 가드
  bamboo_left: {
    cls: "slime-sparkle",
    body: [
      ".K....K....K.", "KRK..KRK..KRK", "KRRK.KRK.KRRK", ".KRRKKRKKRRK.",
      "..KRRRRRRRK..", "...KDRRRDK...", "....KKKKK....",
    ],
  },

  // ---------- 에픽 — 무한의 주술사(infinity) ----------
  // 은발 삐죽머리: 하늘로 높이 뻗친 은백색 스파이크
  infinity_head: {
    cls: "slime-sparkle",
    body: [
      "...K......K......K...",
      "..KSK....KSK....KSK..",
      "..KSK....KSK....KSK..",
      ".KSSSK..KSSSK..KSSSK.",
      ".KSSSK..KSSSK..KSSSK.",
      "KSSSSSKKSSSSSKKSSSSSK",
      "KSSSSSSSSSSSSSSSSSSSK",
      "KSFSSSSSSSSSSSSSSSSSK",
      "KKKKKKKKKKKKKKKKKKKKK",
    ],
  },
  // 적색 질량 구슬: 발산 — 붉게 이글거리는 구체
  infinity_right: {
    cls: "slime-sparkle",
    body: [
      "....KKK....", "..KKRRRKK..", "..KRRRRRK..", ".KRRFRRRRK.", ".KRRRRRRRK.",
      "..KRRRRRK..", "..KKRRRKK..", "....KKK....",
    ],
  },
  // 청색 질량 구슬: 수렴 — 고요하게 빛나는 구체
  infinity_left: {
    cls: "slime-sparkle",
    body: [
      "....KKK....", "..KKBBBKK..", "..KBBBBBK..", ".KBBFBBBBK.", ".KBBBBBBBK.",
      "..KBBBBBK..", "..KKBBBKK..", "....KKK....",
    ],
  },

  // 심연의 마귀방패: 뿔 돋친 흑요석 방패 — 마귀의 형상, 타오르는 눈과 이빨 자국
  archdemon_left: {
    cls: "slime-sparkle",
    body: [
      ".KK....K....KK.", "KDDK..KDK..KDDK", "KDDDKKDDDKKDDDK", "KDDDDDDDDDDDDDK",
      "KDDODDDDDDDODDK", "KDDODDDDDDDODDK", "KDDDDDDDDDDDDDK", ".KDDDDDDDDDDDK.",
      ".KDDDKKKKKDDDK.", "..KDDDDDDDDDK..", "...KDDDDDDDK...", "....KDDDDDK....",
      ".....KDDDK.....", "......KDK......", ".......K.......",
    ],
    fx: ["O.............P", "...............", ".......O.......", "P.............O", "..............."],
  },
};

function drawSprite(rows: string[], x0: number, y0: number, cell: number): string {
  let s = "";
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === ".") return;
      s += `<rect x="${x0 + i * cell}" y="${y0 + j * cell}" width="${cell}" height="${cell}" fill="${PIXEL_PAL[ch]}"/>`;
    });
  });
  return s;
}

function equipSpriteFor(code: string, baseCell: number): { rows: string[]; fx: string[] | null; cls: string | null; cell: number } | null {
  const fine = PIXEL_FINE[code];
  if (fine) return { rows: fine.body, fx: fine.fx ?? null, cls: fine.cls, cell: 3.5 };
  if (PIXEL_SPRITES[code]) return { rows: PIXEL_SPRITES[code], fx: null, cls: null, cell: baseCell };
  return null;
}

function spriteWithFx(sp: { rows: string[]; fx: string[] | null; cls: string | null; cell: number }, x0: number, y0: number): string {
  let s = drawSprite(sp.rows, x0, y0, sp.cell);
  if (sp.fx) s += `<g class="${sp.cls}">` + drawSprite(sp.fx, x0, y0 - 2 * sp.cell, sp.cell) + `</g>`;
  return s;
}

function pixelGlassesFor(code: string, p: Derived, cell: number): string {
  const ex = p.eyeGap / 2, y = p.eyeY;
  const leftOf = (v: number) => Math.floor(v / cell) * cell;
  const px = (x: number, yy: number, fill: string, o?: number) => rect(x, yy, cell, fill, o);
  let s = "";

  if (code === "youtuber_face") code = "sun"; // 힙한 선글라스 = 기존 선글라스 렌더

  if (code === "hero_face") {
    // 역전의 흉터: 왼뺨의 X자 흉터
    const fx = leftOf(-ex) - cell, fy = leftOf(y) + 2 * cell;
    for (const [dx, dy] of [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]] as const) {
      s += px(fx + dx * cell, fy + dy * cell, PIXEL_PAL.a, 0.85);
    }
    return s;
  }
  if (code === "spirit_face") {
    // 요정의 귀: 양옆으로 뾰족 솟은 귀
    const fy = leftOf(y);
    for (const sd of [-1, 1]) {
      const bx = leftOf(sd * (p.bodyW - 2));
      s += px(bx, fy, PIXEL_PAL.K) + px(bx + sd * cell, fy - cell, PIXEL_PAL.K) +
        px(bx + sd * cell, fy, PIXEL_PAL.N, 0.9);
    }
    return s;
  }
  if (code === "ranger_face") {
    // 숲의 페인트: 양뺨의 초록 나뭇잎 줄무늬
    const fy = leftOf(y) + 2 * cell;
    for (const sd of [-1, 1]) {
      const x = leftOf(sd * ex) + sd * cell;
      s += px(x, fy, PIXEL_PAL.V, 0.95) + px(x - sd * cell, fy + cell, PIXEL_PAL.v, 0.9);
    }
    return s;
  }
  if (code === "soldier_face") {
    // 위장 크림: 양뺨의 위장 줄
    const fy = leftOf(y) + 2 * cell;
    for (const sd of [-1, 1]) {
      const x = leftOf(sd * ex) + sd * cell;
      s += px(x, fy, PIXEL_PAL.v, 0.95) + px(x - sd * cell, fy, PIXEL_PAL.A, 0.85);
    }
    return s;
  }
  if (code === "archmage_face" || code === "lawyer_face" || code === "scientist_face") {
    // 지혜의 뿔테(금빛 반짝) / 금테 안경 / 투명 보안경 — 4x4 프레임 변형
    const frameCol = code === "lawyer_face" ? PIXEL_PAL.G : code === "scientist_face" ? PIXEL_PAL.S : PIXEL_PAL.K;
    for (const sd of [-1, 1]) {
      const fx = leftOf(sd * ex) - cell, fy = leftOf(y) - cell;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const center = i >= 1 && i <= 2 && j >= 1 && j <= 2;
          if (center) continue;
          s += px(fx + i * cell, fy + j * cell, frameCol);
        }
      }
      if (code === "scientist_face") s += px(fx + cell, fy + cell, "#EAF6FF", 0.75);
    }
    const cyT = leftOf(y);
    const bL = leftOf(-ex) + 3 * cell, bR = leftOf(ex) - cell;
    for (let x = bL; x < bR; x += cell) s += px(x, cyT, frameCol);
    if (code === "archmage_face") s += px(leftOf(ex) + 2 * cell, leftOf(y) - cell, PIXEL_PAL.G, 0.9);
    return s;
  }

  // ---- 세트 얼굴 파츠 ----
  if (code === "archangel_face") {
    // 금빛 눈가리개: 얼굴을 넓게 가로지르는 금빛 천 — 위아래 윤곽선으로 몸색과 분리
    const fy = leftOf(y) - cell;
    for (let x = leftOf(-ex) - 4 * cell; x <= leftOf(ex) + 4 * cell; x += cell) {
      s += px(x, fy - cell, PIXEL_PAL.K) + px(x, fy, PIXEL_PAL.G) +
        px(x, fy + cell, PIXEL_PAL.g) + px(x, fy + 2 * cell, PIXEL_PAL.K);
    }
    s += px(leftOf(-ex), fy, "#FFFFFF", 0.85);
    return s;
  }
  if (code === "archdemon_face") {
    // 심연의 제3의 눈: 이마에 세로로 열린 심연의 눈 — 주황 홍채 + 검은 세로 동공
    // 한 칸 아래로 — 양눈에 가깝게 (원장 지시 2026-08-03)
    const fy = leftOf(y) - cell;
    s += px(0, fy - 4 * cell, PIXEL_PAL.K);
    s += px(-cell, fy - 3 * cell, PIXEL_PAL.K) + px(0, fy - 3 * cell, PIXEL_PAL.O) + px(cell, fy - 3 * cell, PIXEL_PAL.K);
    s += px(-cell, fy - 2 * cell, PIXEL_PAL.K) + px(0, fy - 2 * cell, PIXEL_PAL.D) + px(cell, fy - 2 * cell, PIXEL_PAL.K);
    s += px(0, fy - cell, PIXEL_PAL.K);
    // 눈가에서 배어 나오는 심연의 기운
    s += `<g class="slime-sparkle">` +
      px(-2 * cell, fy - 3 * cell, PIXEL_PAL.O, 0.7) +
      px(2 * cell, fy - 2 * cell, PIXEL_PAL.O, 0.7) +
      `</g>`;
    return s;
  }
  if (code === "doctor_face") {
    // 이마 반사경: 머리띠 + 은색 원판 (한가운데 반짝)
    const fy = leftOf(y) - 3 * cell;
    for (let x = leftOf(-ex) - cell; x <= leftOf(ex) + cell; x += cell) s += px(x, fy, PIXEL_PAL.K);
    s += px(-cell, fy - cell, PIXEL_PAL.S) + px(0, fy - cell, PIXEL_PAL.S) +
      px(-cell, fy, PIXEL_PAL.S) + px(0, fy, PIXEL_PAL.S) +
      px(-cell, fy - cell, "#FFFFFF", 0.9);
    return s;
  }

  if (code === "chainsaw_face") {
    // 철창 이빨 마스크: 입가를 넓게 덮는 은색 그릴 — 2단 세로 창살
    const my = leftOf(p.mouthY) - cell;
    for (let x = -3 * cell; x <= 3 * cell; x += cell) {
      const bar = Math.abs(x / cell) % 2 === 0 ? PIXEL_PAL.K : PIXEL_PAL.S;
      s += px(x, my - 2 * cell, PIXEL_PAL.K);
      s += px(x, my - cell, bar) + px(x, my, bar);
      s += px(x, my + cell, PIXEL_PAL.K);
    }
    // 양옆 고정 스트랩
    s += px(-4 * cell, my - 2 * cell, PIXEL_PAL.K) + px(4 * cell, my - 2 * cell, PIXEL_PAL.K);
    return s;
  }
  if (code === "bamboo_face") {
    // 대나무 재갈: 입에 가로로 문 대나무통 + 마디
    const my = leftOf(p.mouthY) - cell;
    for (let x = -3 * cell; x <= 3 * cell; x += cell) {
      const edge = Math.abs(x) === 3 * cell;
      const joint = Math.abs(x) === cell;
      s += px(x, my, edge ? PIXEL_PAL.K : joint ? PIXEL_PAL.v : PIXEL_PAL.V);
      s += px(x, my - cell, PIXEL_PAL.K, edge ? 1 : 0.9);
      s += px(x, my + cell, PIXEL_PAL.K, edge ? 1 : 0.9);
    }
    return s;
  }
  if (code === "infinity_face") {
    // 칠흑의 안대: 두 눈을 완전히 덮는 검은 천
    const fy = leftOf(y) - cell;
    for (let x = leftOf(-ex) - 4 * cell; x <= leftOf(ex) + 4 * cell; x += cell) {
      s += px(x, fy, PIXEL_PAL.K) + px(x, fy + cell, PIXEL_PAL.K) + px(x, fy + 2 * cell, PIXEL_PAL.K);
    }
    s += px(leftOf(-ex) - 2 * cell, fy, "#5A5650", 0.9);
    return s;
  }

  // ---- 노말 얼굴 파츠 (안경 프레임이 아닌 것 포함) ----
  if (code === "blush") {
    // 홍조 스티커: 양볼에 분홍 2셀
    const fy = leftOf(y) + 2 * cell;
    for (const sd of [-1, 1]) {
      const x = leftOf(sd * ex) + sd * cell;
      s += px(x, fy, PIXEL_PAL.N, 0.9) + px(x - sd * cell, fy, PIXEL_PAL.N, 0.55);
    }
    return s;
  }
  if (code === "bandaid") {
    // 밴드에이드: 왼뺨에 가로 반창고 (양끝 살구색 + 가운데 흰 패드)
    const fx = leftOf(-ex) - 2 * cell, fy = leftOf(y) + 2 * cell;
    s += px(fx, fy, PIXEL_PAL.E) + px(fx + cell, fy, PIXEL_PAL.F) + px(fx + 2 * cell, fy, PIXEL_PAL.E);
    return s;
  }
  if (code === "patch") {
    // 안대: 오른눈 3x3 가리개 + 머리를 두르는 끈
    const fx = leftOf(ex) - cell, fy = leftOf(y) - cell;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += px(fx + i * cell, fy + j * cell, PIXEL_PAL.K);
    for (let x = leftOf(-p.bodyW) + cell; x < fx; x += cell) s += px(x, fy, PIXEL_PAL.K);
    for (let x = fx + 3 * cell; x < leftOf(p.bodyW); x += cell) s += px(x, fy, PIXEL_PAL.K);
    return s;
  }
  if (code === "tri" || code === "flat" || code === "rimless") {
    for (const sd of [-1, 1]) {
      const fx = leftOf(sd * ex) - cell, fy = leftOf(y) - cell;
      if (code === "tri") {
        // 세모안경: 아래로 좁아지는 ▽ 렌즈
        for (let i = 0; i < 4; i++) s += px(fx + i * cell, fy, PIXEL_PAL.K);
        s += px(fx + cell, fy + cell, PIXEL_PAL.K) + px(fx + 2 * cell, fy + cell, PIXEL_PAL.K);
        s += px(fx + cell, fy + 2 * cell, PIXEL_PAL.K);
      } else if (code === "flat") {
        // 일자안경: 윗선 + 양옆만 있는 하프림
        for (let i = 0; i < 4; i++) s += px(fx + i * cell, fy, PIXEL_PAL.K);
        s += px(fx, fy + cell, PIXEL_PAL.K) + px(fx + 3 * cell, fy + cell, PIXEL_PAL.K);
      } else {
        // 무테안경: 밝은 렌즈 반사 + 코받침 (프레임 없이도 보이게)
        for (const [di, dj] of [[1, 1], [2, 1], [1, 2], [2, 2]] as const) {
          s += px(fx + di * cell, fy + dj * cell, "#EDF4FF", 0.85);
        }
        s += px(fx + cell, fy + cell, "#FFFFFF", 0.95);
      }
    }
    const fy = leftOf(y) - cell + (code === "rimless" ? cell : 0);
    const bL = leftOf(-ex) + 3 * cell, bR = leftOf(ex) - cell;
    for (let x = bL; x < bR; x += cell) s += px(x, fy, PIXEL_PAL.K);
    return s;
  }

  const sides = code === "monocle" ? [1] : [-1, 1];
  for (const sd of sides) {
    const fx = leftOf(sd * ex) - cell, fy = leftOf(y) - cell;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const center = i >= 1 && i <= 2 && j >= 1 && j <= 2;
        let fill: string;
        if (code === "sun") fill = center ? "#4A4740" : PIXEL_PAL.K;
        else if (center) continue;
        else fill = code === "monocle" ? PIXEL_PAL.g : PIXEL_PAL.K;
        s += `<rect x="${fx + i * cell}" y="${fy + j * cell}" width="${cell}" height="${cell}" fill="${fill}"/>`;
      }
    }
    if (code === "sun") s += `<rect x="${fx + cell}" y="${fy + cell}" width="${cell}" height="${cell}" fill="#FFFFFF" opacity="0.8"/>`;
  }
  if (code === "monocle") {
    const cxL = leftOf(ex), cyT = leftOf(y);
    s += `<rect x="${cxL + 3 * cell}" y="${cyT + 3 * cell}" width="${cell}" height="${cell}" fill="${PIXEL_PAL.g}"/>` +
      `<rect x="${cxL + 4 * cell}" y="${cyT + 4 * cell}" width="${cell}" height="${cell}" fill="${PIXEL_PAL.g}"/>`;
  } else {
    const cyT = leftOf(y);
    const bL = leftOf(-ex) + 3 * cell, bR = leftOf(ex) - cell;
    for (let x = bL; x < bR; x += cell) {
      s += `<rect x="${x}" y="${cyT}" width="${cell}" height="${cell}" fill="${PIXEL_PAL.K}"/>`;
    }
  }
  return s;
}

// ============================================================
// 이펙트 슬롯 — 몸 뒤에 깔리는 전신 연출 (레전더리 전용 아트 규칙)
// ============================================================

// 대천사 육익: 중앙에서 바깥으로 뻗는 오른쪽 절반 (왼쪽은 미러)
// 상익은 머리 위로 솟아오른다 — 웅장하게 (원장 지시 2026-08-03)
const ANGEL_WING_HALF = [
  "................F.", "..............FFF.", ".............FFFF.", "...........FFFFF..",
  "..........FFFFF...", ".........FFFFF....", "........FFFF......", "..FFFFFFFFF.......",
  ".FFFFFFFFFFFFF....", ".FFFFFFFFFFFFFFFF.", ".SFFFFFFFFFFFFFFS.", "..SSFFFFFFFFSS....",
  "...FFFFFFF........", "...SFFFFFF........", "....SFFFF.........", ".....SFFF.........",
  "......SFF.........", ".......SF.........",
];

// 심연의 화염 기둥: 컬럼별 불꽃 높이 (셀 단위, 좌→우)
// 중앙(29~31셀)은 머리 위로 치솟고, 가장자리 컬럼은 몸통(±55) 밖에서 넘실거린다
const FLAME_HEIGHTS = [6, 11, 15, 9, 7, 12, 8, 14, 18, 23, 27, 25, 29, 31, 28, 30, 24, 26, 20, 16, 12, 9, 14, 8, 11, 16, 7];

function effectBackLayer(code: string, p: Derived): string {
  const bw = p.bodyW;
  const topY = BASELINE - p.bodyH;
  const plus = (x: number, y: number, col: string, c: number) => {
    let t = "";
    for (const [dx, dy] of [[0, 0], [c, 0], [-c, 0], [0, c], [0, -c]] as const) t += rect(x + dx, y + dy, c, col, 0.92);
    return t;
  };

  if (code === "archmage_fx") {
    // 오행 마법진: 발밑을 도는 5속성 링
    const ring: [number, number, string][] = [
      [-(bw + 18), 136, "R"], [-(bw * 0.5), 141, "B"], [4, 143, "V"],
      [bw * 0.55, 141, "G"], [bw + 14, 136, "A"],
    ];
    let s = "";
    for (const [x, yy, c] of ring) s += rect(x, yy, 7, PIXEL_PAL[c], 0.95);
    s += `<g class="slime-sparkle">` +
      rect(-(bw + 6), 131, 5, PIXEL_PAL.P, 0.8) + rect(bw + 2, 131, 5, PIXEL_PAL.P, 0.8) +
      rect(-bw * 0.2, 138, 5, PIXEL_PAL.L, 0.8) + `</g>`;
    return s;
  }
  if (code === "hero_fx") {
    // 황금 투기: 몸을 감싸고 솟는 금빛 오라
    let body = "";
    let tips = "";
    for (const [x, h] of [[-(bw + 10), 7], [-(bw + 17), 4], [bw + 4, 8], [bw + 11, 5], [bw + 18, 3], [-(bw + 3), 5]] as const) {
      for (let j = 0; j < h; j++) {
        const yy = BASELINE - 10 - j * 7;
        if (j >= h - 2) tips += rect(x, yy, 7, PIXEL_PAL.L, 0.9);
        else body += rect(x, yy, 7, PIXEL_PAL.G, 0.9);
      }
    }
    return body + `<g class="slime-sparkle">` + tips + rect(0, topY - 16, 6, PIXEL_PAL.L, 0.9) + `</g>`;
  }
  if (code === "spirit_fx") {
    // 정령 세 마리: 주위를 맴도는 픽셀 요정
    const fairy = (x: number, yy: number, col: string) =>
      rect(x, yy, 6, col) + rect(x - 6, yy - 6, 6, "#FFFFFF", 0.75) + rect(x + 6, yy - 6, 6, "#FFFFFF", 0.75);
    let s = fairy(-(bw + 16), BASELINE - p.bodyH * 0.75, PIXEL_PAL.N);
    s += `<g class="slime-sparkle">` +
      fairy(bw + 14, BASELINE - p.bodyH * 0.5, PIXEL_PAL.T) +
      fairy(bw + 20, BASELINE - 26, PIXEL_PAL.Y) + `</g>`;
    return s;
  }
  if (code === "ranger_fx") {
    // 숲의 오라: 흩날리는 나뭇잎 + 반딧불
    let s = rect(-(bw + 20), BASELINE - p.bodyH * 0.8, 6, PIXEL_PAL.V, 0.95) +
      rect(-(bw + 12), BASELINE - 30, 6, PIXEL_PAL.v, 0.9) +
      rect(bw + 10, BASELINE - p.bodyH * 0.55, 6, PIXEL_PAL.V, 0.95) +
      rect(bw + 20, BASELINE - 20, 6, PIXEL_PAL.v, 0.9);
    s += `<g class="slime-sparkle">` +
      rect(bw + 16, topY - 8, 5, PIXEL_PAL.L, 0.95) +
      rect(-(bw + 18), BASELINE - 44, 5, PIXEL_PAL.L, 0.95) +
      rect(bw + 26, BASELINE - 38, 4, PIXEL_PAL.L, 0.85) + `</g>`;
    return s;
  }
  if (code === "doctor_fx") {
    // 힐링 십자: 흩날리는 초록 십자
    let s = plus(-(bw + 16), BASELINE - p.bodyH * 0.7, PIXEL_PAL.V, 6);
    s += `<g class="slime-sparkle">` +
      plus(bw + 14, BASELINE - p.bodyH * 0.45, PIXEL_PAL.V, 5) +
      plus(bw + 20, topY - 6, PIXEL_PAL.V, 4) + `</g>`;
    return s;
  }
  if (code === "lawyer_fx") {
    // 이의있음!: 머리 위 말풍선
    const bx = bw * 0.55, by = topY - 34;
    let bubble = "";
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        const edge = i === 0 || i === 4 || j === 0 || j === 2;
        bubble += rect(bx + i * 6, by + j * 6, 6, edge ? PIXEL_PAL.K : "#FFFFFF");
      }
    }
    bubble += rect(bx + 6, by + 18, 6, PIXEL_PAL.K); // 꼬리
    bubble += rect(bx + 12, by + 6, 6, PIXEL_PAL.R); // !
    return `<g class="slime-sparkle">` + bubble + `</g>`;
  }
  if (code === "scientist_fx") {
    // 화학 기포: 뽀글뽀글 초록 거품
    let s = rect(bw + 10, BASELINE - p.bodyH * 0.6, 6, PIXEL_PAL.V, 0.9) +
      rect(-(bw + 14), BASELINE - 34, 5, PIXEL_PAL.T, 0.9);
    s += `<g class="slime-sparkle">` +
      rect(bw + 18, BASELINE - p.bodyH * 0.85, 5, PIXEL_PAL.V, 0.85) +
      rect(bw + 12, topY - 10, 4, PIXEL_PAL.T, 0.85) +
      rect(-(bw + 8), topY - 4, 5, PIXEL_PAL.V, 0.8) + `</g>`;
    return s;
  }
  if (code === "youtuber_fx") {
    // 좋아요 세례: 팡팡 터지는 빨간 하트
    const heart = (x: number, yy: number, c: number) =>
      rect(x, yy, c, PIXEL_PAL.R) + rect(x + 2 * c, yy, c, PIXEL_PAL.R) +
      rect(x, yy + c, c, PIXEL_PAL.R) + rect(x + c, yy + c, c, PIXEL_PAL.R) + rect(x + 2 * c, yy + c, c, PIXEL_PAL.R) +
      rect(x + c, yy + 2 * c, c, PIXEL_PAL.R);
    let s = heart(-(bw + 22), BASELINE - p.bodyH * 0.8, 5);
    s += `<g class="slime-sparkle">` +
      heart(bw + 10, BASELINE - p.bodyH * 0.55, 5) +
      heart(bw + 18, topY - 14, 4) + `</g>`;
    return s;
  }
  if (code === "soldier_fx") {
    // 연막: 발밑에 깔리는 초록 연기
    let s = "";
    for (const [x, yy, c, o] of [
      [-(bw + 20), 132, 8, 0.85], [-(bw + 6), 137, 7, 0.9], [bw + 2, 134, 8, 0.85],
      [bw + 16, 138, 7, 0.9], [-(bw * 0.3), 139, 8, 0.8],
    ] as const) s += rect(x, yy, c, PIXEL_PAL.v, o);
    s += `<g class="slime-sparkle">` +
      rect(-(bw + 26), 126, 6, PIXEL_PAL.V, 0.7) + rect(bw + 24, 128, 6, PIXEL_PAL.V, 0.7) + `</g>`;
    return s;
  }
  if (code === "archangel_fx") {
    // 셀 5 — 각성체(±55) 옆으로 날개가 확실히 뻗도록 (±92)
    const fc = 5;
    const rows = ANGEL_WING_HALF.map((h) => [...h].reverse().join("") + "." + h);
    const w = rows[0].length * fc;
    const y0 = BASELINE - p.bodyH - 5 * fc; // 상익이 머리 위로 솟도록
    let s = drawSprite(rows, -w / 2, y0, fc);
    // 깃털 반짝임
    s += `<g class="slime-sparkle">` +
      rect(-w / 2 + 2 * fc, y0 + fc, fc, PIXEL_PAL.H, 0.9) +
      rect(w / 2 - 3 * fc, y0 + 3 * fc, fc, PIXEL_PAL.H, 0.9) +
      rect(-w / 2 + 5 * fc, y0 + 11 * fc, fc, "#FFFFFF", 0.8) +
      rect(w / 2 - 6 * fc, y0 + 13 * fc, fc, "#FFFFFF", 0.8) +
      `</g>`;
    return s;
  }
  if (code === "chainsaw_fx") {
    // 엔진 스파크: 몸 주위로 튀는 노란 불꽃 + 핏빛 파편
    const bw = p.bodyW;
    const mid = BASELINE - p.bodyH * 0.55;
    let s = pixelSparkle(-(bw + 16), mid - 18, PIXEL_PAL.L, 7) +
      pixelSparkle(bw + 14, mid + 8, PIXEL_PAL.L, 7) +
      pixelSparkle(-(bw + 26), BASELINE - 26, PIXEL_PAL.L, 5) +
      rect(-(bw + 24), mid + 20, 6, PIXEL_PAL.D) + rect(bw + 22, mid - 26, 6, PIXEL_PAL.D) +
      rect(bw + 30, mid + 24, 6, PIXEL_PAL.D) + rect(-(bw + 10), BASELINE - p.bodyH - 8, 6, PIXEL_PAL.D) +
      rect(-(bw + 8), BASELINE - 16, 6, PIXEL_PAL.R) + rect(bw + 8, BASELINE - 34, 6, PIXEL_PAL.R);
    s += `<g class="slime-sparkle">` +
      pixelSparkle(bw + 22, mid - 42, PIXEL_PAL.Y, 6) +
      pixelSparkle(-(bw + 14), BASELINE - 32, PIXEL_PAL.Y, 6) +
      pixelSparkle(bw + 32, BASELINE - 14, PIXEL_PAL.Y, 5) +
      rect(0, BASELINE - p.bodyH - 14, 6, PIXEL_PAL.L, 0.9) +
      rect(-14, BASELINE - p.bodyH - 8, 5, PIXEL_PAL.L, 0.7) +
      `</g>`;
    return s;
  }
  if (code === "bamboo_fx") {
    // 혈귀술 불꽃: 몸 주위로 크게 흩날리는 분홍빛 불꽃잎
    const bw = p.bodyW;
    const flame = (x: number, y: number, c: number) =>
      rect(x + c, y, c, PIXEL_PAL.N, 0.95) +
      rect(x, y + c, c, PIXEL_PAL.n) + rect(x + c, y + c, c, PIXEL_PAL.N) + rect(x + 2 * c, y + c, c, PIXEL_PAL.n, 0.85) +
      rect(x + c, y + 2 * c, c, PIXEL_PAL.n);
    let s = flame(-(bw + 30), BASELINE - p.bodyH * 0.85, 7) +
      flame(bw + 8, BASELINE - p.bodyH * 0.5, 7) +
      flame(-(bw + 16), BASELINE - 34, 6) +
      flame(bw + 18, BASELINE - p.bodyH - 20, 6);
    s += `<g class="slime-sparkle">` +
      flame(-(bw + 8), BASELINE - p.bodyH - 26, 5) +
      flame(bw + 26, BASELINE - 40, 5) +
      rect(bw + 30, BASELINE - p.bodyH * 0.75, 5, PIXEL_PAL.N, 0.8) +
      rect(-(bw + 34), BASELINE - 20, 5, PIXEL_PAL.N, 0.8) +
      `</g>`;
    return s;
  }
  if (code === "infinity_fx") {
    // 영역 전개: 발밑에 펼쳐지는 보랏빛 공간 타일 + 떠오르는 파편
    let tiles = "";
    for (let i = -10; i <= 10; i++) {
      const x = i * 7 - 3.5;
      tiles += rect(x, 131, 7, (i % 2 === 0 ? PIXEL_PAL.P : PIXEL_PAL.p), 0.95);
      tiles += rect(x, 138, 7, (i % 2 === 0 ? PIXEL_PAL.p : PIXEL_PAL.P), 0.95);
    }
    const bw = p.bodyW;
    let s = tiles;
    s += `<g class="slime-sparkle">` +
      rect(-(bw + 18), BASELINE - p.bodyH * 0.7, 6, PIXEL_PAL.P, 0.85) +
      rect(bw + 16, BASELINE - p.bodyH * 0.9, 6, PIXEL_PAL.p, 0.85) +
      rect(bw + 24, BASELINE - 40, 5, PIXEL_PAL.P, 0.7) +
      rect(-(bw + 26), BASELINE - 34, 5, PIXEL_PAL.p, 0.7) +
      `</g>`;
    return s;
  }
  if (code === "archdemon_fx") {
    const fc = 5;
    const half = Math.floor(FLAME_HEIGHTS.length / 2);
    let body = "";
    let tips = "";
    FLAME_HEIGHTS.forEach((h, i) => {
      const x = (i - half) * fc - fc / 2;
      for (let j = 0; j < h; j++) {
        const y = BASELINE - 6 - (j + 1) * fc;
        // 검붉은 심연(D) → 진홍(R) → 주황 불끝(O) — 화 속성 몸색과 분리되도록 어둡게 깔린다
        if (j >= h - 2) tips += rect(x, y, fc, PIXEL_PAL.O, 0.95);
        else if (j >= h * 0.55) body += rect(x, y, fc, PIXEL_PAL.R);
        else body += rect(x, y, fc, PIXEL_PAL.D);
      }
    });
    return body + `<g class="slime-sparkle">` + tips + `</g>`;
  }
  return "";
}

function equipLayer(equip: SlimeEquip, p: Derived, cell: number): string {
  const snap = (v: number) => Math.round(v / cell) * cell;
  const topY = BASELINE - p.bodyH;
  let s = "";
  // 얼굴 아이템은 반드시 손 아이템보다 뒤 (원장 지시 2026-08-03)
  if (equip.eyewear) s += pixelGlassesFor(equip.eyewear, p, cell);
  const rSp = equip.weapon ? equipSpriteFor(equip.weapon, cell) : null;
  if (rSp) {
    const w = rSp.rows[0].length * rSp.cell;
    // 그립이 몸 가장자리에 살짝 겹치게 — 들고 있는 느낌
    // 삼지창은 두 칸 안쪽으로 붙인다 (원장 지시 2026-08-03)
    const inset = equip.weapon === "archdemon_right" ? 2 * cell : 0;
    const x0 = snap(p.bodyW - 6) - Math.floor(w / 2 / cell) * cell - inset;
    const y0 = snap(BASELINE - cell * 2) - rSp.rows.length * rSp.cell;
    const gx = x0 + w / 2;
    const gy = y0 + rSp.rows.length * rSp.cell - cell;
    s += `<g transform="rotate(28 ${gx} ${gy})">` + spriteWithFx(rSp, x0, y0) + `</g>`;
  }
  const lSp = equip.shield ? equipSpriteFor(equip.shield, cell) : null;
  if (lSp) {
    const w = lSp.rows[0].length * lSp.cell;
    const x0 = snap(-(p.bodyW + 11)) - Math.floor(w / 2 / cell) * cell;
    // 오른손(그립이 바닥 근처)과 균형 맞춰 두 칸 아래 (원장 지시 2026-08-03)
    const y0 = snap(BASELINE - p.bodyH * 0.5) - Math.floor((lSp.rows.length * lSp.cell) / 2 / cell) * cell + 2 * cell;
    s += spriteWithFx(lSp, x0, y0);
  }
  const hSp = equip.hat ? equipSpriteFor(equip.hat, cell) : null;
  if (hSp) {
    // 정중앙 + 1.2배 — "왕이다!". 꼭지는 slimeSvg에서 생략된다.
    // 오프셋 2.5행: 모자 스프라이트 마지막 행 = 이마 위 경계선 (원장 지시 2026-08-03,
    // 스프라이트마다 아래 경계 행이 하나씩 있어야 원래 위치에 얹힌다)
    // HAT_DROP: 캡류는 한 칸 더 눌러쓴다 — 왼쪽 빈 픽셀 때문에 떠 보이는 문제
    const hatSp = { ...hSp, cell: hSp.cell * 1.2 };
    const w = hatSp.rows[0].length * hatSp.cell;
    const x0 = -w / 2;
    const drop = equip.hat === "cap" || equip.hat === "meshcap" ? 1 : 0;
    const y0 = topY - (hatSp.rows.length - 2.5 - drop) * hatSp.cell;
    s += spriteWithFx(hatSp, x0, y0);
  }
  return s;
}

/**
 * 슬라임 한 마리의 SVG 마크업을 돌려준다 (서버/클라이언트 공용).
 * 알 단계는 attr 무관하게 공통 미스터리 알을 그린다. 장비는 틴부터 표시.
 */
export function slimeSvg(
  attr: SlimeAttr,
  stage: SlimeStage,
  width: number,
  expression: SlimeExpression = "normal",
  equip: SlimeEquip = {}
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
    // 꼭지(안테나): 줄기 + 방울 2x2 — 모자를 쓰면 모자에 덮이므로 생략
    const topY = BASELINE - p.bodyH;
    const wearing = stage === "teen" || stage === "awake";
    let rects = "";
    if (!(wearing && equip.hat)) {
      const stemX = Math.round((p.tipLean * 0.5) / cell) * cell;
      const stemCells = Math.max(1, Math.round(p.stemLen / cell));
      for (let i = 1; i <= stemCells; i++) rects += rect(stemX, topY - i * cell, cell, c.stroke);
      for (const [dx, dy] of [[-cell / 2, 1], [cell / 2, 1], [-cell / 2, 2], [cell / 2, 2]] as Pt[]) {
        rects += rect(stemX + dx, topY - (stemCells + dy) * cell - 2, cell, c.stroke);
      }
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
    const fxBack = wearing && equip.effect ? effectBackLayer(equip.effect, p) : "";
    inner = `<ellipse cx="0" cy="148" rx="${p.bodyW * 0.8}" ry="6" fill="#000" opacity="0.08"/>` +
      aura +
      `<g class="slime-breathe">` + fxBack + rects + (wearing ? equipLayer(equip, p, cell) : "") + `</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" width="${width}" role="img" aria-label="슬라임">` + inner + `</svg>`;
}
