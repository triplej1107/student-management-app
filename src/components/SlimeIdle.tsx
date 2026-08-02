"use client";

import { useEffect, useRef, useState } from "react";
import { slimeSvg, type SlimeAttr, type SlimeEquip, type SlimeExpression, type SlimeStage } from "@/lib/slimeSprite";

/**
 * 살아있는 슬라임 — 무대(가로 전체) 위에서 몇 초마다 랜덤 행동을 한다:
 * 통통 뛰어 이동, 웃기, 하품, 훌쩍이기, 졸기. 알은 갸웃거리기만.
 *
 * 행동 가중치는 BEHAVIORS에서 조정. 추후 상태 연동(밀림 있으면 울기,
 * 밤 시간엔 졸기 확률 증가 등)을 여기서 확장하면 된다.
 */

type Behavior =
  | { kind: "idle"; ms: number }
  | { kind: "hop"; ms: number; to: number }
  | { kind: "expr"; ms: number; expression: SlimeExpression; motion?: string };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// 가중치 행동 풀 — 여기만 고치면 성격이 바뀐다.
// 추후 상태 연동 아이디어: 밀림 있으면 cry↑, 밤 10시 이후 sleep↑, 시험 주간 surprised↑
const POOL: { w: number; make: () => Behavior }[] = [
  { w: 26, make: () => ({ kind: "hop", ms: 1300, to: 0 }) },
  { w: 10, make: () => ({ kind: "expr", ms: 2400, expression: "laugh" }) },
  { w: 8, make: () => ({ kind: "expr", ms: 2800, expression: "yawn", motion: "slime-stretch" }) },
  { w: 5, make: () => ({ kind: "expr", ms: 2800, expression: "cry" }) },
  { w: 12, make: () => ({ kind: "expr", ms: 4200, expression: "sleep" }) },
  { w: 8, make: () => ({ kind: "expr", ms: 1600, expression: "wink" }) },
  { w: 6, make: () => ({ kind: "expr", ms: 1300, expression: "surprised" }) },
  { w: 7, make: () => ({ kind: "expr", ms: 2600, expression: "love" }) },
  { w: 8, make: () => ({ kind: "expr", ms: 3000, expression: "sing", motion: "slime-sway" }) },
  { w: 5, make: () => ({ kind: "expr", ms: 2000, expression: "normal", motion: "slime-wiggle" }) },
  { w: 5, make: () => ({ kind: "idle", ms: rand(2200, 4200) }) },
];
const POOL_TOTAL = POOL.reduce((sum, b) => sum + b.w, 0);

function nextBehavior(currentX: number): Behavior {
  let roll = Math.random() * POOL_TOTAL;
  for (const entry of POOL) {
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
  equip,
}: {
  attr: SlimeAttr;
  stage: SlimeStage;
  width: number;
  stageHeight?: number;
  equip?: SlimeEquip;
}) {
  const [x, setX] = useState(50);
  const [motion, setMotion] = useState<string | undefined>(undefined);
  const [expression, setExpression] = useState<SlimeExpression>("normal");
  const xRef = useRef(50);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const b = nextBehavior(xRef.current);
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
      setExpression("normal");
      setMotion(undefined);
      timer = setTimeout(tick, b.ms);
    };

    timer = setTimeout(tick, rand(1200, 2800));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

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
          <span dangerouslySetInnerHTML={{ __html: slimeSvg(attr, stage, width, expression, equip ?? {}) }} />
        </div>
      </div>
    </div>
  );
}
