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
import { ITEMS, SZ } from './노말-도트.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const STAGES = ['baby', 'teen', 'awake'];

/* 왼손은 물건마다 쥐는 자리가 다르다 — 가방류는 맨 위(손잡이), 판·책은 가운데.
   오른손은 연필·검처럼 아래에서 1/4 (랩 기본값 78%). */
export const GRIP = {
  nm_left_bag: 0.10, nm_left_handbag: 0.06, nm_left_ecobag: 0.08,
  nm_left_shield: 0.45, nm_left_book: 0.45, nm_left_laptop: 0.45,
  nm_left_tablet: 0.45, nm_left_phone: 0.45, nm_left_note: 0.45, nm_left_novel: 0.45,
};
/* 기울기는 그림이 아니라 배치값이다 (슬라임랩-v4.html:2732 참고). 무기처럼 든 것만 준다. */
export const ROT = { nm_right_sword: 12, nm_right_gun: 8, nm_right_staff: 6, nm_right_twig: 10 };
/* 얼굴 앵커는 눈높이다. 마스크는 눈 아래에 걸려야 하므로 그림의 34% 지점을 눈에 맞춘다. */
export const FACE_Y = { nm_face_mask: 0.34 };

/* 슬라임랩 autoAnchor 손 슬롯 규칙 (슬라임랩-v4.html:2710) */
export function handAnchor(px, grip) {
  const pts = [...px.keys()].map((k) => k.split(',').map(Number));
  const ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0]);
  const gy = Math.round(Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * grip);
  const row = pts.filter(([, y]) => Math.abs(y - gy) <= 1).map(([x]) => x);
  const gx = row.length ? Math.round((Math.min(...row) + Math.max(...row)) / 2)
                        : Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
  return [gx, gy];
}

export function build(code, slot, fn, si) {
  const [w, h] = SZ[slot][si];
  const px = fn(w, h);
  if (slot === 'face')
    return { w, h, px, anchor: [Math.round((w - 1) / 2), Math.round(h * (FACE_Y[code] ?? 0.5))] };
  return { w, h, px, anchor: handAnchor(px, slot === 'right' ? 0.78 : (GRIP[code] ?? 0.45)) };
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
