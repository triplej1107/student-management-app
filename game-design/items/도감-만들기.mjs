/* 도감 페이지를 만든다 — 지금까지 만든 노말 파츠를 한곳에서 본다.
 *
 *   node game-design/items/도감-만들기.mjs
 *
 * **items.json 과 그 옆의 PNG 에서 읽는다.** 그림 코드(노말-도트.mjs)에서 읽지 않는다 —
 * 그래야 랩에서 반입한 것(원장 그림)과 스크립트로 만든 것이 한 화면에 같이 나오고,
 * 나중에 유실된 PNG 가 채워지면 손 안 대고 그대로 붙는다.
 * PNG 가 있는 것은 입힌 그림을, 없는 것은 앵커만 표로 싣는다.
 *
 * 그림은 랩의 진짜 렌더러(slimeParts + impSvg)가 그리고 data URI 로 박으므로,
 * 나온 HTML 한 장은 아무것도 없이 혼자 열린다 (폰에서 보라고 아티팩트로 올리기 좋게).
 *
 * 결과: game-design/items/도감.html — 생성물이라 저장소에 넣지 않는다(.gitignore).
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ITEMS } from './노말-도트.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const LAB = join(DIR, '..', '슬라임랩-v4.html');
const STAGES = [['baby', '베이비'], ['teen', '틴'], ['awake', '각성']];
const SLOT_KO = { head: '머리', face: '얼굴', right: '오른손', left: '왼손', fx: '이펙트' };
const BY_SCRIPT = new Set(ITEMS.map((i) => i[0]));      // 내가 그린 것 / 나머지는 랩 반입

const man = JSON.parse(readFileSync(join(DIR, 'items.json'), 'utf8'));

const drawable = [], pending = [];                      // PNG 가 하나라도 있어야 그린다
for (const it of man.items)
  (STAGES.some(([st]) => it[st] && existsSync(join(DIR, it[st].png))) ? drawable : pending).push(it);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
await p.goto('file://' + LAB);

const made = [];
for (const it of drawable) {
  const rec = { code: it.code, ko: it.ko || it.code, slot: it.slot, rot: it.rot || 0,
                by: BY_SCRIPT.has(it.code) ? 'script' : 'lab', stages: [] };
  for (const [st, stKo] of STAGES) {
    const f = it[st] && join(DIR, it[st].png);
    if (!f || !existsSync(f)) continue;
    const b64 = 'data:image/png;base64,' + readFileSync(f).toString('base64');
    const size = await p.evaluate(async ({ b64, slot, anchor, deg, st, cell }) => {
      const im = new Image();                            // PNG 한 픽셀 = 한 칸
      await new Promise((r) => { im.onload = r; im.src = b64; });
      const cv = document.createElement('canvas');
      cv.width = im.width; cv.height = im.height;
      const cx = cv.getContext('2d');
      cx.drawImage(im, 0, 0);
      const d = cx.getImageData(0, 0, im.width, im.height).data;
      const px = new Map(), h2 = (v) => v.toString(16).padStart(2, '0');
      for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
        const i = (y * im.width + x) * 4;
        if (d[i + 3] < 8) continue;
        px.set(x + ',' + y, '#' + h2(d[i]) + h2(d[i + 1]) + h2(d[i + 2]));
      }
      const g = st === 'baby' ? babyParts(SKINS[0])
              : slimeParts(SKINS[0], st === 'awake' ? { awake: true } : undefined);
      // 랩 자체가 어두운 배경이라 그대로 찍으면 밝은 테마에서 검은 상자가 된다
      document.documentElement.style.background = 'transparent';
      document.body.style.cssText = 'margin:0;background:transparent';
      document.body.innerHTML = `<div id="one" style="width:200px">${
        wrap(impLayer(g.inner, impSvgAt(cell, { px, w: im.width, h: im.height }, slot, anchor, g.anchors, false, false, deg), slot), 200)}</div>`;
      document.querySelector('#one svg').style.cssText = 'width:200px;height:auto;display:block';
      return [im.width, im.height];
    }, { b64, slot: it.slot, anchor: it[st].anchor, cell: it.cell || man.cell || 3,        // 담을 때의 칸 그대로 (등급에서 다시 뽑지 않는다)
         deg: (it.slot === 'left' ? -1 : 1) * (it.rot || 0), st });
    const shot = await (await p.$('#one')).screenshot({ omitBackground: true });
    rec.stages.push({ st, ko: stKo, w: size[0], h: size[1], anchor: it[st].anchor,
                      img: 'data:image/png;base64,' + shot.toString('base64') });
  }
  made.push(rec);
}
await b.close();

const missing = pending.map((i) => ({ code: i.code, ko: i.ko, slot: i.slot, rot: i.rot || 0,
  anchors: STAGES.map(([st]) => i[st] && i[st].anchor) }));

/* ── 페이지 ─────────────────────────────────────── */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = {};
for (const i of man.items) n[i.slot] = (n[i.slot] || 0) + 1;
const byLab = made.filter((m) => m.by === 'lab').length;

const card = (it) => `
<article class="card" data-slot="${it.slot}" data-by="${it.by}">
  <div class="strip">
    ${it.stages.map((s) => `
    <figure class="shot">
      <img src="${s.img}" alt="${esc(it.ko)} ${esc(s.ko)}" loading="lazy" width="200" height="200">
      <figcaption>${s.ko}<span class="dim"> ${s.w}×${s.h}</span></figcaption>
    </figure>`).join('')}
  </div>
  <div class="meta">
    <h3>${esc(it.ko)}<span class="slot">${SLOT_KO[it.slot]}</span>
      <span class="by ${it.by}">${it.by === 'lab' ? '원장' : '스크립트'}</span></h3>
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
.sep{ width:1px; background:var(--line); margin:2px 4px; }

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
.meta h3{ font-size:17px; margin:0; display:flex; align-items:baseline; gap:7px; flex-wrap:wrap; }
.slot,.by{ font-family:var(--mono); font-size:11px; font-weight:400; border-radius:2px; padding:1px 6px; }
.slot{ color:var(--accent); border:1px solid var(--line); }
.by.lab{ color:var(--cool); border:1px solid currentColor; }
.by.script{ color:var(--muted); border:1px solid var(--line); }
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
  <p class="lede">노말 아이템을 베이비·틴·각성 세 단계에 실제로 입혀 본 것이다.
    <b>원장</b> 표가 붙은 건 랩에서 GPT 그림으로 반입한 것, <b>스크립트</b>는 도트 코드가 그린 것이다.
    둘 다 디자인 랩의 렌더러가 그대로 그리므로 게임에 들어갈 때도 같은 자리에 놓인다.</p>
  <ul class="tally">
    <li>노말 <b>${man.items.length}</b>/33종</li>
    ${Object.keys(SLOT_KO).filter((k) => n[k]).map((k) => `<li>${SLOT_KO[k]} <b>${n[k]}</b></li>`).join('')}
    <li>그림 있음 <b>${made.length}</b></li>
    <li>원장 그림 <b>${byLab}</b></li>
  </ul>
  <div class="knobs">
    <h2>스크립트 쪽에 걸려 있는 조절값</h2>
    <dl>
      <dt>RAISE = 2</dt><dd>양손 스무 종의 높이. 아랫변이 손에서 몇 칸 아래 오는가</dd>
      <dt>LEFT_NUDGE = 1</dt><dd>왼손 열 종을 바깥으로 미는 칸 수</dd>
      <dt>ROT 5~14°</dt><dd>오른손 기울기. 연필 14° · 볼펜 9° 를 기준선으로 종별</dd>
    </dl>
  </div>
</div></header>

<nav class="filters"><div class="wrap">
  <button class="chip" aria-pressed="true" data-k="slot" data-f="all">전체</button>
  ${Object.keys(SLOT_KO).filter((k) => n[k]).map((k) =>
    `<button class="chip" aria-pressed="false" data-k="slot" data-f="${k}">${SLOT_KO[k]}</button>`).join('')}
  <span class="sep"></span>
  <button class="chip" aria-pressed="true" data-k="by" data-f="all">둘 다</button>
  <button class="chip" aria-pressed="false" data-k="by" data-f="lab">원장</button>
  <button class="chip" aria-pressed="false" data-k="by" data-f="script">스크립트</button>
</div></nav>

<main class="wrap">
  <div class="grid">${made.map(card).join('')}</div>
  ${missing.length ? `
  <section class="pending">
    <h2>그림이 없는 ${missing.length}종</h2>
    <p>랩에서 GPT 그림으로 반입한 것들이다. 눈으로 맞춘 앵커는 살아 있는데 그림(PNG)이 없다 —
      그림까지 저장하도록 고치기 전에 담은 탓이다. 원본 PNG 만 저장소에 올라오면
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
  </section>` : ''}

  <footer>
    <p><span class="tag">다음</span> 노말 33종은 다 찼다. 그다음은 세트템 70종 —
      매직 25 → 레어 20 → 에픽 15 → 레전더리 10.</p>
    <p>이 도감은 <code>game-design/items/items.json</code> 과 그 옆 PNG 에서 읽는다.
      아트를 고치거나 PNG 가 채워진 뒤 <code>도감-만들기.mjs</code> 를 다시 돌리면 그대로 반영된다.</p>
  </footer>
</main>

<script>
const chips = [...document.querySelectorAll('.chip')];
const cards = [...document.querySelectorAll('.card')];
const pick = { slot: 'all', by: 'all' };
chips.forEach((c) => c.addEventListener('click', () => {
  const k = c.dataset.k;
  chips.filter((o) => o.dataset.k === k).forEach((o) => o.setAttribute('aria-pressed', String(o === c)));
  pick[k] = c.dataset.f;
  cards.forEach((n2) => {
    n2.hidden = (pick.slot !== 'all' && n2.dataset.slot !== pick.slot)
             || (pick.by !== 'all' && n2.dataset.by !== pick.by);
  });
}));
</script>
`;

const out = join(DIR, '도감.html');
writeFileSync(out, html);
console.log(`그림 ${made.length}종(원장 ${byLab} · 스크립트 ${made.length - byLab}) + 앵커만 ${missing.length}종` +
  ` → ${out} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
