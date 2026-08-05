/* 노말 파츠를 PNG + items.json 으로 내보낸다.
 *
 *   node game-design/items/노말-내보내기.mjs
 *
 * 앵커까지 여기서 계산하므로 **디자인 랩을 거치지 않는다.** 랩은 눈으로 확인할 때만 쓴다.
 * 앵커 규칙은 슬라임랩-v4.html 의 autoAnchor 를 그대로 옮긴 것이라 랩에서 반입한 것과
 * 같은 자리에 놓인다 (검증: 노말-확인.mjs 가 랩의 진짜 렌더러에 물려 그림을 뽑는다).
 *
 * 아트를 고치려면 노말-도트.mjs 를 고치고 이걸 다시 돌리면 된다. 전부 재현된다.
 */
import zlib from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ITEMS, SZ, MASK_TOP } from './노말-도트.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const STAGES = ['baby', 'teen', 'awake'];

/* 양손 공통 — 아이템 **아랫변이 손에서 몇 칸 아래**에 오는가. 이 한 줄이 두 손 스무 종의
   높이를 전부 정한다.
   기준은 오른손 기본 쥐기(아래에서 1/4 = 랩 기본값 78%)에서 RAISE 만큼 올린 값이다.
   더 올리려면 RAISE 만 키우면 되고, 왼손도 같이 따라 올라간다. */
export const GRIP_RIGHT = 0.78;
export const RAISE = 2;                                     // 원장 지시로 두 칸 올림 (2026-08-05)

/* 왼손만 바깥(화면 왼쪽)으로 몇 칸 밀지. 앵커 x 를 키우면 그림이 왼쪽으로 간다
   — 그리는 자리가 at + (x − anchor) × 셀 이라서 그렇다. */
export const LEFT_NUDGE = 1;                                // 원장 지시 (2026-08-05)

const bottomBelowHand = (si) => {
  const h = SZ.right[si][1];
  return Math.max(0, (h - 1) - Math.round((h - 1) * GRIP_RIGHT) - RAISE);
};

/* 기울기는 그림이 아니라 배치값이다 (슬라임랩-v4.html:2732 참고).
   원장이 맞춰 둔 연필 14° · 볼펜 9° 를 기준선으로, 길고 얇을수록 크게 준다. */
export const ROT = {
  nm_right_twig: 14, nm_right_sharp: 13, nm_right_sword: 12,
  nm_right_fountain: 10, nm_right_cutter: 9, nm_right_staff: 7, nm_right_phone: 5,
};
/* 얼굴 앵커는 눈높이다. 마스크는 눈 아래에 걸려야 하므로 마스크 윗변 바로 아래를 눈에 맞춘다.
   (h) => 그림 안에서 눈이 오는 줄. 기본은 그림 한가운데. */
export const FACE_Y = { nm_face_mask: (h) => MASK_TOP(h) + 1 };

/* 손 슬롯 앵커. 가로는 슬라임랩 autoAnchor 와 같은 규칙 —
   **그 높이에 실제로 그려진 칸들의 가운데** (슬라임랩-v4.html:2710).
   전체 가로 가운데를 쓰면 기울여 그린 물건에서 쥐는 자리가 옆으로 밀린다. */
export function handAnchor(px, gy) {
  const pts = [...px.keys()].map((k) => k.split(',').map(Number));
  const row = pts.filter(([, y]) => Math.abs(y - gy) <= 1).map(([x]) => x);
  const xs = row.length ? row : pts.map((p) => p[0]);
  return [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), gy];
}

export function build(code, slot, fn, si) {
  const [w, h] = SZ[slot][si];
  const px = fn(w, h);
  if (slot === 'face')
    return { w, h, px, anchor: [Math.round((w - 1) / 2), (FACE_Y[code] ?? ((v) => Math.round(v / 2)))(h)] };
  // 두 손 모두 같은 규칙 — 실제로 그려진 아랫변을 기준선에 올린다.
  const y1 = Math.max(...[...px.keys()].map((k) => +k.split(',')[1]));
  const anchor = handAnchor(px, y1 - bottomBelowHand(si));
  if (slot === 'left') anchor[0] += LEFT_NUDGE;
  return { w, h, px, anchor };
}

/* 최소 PNG 라이터 — 한 칸 = 1픽셀, 배경 투명 (랩의 partPng 과 같은 규격) */
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const T = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = T[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

// 경로에 한글이 있으면 import.meta.url 이 퍼센트 인코딩되므로 풀어서 비교한다
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = join(DIR, 'items.json');
  const man = JSON.parse(readFileSync(path, 'utf8'));
  const by = new Map(man.items.map((it) => [it.code, it]));
  let pngs = 0;

  for (const [code, ko, slot, fn] of ITEMS) {
    const entry = { code, ko, slot, tier: 'normal' };
    if (ROT[code]) entry.rot = ROT[code];
    STAGES.forEach((st, si) => {
      const r = build(code, slot, fn, si);
      const buf = Buffer.alloc(r.w * r.h * 4);
      for (const [k, c] of r.px) {
        const [x, y] = k.split(',').map(Number), o = (y * r.w + x) * 4, [R, G, B] = hex(c);
        buf[o] = R; buf[o + 1] = G; buf[o + 2] = B; buf[o + 3] = 255;
      }
      const name = `${code}_${st}.png`;
      writeFileSync(join(DIR, name), png(r.w, r.h, buf));
      pngs++;
      entry[st] = { png: name, anchor: r.anchor };
    });
    by.set(code, { ...(by.get(code) || {}), ...entry });
  }

  const order = { head: 0, face: 1, right: 2, left: 3, fx: 4 };
  man.items = [...by.values()].sort((a, b) => (order[a.slot] - order[b.slot]) || a.code.localeCompare(b.code));
  writeFileSync(path, JSON.stringify(man, null, 2) + '\n');

  const n = {};
  for (const it of man.items) n[it.slot] = (n[it.slot] || 0) + 1;
  console.log(`PNG ${pngs}장 · items.json ${man.items.length}종 ` +
    `(머리 ${n.head || 0} · 얼굴 ${n.face || 0} · 오른손 ${n.right || 0} · 왼손 ${n.left || 0})`);
}
