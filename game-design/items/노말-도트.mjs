/* 노말 남은 18종 — 오른손 8 · 왼손 10.
   규격: 아이템-반입-규격.md / IMP_REC
     오른손 8×18 · 9×20 · 11×25   (세로로 김)
     왼손  11×16 · 12×17 · 15×21  (가로가 넓음)
   색은 3~12색. 좌표는 W,H 비율로 잡아 세 단계가 같은 실루엣을 유지한다. */

export const SZ = {
  right: [[8, 18], [9, 20], [11, 25]],
  left: [[11, 16], [12, 17], [15, 21]],
  face: [[15, 7], [22, 11], [24, 12]],
};

const P = {
  out: '#23262e', dk: '#3a3f4b',
  mtl: '#c3cad4', mtd: '#79838f', mtl2: '#e6ebf1',
  gld: '#e8b93b', gdd: '#a8801d',
  wd: '#a9834f', wdd: '#6b4f2c', wdl: '#c9a675',
  red: '#c8443c', redd: '#8e2b26',
  grn: '#4f9a4a', grnd: '#33682f',
  blu: '#3a72c8', blud: '#25508f', blul: '#6d9fe6',
  cyn: '#7fd4c8',
  ppl: '#7a63c4',
  cream: '#f2e7cf', creamd: '#cbbb99',
  wht: '#f4f6f9',
  tan: '#d9c39a', tand: '#a89468',
  blk: '#2c2f36',
};

/* ── 그리기 기본 도구 ─────────────────────────────── */
function pad(W, H) {
  const m = new Map();
  const set = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H) m.set(x + ',' + y, c);
  };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
  const frame = (x, y, w, h, c) => {
    for (let i = 0; i < w; i++) { set(x + i, y, c); set(x + i, y + h - 1, c); }
    for (let j = 0; j < h; j++) { set(x, y + j, c); set(x + w - 1, y + j, c); }
  };
  const box = (x, y, w, h, fill, out) => { rect(x, y, w, h, fill); frame(x, y, w, h, out ?? P.out); };
  const hline = (x, y, w, c) => rect(x, y, w, 1, c);
  const vline = (x, y, h, c) => rect(x, y, 1, h, c);
  // 타원 호 — 촘촘히 찍어서 픽셀이 끊기지 않게. a0~a1은 라디안(0=오른쪽, PI/2=위).
  const arc = (cx, cy, rx, ry, a0, a1, c) => {
    const n = Math.ceil((rx + ry) * 6);
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      set(cx + Math.cos(a) * rx, cy - Math.sin(a) * ry, c);
    }
  };
  return { m, set, rect, frame, box, hline, vline, arc };
}
const R = (v) => Math.round(v);
const M = (a, b) => Math.max(a, b);

/* ── 오른손 8종 ───────────────────────────────────── */

// 샤프 — 심·슬리브·좁은 촉·그립·몸통·클립
function sharp(W, H) {
  const g = pad(W, H), bw = M(3, W - 4), x0 = R((W - bw) / 2), cx = x0 + Math.floor(bw / 2);
  let y = 0;
  for (let i = 0; i < M(1, R(H * 0.06)); i++, y++) g.set(cx, y, P.dk);
  for (let i = 0; i < M(1, R(H * 0.07)); i++, y++) { g.set(cx, y, P.mtl); g.set(cx - 1, y, P.mtd); }
  const coneH = M(2, R(H * 0.13));
  for (let i = 0; i < coneH; i++, y++) {
    const w = M(2, R(2 + (bw - 2) * ((i + 1) / coneH))), sx = x0 + R((bw - w) / 2);
    for (let x = 0; x < w; x++) g.set(sx + x, y, x === 0 || x === w - 1 ? P.mtd : P.mtl);
  }
  for (let i = 0; i < M(2, R(H * 0.17)); i++, y++)
    for (let x = 0; x < bw; x++) g.set(x0 + x, y, x === 0 || x === bw - 1 ? P.out : (i % 2 ? P.mtd : P.mtl));
  for (; y < H; y++) for (let x = 0; x < bw; x++)
    g.set(x0 + x, y, x === 0 || x === bw - 1 ? P.out : x === 1 ? P.blul : P.blu);
  const k0 = R(H * 0.60);
  g.vline(x0 + bw, k0, R(H * 0.86) - k0, P.mtd);
  g.set(x0 + bw, k0 - 1, P.out); g.set(x0 + bw - 1, k0 - 1, P.mtd);
  return g.m;
}

// 커터칼 — 비스듬한 은색 날 + 노란 몸통 + 슬라이더
function cutter(W, H) {
  const g = pad(W, H), bw = M(3, W - 2), x0 = R((W - bw) / 2);
  const blH = M(3, R(H * 0.30)), blW = M(2, bw - 1), bx = x0 + bw - blW;
  for (let y = 0; y < blH; y++) {
    const L = R((1 - y / blH) * (blW - 1));
    for (let x = L; x < blW; x++) g.set(bx + x, y, (x === L || x === blW - 1) ? P.mtd : P.mtl2);
  }
  for (let y = blH; y < H; y++) for (let x = 0; x < bw; x++)
    g.set(x0 + x, y, (x === 0 || x === bw - 1 || y === H - 1) ? P.out : x === 1 ? '#ffd95c' : P.gld);
  const sy = R(H * 0.55);
  g.vline(x0 + Math.floor(bw / 2), sy, M(2, R(H * 0.14)), P.dk);
  return g.m;
}

// 작은 나뭇가지 — 휜 줄기 + 곁가지 + 잎
function twig(W, H) {
  const g = pad(W, H), cx = (W - 1) / 2, bend = W * 0.12;
  const at = (y) => cx + Math.sin((y / H) * Math.PI * 1.15) * bend;
  for (let y = 0; y < H; y++) {                                   // 줄기 3칸
    const x = at(y);
    g.set(x - 1, y, P.wdd); g.set(x, y, P.wdl); g.set(x + 1, y, P.wd);
  }
  const leaf = (lx, ly, sd) => [[0, 0, P.grn], [sd, 0, P.grnd], [0, -1, P.grn], [sd, -1, P.grnd]]
    .forEach(([dx, dy, c]) => g.set(lx + dx, ly + dy, c));
  const bl = M(2, R(W * 0.26));
  const yA = R(H * 0.44), xA = at(yA);                            // 오른쪽 곁가지
  for (let i = 1; i <= bl; i++) g.set(xA + 1 + i, yA - i, P.wd);
  leaf(xA + 1 + bl, yA - bl - 1, 1);
  const yB = R(H * 0.20), xB = at(yB);                            // 왼쪽 곁가지
  for (let i = 1; i <= bl - 1; i++) g.set(xB - 1 - i, yB - i, P.wdd);
  leaf(xB - bl, yB - bl, -1);
  return g.m;
}

// 스마트폰 — 세로 폰, 카메라 점 + 홈바
function phoneR(W, H) {
  const g = pad(W, H), bw = M(4, W - 2), bh = M(8, R(H * 0.94)), x0 = R((W - bw) / 2), y0 = R((H - bh) / 2);
  g.box(x0, y0, bw, bh, P.blk, P.out);
  const bez = 1;
  g.rect(x0 + bez, y0 + bez + 1, bw - bez * 2, bh - bez * 2 - 2, P.blul);
  g.rect(x0 + bez, y0 + bez + 1, bw - bez * 2, M(1, R(bh * 0.22)), P.cyn);   // 화면 상단 밝은 띠
  g.set(x0 + Math.floor(bw / 2), y0 + bez, P.mtd);                            // 카메라
  g.hline(x0 + 2, y0 + bh - 2, M(1, bw - 4), P.mtl);                          // 홈바
  return g.m;
}

// 만년필 — 금촉 + 금띠 + 검은 몸통
function fountain(W, H) {
  const g = pad(W, H), bw = M(3, W - 4), x0 = R((W - bw) / 2), cx = x0 + Math.floor(bw / 2);
  let y = 0;
  const nibH = M(3, R(H * 0.18));
  for (let i = 0; i < nibH; i++, y++) {                      // 촉 — 아래로 갈수록 넓어짐
    const w = M(1, R(1 + (bw - 1) * ((i + 1) / nibH))), sx = x0 + R((bw - w) / 2);
    for (let x = 0; x < w; x++) g.set(sx + x, y, x === 0 || x === w - 1 ? P.gdd : P.gld);
    if (i >= nibH * 0.35) g.set(cx, y, P.gdd);               // 촉 가운데 슬릿
  }
  for (let i = 0; i < M(1, R(H * 0.07)); i++, y++)           // 금띠
    for (let x = 0; x < bw; x++) g.set(x0 + x, y, x === 0 || x === bw - 1 ? P.gdd : P.gld);
  for (; y < H; y++) for (let x = 0; x < bw; x++)
    g.set(x0 + x, y, x === 0 || x === bw - 1 ? P.out : x === 1 ? P.dk : P.blk);
  const b0 = R(H * 0.78);                                     // 아래 금띠
  for (let i = 0; i < M(1, R(H * 0.06)); i++)
    for (let x = 0; x < bw; x++) g.set(x0 + x, b0 + i, x === 0 || x === bw - 1 ? P.gdd : P.gld);
  return g.m;
}

// 지팡이 — 갈고리 손잡이 + 곧은 대 + 고무 끝
function staff(W, H) {
  const g = pad(W, H), sw = M(2, R(W * 0.28)), x0 = W - sw - 1;
  const rx = (x0 - 1) / 2, hookH = M(3, R(H * 0.18));
  const hcx = x0 - rx;                                          // 호의 오른쪽 끝이 대 위에 닿는다
  for (let d = 0; d < sw; d++) {                                // 두께만큼 겹쳐 그려 끊김 방지
    g.arc(hcx, hookH, rx - d * 0.5, hookH - d * 0.5, 0, Math.PI, d === sw - 1 ? P.wdd : P.wdl);
  }
  for (let y = hookH; y < H; y++)                               // 대
    for (let i = 0; i < sw; i++) g.set(x0 + i, y, i === 0 ? P.wdl : i === sw - 1 ? P.wdd : P.wd);
  for (let y = H - M(1, R(H * 0.07)); y < H; y++)               // 고무 끝
    for (let i = 0; i < sw; i++) g.set(x0 + i, y, P.dk);
  return g.m;
}

// 총 — 권총, 총구 위. 위 슬라이드 / 아래 그립 / 가운데 방아쇠울(뚫린 구멍이 핵심)
function gun(W, H) {
  const g = pad(W, H);
  const slW = M(5, R(W * 0.72)), sx = W - slW, slH = M(6, R(H * 0.42));
  g.box(sx, 0, slW, slH, P.mtd, P.out);                          // 슬라이드
  g.vline(sx + 1, 1, slH - 2, P.mtl);
  g.hline(sx + 2, R(slH * 0.42), M(2, slW - 4), P.dk);           // 배출구
  g.rect(sx + R(slW / 2) - 1, 0, 2, 1, P.blk);                   // 총구
  const fh = M(2, R(H * 0.12)), fy = slH;
  g.box(0, fy, W, fh, P.mtd, P.out);                             // 프레임 — 여기서 L자가 꺾인다
  const grW = M(4, R(W * 0.55)), gy = fy + fh, gh = H - gy;
  for (let j = 0; j < gh; j++)                                   // 그립 — 왼쪽 아래
    for (let i = 0; i < grW; i++)
      g.set(i, gy + j, i === 0 || i === grW - 1 || j === gh - 1 ? P.out : (j % 2 ? P.wdd : P.wd));
  const th = M(2, R(gh * 0.40));                                 // 방아쇠울 — 속이 뚫린 ㄱ자
  g.vline(W - 2, gy, th, P.out);
  g.hline(grW, gy + th, W - grW - 1, P.out);
  g.set(grW, gy + 1, P.dk);                                      // 방아쇠
  return g.m;
}

// 칼 — 날 + 코등이 + 손잡이 + 자루끝
function sword(W, H) {
  const g = pad(W, H);
  const blH = M(6, R(H * 0.62)), blW = M(3, W - 4), bx = R((W - blW) / 2);
  const tipH = M(2, R(blH * 0.22));
  for (let y = 0; y < blH; y++) {
    let w = blW, sx = bx;
    if (y < tipH) { w = M(1, R(blW * ((y + 1) / tipH))); sx = bx + R((blW - w) / 2); }
    for (let x = 0; x < w; x++)
      g.set(sx + x, y, x === 0 ? P.mtd : x === w - 1 ? P.mtd : (x === Math.floor(w / 2) ? P.mtl : P.mtl2));
  }
  const gy = blH, gw = W, gh = M(1, R(H * 0.06));              // 코등이
  for (let j = 0; j < gh; j++) for (let x = 0; x < gw; x++)
    g.set(x, gy + j, x === 0 || x === gw - 1 ? P.gdd : P.gld);
  const hw = M(2, W - 5), hx = R((W - hw) / 2), hy = gy + gh;
  for (let y = hy; y < H - 1; y++) for (let x = 0; x < hw; x++)
    g.set(hx + x, y, x === 0 || x === hw - 1 ? P.out : (y % 2 ? P.wdd : P.wd));
  for (let x = 0; x < M(2, hw + 2); x++) g.set(hx - 1 + x, H - 1, P.gld);   // 자루끝
  return g.m;
}

/* ── 왼손 10종 ───────────────────────────────────── */

// 방패 — 히터 실드, 금속 테두리 + 가운데 돌기
function shield(W, H) {
  const g = pad(W, H), tipY = H - 1;
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const half = t < 0.55 ? (W - 1) / 2 : ((W - 1) / 2) * (1 - (t - 0.55) / 0.45);
    const L = R((W - 1) / 2 - half), Rt = R((W - 1) / 2 + half);
    for (let x = L; x <= Rt; x++)
      g.set(x, y, (x === L || x === Rt || y === 0 || y === tipY) ? P.out : (x < L + 2 ? P.wdl : P.wd));
  }
  g.hline(1, 1, W - 2, P.mtd);                                  // 위 테두리
  const cx = R((W - 1) / 2), cy = R(H * 0.42), r = M(1, R(W * 0.17));
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++)
    if (i * i + j * j <= r * r + 1) g.set(cx + i, cy + j, (i === -r || j === -r) ? P.mtl2 : P.mtd);
  return g.m;
}

// 책 — 두꺼운 양장본, 왼쪽 책등 + 오른쪽 책배
function book(W, H) {
  const g = pad(W, H), sp = M(2, R(W * 0.22));
  g.box(0, 0, W, H, P.red, P.out);
  g.rect(1, 1, sp, H - 2, P.redd);                              // 책등
  g.vline(sp + 1, 1, H - 2, P.redd);
  const px = W - M(2, R(W * 0.16));
  g.rect(px, 1, W - px - 1, H - 2, P.cream);                    // 책배(종이)
  for (let y = 2; y < H - 2; y += 2) g.hline(px, y, W - px - 1, P.creamd);
  g.hline(sp + 3, R(H * 0.30), M(2, W - sp - 6), P.gld);        // 표지 금박
  g.hline(sp + 3, R(H * 0.30) + 2, M(2, R((W - sp - 6) * 0.6)), P.gld);
  return g.m;
}

// 가방 — 백팩, 뚜껑 + 버클 + 손잡이
function bag(W, H) {
  const g = pad(W, H), hy = M(1, R(H * 0.12));
  g.box(2, hy - 1, W - 4, 2, P.blud, P.out);                    // 손잡이
  g.box(0, hy, W, H - hy, P.blu, P.out);
  g.rect(1, hy + 1, W - 2, M(2, R(H * 0.34)), P.blud);          // 뚜껑
  g.hline(1, hy + M(2, R(H * 0.34)), W - 2, P.out);
  const bx = R(W / 2) - 1, by = hy + M(2, R(H * 0.34)) - 1;
  g.rect(bx, by, 2, 2, P.gld);                                  // 버클
  g.hline(2, R(H * 0.72), W - 4, P.blud);                       // 앞주머니
  g.frame(2, R(H * 0.72), W - 4, H - R(H * 0.72) - 1, P.blud);
  return g.m;
}

// 핸드백 — 몸통 + 아치 손잡이 + 잠금
function handbag(W, H) {
  const g = pad(W, H), hh = M(3, R(H * 0.30)), by = hh;
  g.arc((W - 1) / 2, by, W * 0.30, hh - 1, 0, Math.PI, P.wdd);   // 손잡이 아치 — 끊김 없이
  g.arc((W - 1) / 2, by, W * 0.30 - 1, hh - 2, 0, Math.PI, P.wd);
  g.box(1, by, W - 2, H - by, P.red, P.out);
  g.hline(2, by + 1, W - 4, P.redd);
  g.rect(R(W / 2) - 1, by + M(1, R((H - by) * 0.34)), 2, 2, P.gld);   // 잠금
  return g.m;
}

// 노트북 — 열린 노트북, 화면 + 힌지 + 자판
function laptop(W, H) {
  const g = pad(W, H), scH = M(5, R(H * 0.58));
  g.box(1, 0, W - 2, scH, P.dk, P.out);
  g.rect(2, 1, W - 4, scH - 2, P.blud);
  g.rect(2, 1, M(2, R((W - 4) * 0.45)), M(1, R((scH - 2) * 0.4)), P.blul);   // 화면 반사
  g.box(0, scH, W, H - scH, P.mtd, P.out);                       // 본체
  for (let y = scH + 2; y < H - 2; y += 2)
    for (let x = 2; x < W - 2; x += 2) g.set(x, y, P.dk);        // 자판
  g.hline(R(W * 0.34), H - 2, M(2, R(W * 0.32)), P.mtl);         // 터치패드
  return g.m;
}

// 아이패드 — 넓은 베젤 + 화면 + 홈버튼
function tablet(W, H) {
  const g = pad(W, H);
  g.box(0, 0, W, H, P.mtd, P.out);
  g.rect(2, 2, W - 4, H - 5, P.blud);
  g.rect(2, 2, W - 4, M(1, R((H - 5) * 0.3)), P.blul);
  g.set(R(W / 2), H - 2, P.mtl2);                                 // 홈버튼
  return g.m;
}

// 핸드폰 — 민트 케이스 + 노치
function phoneL(W, H) {
  const g = pad(W, H), bw = M(5, R(W * 0.74)), x0 = R((W - bw) / 2);
  g.box(x0, 0, bw, H, P.cyn, P.out);
  g.rect(x0 + 1, 2, bw - 2, H - 4, P.blk);
  g.rect(x0 + 2, 3, bw - 4, H - 6, P.blul);
  g.hline(x0 + R(bw / 2) - 1, 1, 2, P.dk);                        // 노치
  return g.m;
}

// 노트 — 스프링 노트, 위 링 + 줄 + 여백선
function note(W, H) {
  const g = pad(W, H), ry = M(1, R(H * 0.10));
  g.box(0, ry, W, H - ry, P.wht, P.out);
  for (let x = 1; x < W - 1; x += 2) { g.set(x, ry - 1, P.mtd); g.set(x, ry, P.mtl2); }   // 스프링
  for (let y = ry + 3; y < H - 2; y += 2) g.hline(3, y, W - 5, P.mtd);                     // 줄
  g.vline(2, ry + 1, H - ry - 2, P.red);                                                   // 여백선
  return g.m;
}

// 소설책 — 문고본 표지, 제목 띠 + 지은이 줄 + 책배
function novel(W, H) {
  const g = pad(W, H), bw = M(5, R(W * 0.80)), x0 = R((W - bw) / 2);
  g.box(x0, 0, bw, H, P.ppl, P.out);
  g.rect(x0 + bw - 1, 1, 1, H - 2, P.cream);                     // 책배
  g.rect(x0 + 2, R(H * 0.22), bw - 4, M(1, R(H * 0.14)), P.cream);   // 제목 띠
  g.hline(x0 + 2, R(H * 0.60), M(2, R((bw - 4) * 0.6)), P.creamd);   // 지은이
  g.hline(x0 + 2, R(H * 0.72), M(2, R((bw - 4) * 0.4)), P.creamd);
  return g.m;
}

// 에코백 — 캔버스 토트, 손잡이 두 줄 + 프린트
function ecobag(W, H) {
  const g = pad(W, H), hh = M(3, R(H * 0.28)), by = hh;
  for (const sd of [-1, 1])                                       // 손잡이 두 개 — 붙은 아치로
    g.arc((W - 1) / 2 + sd * (W * 0.22), by, W * 0.13, hh - 1, 0, Math.PI, P.tand);
  g.box(0, by, W, H - by, P.tan, P.out);
  g.hline(1, by + 1, W - 2, P.tand);
  const px = R(W / 2), py = by + M(2, R((H - by) * 0.40));        // 프린트(잎 마크)
  [[0, 0], [1, 0], [0, -1], [-1, 1], [0, 1]].forEach(([dx, dy]) => g.set(px + dx, py + dy, P.grn));
  g.set(px, py + 2, P.grnd);
  return g.m;
}

/* ── 얼굴 1종 (카탈로그 「한 종 미정」 자리 제안) ──────── */

// 마스크 — 눈 아래에 걸린다. 앵커를 그림 위쪽에 두어 눈높이보다 내려 앉힌다.
function mask(W, H) {
  const g = pad(W, H);
  const bx = M(4, R(W * 0.16)), bw = W - bx * 2, by = M(2, R(H * 0.30)), bh = H - by;
  g.box(bx, by, bw, bh, P.wht, P.mtd);
  for (let y = by + 2; y < H - 1; y += 2) g.hline(bx + 1, y, bw - 2, P.mtd);   // 주름
  g.rect(bx + 1, by + 1, bw - 2, 1, P.mtl2);
  for (let i = 0; i < bx; i++) {                                              // 귀끈
    g.set(bx - 1 - i, by - 1 - R(i * (by - 1) / M(1, bx)), P.mtd);
    g.set(bx + bw + i, by - 1 - R(i * (by - 1) / M(1, bx)), P.mtd);
  }
  return g.m;
}

export const ITEMS = [
  ['nm_right_sharp', '샤프', 'right', sharp],
  ['nm_right_cutter', '커터칼', 'right', cutter],
  ['nm_right_twig', '작은 나뭇가지', 'right', twig],
  ['nm_right_phone', '스마트폰', 'right', phoneR],
  ['nm_right_fountain', '만년필', 'right', fountain],
  ['nm_right_staff', '지팡이', 'right', staff],
  // nm_right_gun 총 — 스크립트 그림이 어색해서 뺐다. 원장이 따로 넣는다 (2026-08-05).
  // 그리려면 gun() 은 아래에 그대로 있으니 이 줄만 되살리면 된다.
  ['nm_right_sword', '칼', 'right', sword],
  ['nm_left_shield', '방패', 'left', shield],
  ['nm_left_book', '책', 'left', book],
  ['nm_left_bag', '가방', 'left', bag],
  ['nm_left_handbag', '핸드백', 'left', handbag],
  ['nm_left_laptop', '노트북', 'left', laptop],
  ['nm_left_tablet', '아이패드', 'left', tablet],
  ['nm_left_phone', '핸드폰', 'left', phoneL],
  ['nm_left_note', '노트', 'left', note],
  ['nm_left_novel', '소설책', 'left', novel],
  ['nm_left_ecobag', '에코백', 'left', ecobag],
  ['nm_face_mask', '마스크', 'face', mask],
];
