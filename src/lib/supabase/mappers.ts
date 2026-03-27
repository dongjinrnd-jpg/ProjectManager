/**
 * camelCase ↔ snake_case 변환 유틸리티
 *
 * TypeScript 타입 (camelCase) ↔ PostgreSQL 컬럼 (snake_case)
 */

/**
 * TypeScript 필드명 → DB 컬럼명 특수 매핑
 * 'order'는 PostgreSQL 예약어라 'sort_order'로 변경됨
 */
const CAMEL_TO_SNAKE_ALIASES: Record<string, string> = {
  order: 'sort_order',
};

const SNAKE_TO_CAMEL_ALIASES: Record<string, string> = {
  sort_order: 'order',
};

/**
 * camelCase → snake_case
 * 예: teamLeaderId → team_leader_id
 */
function camelToSnake(str: string): string {
  if (CAMEL_TO_SNAKE_ALIASES[str]) return CAMEL_TO_SNAKE_ALIASES[str];
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * snake_case → camelCase
 * 예: team_leader_id → teamLeaderId
 */
function snakeToCamel(str: string): string {
  if (SNAKE_TO_CAMEL_ALIASES[str]) return SNAKE_TO_CAMEL_ALIASES[str];
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 객체의 키를 camelCase → snake_case로 변환
 */
export function toSnakeCase<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value;
  }
  return result;
}

/**
 * 객체의 키를 snake_case → camelCase로 변환
 */
export function toCamelCase<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = value;
  }
  return result as T;
}

/**
 * 배열의 각 객체를 snake_case → camelCase로 변환
 */
export function toCamelCaseArray<T>(arr: Record<string, unknown>[]): T[] {
  return arr.map((item) => toCamelCase<T>(item));
}

/**
 * camelCase 필드명을 snake_case로 변환 (단일 문자열)
 */
export function fieldToSnake(field: string): string {
  return camelToSnake(field);
}

/**
 * snake_case 필드명을 camelCase로 변환 (단일 문자열)
 */
export function fieldToCamel(field: string): string {
  return snakeToCamel(field);
}
