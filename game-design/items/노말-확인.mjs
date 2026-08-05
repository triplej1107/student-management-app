/* 앵커 확인 — 슬라임랩의 진짜 렌더러(slimeParts + impSvg)에 아트와 앵커를 물려
 * 실제로 입힌 그림을 뽑는다. 숫자만 봐서는 앵커가 맞는지 알 수 없다.
 *
 *   node game-design/items/노말-확인.mjs [baby|teen|awake]
 *
 * 결과는 game-design/items/노말-착용확인.png.
 * playwright 는 전역 설치본을 쓴다 (PLAYWRIGHT_BROWSERS_PATH 로 크로미움이 잡혀 있다).
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ITEMS } from './노말-도트.mjs';
import { build, ROT } from './노말-내보내기.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const LAB = join(DIR, '..', '슬라임랩-v4.html');
const STAGE = process.argv[2] || 'teen';
const SI = { baby: 0, teen: 1, awake: 2 }[STAGE] ?? 1;

const data = ITEMS.map(([code, ko, slot, fn]) => {
  const r = build(code, slot, fn, SI);
  return { code, ko, slot, w: r.w, h: r.h, anchor: r.anchor,
           px: [...r.px], deg: (slot === 'left' ? -1 : 1) * (ROT[code] || 0) };
});

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1180, height: 900 } });
await p.goto('file://' + LAB);
await p.evaluate(({ data, stage }) => {
  const g = stage === 'baby' ? babyParts(SKINS[0])
          : slimeParts(SKINS[0], stage === 'awake' ? { awake: true } : undefined);
  document.body.innerHTML =
    '<div id="sheet" style="display:flex;flex-wrap:wrap;gap:2px;background:#fff;width:1160px"></div>';
  const sheet = document.getElementById('sheet');
  for (const d of data) {
    const r = { px: new Map(d.px), w: d.w, h: d.h };
    const fig = document.createElement('figure');
    fig.style.cssText = 'margin:0;width:190px;text-align:center;font:11px sans-serif;color:#555';
    fig.innerHTML = wrap(g.inner + impSvg(r, d.slot, d.anchor, g.anchors, false, false, d.deg), 190) +
      `<figcaption>${d.ko} [${d.anchor.join(',')}]</figcaption>`;
    sheet.appendChild(fig);
  }
}, { data, stage: STAGE });
const out = join(DIR, '노말-착용확인.png');
writeFileSync(out, await (await p.$('#sheet')).screenshot());
await b.close();
console.log(`${STAGE} 슬라임에 ${data.length}종 입힌 결과 → ${out}`);
