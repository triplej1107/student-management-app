"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "unsupported" | "default" | "subscribing" | "granted" | "denied";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** 로그인 시 뜨는 알림 켜기 유도 모달 — 이미 켜져 있거나(granted) 이 기기가
 * 지원 안 하거나(unsupported) 이미 거부했으면(denied) 아무것도 안 띄우고
 * 바로 onDone()을 호출해 다음 모달로 넘어간다. 아직 켜지 않았으면(default)
 * 켤 때까지 로그인할 때마다 다시 뜬다 — 세션에 "봤음" 상태를 저장하지 않음. */
export function PushOptInModal({
  onDone,
  bodyText = "클리닉 숙제가 밀리면 알림으로 알려드려요.",
}: {
  onDone: () => void;
  bodyText?: string;
}) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    // 아이폰 미설치 상태에서는 웹푸시 자체가 불가능(애플 제약) — InstallPromptModal이
    // 먼저 설치를 안내하므로 여기서는 조용히 다음 모달로 넘어간다.
    if (isIOS && !isStandalone) {
      onDone();
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported");
      onDone();
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      onDone();
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) {
          setStatus("granted");
          onDone();
        } else {
          setStatus("default");
        }
      })
      .catch(() => setStatus("default"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subscribe() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setStatus("unsupported");
      onDone();
      return;
    }
    setStatus("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        onDone();
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setStatus("granted");
      onDone();
    } catch {
      onDone();
    }
  }

  if (status === "checking" || status === "unsupported" || status === "granted" || status === "denied") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <div className="text-base font-extrabold text-ink">🔔 알림을 켜두면 더 편해요</div>
        <div className="mt-1.5 text-sm text-ink-secondary">{bodyText}</div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onDone}
            disabled={status === "subscribing"}
            className="flex-1 rounded-xl border border-line bg-white py-2.5 text-sm font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
          >
            나중에
          </button>
          <button
            onClick={subscribe}
            disabled={status === "subscribing"}
            className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
          >
            {status === "subscribing" ? "설정 중..." : "알림 켜기"}
          </button>
        </div>
      </div>
    </div>
  );
}
