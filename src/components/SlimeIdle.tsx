"use client";

import { useEffect, useRef, useState } from "react";
import { slimeSvg, type SlimeAttr, type SlimeEquip, type SlimeStage } from "@/lib/slimeSprite";
import {
  slimeArtSrc,
  slimeArtWidth,
  hasArtExpression,
  ART_RATIO,
  type ArtExpression,
} from "@/lib/slimeArt";

/**
 * 살아있는 슬라임 — 무대(가로 전체) 위에서 몇 초마다 랜덤 행동을 한다:
 * 통통 뛰어 이동, 기지개, 갸웃, 몸 흔들기, 그리고 표정 짓기.
 *
 * 표정은 아트 이미지가 있는 것만 후보에 오른다(ART_EXPRESSIONS). 이미지를
 * 추가하면 별도 수정 없이 이 풀에 자동으로 합류한다.
 */

type Behavior =
  | { kind: "idle"; ms: number }
  | { kind: "hop"; ms: number; to: number }
  | { kind: "move"; ms: number; motion: string }
  | { kind: "expr"; ms: number; expression: ArtExpression; motion?: string };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// 가중치 행동 풀 — 여기만 고치면 성격이 바뀐다.
// 추후 상태 연동 아이디어: 밀림 있으면 cry↑, 밤 10시 이후 sleep↑, 시험 주간 surprised↑
const MOTION_POOL: { w: number; make: () => Behavior }[] = [
  { w: 34, make: () => ({ kind: "hop", ms: 1300, to: 0 }) },
  { w: 12, make: () => ({ kind: "move", ms: 1500, motion: "slime-stretch" }) },
  { w: 12, make: () => ({ kind: "move", ms: 2000, motion: "slime-wiggle" }) },
  { w: 10, make: () => ({ kind: "move", ms: 3000, motion: "slime-sway" }) },
  { w: 16, make: () => ({ kind: "idle", ms: rand(2200, 4200) }) },
];

// 표정별 연출 — 아트 이미지가 있는 것만 실제 후보가 된다.
// 'laugh'는 기본(평상시) 얼굴로 쓰이므로 풀에서 제외한다 (바뀌어도 티가 안 남).
const EXPR_POOL: { w: number; expression: ArtExpression; ms: number; motion?: string }[] = [
  { w: 8, expression: "yawn", ms: 2800, motion: "slime-stretch" },
  { w: 4, expression: "cry", ms: 2800 },
  { w: 11, expression: "sleep", ms: 4200 },
  { w: 8, expression: "wink", ms: 1600 },
  { w: 6, expression: "surprised", ms: 1400 },
  { w: 8, expression: "sing", ms: 3000, motion: "slime-sway" },
  { w: 8, expression: "proud", ms: 2400 },
  { w: 6, expression: "tired", ms: 3000 },
  { w: 4, expression: "teary", ms: 2600 },
  { w: 6, expression: "pout", ms: 2200 },
  { w: 6, expression: "think", ms: 3000 },
  { w: 7, expression: "fired", ms: 2000, motion: "slime-wiggle" },
  { w: 4, expression: "dizzy", ms: 2600, motion: "slime-sway" },
  { w: 7, expression: "eating", ms: 2800 },
  { w: 8, expression: "smirk", ms: 1800 },
  { w: 5, expression: "halo", ms: 3200 },
];

function buildPool(attr: SlimeAttr) {
  const pool = [...MOTION_POOL];
  for (const e of EXPR_POOL) {
    if (!hasArtExpression(attr, e.expression)) continue;
    pool.push({ w: e.w, make: () => ({ kind: "expr", ms: e.ms, expression: e.expression, motion: e.motion }) });
  }
  return { pool, total: pool.reduce((s, b) => s + b.w, 0) };
}

function nextBehavior(pool: ReturnType<typeof buildPool>, currentX: number): Behavior {
  let roll = Math.random() * pool.total;
  for (const entry of pool.pool) {
    roll -= entry.w;
    if (roll <= 0) {
      const b = entry.make();
      if (b.kind === "hop") {
        let to = rand(12, 88);
        if (Math.abs(to - currentX) < 22) to = currentX > 50 ? rand(12, 34) : rand(66, 88);
        return { ...b, to };
      }
      return b;
    }
  }
  return { kind: "idle", ms: 3000 };
}

export function SlimeIdle({
  attr,
  stage,
  width,
  stageHeight,
}: {
  attr: SlimeAttr;
  stage: SlimeStage;
  width: number;
  stageHeight?: number;
  /** 장비 도트는 새 아트 몸통 좌표에 맞춰 재배치 전까지 표시하지 않는다. */
  equip?: SlimeEquip;
}) {
  const [x, setX] = useState(50);
  const [motion, setMotion] = useState<string | undefined>(undefined);
  const [expression, setExpression] = useState<ArtExpression>("normal");
  const xRef = useRef(50);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const pool = buildPool(attr);

    const tick = () => {
      if (cancelled) return;
      const b = nextBehavior(pool, xRef.current);
      if (b.kind === "hop") {
        xRef.current = b.to;
        setX(b.to);
        setMotion("slime-hop");
        setExpression("normal");
        timer = setTimeout(() => {
          setMotion(undefined);
          timer = setTimeout(tick, rand(1200, 2600));
        }, b.ms);
        return;
      }
      if (b.kind === "expr") {
        setExpression(b.expression);
        setMotion(b.motion);
        timer = setTimeout(() => {
          setExpression("normal");
          setMotion(undefined);
          timer = setTimeout(tick, rand(1000, 2400));
        }, b.ms);
        return;
      }
      if (b.kind === "move") {
        setMotion(b.motion);
        timer = setTimeout(() => {
          setMotion(undefined);
          timer = setTimeout(tick, rand(1000, 2400));
        }, b.ms);
        return;
      }
      setMotion(undefined);
      timer = setTimeout(tick, b.ms);
    };

    timer = setTimeout(tick, rand(1200, 2800));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attr]);

  // 알은 이동·표정 없이 제자리 갸웃(렌더러 내장 wobble)만
  if (stage === "egg") {
    return (
      <div style={{ textAlign: "center" }}>
        <span dangerouslySetInnerHTML={{ __html: slimeSvg(attr, stage, width) }} />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: stageHeight ?? width * 1.05, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: `${x}%`,
          transform: "translateX(-50%)",
          transition: "left 1.3s ease-in-out",
        }}
      >
        <div className={motion}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="slime-art"
            src={slimeArtSrc(attr, expression)}
            alt="슬라임"
            width={slimeArtWidth(stage, width)}
            height={Math.round(slimeArtWidth(stage, width) / ART_RATIO)}
          />
        </div>
      </div>
    </div>
  );
}
