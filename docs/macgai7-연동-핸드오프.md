# 맥가이7 등원 명단 연동 — 노트북 세션 핸드오프

앱 쪽은 전부 만들어져 있다. **노트북에서 할 일은 "맥가이7 화면에서 등원 명단을
읽어오는 것" 하나뿐**이다. 브라우저(claude.ai/code) 세션에서는 외부 인터넷이
막혀 `edu.macgai7.com`에 접속조차 안 되므로 이 조각만 노트북에서 해야 한다.

## 왜 이렇게 하나

- 맥가이7은 **API를 제공하지 않는다**(업체 확인, 2026-08). 다만 자동 접속을
  금지한다고 하지도 않았다.
- 그래서 원장님 학원 계정으로 로그인해 **출결현황 > 등하원명단** 화면을 읽는다.
- 이 방식은 맥가이7이 화면을 개편하면 조용히 멈춘다. 그래서 감시 장치
  (`macgai_sync_log`)를 함께 만들어 뒀다. **반드시 같이 쓸 것.**

## 이미 되어 있는 것 (손댈 필요 없음)

| 파일 | 역할 |
|---|---|
| `supabase/migrations/0039_lecture_attendance.sql` | 강의 출결·시간 조정·동기화 로그 테이블 |
| `src/lib/lectureRules.ts` | 순수 판정 로직 (지각/미출석/조정 반영). 테스트 있음 |
| `src/lib/lectureAttendance.ts` | 기록·알림·조정·감시 |

앱은 학생마다 강의 요일·시간(`class_day`/`class_time`)을 **이미 갖고 있다**
(회원명단 엑셀의 `종주(고1정규)-일19시[고등국어]`에서 읽은 값). 그래서
"오늘 누가 와야 하는지"는 앱이 안다. 맥가이7에서 가져올 것은 **"실제로 누가
찍었는지"** 하나뿐이다.

## 노트북에서 만들 것

### 1. 스크래퍼

`src/lib/macgai7.ts` 같은 파일을 새로 만들고, 아래 모양만 맞춰 돌려주면 된다.

```ts
import type { MacgaiCheckIn } from "./lectureAttendance";

/** 오늘 등하원명단을 읽어온다. 실패하면 던진다(호출부가 로그에 남긴다). */
export async function fetchTodayCheckIns(): Promise<MacgaiCheckIn[]>;
```

`MacgaiCheckIn`은 두 칸뿐이다.

```ts
{ studentCode: "56501", checkedInTime: "22:04" }
```

- `studentCode` — 등하원명단의 **학번** 칸. 앱 `students.student_code`와 같은 5자리다.
- `checkedInTime` — **등원** 칸의 "HH:MM".

명단에 있는 다른 칸(이름·학급·전화번호)은 **가져오지 말 것.** 특히 학생·학부모
전화번호는 앱에 저장할 이유가 없다.

### 2. 조사할 것

- `edu.macgai7.com` 로그인 폼 (ASP.NET `.aspx` 기반으로 보임 — `__VIEWSTATE`
  등 숨은 필드를 같이 넘겨야 할 가능성이 높다)
- 출결현황 조회 요청의 파라미터 (기간 시작/끝, 수업종류, 학년 등)
- 세션 쿠키 유지 방식

가능하면 HTML을 파싱하지 말고 **엑셀 버튼이 부르는 요청**을 그대로 쓰는 쪽이
낫다. 화면 마크업보다 잘 안 바뀐다.

### 3. 크론

`src/app/api/cron/lecture-attendance/route.ts`를 만들어 아래 흐름으로.

```ts
try {
  const checkIns = await fetchTodayCheckIns();
  const result = await syncLectureAttendance(checkIns);
  await recordSyncRun({ ok: true, fetchedCount: checkIns.length });
} catch (e) {
  await recordSyncRun({ ok: false, error: String(e) });
}
```

호출 주기는 **10분**. Vercel Hobby는 크론이 하루 한 번뿐이라, "잊지마"처럼
`.github/workflows/`에 GitHub Actions로 만들어 부른다
(`reminder-check.yml`을 그대로 베끼면 된다). 다만 주말 강의 시간대에만 돌면
충분하니 `cron: "*/10 0-14 * * 6,0"` 정도로 좁혀도 된다(UTC 기준이라 한국
토·일 오전~밤).

### 4. 감시 알림

`isSyncStale(lastOkAt, now)`가 true면 종주T에게 푸시. 3시간 넘게 성공이 없으면
죽은 것으로 본다. 같은 크론 안에서 확인하면 된다.

## 시크릿

맥가이7 로그인 정보는 **원장님 계정 말고 조회 권한만 있는 직원 계정**을 새로
만들어 쓴다.

```
MACGAI7_ID=...
MACGAI7_PASSWORD=...
```

`.env.local` + Vercel production env + claude.ai/code "Default" 환경 **세 곳
모두**에 등록해야 한다.

## 테스트

DB 없이 판정만 확인하려면 `src/lib/lectureRules.test.ts`를 보면 된다.
실제 흐름은 `syncLectureAttendance`에 가짜 배열을 넘겨 확인할 수 있다.

```ts
await syncLectureAttendance([{ studentCode: "56501", checkedInTime: "19:03" }]);
```

로컬(`next dev`/`next start`)에서는 미출석 알림이 실제로 나가지 않고 콘솔에만
찍힌다(`isDeployedEnvironment()` 확인). 운영 DB를 그대로 보기 때문에 넣어둔
안전장치다 — **지우지 말 것.**

## 배포 순서

1. `0039_lecture_attendance.sql`을 Supabase SQL Editor에서 실행
2. 스크래퍼 + 크론 배포
3. 주말 강의 한 번 돌려보고 `macgai_sync_log`에 `ok=true`가 쌓이는지 확인
4. 그 다음에야 미출석 알림을 켠다 — 처음부터 켜면 잘못된 결석 알림이 학부모께
   나갈 수 있다
