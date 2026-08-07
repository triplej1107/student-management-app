/**
 * 사용 안내서(설명서)를 고칠 때마다 이 값을 바꾼다.
 *
 * 값이 바뀌면 첫 화면 로고와 프로필의 안내서 버튼에 **파란 점**이 다시 뜨고,
 * 안내서를 한 번 열면 사라진다. 안내서를 고쳐놓고 이 값을 안 바꾸면 아무도
 * 새로 고쳐진 걸 모른다 — public/guide/*.html 을 손대면 여기도 같이 바꿀 것.
 *
 * 날짜만 쓰면 같은 날 두 번 고쳤을 때 구분이 안 되므로 뒤에 무엇을 고쳤는지
 * 붙인다. 형식은 자유고, 값이 **달라지기만** 하면 된다.
 */
export const GUIDE_VERSION = "2026-08-07-강의출결";

/** 마지막으로 읽은 안내서 버전을 담아두는 localStorage 키. */
export const GUIDE_SEEN_KEY = "guideSeenVersion";

/**
 * 파란 점을 띄워야 하는지.
 *
 * 한 번도 연 적 없으면(null) 띄운다 — 새로 온 학생·학부모에게도 "여기 안내서가
 * 있다"고 알려주는 편이 낫다.
 */
export function isGuideUnread(seen: string | null): boolean {
  return seen !== GUIDE_VERSION;
}
