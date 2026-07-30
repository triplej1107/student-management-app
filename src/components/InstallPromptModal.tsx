"use client";

import { useEffect, useState } from "react";

type Kind = "checking" | "in-app-browser" | "android" | "ios" | "none";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectInAppBrowser(ua: string): string | null {
  if (/KAKAOTALK/i.test(ua)) return "카카오톡";
  if (/NAVER\(/i.test(ua)) return "네이버 앱";
  if (/Instagram/i.test(ua)) return "인스타그램";
  if (/FBAN|FBAV/i.test(ua)) return "페이스북";
  if (/Line\//i.test(ua)) return "라인";
  return null;
}

/** 로그인 시 뜨는 홈 화면 설치 유도 모달 — 이미 설치돼 있으면(standalone)
 * 바로 넘어간다. 기기별로 다르게 안내한다:
 * - 카카오톡 등 인앱 브라우저: 설치 자체가 불가능하니 "다른 브라우저로 열기" 안내
 * - 안드로이드: beforeinstallprompt로 원터치 설치 버튼
 * - 아이폰: 공유 → 홈 화면에 추가 안내(애플이 자동 설치를 막아놔서 이게 최선)
 * beforeinstallprompt가 안 뜨거나(조건 미충족) 데스크톱이면 조용히 넘어간다. */
export function InstallPromptModal({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<Kind>("checking");
  const [inAppName, setInAppName] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      onDone();
      return;
    }

    const ua = navigator.userAgent;
    const inApp = detectInAppBrowser(ua);
    if (inApp) {
      setInAppName(inApp);
      setKind("in-app-browser");
      return;
    }

    if (/iphone|ipad|ipod/i.test(ua)) {
      setKind("ios");
      return;
    }

    if (!/android/i.test(ua)) {
      onDone(); // 데스크톱 등 — 설치 유도 안 함
      return;
    }

    let resolved = false;
    function handler(e: Event) {
      e.preventDefault();
      resolved = true;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setKind("android");
    }
    window.addEventListener("beforeinstallprompt", handler);
    const timer = setTimeout(() => {
      if (!resolved) onDone(); // 설치 가능 조건 미충족 등 — 조용히 넘어감
    }, 2000);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    onDone();
  }

  if (kind === "checking" || kind === "none") return null;

  if (kind === "in-app-browser") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <div className="text-base font-extrabold text-ink">{inAppName} 안에서는 설치할 수 없어요</div>
          <div className="mt-1.5 text-sm text-ink-secondary">
            우측 상단(또는 하단) 메뉴에서 <b>&ldquo;다른 브라우저로 열기&rdquo;</b>를 선택해서 열어주시면
            앱을 설치할 수 있어요.
          </div>
          <button
            onClick={onDone}
            className="mt-4 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  if (kind === "ios") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/40 px-6 pb-8">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <div className="text-base font-extrabold text-ink">📲 홈 화면에 추가하면 더 편해요</div>
          <div className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
            아래 <b>공유</b> 버튼을 누르고
            <br />
            <b>&ldquo;홈 화면에 추가&rdquo;</b>를 선택해주세요
          </div>
          <div className="mt-2 animate-bounce text-2xl">⬇️</div>
          <button
            onClick={onDone}
            className="mt-3 w-full rounded-xl border border-line bg-white py-2.5 text-sm font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          >
            나중에
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <div className="text-base font-extrabold text-ink">📲 앱을 홈 화면에 설치할까요?</div>
        <div className="mt-1.5 text-sm text-ink-secondary">
          한 번만 설치하면 앱처럼 바로 열 수 있고, 알림도 받을 수 있어요.
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onDone}
            disabled={installing}
            className="flex-1 rounded-xl border border-line bg-white py-2.5 text-sm font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
          >
            나중에
          </button>
          <button
            onClick={install}
            disabled={installing}
            className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
          >
            설치하기
          </button>
        </div>
      </div>
    </div>
  );
}
