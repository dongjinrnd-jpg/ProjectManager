/**
 * 실패한 테이블만 재마이그레이션
 *
 * 실행: npx tsx scripts/migrate-retry.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const auth = new google.auth.JWT({
  email: SERVICE_ACCOUNT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 컬럼명 리네임
const COLUMN_RENAMES: Record<string, string> = {
  'order': 'sort_order',
};

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

async function readSheet(sheetName: string): Promise<Record<string, string>[]> {
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z1`,
  });
  const headers = headerRes.data.values?.[0] || [];
  if (headers.length === 0) return [];

  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:Z`,
  });
  const rows = dataRes.data.values || [];

  return rows
    .filter((row) => row.some((cell) => cell && cell.trim() !== ''))
    .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
}

function transformRow(
  row: Record<string, string>,
  booleanFields: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    let snakeKey = camelToSnake(key);
    if (COLUMN_RENAMES[snakeKey]) snakeKey = COLUMN_RENAMES[snakeKey];

    if (booleanFields.includes(key)) {
      result[snakeKey] = value.toUpperCase() === 'TRUE';
      continue;
    }
    if (value === '') { result[snakeKey] = null; continue; }

    const intFields = ['sort_order', 'year', 'month', 'week', 'file_size'];
    if (intFields.includes(snakeKey)) {
      const num = parseInt(value, 10);
      result[snakeKey] = isNaN(num) ? null : num;
      continue;
    }
    result[snakeKey] = value;
  }
  return result;
}

// 실패한 테이블들
const RETRY_TABLES = [
  { sheetName: 'Customers', tableName: 'customers', booleanFields: ['isActive'] },
  { sheetName: 'Models', tableName: 'models', booleanFields: ['isActive'] },
  { sheetName: 'ReportCategories', tableName: 'report_categories', booleanFields: ['isActive'] },
  { sheetName: 'ProjectSchedules', tableName: 'project_schedules', booleanFields: [] },
  { sheetName: 'WeeklyReports', tableName: 'weekly_reports', booleanFields: ['isDeleted', 'isIncluded'] },
];

async function main() {
  console.log('실패한 테이블 재마이그레이션\n');

  for (const { sheetName, tableName, booleanFields } of RETRY_TABLES) {
    process.stdout.write(`[${sheetName}] → ${tableName} ... `);

    try {
      const sheetRows = await readSheet(sheetName);
      if (sheetRows.length === 0) { console.log('0건'); continue; }

      const transformed = sheetRows.map((row) => transformRow(row, booleanFields));

      // 기존 데이터 삭제 (혹시 부분 삽입된 경우)
      await supabase.from(tableName).delete().neq('id', '___none___');

      const { error } = await supabase.from(tableName).insert(transformed);

      if (error) {
        console.log(`오류: ${error.message}`);
        // 첫 번째 행 출력으로 디버깅
        console.log('  첫 번째 행:', JSON.stringify(transformed[0], null, 2));
      } else {
        console.log(`${sheetRows.length}건 삽입 완료 ✓`);
      }
    } catch (err) {
      console.log(`오류: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log('\n완료!');
}

main().catch(console.error);
