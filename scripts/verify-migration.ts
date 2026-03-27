/**
 * 마이그레이션 검증 스크립트
 * 실행: npx tsx scripts/verify-migration.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TABLES = [
  'users', 'customers', 'models', 'report_categories', 'settings',
  'projects', 'worklogs', 'project_schedules', 'project_history',
  'favorites', 'comments', 'meeting_minutes', 'weekly_reports',
  'weekly_report_notices', 'weekly_report_summary', 'attachments',
  'saved_searches', 'improvements', 'worklog_comments',
  'improvement_histories', 'improvement_comments',
];

async function main() {
  console.log('Supabase 데이터 검증\n');
  console.log('테이블'.padEnd(30) + '건수'.padStart(6));
  console.log('-'.repeat(36));

  let total = 0;
  for (const table of TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    const n = error ? -1 : (count ?? 0);
    total += Math.max(0, n);
    const status = error ? `오류: ${error.message}` : `${n}`;
    console.log(table.padEnd(30) + status.padStart(6));
  }

  console.log('-'.repeat(36));
  console.log('합계'.padEnd(30) + String(total).padStart(6));
}

main().catch(console.error);
