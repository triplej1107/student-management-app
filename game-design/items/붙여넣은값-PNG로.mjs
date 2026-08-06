/* 랩의 「전부 복사 (그림까지)」 로 얻은 값을 PNG + items.json 으로 푼다.
   자동 내려받기가 막히는 자리(아티팩트 액자 안)에서 쓰라고 만든 길이다.
     node 붙여넣은값-PNG로.mjs dump.json [나갈폴더] [기존items.json]

   dump.json 은 복사한 값을 그대로 붙여넣어 저장한 파일.
   세 번째 인자를 주면 **앵커와 기울기는 그 파일 것을 쓴다** — 그림만 새로 받고
   손으로 맞춰 둔 값은 지키려는 용도다. 다시 반입하면 앵커가 자동값으로 돌아가므로
   눈으로 맞춘 수고를 잃지 않으려면 이걸 쓴다. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const C36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const src = process.argv[2];
if (!src) { console.error('쓰기: node 붙여넣은값-PNG로.mjs dump.json'); process.exit(1); }
const out = process.argv[3] || dirname(new URL(import.meta.url).pathname);
const data = JSON.parse(readFileSync(src, 'utf8'));

// 기존 매니페스트가 있으면 앵커·기울기를 그쪽에서 가져온다
const keep = process.argv[4] ? JSON.parse(readFileSync(process.argv[4], 'utf8')) : null;
const old = new Map((keep ? keep.items : []).map((i) => [i.code, i]));
let kept = 0;
for (const it of data.items) {
  const o = old.get(it.code);
  if (!o) continue;
  if (o.rot !== undefined) it.rot = o.rot; else delete it.rot;
  for (const st of ['baby', 'teen', 'awake'])
    if (it[st] && o[st]) { it[st].anchor = o[st].anchor; kept++; }
}
if (keep) console.log(`앵커 ${kept}개를 ${process.argv[4]} 것으로 유지`);

// 최소한의 PNG 라이터 (팔레트 없이 RGBA 그대로)
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const crcT = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

let n = 0;
for (const it of data.items) {
  for (const st of ['baby', 'teen', 'awake']) {
    const a = it[st] && it[st].art;
    if (!a) continue;
    const buf = Buffer.alloc(a.w * a.h * 4);
    a.rows.split('|').forEach((line, y) => [...line].forEach((ch, x) => {
      if (ch === '.') return;
      const hex = a.pal[C36.indexOf(ch)], i = (y * a.w + x) * 4;
      buf[i] = parseInt(hex.slice(1, 3), 16);
      buf[i + 1] = parseInt(hex.slice(3, 5), 16);
      buf[i + 2] = parseInt(hex.slice(5, 7), 16);
      buf[i + 3] = 255;
    }));
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, it[st].png), png(a.w, a.h, buf));
    n++;
  }
}
const clean = data.items.map((it) => {
  const o = { ...it };
  for (const st of ['baby', 'teen', 'awake']) {
    if (!o[st]) continue;
    const keepScale = o[st].scale;
    o[st] = { png: o[st].png, anchor: o[st].anchor };
    if (keepScale && keepScale !== 1) o[st].scale = keepScale;   // 놓을 때 주는 배율은 살린다
  }
  return o;
});
writeFileSync(join(out, 'items.json'),
  JSON.stringify({ cell: data.cell, authoredFor: data.authoredFor, items: clean }, null, 2)
    .replace(/\[\s+(-?\d+),\s+(-?\d+)\s+\]/g, '[$1, $2]'));
console.log(`PNG ${n}장 · items.json ${clean.length}종 → ${out}`);
