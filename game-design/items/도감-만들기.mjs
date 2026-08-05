/* 도감 페이지를 만든다 — 지금까지 만든 노말 파츠를 한곳에서 본다.
 *
 *   node game-design/items/도감-만들기.mjs
 *
 * 랩의 진짜 렌더러로 18종 × 3단계를 찍어 data URI 로 박아 넣으므로, 나온 HTML 한 장은
 * 아무것도 없이 혼자 열린다 (폰에서 보라고 아티팩트로 올리기 좋게).
 * 그림이 없는 14종(랩에서 반입한 GPT 그림)은 앵커만 표로 싣는다.
 *
 * 결과: game-design/items/도감.html — 생성물이라 저장소에 넣지 않는다(.gitignore).
 */

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
import { ITEMS } from './노말-도트.mjs';
import { build, ROT } from './노말-내보내기.mjs';


const LAB = join(DIR, '..', '슬라임랩-v4.html');
const STAGES = [['baby', '베이비', 0], ['teen', '틴', 1], ['awake', '각성', 2]];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
await p.goto('file://' + LAB);

const out = [];
for (const [code, ko, slot, fn] of ITEMS) {
  const rec = { code, ko, slot, rot: ROT[code] || 0, stages: [] };
  for (const [st, stKo, si] of STAGES) {
    const r = build(code, slot, fn, si);
    await p.evaluate(({ px, w, h, slot, anchor, deg, st }) => {
      const g = st === 'baby' ? babyParts(SKINS[0])
              : slimeParts(SKINS[0], st === 'awake' ? { awake: true } : undefined);
      // 랩 자체가 어두운 배경이라 그대로 찍으면 밝은 테마에서 검은 상자가 된다
      document.documentElement.style.background = 'transparent';
      document.body.style.cssText = 'margin:0;background:transparent';
      document.body.innerHTML =
        `<div id="one" style="width:200px">${wrap(g.inner + impSvg({ px: new Map(px), w, h }, slot, anchor, g.anchors, false, false, deg), 200)}</div>`;
      document.querySelector('#one svg').style.cssText = 'width:200px;height:auto;display:block';
    }, { px: [...r.px], w: r.w, h: r.h, slot, anchor: r.anchor,
         deg: (slot === 'left' ? -1 : 1) * (ROT[code] || 0), st });
    const buf = await (await p.$('#one')).screenshot({ omitBackground: true });
    rec.stages.push({ st, ko: stKo, w: r.w, h: r.h, anchor: r.anchor,
                      img: 'data:image/png;base64,' + buf.toString('base64') });
  }
  out.push(rec);
}
await b.close();

/* 그림 없이 앵커만 있는 것들 (랩에서 반입한 GPT 그림 — PNG 유실) */
const man = JSON.parse(readFileSync(join(DIR, 'items.json'), 'utf8'));
const have = new Set(ITEMS.map((i) => i[0]));
const missing = man.items.filter((i) => !have.has(i.code))
  .map((i) => ({ code: i.code, ko: i.ko, slot: i.slot, rot: i.rot || 0,
                 anchors: ['baby', 'teen', 'awake'].map((st) => i[st] && i[st].anchor) }));

const made = out;


const SLOT_KO = { head: '머리', face: '얼굴', right: '오른손', left: '왼손' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const n = {};
for (const i of [...made, ...missing]) n[i.slot] = (n[i.slot] || 0) + 1;

const card = (it) => `
<article class="card" data-slot="${it.slot}">
  <div class="strip">
    ${it.stages.map((s) => `
    <figure class="shot">
      <img src="${s.img}" alt="${esc(it.ko)} ${esc(s.ko)}" loading="lazy" width="200" height="200">
      <figcaption>${s.ko}<span class="dim"> ${s.w}×${s.h}</span></figcaption>
    </figure>`).join('')}
  </div>
  <div class="meta">
    <h3>${esc(it.ko)}<span class="slot">${SLOT_KO[it.slot]}</span></h3>
    <p class="code">${esc(it.code)}</p>
    <dl class="facts">
      <div><dt>앵커</dt><dd>${it.stages.map((s) => `${s.anchor[0]},${s.anchor[1]}`).join(' · ')}</dd></div>
      <div><dt>기울기</dt><dd>${it.rot ? it.rot + '°' : '없음'}</dd></div>
    </dl>
  </div>
</article>`;

const html = `<title>슬라임 아이템 도감 — 노말</title>
<style>
:root{
  --bg:#1e1c19; --surface:#262320; --line:#3a342c; --ink:#ece7de; --muted:#98917f;
  --accent:#f0a33c; --cool:#9cc4ec;
  --sans:"Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,"Cascadia Mono",monospace;
  --pad:clamp(16px,4vw,40px);
}
@media (prefers-color-scheme:light){
  :root{ --bg:#f7f4ed; --surface:#fff; --line:#e5dfd2; --ink:#2b2721; --muted:#79725f;
         --accent:#b8720f; --cool:#3f6f9e; }
}
:root[data-theme="dark"]{ --bg:#1e1c19; --surface:#262320; --line:#3a342c; --ink:#ece7de;
  --muted:#98917f; --accent:#f0a33c; --cool:#9cc4ec; }
:root[data-theme="light"]{ --bg:#f7f4ed; --surface:#fff; --line:#e5dfd2; --ink:#2b2721;
  --muted:#79725f; --accent:#b8720f; --cool:#3f6f9e; }

body{ margin:0; background:var(--bg); color:var(--ink); font-family:var(--sans);
      line-height:1.6; -webkit-text-size-adjust:100%; }
img{ max-width:100%; height:auto; }
.wrap{ max-width:1180px; margin:0 auto; padding:var(--pad); }

header.top{ border-bottom:1px solid var(--line); }
.eyebrow{ font-family:var(--mono); font-size:12px; letter-spacing:.14em; text-transform:uppercase;
          color:var(--accent); margin:0 0 10px; }
h1{ font-size:clamp(26px,5vw,40px); line-height:1.2; margin:0 0 12px; text-wrap:balance;
    letter-spacing:-.02em; font-weight:800; }
.lede{ margin:0; color:var(--muted); max-width:60ch; }

.tally{ display:flex; flex-wrap:wrap; gap:8px; margin:22px 0 0; padding:0; list-style:none; }
.tally li{ font-family:var(--mono); font-size:13px; border:1px solid var(--line);
           border-radius:2px; padding:5px 10px; background:var(--surface); }
.tally b{ color:var(--accent); font-weight:700; }

.knobs{ margin:22px 0 0; border:1px solid var(--line); border-left:3px solid var(--accent);
        background:var(--surface); padding:14px 16px; }
.knobs h2{ font-size:13px; margin:0 0 8px; letter-spacing:.04em; color:var(--muted); font-weight:700; }
.knobs dl{ margin:0; display:grid; gap:4px 18px; grid-template-columns:auto 1fr;
           font-family:var(--mono); font-size:13px; }
.knobs dt{ color:var(--accent); }
.knobs dd{ margin:0; color:var(--muted); }

nav.filters{ position:sticky; top:0; z-index:5; background:var(--bg);
             border-bottom:1px solid var(--line); }
.filters .wrap{ padding-top:12px; padding-bottom:12px; display:flex; flex-wrap:wrap; gap:8px; }
.chip{ font:inherit; font-size:14px; cursor:pointer; background:var(--surface); color:var(--ink);
       border:1px solid var(--line); border-radius:2px; padding:7px 14px; }
.chip[aria-pressed="true"]{ background:var(--accent); border-color:var(--accent); color:var(--bg);
                            font-weight:700; }
.chip:focus-visible{ outline:2px solid var(--cool); outline-offset:2px; }

.grid{ display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(288px,1fr)); }
.card{ background:var(--surface); border:1px solid var(--line); border-radius:3px; overflow:hidden; }
.card[hidden]{ display:none; }
.strip{ display:grid; grid-template-columns:repeat(3,1fr); gap:1px;
        background:var(--line); border-bottom:1px solid var(--line); }
.shot{ margin:0; background:var(--surface); padding:8px 4px 6px; text-align:center; }
.shot img{ display:block; width:100%; image-rendering:pixelated; }
.shot figcaption{ font-family:var(--mono); font-size:11px; color:var(--muted); margin-top:4px; }
.dim{ opacity:.6; }

.meta{ padding:12px 14px 14px; }
.meta h3{ font-size:17px; margin:0; display:flex; align-items:baseline; gap:8px; }
.slot{ font-family:var(--mono); font-size:11px; font-weight:400; color:var(--accent);
       border:1px solid var(--line); border-radius:2px; padding:1px 6px; }
.code{ font-family:var(--mono); font-size:12px; color:var(--muted); margin:3px 0 10px;
       word-break:break-all; }
.facts{ margin:0; display:grid; gap:3px; font-family:var(--mono); font-size:12px;
        font-variant-numeric:tabular-nums; }
.facts>div{ display:flex; gap:10px; }
.facts dt{ color:var(--muted); min-width:44px; }
.facts dd{ margin:0; }

section.pending{ margin-top:44px; padding-top:28px; border-top:1px solid var(--line); }
section.pending h2{ font-size:19px; margin:0 0 8px; }
section.pending p{ margin:0 0 18px; color:var(--muted); max-width:62ch; }
.pending table{ width:100%; border-collapse:collapse; font-size:13px; }
.pending .scroll{ overflow-x:auto; }
.pending th{ text-align:left; font-family:var(--mono); font-size:11px; letter-spacing:.08em;
             text-transform:uppercase; color:var(--muted); font-weight:600;
             border-bottom:1px solid var(--line); padding:0 12px 7px 0; white-space:nowrap; }
.pending td{ border-bottom:1px solid var(--line); padding:8px 12px 8px 0; white-space:nowrap; }
.pending td.c{ font-family:var(--mono); color:var(--muted); font-variant-numeric:tabular-nums; }
.tag{ font-family:var(--mono); font-size:11px; color:var(--cool);
      border:1px solid currentColor; border-radius:2px; padding:1px 6px; }

footer{ margin-top:44px; padding-top:22px; border-top:1px solid var(--line);
        color:var(--muted); font-size:13px; }
footer p{ margin:0 0 6px; max-width:62ch; }
@media (prefers-reduced-motion:reduce){ *{ animation:none !important; transition:none !important; } }
</style>

<header class="top"><div class="wrap">
  <p class="eyebrow">유종의미 슬라임 · 시즌 0</p>
  <h1>노말 파츠 도감</h1>
  <p class="lede">지금까지 만든 노말 아이템을 베이비·틴·각성 세 단계에 실제로 입혀 본 것이다.
    그림은 디자인 랩의 렌더러가 그대로 그린 것이라, 게임에 들어갈 때도 같은 자리에 놓인다.</p>
  <ul class="tally">
    <li>노말 <b>${made.length + missing.length}</b>/33종</li>
    ${Object.entries(SLOT_KO).map(([k, v]) => `<li>${v} <b>${n[k] || 0}</b></li>`).join('')}
    <li>그림 있음 <b>${made.length}</b></li>
  </ul>
  <div class="knobs">
    <h2>지금 걸려 있는 조절값</h2>
    <dl>
      <dt>RAISE = 2</dt><dd>양손 스무 종의 높이. 아랫변이 손에서 몇 칸 아래 오는가</dd>
      <dt>LEFT_NUDGE = 1</dt><dd>왼손 열 종을 바깥으로 미는 칸 수</dd>
      <dt>ROT 5~14°</dt><dd>오른손 기울기. 연필 14° · 볼펜 9° 를 기준선으로 종별</dd>
    </dl>
  </div>
</div></header>

<nav class="filters"><div class="wrap">
  <button class="chip" aria-pressed="true" data-f="all">전체</button>
  ${Object.entries(SLOT_KO).map(([k, v]) =>
    `<button class="chip" aria-pressed="false" data-f="${k}">${v}</button>`).join('')}
</div></nav>

<main class="wrap">
  <div class="grid">${made.map(card).join('')}</div>

  <section class="pending">
    <h2>그림이 없는 ${missing.length}종</h2>
    <p>랩에서 GPT 그림으로 반입한 것들이다. 눈으로 맞춘 앵커는 살아 있는데 그림(PNG)이 없다 —
      아티팩트가 액자 안이라 자동 내려받기가 조용히 막혔던 탓이다. 원본 이미지를 랩에 다시 넣으면
      앵커는 그대로 두고 그림만 채워진다.</p>
    <div class="scroll"><table>
      <thead><tr><th>이름</th><th>코드</th><th>부위</th><th>앵커 (베·틴·각)</th><th>기울기</th></tr></thead>
      <tbody>${missing.map((m) => `<tr>
        <td>${esc(m.ko || '')}</td>
        <td class="c">${esc(m.code)}</td>
        <td class="c">${SLOT_KO[m.slot] || m.slot}</td>
        <td class="c">${m.anchors.map((a) => a ? a.join(',') : '—').join('　·　')}</td>
        <td class="c">${m.rot ? m.rot + '°' : '—'}</td></tr>`).join('')}
      </tbody>
    </table></div>
  </section>

  <footer>
    <p><span class="tag">남은 것</span> 노말은 <code>nm_right_gun</code> 「총」 한 종뿐이고, 원장이 직접 넣기로 했다.
      그 뒤로 세트템 70종 — 매직 25 → 레어 20 → 에픽 15 → 레전더리 10.</p>
    <p>이 도감의 그림은 <code>game-design/items/</code> 의 도트 코드에서 나온다.
      아트를 고치면 내보내기를 다시 돌려 전부 재현된다.</p>
  </footer>
</main>

<script>
const chips = [...document.querySelectorAll('.chip')];
const cards = [...document.querySelectorAll('.card')];
chips.forEach((c) => c.addEventListener('click', () => {
  chips.forEach((o) => o.setAttribute('aria-pressed', String(o === c)));
  const f = c.dataset.f;
  cards.forEach((k) => { k.hidden = f !== 'all' && k.dataset.slot !== f; });
}));
</script>
`;

const out2 = join(DIR, '도감.html');
writeFileSync(out2, html);
console.log(`${made.length}종 × 3단계 + 앵커만 ${missing.length}종 → ${out2} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
