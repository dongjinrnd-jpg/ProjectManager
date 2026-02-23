# Supabase 마이그레이션 가이드

> **상태**: 검토 중 (Google Sheets API 할당량 한계로 인한 마이그레이션 필요)
> **작성일**: 2026-02-23
> **우선순위**: 높음 (Quota exceeded 에러 빈번 발생)

---

## 1. 마이그레이션 배경

### 현재 문제점
- Google Sheets API 제한: **분당 60회/유저**
- 카드 연결 없이 할당량 증가 불가
- 프로젝트 상세 페이지 접근 시 Quota exceeded 에러 빈번 발생
- 데이터 증가 시 성능 저하 예상 (전체 데이터 로드 후 필터링)

### 적용된 임시 최적화
- 프로젝트 상세 통합 API (`/api/projects/[id]/detail`)
- 사용자/프로젝트 목록 캐싱 (5분 TTL)
- 업무일지 기본 필터 (오늘만)
- API 순차 실행 (150ms 간격)

---

## 2. Supabase 선택 이유

| 항목 | Google Sheets | Supabase |
|------|---------------|----------|
| 무료 티어 | 분당 60회 제한 | 50,000행, 500MB |
| 쿼리 | 전체 로드 후 필터링 | SQL WHERE 절 |
| 속도 | 느림 (API 호출) | 빠름 (직접 쿼리) |
| 확장성 | 제한적 | 무제한 (유료) |
| 파일 저장 | 불가 (Service Account) | Storage 지원 |

---

## 3. 현재 아키텍처

```
클라이언트 (React)
    ↓ fetch
API Routes (/api/*)
    ↓ 호출
src/lib/google/sheets.ts  ← 이 부분만 교체
    ↓
Google Sheets
```

---

## 4. 변경 범위

### 4.1 변경되는 파일

#### 새로 생성
```
src/lib/supabase/
├── client.ts        # Supabase 클라이언트
├── db.ts            # CRUD 함수 (sheets.ts 대체)
└── types.ts         # DB 타입 정의
```

#### 수정 필요
```
src/app/api/
├── projects/route.ts
├── projects/[id]/route.ts
├── projects/[id]/detail/route.ts
├── worklogs/route.ts
├── worklogs/[id]/route.ts
├── schedules/route.ts
├── schedules/[id]/route.ts
├── users/route.ts
├── users/[id]/route.ts
├── favorites/route.ts
├── comments/route.ts
├── meeting-minutes/route.ts
├── weekly-reports/route.ts
├── dashboard/route.ts
├── search/route.ts
├── settings/route.ts
├── master/customers/route.ts
├── master/models/route.ts
└── export/*.ts
```

### 4.2 변경 안 되는 파일
- `src/app/**/*Client.tsx` - 클라이언트 컴포넌트 전체
- `src/components/**/*` - 모든 컴포넌트
- `src/types/**/*` - 타입 정의 (일부 조정 가능)

---

## 5. 데이터베이스 스키마

### 5.1 테이블 생성 SQL

```sql
-- Users 테이블
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'engineer',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects 테이블
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  item TEXT NOT NULL,
  customer TEXT NOT NULL,
  part_no TEXT,
  division TEXT,
  category TEXT,
  status TEXT DEFAULT '진행중',
  current_stage TEXT,
  stages TEXT[], -- 배열로 저장
  team_leader_id TEXT REFERENCES users(id),
  team_members TEXT[], -- 배열로 저장
  schedule_start DATE,
  schedule_end DATE,
  progress TEXT,
  issues TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WorkLogs 테이블
CREATE TABLE worklogs (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  project_id TEXT REFERENCES projects(id),
  item TEXT,
  customer TEXT,
  stage TEXT,
  assignee_id TEXT REFERENCES users(id),
  participants TEXT[],
  plan TEXT,
  content TEXT NOT NULL,
  issue TEXT,
  issue_status TEXT DEFAULT 'none',
  issue_resolved_at TIMESTAMPTZ,
  schedule_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ProjectSchedules 테이블
CREATE TABLE project_schedules (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  stage TEXT,
  task_name TEXT NOT NULL,
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,
  responsibility TEXT,
  category TEXT,
  status TEXT DEFAULT 'planned',
  note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Favorites 테이블
CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- Comments 테이블 (경영진 코멘트)
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  user_id TEXT REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MeetingMinutes 테이블
CREATE TABLE meeting_minutes (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  participants TEXT[],
  content TEXT NOT NULL,
  decisions TEXT,
  action_items TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WeeklyReports 테이블
CREATE TABLE weekly_reports (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  title TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, week)
);

-- Settings 테이블
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers 마스터
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Models 마스터
CREATE TABLE models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_worklogs_project ON worklogs(project_id);
CREATE INDEX idx_worklogs_date ON worklogs(date);
CREATE INDEX idx_worklogs_assignee ON worklogs(assignee_id);
CREATE INDEX idx_schedules_project ON project_schedules(project_id);
CREATE INDEX idx_comments_project ON comments(project_id);
CREATE INDEX idx_favorites_user ON favorites(user_id);
```

---

## 6. 코드 변경 예시

### 6.1 Supabase 클라이언트 (`src/lib/supabase/client.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### 6.2 CRUD 함수 비교

#### 현재 (Google Sheets)
```typescript
// 전체 조회
const users = await getAllAsObjects<User>(SHEET_NAMES.USERS);

// 조건 조회
const result = await findRowByColumn<Project>(
  SHEET_NAMES.PROJECTS, 'id', projectId
);

// 생성
await appendRow(SHEET_NAMES.WORKLOGS, rowValues);

// 수정
await updateRow(SHEET_NAMES.PROJECTS, rowIndex, rowValues);

// 삭제
await deleteRow(SHEET_NAMES.WORKLOGS, rowIndex);
```

#### Supabase 변경 후
```typescript
// 전체 조회
const { data: users } = await supabase
  .from('users')
  .select('*')
  .eq('is_active', true);

// 조건 조회
const { data: project } = await supabase
  .from('projects')
  .select('*')
  .eq('id', projectId)
  .single();

// 생성
await supabase.from('worklogs').insert(newWorklog);

// 수정
await supabase
  .from('projects')
  .update(updatedData)
  .eq('id', projectId);

// 삭제
await supabase.from('worklogs').delete().eq('id', worklogId);
```

### 6.3 필터링 비교

#### 현재 (메모리에서 필터링)
```typescript
const allWorklogs = await getAllAsObjects<WorkLog>(SHEET_NAMES.WORKLOGS);
const filtered = allWorklogs.filter(w =>
  w.projectId === projectId &&
  w.date >= startDate
);
```

#### Supabase (쿼리 레벨 필터링)
```typescript
const { data: worklogs } = await supabase
  .from('worklogs')
  .select('*')
  .eq('project_id', projectId)
  .gte('date', startDate)
  .order('date', { ascending: false });
```

---

## 7. 마이그레이션 단계

### Phase 1: 준비 (1일)
- [ ] Supabase 프로젝트 생성
- [ ] 테이블 생성 (위 SQL 실행)
- [ ] 환경 변수 설정

### Phase 2: 데이터 이전 (0.5일)
- [ ] Google Sheets → CSV 내보내기
- [ ] CSV → Supabase 가져오기
- [ ] 데이터 무결성 검증

### Phase 3: 코드 수정 (1~2일)
- [ ] `src/lib/supabase/` 생성
- [ ] API Routes 수정 (약 20개)
- [ ] 테스트

### Phase 4: 배포 (0.5일)
- [ ] Vercel 환경 변수 설정
- [ ] 배포 및 검증
- [ ] Google Sheets 연동 코드 제거

---

## 8. 환경 변수

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx...

# 기존 Google 관련 환경변수는 제거
# GOOGLE_SERVICE_ACCOUNT_EMAIL (삭제)
# GOOGLE_PRIVATE_KEY (삭제)
# GOOGLE_SPREADSHEET_ID (삭제)
```

---

## 9. 예상 효과

| 항목 | 현재 | 마이그레이션 후 |
|------|------|----------------|
| API 제한 | 분당 60회 | 무제한 |
| 응답 속도 | 1~3초 | 0.1~0.5초 |
| 필터링 | 메모리 | DB 쿼리 |
| 파일 저장 | 불가 | Storage 사용 가능 |
| 확장성 | 제한적 | 무제한 |

---

## 10. 롤백 계획

마이그레이션 실패 시:
1. Vercel 환경 변수를 Google Sheets로 복원
2. 이전 커밋으로 롤백
3. Google Sheets 데이터 확인

---

## 11. 참고 자료

- [Supabase 공식 문서](https://supabase.com/docs)
- [Next.js + Supabase 가이드](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Supabase JavaScript 클라이언트](https://supabase.com/docs/reference/javascript/introduction)
