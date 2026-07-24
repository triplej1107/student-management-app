# 유종의미 국어학원 학생관리 앱

Next.js(App Router) + Supabase(Postgres) 기반 학생관리 웹앱(PWA). 4개 역할(학생/학부모/조교/종주T)이 폰 폭 UI를 공유합니다.

## 처음 설정하기

### 1. Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다.
2. **Project Settings → API**에서 **Project URL**과 **service_role key**(anon key 아님, 반드시 service_role)를 복사합니다.
3. **SQL Editor**를 열고 [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), 이어서 [`supabase/migrations/0002_clinic_approvals.sql`](supabase/migrations/0002_clinic_approvals.sql) 내용을 순서대로 붙여넣어 실행합니다.

### 2. 환경변수 설정

`.env.local.example`을 참고해 `.env.local`을 채웁니다 (이미 `SESSION_SECRET`은 생성되어 있습니다):

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PASSWORD=...   # 종주T 로그인 비밀번호 (원하는 값으로 설정)
```

### 3. 초기 데이터 심기

```bash
npm run seed
```

업무 체크리스트 24개 항목과 종주T 비밀번호 해시가 DB에 들어갑니다. 학생 명단은 아직 없는 상태입니다 — 종주T로 로그인해서 **학생 관리 → 학생 개별 관리 → "+ 학생 추가"**로 직접 추가하면 됩니다.

**바로 테스트하고 싶다면** 핸드오프에 포함된 실제 익명화 샘플 명단을 한 번에 넣을 수 있습니다:

```bash
npm run seed:students
```

### 4. 실행

```bash
npm run dev
```

## 배포 (Vercel)

1. [vercel.com](https://vercel.com)에서 이 저장소(또는 `student-management-app` 폴더)를 새 프로젝트로 가져옵니다.
2. `.env.local`의 모든 값을 Vercel **Environment Variables**에 동일하게 등록합니다.
3. 배포 후 접속 URL을 학생/학부모/조교에게 공유하면, 브라우저에서 "홈 화면에 추가"로 앱처럼 설치할 수 있습니다(PWA).

## 학생 명단 관리

외부 시스템(구글 시트 등) 연동 없이 앱 안에서 전체 명단을 관리합니다.

- **명단 관리** 탭 — 전체 학생 목록(검색/필터), 여러 명 선택 후 일괄 삭제·반 배정 변경·재원상태 변경, 엑셀/구글시트에서 복사한 내용을 붙여넣는 일괄 등록(이미 있는 학번은 정보 갱신, 새 학번은 신규 추가 — 붙여넣은 칸이 비어있으면 기존 값은 그대로 유지됩니다).
- **학생 개별 관리** 탭 — 학생 한 명을 검색해서 전체 정보(연락처/학교/수업·클리닉 시간 등)를 상세히 입력·수정하거나, 성적/교재/학생상태 같은 앱 전용 정보를 편집. "+ 학생 추가"로 새 학생 한 명을 상세 정보까지 한 번에 등록할 수도 있습니다.

## 클리닉 결재 흐름

조교가 숙제검사를 체크하고 **조교 결재**에 체크하면(누가 결재했는지 이름이 함께 기록됩니다), 종주T가 **학생 관리 → 결재 관리** 탭에서 요일별로 그 학생들을 확인하고 **종주T 최종 결재**를 체크합니다. 종주T 홈 화면에서 오늘 결재 대기 중인 학생 수와, 조교별 업무 체크리스트 진행 현황을 한눈에 볼 수 있습니다.

## 구조

- `src/app` — 라우트 (역할선택 → 로그인 → `/student`, `/staff`, `/admin`)
- `src/lib/data.ts` — 모든 DB 읽기/쓰기 함수
- `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/authz.ts` — 로그인 검증 / 세션 쿠키 / 역할별 접근 제어
- `supabase/migrations/0001_init.sql` — DB 스키마
- `scripts/seed.mjs` — 업무 체크리스트 + 종주T 비밀번호 초기 데이터
- `scripts/seed-students.mjs` — (선택) 핸드오프의 익명화 샘플 명단을 바로 넣는 테스트용 스크립트
