"use client";

import { useEffect, useRef, useState } from "react";
import { slimeSvg, type SlimeAttr, type SlimeEquip, type SlimeStage } from "@/lib/slimeSprite";
import { slimeArtSrc, slimeArtWidth, ART_RATIO } from "@/lib/slimeArt";

/**
 * 살아있는 슬라임 — 무대(가로 전체) 위에서 몇 초마다 랜덤 행동을 한다:
 * 통통 뛰어 이동, 기지개, 갸웃, 몸 흔들기. 알은 갸웃거리기만.
 *
 * 몸통이 확정 아트 이미지로 바뀌면서 표정 교체는 빠졌다(이미지 얼굴 고정).
 * 표정을 되살리려면 속성×표정 이미지가 더 필요하다.
 */

type Behavior =
  | { kind: "idle"; ms: number }
  | { kind: "hop"; ms: number; to: number }
  | { kind: "move"; ms: number; motion: string };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// 가중치 행동 풀 — 여기만 고치면 성격이 바뀐다.
// 추후 상태 연동 아이디어: 밀림 있으면 cry↑, 밤 10시 이후 sleep↑, 시험 주간 surprised↑
const POOL: { w: number; make: () => Behavior }[] = [
  { w: 34, make: () => ({ kind: "hop", ms: 1300, to: 0 }) },
  { w: 16, make: () => ({ kind: "move", ms: 1500, motion: "slime-stretch" }) },
  { w: 16, make: () => ({ kind: "move", ms: 2000, motion: "slime-wiggle" }) },
  { w: 14, make: () => ({ kind: "move", ms: 3000, motion: "slime-sway" }) },
  { w: 20, make: () => ({ kind: "idle", ms: rand(2200, 4200) }) },
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
        timer = setTimeout(() => {
          setMotion(undefined);
          timer = setTimeout(tick, rand(1200, 2600));
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="slime-art"
            src={slimeArtSrc(attr)}
            alt="슬라임"
            width={slimeArtWidth(stage, width)}
            height={Math.round(slimeArtWidth(stage, width) / ART_RATIO)}
          />
        </div>
      </div>
    </div>
  );
}
