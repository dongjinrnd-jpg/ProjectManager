/**
 * Google Sheets → Supabase 데이터 마이그레이션 스크립트
 *
 * 실행: npx tsx scripts/migrate-to-supabase.ts
 *
 * 주의:
 * - .env.local의 Google Sheets + Supabase 환경 변수가 모두 필요합니다
 * - 기존 Supabase 테이블에 데이터가 있으면 중복 삽입될 수 있습니다
 * - FK 의존성 순서대로 삽입합니다
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.local 로드
config({ path: resolve(__dirname, '../.env.local') });

import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

// ============================================
// 설정
// ============================================

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')!;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Google Sheets 클라이언트
const auth = new google.auth.JWT({
  email: SERVICE_ACCOUNT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Supabase 클라이언트
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================
// Google Sheets → 테이블 매핑
// ============================================

interface SheetMapping {
  sheetName: string;        // Google Sheets 시트명
  tableName: string;        // Supabase 테이블명
  booleanFields: string[];  // TRUE/FALSE → boolean 변환 대상
  pkField: string;          // Primary Key 필드명 (시트 기준)
}

const MIGRATION_ORDER: SheetMapping[] = [
  // Tier 1: 마스터 데이터 (의존성 없음)
  { sheetName: 'Users', tableName: 'users', booleanFields: ['isActive'], pkField: 'id' },
  { sheetName: 'Customers', tableName: 'customers', booleanFields: ['isActive'], pkField: 'id' },
  { sheetName: 'Models', tableName: 'models', booleanFields: ['isActive'], pkField: 'id' },
  { sheetName: 'ReportCategories', tableName: 'report_categories', booleanFields: ['isActive'], pkField: 'id' },
  { sheetName: 'Settings', tableName: 'settings', booleanFields: [], pkField: 'key' },

  // Tier 2: Projects (Users 의존)
  { sheetName: 'Projects', tableName: 'projects', booleanFields: [], pkField: 'id' },

  // Tier 3: Projects 의존 테이블
  { sheetName: 'WorkLogs', tableName: 'worklogs', booleanFields: [], pkField: 'id' },
  { sheetName: 'ProjectSchedules', tableName: 'project_schedules', booleanFields: [], pkField: 'id' },
  { sheetName: 'ProjectHistory', tableName: 'project_history', booleanFields: [], pkField: 'id' },
  { sheetName: 'Favorites', tableName: 'favorites', booleanFields: [], pkField: 'id' },
  { sheetName: 'Comments', tableName: 'comments', booleanFields: [], pkField: 'id' },
  { sheetName: 'MeetingMinutes', tableName: 'meeting_minutes', booleanFields: [], pkField: 'id' },
  { sheetName: 'WeeklyReports', tableName: 'weekly_reports', booleanFields: ['isDeleted', 'isIncluded'], pkField: 'id' },
  { sheetName: 'WeeklyReportNotices', tableName: 'weekly_report_notices', booleanFields: [], pkField: 'id' },
  { sheetName: 'WeeklyReportSummary', tableName: 'weekly_report_summary', booleanFields: ['isAiGenerated'], pkField: 'id' },
  { sheetName: 'Attachments', tableName: 'attachments', booleanFields: [], pkField: 'id' },
  { sheetName: 'SavedSearches', tableName: 'saved_searches', booleanFields: [], pkField: 'id' },
  { sheetName: 'Improvements', tableName: 'improvements', booleanFields: [], pkField: 'id' },

  // Tier 4: 2차 의존 테이블
  { sheetName: 'WorklogComments', tableName: 'worklog_comments', booleanFields: [], pkField: 'id' },
  { sheetName: 'ImprovementHistories', tableName: 'improvement_histories', booleanFields: [], pkField: 'id' },
  { sheetName: 'ImprovementComments', tableName: 'improvement_comments', booleanFields: [], pkField: 'id' },
];

// ============================================
// camelCase → snake_case 변환
// ============================================

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Google Sheets 컬럼명 → Supabase 컬럼명 매핑 (이름이 다른 경우)
 */
const COLUMN_RENAMES: Record<string, string> = {
  'order': 'sort_order',     // 'order'는 PostgreSQL 예약어
};

// ============================================
// 핵심 함수
// ============================================

/**
 * Google Sheets에서 시트 데이터를 읽어옵니다.
 */
async function readSheet(sheetName: string): Promise<Record<string, string>[]> {
  // 헤더 읽기
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z1`,
  });
  const headers = headerRes.data.values?.[0] || [];

  if (headers.length === 0) {
    console.log(`  ⚠ ${sheetName}: 헤더 없음, 건너뜀`);
    return [];
  }

  // 데이터 읽기
  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:Z`,
  });
  const rows = dataRes.data.values || [];

  // 행 → 객체 변환
  return rows
    .filter((row) => row.some((cell) => cell && cell.trim() !== ''))  // 빈 행 제거
    .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
}

/**
 * camelCase 객체를 snake_case로 변환하고 타입을 정리합니다.
 */
function transformRow(
  row: Record<string, string>,
  mapping: SheetMapping
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    let snakeKey = camelToSnake(key);
    // 컬럼명 리네임 적용
    if (COLUMN_RENAMES[snakeKey]) {
      snakeKey = COLUMN_RENAMES[snakeKey];
    }

    // boolean 변환
    if (mapping.booleanFields.includes(key)) {
      result[snakeKey] = value.toUpperCase() === 'TRUE';
      continue;
    }

    // 빈 문자열 → null (숫자/날짜 컬럼 호환)
    if (value === '') {
      result[snakeKey] = null;
      continue;
    }

    // 정수형 필드 변환
    const intFields = ['sort_order', 'year', 'month', 'week', 'order', 'file_size'];
    if (intFields.includes(snakeKey) && value !== '') {
      const num = parseInt(value, 10);
      result[snakeKey] = isNaN(num) ? null : num;
      continue;
    }

    result[snakeKey] = value;
  }

  return result;
}

/**
 * Supabase에 데이터를 배치 삽입합니다.
 */
async function insertToSupabase(
  tableName: string,
  rows: Record<string, unknown>[]
): Promise<number> {
  if (rows.length === 0) return 0;

  // 500건씩 배치 처리
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from(tableName)
      .insert(batch);

    if (error) {
      console.error(`  ✗ ${tableName} 삽입 오류 (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, error.message);
      // 개별 삽입으로 폴백 — 어떤 행이 문제인지 찾기
      for (let j = 0; j < batch.length; j++) {
        const { error: rowError } = await supabase
          .from(tableName)
          .insert(batch[j]);
        if (rowError) {
          const pk = (batch[j] as Record<string, unknown>).id || (batch[j] as Record<string, unknown>).key || `row ${i + j}`;
          console.error(`    ✗ ${pk}: ${rowError.message}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }
  }

  return inserted;
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  console.log('='.repeat(60));
  console.log('Google Sheets → Supabase 데이터 마이그레이션');
  console.log('='.repeat(60));
  console.log();

  // 환경 변수 확인
  if (!SPREADSHEET_ID || !SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
    console.error('✗ Google Sheets 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('✗ Supabase 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  console.log(`Sheets: ${SPREADSHEET_ID}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log();

  const results: { table: string; source: number; inserted: number }[] = [];

  for (const mapping of MIGRATION_ORDER) {
    process.stdout.write(`[${mapping.sheetName}] → ${mapping.tableName} ... `);

    try {
      // 1. Google Sheets에서 읽기
      const sheetRows = await readSheet(mapping.sheetName);

      if (sheetRows.length === 0) {
        console.log('0건 (빈 시트)');
        results.push({ table: mapping.tableName, source: 0, inserted: 0 });
        continue;
      }

      // 2. 변환
      const transformed = sheetRows.map((row) => transformRow(row, mapping));

      // 3. Supabase에 삽입
      const inserted = await insertToSupabase(mapping.tableName, transformed);

      console.log(`${sheetRows.length}건 → ${inserted}건 삽입 완료`);
      results.push({ table: mapping.tableName, source: sheetRows.length, inserted });

      // API 제한 방지 (100ms 대기)
      await new Promise((r) => setTimeout(r, 100));

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`오류: ${message}`);
      results.push({ table: mapping.tableName, source: -1, inserted: 0 });
    }
  }

  // 결과 요약
  console.log();
  console.log('='.repeat(60));
  console.log('마이그레이션 결과 요약');
  console.log('='.repeat(60));
  console.log();
  console.log('테이블'.padEnd(30) + '원본'.padStart(6) + '삽입'.padStart(6) + '  상태');
  console.log('-'.repeat(50));

  let allOk = true;
  for (const r of results) {
    const status = r.source === r.inserted ? '✓' : r.source === 0 ? '-' : '✗';
    if (r.source !== r.inserted && r.source > 0) allOk = false;
    console.log(
      r.table.padEnd(30) +
      String(r.source).padStart(6) +
      String(r.inserted).padStart(6) +
      `  ${status}`
    );
  }

  console.log();
  if (allOk) {
    console.log('✓ 마이그레이션 완료!');
  } else {
    console.log('⚠ 일부 테이블에서 오류가 발생했습니다. 위 로그를 확인하세요.');
  }
}

main().catch(console.error);
