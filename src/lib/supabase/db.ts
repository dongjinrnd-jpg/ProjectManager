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

/**
 * PostgREST 한 번의 요청으로 받을 수 있는 최대 행 수.
 * 서버 기본 상한(1000)에 맞춰 페이지네이션 단위로 사용한다.
 */
const PAGE_SIZE = 1000;

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

  // PostgREST 기본 응답 상한(1000행)을 넘기기 위해 range로 페이지네이션한다.
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Supabase 조회 오류 (${tableName}): ${error.message}`);
    }

    const page = data || [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return toCamelCaseArray<T>(rows);
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
    or?: string;
    orderBy?: { column: string; ascending?: boolean } | Array<{ column: string; ascending?: boolean }>;
    limit?: number;
    select?: string;
  }
): Promise<T[]> {
  const supabase = getSupabase();

  // 페이지마다 동일한 조건의 쿼리를 새로 만든다 (빌더는 재사용 불가)
  const build = () => {
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

    // OR 조건 (PostgREST 문법: "col1.ilike.%val%,col2.ilike.%val%")
    if (options?.or) {
      q = q.or(options.or);
    }

    // 정렬 (단일 또는 다중)
    if (options?.orderBy) {
      const orders = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
      for (const order of orders) {
        q = q.order(fieldToSnake(order.column), {
          ascending: order.ascending ?? true,
        });
      }
    }

    return q;
  };

  // limit이 없으면 조건에 맞는 전체 행을 가져온다.
  // PostgREST 기본 상한(1000행) 때문에 range로 나눠 요청해야 한다.
  const wanted = options?.limit ?? Infinity;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];

  for (let from = 0; from < wanted; from += PAGE_SIZE) {
    const size = Math.min(PAGE_SIZE, wanted - from);
    const { data, error } = await build().range(from, from + size - 1);

    if (error) {
      throw new Error(`Supabase 쿼리 오류 (${tableName}): ${error.message}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = (data as any[]) || [];
    rows.push(...page);

    if (page.length < size) break;
  }

  return toCamelCaseArray<T>(rows);
}

/**
 * `PREFIX + 일련번호` 형식의 다음 ID를 생성합니다.
 *
 * 전체 행을 읽어 최댓값을 찾던 기존 방식은 PostgREST 응답 상한(1000행)에
 * 걸려 최신 행을 놓치고 중복 PK를 만들었습니다.
 * 여기서는 prefix로 필터링한 뒤 내림차순 1건만 조회합니다.
 *
 * @param tableName - 테이블 이름
 * @param prefix - ID 접두사 (예: 'WL-20260828-')
 * @param padding - 일련번호 자릿수 (예: 3 → '001')
 * @returns 다음 ID 문자열
 */
export async function generateSequentialId(
  tableName: SheetName,
  prefix: string,
  padding: number
): Promise<string> {
  // prefix로 필터링한 id만 조회하고 숫자로 비교한다.
  // (문자열 정렬만 쓰면 자릿수가 넘어갈 때 'PS-999' > 'PS-1000'이 되어 어긋난다)
  const rows = await query<{ id: string }>(tableName, {
    select: 'id',
    filters: [{ column: 'id', op: 'like', value: `${prefix}%` }],
  });

  let maxNum = 0;
  for (const row of rows) {
    if (!row.id) continue;
    const parsed = parseInt(row.id.slice(prefix.length), 10);
    if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
  }

  return `${prefix}${String(maxNum + 1).padStart(padding, '0')}`;
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
 * 특정 컬럼 값과 일치하는 모든 행을 삭제합니다.
 *
 * @param tableName - 테이블 이름
 * @param column - 필터 컬럼 (camelCase)
 * @param value - 일치값 또는 값 배열(IN 절)
 * @returns 삭제된 행 수
 */
export async function deleteByColumn(
  tableName: SheetName,
  column: string,
  value: string | string[]
): Promise<number> {
  const supabase = getSupabase();
  const snakeCol = fieldToSnake(column);

  let q = supabase.from(tableName).delete({ count: 'exact' });
  q = Array.isArray(value) ? q.in(snakeCol, value) : q.eq(snakeCol, value);

  const { error, count } = await q;

  if (error) {
    throw new Error(`Supabase 삭제 오류 (${tableName}.${column}): ${error.message}`);
  }

  return count ?? 0;
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
  projects: ['id', 'status', 'customer', 'division', 'category', 'model', 'item', 'partNo', 'teamLeaderId', 'teamMembers', 'currentStage', 'stages', 'progress', 'issues', 'scheduleStart', 'scheduleEnd', 'note', 'productImageUrl', 'createdAt', 'updatedAt'],
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
