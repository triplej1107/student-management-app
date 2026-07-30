"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "unsupported" | "ios-needs-install" | "default" | "subscribing" | "granted" | "denied";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** 클리닉 1주 밀림 자동 웹 푸시 구독 배너 — 학생 계정에서만 노출한다.
 * 아이폰 Safari는 홈 화면에 추가(PWA 설치) 상태가 아니면 애초에 푸시
 * 구독 자체가 불가능해서 안내 문구만 보여준다. */
export function PushSubscribeBanner() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      if (isIOS && !isStandalone) {
        setStatus("ios-needs-install");
      } else {
        setStatus("unsupported");
      }
      return;
    }
    if (isIOS && !isStandalone) {
      setStatus("ios-needs-install");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "granted" : "default"))
      .catch(() => setStatus("default"));
  }, []);

  async function subscribe() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setStatus("unsupported");
      return;
    }
    setStatus("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "default");
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
    } catch {
      setStatus("default");
    }
  }

  if (status === "checking" || status === "unsupported" || status === "granted") return null;

  if (status === "ios-needs-install") {
    return (
      <div className="mt-3 rounded-2xl border border-line-soft bg-white p-3.5 text-xs text-ink-secondary">
        📱 아이폰에서 클리닉 밀림 알림을 받으려면 Safari 공유 버튼 → &ldquo;홈 화면에 추가&rdquo;로 앱을 설치해주세요.
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="mt-3 rounded-2xl border border-line-soft bg-white p-3.5 text-xs text-ink-muted">
        알림이 꺼져 있어요. 기기 설정에서 이 사이트의 알림을 허용하면 다시 받을 수 있어요.
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center justify-between rounded-2xl border border-accent/30 bg-accent-soft p-3.5">
      <div className="text-xs font-semibold text-ink">클리닉 숙제가 밀리면 알림으로 알려드려요</div>
      <button
        onClick={subscribe}
        disabled={status === "subscribing"}
        className="rounded-full bg-accent px-3.5 py-2 text-xs font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
      >
        {status === "subscribing" ? "설정 중..." : "알림 켜기"}
      </button>
    </div>
  );
}
