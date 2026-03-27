/**
 * Supabase 데이터베이스 접근 레이어
 *
 * 기존 sheets.ts의 인터페이스를 유지하면서 Supabase로 구현합니다.
 * API Routes에서 import 경로만 변경하면 동작하도록 설계되었습니다.
 *
 * 변경 전: import { getAllAsObjects, SHEET_NAMES } from '@/lib/google';
 * 변경 후: import { getAllAsObjects, SHEET_NAMES } from '@/lib/supabase/db';
 */

import { getSupabase } from './client';
import { toSnakeCase, toCamelCase, toCamelCaseArray, fieldToSnake } from './mappers';

// ============================================
// 시트 이름 → 테이블 이름 매핑
// ============================================

/**
 * 기존 SHEET_NAMES와 동일한 구조 유지 (호환성)
 * 값은 Supabase 테이블명 (snake_case)
 */
export const SHEET_NAMES = {
  USERS: 'users',
  PROJECTS: 'projects',
  WORKLOGS: 'worklogs',
  WEEKLY_REPORTS: 'weekly_reports',
  WEEKLY_REPORT_NOTICES: 'weekly_report_notices',
  WEEKLY_REPORT_SUMMARY: 'weekly_report_summary',
  PROJECT_SCHEDULES: 'project_schedules',
  PROJECT_HISTORY: 'project_history',
  FAVORITES: 'favorites',
  COMMENTS: 'comments',
  ATTACHMENTS: 'attachments',
  MEETING_MINUTES: 'meeting_minutes',
  REPORT_CATEGORIES: 'report_categories',
  SETTINGS: 'settings',
  SAVED_SEARCHES: 'saved_searches',
  CUSTOMERS: 'customers',
  MODELS: 'models',
  IMPROVEMENTS: 'improvements',
  IMPROVEMENT_HISTORIES: 'improvement_histories',
  IMPROVEMENT_COMMENTS: 'improvement_comments',
  WORKLOG_COMMENTS: 'worklog_comments',
} as const;

export type SheetName = (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES];

// ============================================
// 호환성 함수 (기존 sheets.ts API 유지)
// ============================================

/**
 * 테이블의 모든 데이터를 객체 배열로 가져옵니다.
 * 기존 sheets.ts의 getAllAsObjects와 동일한 시그니처
 *
 * @param tableName - 테이블 이름 (SHEET_NAMES 값)
 * @returns 객체 배열 (camelCase 키)
 */
export async function getAllAsObjects<T extends Record<string, unknown>>(
  tableName: SheetName
): Promise<T[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(tableName)
    .select('*');

  if (error) {
    throw new Error(`Supabase 조회 오류 (${tableName}): ${error.message}`);
  }

  return toCamelCaseArray<T>(data || []);
}

/**
 * 특정 컬럼 값으로 행을 찾습니다.
 * 기존 sheets.ts의 findRowByColumn과 호환되는 시그니처
 *
 * rowIndex는 Supabase에서 의미가 없으므로 id를 반환합니다.
 * 기존 코드에서 rowIndex를 updateRow에 사용하던 패턴은
 * updateById로 대체해야 합니다.
 *
 * @param tableName - 테이블 이름
 * @param columnName - 컬럼 이름 (camelCase)
 * @param value - 찾을 값
 * @returns { rowIndex, data } 또는 null (rowIndex는 호환성용, 실제로는 0)
 */
export async function findRowByColumn<T extends Record<string, unknown>>(
  tableName: SheetName,
  columnName: string,
  value: string
): Promise<{ rowIndex: number; data: T } | null> {
  const supabase = getSupabase();
  const snakeColumn = fieldToSnake(columnName);

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq(snakeColumn, value)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase 조회 오류 (${tableName}.${columnName}): ${error.message}`);
  }

  if (!data) return null;

  return {
    rowIndex: 0, // Supabase에서는 사용하지 않음
    data: toCamelCase<T>(data),
  };
}

/**
 * 새 행을 추가합니다.
 * 기존 appendRow는 값 배열을 받았지만,
 * Supabase에서는 객체를 직접 사용합니다.
 *
 * @param tableName - 테이블 이름
 * @param obj - 삽입할 데이터 (camelCase 키)
 * @returns 삽입된 행 수
 */
export async function insertRow<T extends Record<string, unknown>>(
  tableName: SheetName,
  obj: Partial<T>
): Promise<number> {
  const supabase = getSupabase();
  const snakeObj = toSnakeCase(obj as Record<string, unknown>);

  const { error } = await supabase
    .from(tableName)
    .insert(snakeObj);

  if (error) {
    throw new Error(`Supabase 삽입 오류 (${tableName}): ${error.message}`);
  }

  return 1;
}

/**
 * ID로 행을 수정합니다.
 *
 * @param tableName - 테이블 이름
 * @param id - 레코드 ID
 * @param obj - 수정할 데이터 (camelCase 키)
 * @returns 수정된 행 수
 */
export async function updateById<T extends Record<string, unknown>>(
  tableName: SheetName,
  id: string,
  obj: Partial<T>
): Promise<number> {
  const supabase = getSupabase();
  const snakeObj = toSnakeCase(obj as Record<string, unknown>);

  // settings 테이블은 PK가 'key'
  const pkColumn = tableName === 'settings' ? 'key' : 'id';

  const { error } = await supabase
    .from(tableName)
    .update(snakeObj)
    .eq(pkColumn, id);

  if (error) {
    throw new Error(`Supabase 수정 오류 (${tableName}): ${error.message}`);
  }

  return 1;
}

/**
 * ID로 행을 삭제합니다.
 *
 * @param tableName - 테이블 이름
 * @param id - 레코드 ID
 * @returns 성공 여부
 */
export async function deleteById(
  tableName: SheetName,
  id: string
): Promise<boolean> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Supabase 삭제 오류 (${tableName}): ${error.message}`);
  }

  return true;
}

// ============================================
// Supabase 네이티브 함수 (새 코드용)
// ============================================

/**
 * 필터를 적용하여 데이터를 조회합니다.
 *
 * @param tableName - 테이블 이름
 * @param options - 필터/정렬/제한 옵션
 * @returns 객체 배열 (camelCase 키)
 */
export async function query<T extends Record<string, unknown>>(
  tableName: SheetName,
  options?: {
    filters?: Array<{ column: string; op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in'; value: unknown }>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
    select?: string;
  }
): Promise<T[]> {
  const supabase = getSupabase();
  let q = supabase.from(tableName).select(options?.select || '*');

  // 필터 적용
  if (options?.filters) {
    for (const filter of options.filters) {
      const col = fieldToSnake(filter.column);
      switch (filter.op) {
        case 'eq': q = q.eq(col, filter.value); break;
        case 'neq': q = q.neq(col, filter.value); break;
        case 'gt': q = q.gt(col, filter.value); break;
        case 'gte': q = q.gte(col, filter.value); break;
        case 'lt': q = q.lt(col, filter.value); break;
        case 'lte': q = q.lte(col, filter.value); break;
        case 'like': q = q.like(col, filter.value as string); break;
        case 'ilike': q = q.ilike(col, filter.value as string); break;
        case 'in': q = q.in(col, filter.value as unknown[]); break;
      }
    }
  }

  // 정렬
  if (options?.orderBy) {
    q = q.order(fieldToSnake(options.orderBy.column), {
      ascending: options.orderBy.ascending ?? true,
    });
  }

  // 제한
  if (options?.limit) {
    q = q.limit(options.limit);
  }

  const { data, error } = await q;

  if (error) {
    throw new Error(`Supabase 쿼리 오류 (${tableName}): ${error.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return toCamelCaseArray<T>((data as any[]) || []);
}

/**
 * ID로 단일 레코드를 조회합니다.
 *
 * @param tableName - 테이블 이름
 * @param id - 레코드 ID
 * @returns 객체 또는 null
 */
export async function getById<T extends Record<string, unknown>>(
  tableName: SheetName,
  id: string
): Promise<T | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase 조회 오류 (${tableName}): ${error.message}`);
  }

  return data ? toCamelCase<T>(data) : null;
}

/**
 * 삽입하고 삽입된 데이터를 반환합니다.
 *
 * @param tableName - 테이블 이름
 * @param obj - 삽입할 데이터 (camelCase 키)
 * @returns 삽입된 객체
 */
export async function insertAndReturn<T extends Record<string, unknown>>(
  tableName: SheetName,
  obj: Partial<T>
): Promise<T> {
  const supabase = getSupabase();
  const snakeObj = toSnakeCase(obj as Record<string, unknown>);

  const { data, error } = await supabase
    .from(tableName)
    .insert(snakeObj)
    .select()
    .single();

  if (error) {
    throw new Error(`Supabase 삽입 오류 (${tableName}): ${error.message}`);
  }

  return toCamelCase<T>(data);
}

/**
 * 연결 상태를 확인합니다.
 */
export async function checkConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('settings').select('key').limit(1);

    if (error) throw error;

    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

// ============================================
// 레거시 호환 함수
// 기존 Google Sheets 코드가 수정 없이 동작하도록 지원
// ============================================

/**
 * 테이블별 컬럼 헤더 정의 (camelCase, Google Sheets 호환)
 */
const TABLE_HEADERS: Record<string, string[]> = {
  users: ['id', 'password', 'name', 'email', 'role', 'division', 'isActive', 'createdAt', 'updatedAt'],
  customers: ['id', 'name', 'order', 'isActive', 'createdAt', 'updatedAt'],
  models: ['id', 'name', 'order', 'isActive', 'createdAt', 'updatedAt'],
  report_categories: ['id', 'name', 'order', 'isActive'],
  settings: ['key', 'value', 'description', 'updatedAt'],
  projects: ['id', 'status', 'customer', 'division', 'category', 'model', 'item', 'partNo', 'teamLeaderId', 'teamMembers', 'currentStage', 'stages', 'progress', 'issues', 'scheduleStart', 'scheduleEnd', 'note', 'createdAt', 'updatedAt'],
  project_history: ['id', 'projectId', 'changedField', 'oldValue', 'newValue', 'changedById', 'changedAt'],
  project_schedules: ['id', 'projectId', 'stage', 'taskName', 'category', 'responsibility', 'assigneeId', 'plannedStart', 'plannedEnd', 'actualStart', 'actualEnd', 'status', 'note', 'order', 'createdAt', 'updatedAt'],
  worklogs: ['id', 'date', 'projectId', 'item', 'customer', 'stage', 'assigneeId', 'participants', 'plan', 'content', 'issue', 'issueStatus', 'issueResolvedAt', 'scheduleId', 'createdAt', 'updatedAt'],
  worklog_comments: ['id', 'worklogId', 'authorId', 'authorName', 'parentId', 'content', 'createdAt'],
  favorites: ['id', 'userId', 'projectId', 'createdAt'],
  comments: ['id', 'projectId', 'authorId', 'parentId', 'content', 'createdAt'],
  meeting_minutes: ['id', 'projectId', 'title', 'hostDepartment', 'location', 'meetingDate', 'attendeesJson', 'agenda', 'discussion', 'decisions', 'nextSteps', 'createdById', 'createdAt', 'updatedAt'],
  weekly_reports: ['id', 'year', 'month', 'week', 'weekStart', 'weekEnd', 'categoryId', 'customer', 'item', 'projectId', 'content', 'order', 'createdById', 'createdAt', 'updatedAt', 'isDeleted', 'isIncluded'],
  weekly_report_notices: ['id', 'year', 'month', 'week', 'content', 'createdById', 'createdAt'],
  weekly_report_summary: ['id', 'year', 'month', 'week', 'content', 'isAiGenerated', 'createdAt', 'updatedAt'],
  attachments: ['id', 'entityType', 'entityId', 'fileName', 'fileUrl', 'fileSize', 'uploadedById', 'createdAt'],
  saved_searches: ['id', 'userId', 'name', 'filtersJson', 'createdAt', 'updatedAt'],
  improvements: ['id', 'title', 'type', 'status', 'priority', 'content', 'relatedMenu', 'reproductionSteps', 'screenshotUrl', 'authorId', 'authorName', 'createdAt', 'updatedAt', 'dueDate', 'completedAt'],
  improvement_histories: ['id', 'improvementId', 'status', 'memo', 'changedBy', 'changedByName', 'changedAt'],
  improvement_comments: ['id', 'improvementId', 'content', 'authorId', 'authorName', 'createdAt'],
};

// findRowByColumn 결과 캐시 (deleteRow에서 id를 찾기 위해)
const _findCache = new Map<string, string>();

// findRowByColumn에서 캐시 저장 (기존 함수 래핑)
const _originalFindRowByColumn = findRowByColumn;

// @ts-expect-error 레거시 호환을 위한 재할당
// eslint-disable-next-line no-func-assign
findRowByColumn = async function<T extends Record<string, unknown>>(
  tableName: SheetName,
  columnName: string,
  value: string
): Promise<{ rowIndex: number; data: T } | null> {
  const result = await _originalFindRowByColumn<T>(tableName, columnName, value);
  if (result) {
    // 캐시에 저장: tableName + rowIndex → id
    const id = (result.data as Record<string, unknown>).id as string
      || (result.data as Record<string, unknown>).key as string;
    if (id) {
      _findCache.set(`${tableName}:${result.rowIndex}`, id);
    }
  }
  return result;
};

/**
 * 시트의 헤더(컬럼명)를 가져옵니다. (레거시 호환)
 */
export async function getHeaders(tableName: SheetName): Promise<string[]> {
  return TABLE_HEADERS[tableName] || [];
}

/**
 * 시트에서 모든 행을 읽어옵니다. (레거시 호환)
 * 객체를 배열 형태로 변환하여 반환합니다.
 */
export async function getRows(tableName: SheetName): Promise<string[][]> {
  const headers = TABLE_HEADERS[tableName] || [];
  const objects = await getAllAsObjects<Record<string, unknown>>(tableName);
  return objects.map(obj =>
    headers.map(h => {
      const val = obj[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      return String(val);
    })
  );
}

/**
 * 행 데이터를 객체로 변환합니다. (레거시 호환)
 */
export function rowToObject<T extends Record<string, unknown>>(
  headers: string[],
  row: string[]
): T {
  const obj: Record<string, string> = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] || '';
  });
  return obj as T;
}

/**
 * 객체를 행 데이터로 변환합니다. (레거시 호환)
 */
export function objectToRow(
  headers: string[],
  obj: Record<string, unknown>
): string[] {
  return headers.map((header) => {
    const value = obj[header];
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return String(value);
  });
}

/**
 * 시트에 새 행을 추가합니다. (레거시 호환)
 * 값 배열을 받아 헤더 기반으로 객체를 재구성합니다.
 */
export async function appendRow(
  tableName: SheetName,
  values: (string | number | boolean)[]
): Promise<number> {
  const headers = TABLE_HEADERS[tableName] || [];
  const obj: Record<string, unknown> = {};
  headers.forEach((h, i) => {
    const val = values[i];
    if (val === undefined || val === '') {
      obj[h] = null;
    } else if (val === 'TRUE') {
      obj[h] = true;
    } else if (val === 'FALSE') {
      obj[h] = false;
    } else {
      obj[h] = val;
    }
  });
  return insertRow(tableName, obj);
}

/**
 * 시트의 특정 행을 수정합니다. (레거시 호환)
 * 값 배열을 받아 헤더 기반으로 객체를 재구성하고 id로 업데이트합니다.
 */
export async function updateRow(
  tableName: SheetName,
  rowIndex: number,
  values: (string | number | boolean)[]
): Promise<number> {
  const headers = TABLE_HEADERS[tableName] || [];
  const obj: Record<string, unknown> = {};
  headers.forEach((h, i) => {
    const val = values[i];
    if (val === undefined || val === '') {
      obj[h] = null;
    } else if (val === 'TRUE') {
      obj[h] = true;
    } else if (val === 'FALSE') {
      obj[h] = false;
    } else {
      obj[h] = val;
    }
  });

  // id 추출: 첫 번째 컬럼이 id (또는 settings는 key)
  const pkField = tableName === 'settings' ? 'key' : 'id';
  const id = String(obj[pkField] || _findCache.get(`${tableName}:${rowIndex}`) || '');

  if (!id) {
    throw new Error(`updateRow: ${tableName}의 id를 찾을 수 없습니다.`);
  }

  return updateById(tableName, id, obj);
}

/**
 * 시트에서 특정 행을 삭제합니다. (레거시 호환)
 * findRowByColumn 캐시에서 id를 찾아 삭제합니다.
 */
export async function deleteRow(
  tableName: SheetName,
  rowIndex: number
): Promise<boolean> {
  const id = _findCache.get(`${tableName}:${rowIndex}`);
  if (!id) {
    throw new Error(`deleteRow: ${tableName}의 id를 찾을 수 없습니다. findRowByColumn을 먼저 호출하세요.`);
  }
  _findCache.delete(`${tableName}:${rowIndex}`);
  return deleteById(tableName, id);
}

/**
 * 시트의 특정 행을 비웁니다. (레거시 호환 - deleteById로 대체)
 */
export async function clearRow(
  tableName: SheetName,
  rowIndex: number
): Promise<boolean> {
  return deleteRow(tableName, rowIndex);
}
