-- ============================================
-- Supabase Schema for ProjectManager
-- 21 tables (Google Sheets → PostgreSQL)
-- Created: 2026-03-27
-- ============================================

-- 컨벤션: snake_case (PostgreSQL 표준)
-- 기존 TypeScript camelCase → 추상화 레이어에서 변환

-- ============================================
-- 1. Users (사용자)
-- ============================================
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- 로그인 ID (예: admin001)
  password TEXT NOT NULL,                 -- bcrypt 해시
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'engineer',  -- sysadmin|executive|admin|engineer|user
  division TEXT NOT NULL DEFAULT '기타',  -- 전장|유압|기타
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Customers (고객사 마스터)
-- ============================================
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Models (모델 마스터)
-- ============================================
CREATE TABLE models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. ReportCategories (주간보고 구분 마스터)
-- ============================================
CREATE TABLE report_categories (
  id TEXT PRIMARY KEY,                    -- CAT-001
  name TEXT NOT NULL,                     -- 농기|중공업|해외|기타
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- ============================================
-- 5. Settings (시스템 설정)
-- ============================================
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,                             -- JSON 직렬화
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. Projects (프로젝트)
-- ============================================
CREATE TABLE projects (
  id TEXT PRIMARY KEY,                    -- PRJ-2026-001
  status TEXT DEFAULT '진행중',           -- 진행중|보류|완료
  customer TEXT NOT NULL,
  division TEXT,                          -- 전장|유압|기타
  category TEXT,                          -- 농기|중공업|해외|기타
  model TEXT,
  item TEXT NOT NULL,
  part_no TEXT,
  team_leader_id TEXT REFERENCES users(id),
  team_members TEXT,                      -- 쉼표 구분 ID 목록
  current_stage TEXT,                     -- 현재 단계
  stages TEXT,                            -- 쉼표 구분 단계 목록
  progress TEXT,                          -- 업무진행사항
  issues TEXT,                            -- 이슈사항
  schedule_start TEXT,                    -- YYYY-MM-DD
  schedule_end TEXT,                      -- YYYY-MM-DD
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. ProjectHistory (프로젝트 변경 이력)
-- ============================================
CREATE TABLE project_history (
  id TEXT PRIMARY KEY,                    -- PH-001
  project_id TEXT REFERENCES projects(id),
  changed_field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by_id TEXT REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. ProjectSchedules (세부추진항목)
-- ============================================
CREATE TABLE project_schedules (
  id TEXT PRIMARY KEY,                    -- PS-001
  project_id TEXT REFERENCES projects(id),
  stage TEXT,
  task_name TEXT NOT NULL,
  category TEXT,                          -- 영업|생산|구매|품질|설계
  responsibility TEXT,                    -- lead|support
  assignee_id TEXT REFERENCES users(id),
  planned_start TEXT,                     -- YYYY-MM-DD
  planned_end TEXT,                       -- YYYY-MM-DD
  actual_start TEXT,
  actual_end TEXT,
  status TEXT DEFAULT 'planned',          -- planned|in_progress|completed|delayed
  note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. WorkLogs (업무일지)
-- ============================================
CREATE TABLE worklogs (
  id TEXT PRIMARY KEY,                    -- WL-20260202-001
  date TEXT NOT NULL,                     -- YYYY-MM-DD
  project_id TEXT REFERENCES projects(id),
  item TEXT,
  customer TEXT,
  stage TEXT,
  assignee_id TEXT REFERENCES users(id),
  participants TEXT,                      -- 쉼표 구분 ID 목록
  plan TEXT,
  content TEXT NOT NULL,
  issue TEXT,
  issue_status TEXT,                      -- open|resolved
  issue_resolved_at TEXT,
  schedule_id TEXT,                       -- FK → project_schedules.id
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. WorklogComments (업무일지 댓글)
-- ============================================
CREATE TABLE worklog_comments (
  id TEXT PRIMARY KEY,                    -- WLC-00001
  worklog_id TEXT REFERENCES worklogs(id),
  author_id TEXT REFERENCES users(id),
  author_name TEXT,                       -- 비정규화
  parent_id TEXT,                         -- 답글용 (self FK)
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. Favorites (즐겨찾기)
-- ============================================
CREATE TABLE favorites (
  id TEXT PRIMARY KEY,                    -- FAV-001
  user_id TEXT REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- ============================================
-- 12. Comments (경영진 코멘트)
-- ============================================
CREATE TABLE comments (
  id TEXT PRIMARY KEY,                    -- CMT-001
  project_id TEXT REFERENCES projects(id),
  author_id TEXT REFERENCES users(id),
  parent_id TEXT,                         -- 답글용
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 13. MeetingMinutes (회의록 메타데이터)
-- ============================================
CREATE TABLE meeting_minutes (
  id TEXT PRIMARY KEY,                    -- MTG-001
  project_id TEXT REFERENCES projects(id),
  title TEXT NOT NULL,
  host_department TEXT,
  location TEXT,
  meeting_date TEXT,                      -- YYYY-MM-DD HH:MM
  attendees_json TEXT,                    -- JSON 직렬화
  agenda TEXT,
  discussion TEXT,
  decisions TEXT,
  next_steps TEXT,
  created_by_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 14. WeeklyReports (주간보고)
-- ============================================
CREATE TABLE weekly_reports (
  id TEXT PRIMARY KEY,                    -- WR-2026-02-1-001
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week INTEGER NOT NULL,
  week_start TEXT,                        -- YYYY-MM-DD
  week_end TEXT,                          -- YYYY-MM-DD
  category_id TEXT,                       -- FK → report_categories.id
  customer TEXT,
  item TEXT,
  project_id TEXT REFERENCES projects(id),
  content TEXT,
  sort_order INTEGER DEFAULT 0,
  created_by_id TEXT REFERENCES users(id),
  is_deleted BOOLEAN DEFAULT false,
  is_included BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 15. WeeklyReportNotices (주간보고 공지)
-- ============================================
CREATE TABLE weekly_report_notices (
  id TEXT PRIMARY KEY,                    -- WRN-2026-02-1
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week INTEGER NOT NULL,
  content TEXT,
  created_by_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 16. WeeklyReportSummary (주간보고 요약)
-- ============================================
CREATE TABLE weekly_report_summary (
  id TEXT PRIMARY KEY,                    -- WRS-2026-02-1
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week INTEGER NOT NULL,
  content TEXT,
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 17. Attachments (첨부파일 - 미사용 예약)
-- ============================================
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  entity_type TEXT,                       -- project|worklog|meeting
  entity_id TEXT,
  file_name TEXT,
  file_url TEXT,
  file_size INTEGER,
  uploaded_by_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 18. SavedSearches (저장된 검색 조건)
-- ============================================
CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,                    -- SS-001
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  filters_json TEXT,                      -- JSON 직렬화
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 19. Improvements (개선요청)
-- ============================================
CREATE TABLE improvements (
  id TEXT PRIMARY KEY,                    -- IMP-001
  title TEXT NOT NULL,
  type TEXT NOT NULL,                     -- bug|improvement|feature|other
  status TEXT DEFAULT 'submitted',        -- submitted|reviewing|in_progress|completed|hold|rejected
  priority TEXT DEFAULT 'normal',         -- urgent|high|normal|low
  content TEXT NOT NULL,
  related_menu TEXT,                      -- dashboard|projects|worklogs|weekly|schedules|search|settings|other
  reproduction_steps TEXT,
  screenshot_url TEXT,
  author_id TEXT REFERENCES users(id),
  author_name TEXT,                       -- 비정규화
  due_date TEXT,
  completed_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 20. ImprovementHistories (개선요청 처리이력)
-- ============================================
CREATE TABLE improvement_histories (
  id TEXT PRIMARY KEY,
  improvement_id TEXT REFERENCES improvements(id),
  status TEXT NOT NULL,
  memo TEXT,
  changed_by TEXT REFERENCES users(id),
  changed_by_name TEXT,                   -- 비정규화
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 21. ImprovementComments (개선요청 댓글)
-- ============================================
CREATE TABLE improvement_comments (
  id TEXT PRIMARY KEY,
  improvement_id TEXT REFERENCES improvements(id),
  content TEXT NOT NULL,
  author_id TEXT REFERENCES users(id),
  author_name TEXT,                       -- 비정규화
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 인덱스
-- ============================================

-- Projects
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_customer ON projects(customer);
CREATE INDEX idx_projects_team_leader ON projects(team_leader_id);

-- ProjectHistory
CREATE INDEX idx_project_history_project ON project_history(project_id);

-- ProjectSchedules
CREATE INDEX idx_schedules_project ON project_schedules(project_id);
CREATE INDEX idx_schedules_assignee ON project_schedules(assignee_id);

-- WorkLogs
CREATE INDEX idx_worklogs_project ON worklogs(project_id);
CREATE INDEX idx_worklogs_date ON worklogs(date);
CREATE INDEX idx_worklogs_assignee ON worklogs(assignee_id);

-- WorklogComments
CREATE INDEX idx_worklog_comments_worklog ON worklog_comments(worklog_id);

-- Favorites
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_user_project ON favorites(user_id, project_id);

-- Comments
CREATE INDEX idx_comments_project ON comments(project_id);

-- MeetingMinutes
CREATE INDEX idx_meeting_minutes_project ON meeting_minutes(project_id);

-- WeeklyReports
CREATE INDEX idx_weekly_reports_period ON weekly_reports(year, month, week);
CREATE INDEX idx_weekly_reports_creator ON weekly_reports(created_by_id);

-- SavedSearches
CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);

-- Improvements
CREATE INDEX idx_improvements_status ON improvements(status);
CREATE INDEX idx_improvements_author ON improvements(author_id);

-- ImprovementHistories
CREATE INDEX idx_improvement_histories_improvement ON improvement_histories(improvement_id);

-- ImprovementComments
CREATE INDEX idx_improvement_comments_improvement ON improvement_comments(improvement_id);
