/** 성실도 티어 배지의 아이콘/색 — 서버(ujcTier.ts)와 무관한 표시용 값만
 * 모아둔다. 클라이언트 컴포넌트에서도 import할 수 있어야 해서 별도 파일이다
 * (ujcTier.ts는 "server-only"를 임포트한다).
 *
 * 등급 문자열을 키로 쓰는 이유는 UjcWalletCard가 예전부터 그렇게 해왔고,
 * TierGrade 타입을 가져오려면 server-only 모듈에 손이 닿기 때문. */

export const TIER_ICON: Record<string, string> = {
  그랜드마스터: "🏆",
  마스터: "👑",
  다이아: "💎",
  플래티넘: "💠",
  골드: "🥇",
  실버: "🥈",
  브론즈: "🥉",
};

export const TIER_STYLE: Record<string, string> = {
  그랜드마스터: "bg-[#FFF3D6] text-[#B76E00]",
  마스터: "bg-[#F0E7FF] text-[#7B3FE4]",
  다이아: "bg-[#E0F7FB] text-[#0E8AA8]",
  플래티넘: "bg-[#E5F3F5] text-[#3E7C8A]",
  골드: "bg-[#FFF6DD] text-[#B8860B]",
  실버: "bg-[#F1F2F4] text-[#6B7280]",
  브론즈: "bg-[#F5E6DA] text-[#9A5B32]",
};
