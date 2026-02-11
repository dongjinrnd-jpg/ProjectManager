/**
 * Google Sheets API 클라이언트
 *
 * Service Account를 사용하여 Google Sheets에 연결합니다.
 * 환경 변수:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL: Service Account 이메일
 * - GOOGLE_PRIVATE_KEY: Service Account 비공개 키
 * - GOOGLE_SPREADSHEET_ID: 스프레드시트 ID
 */

import { google, sheets_v4 } from 'googleapis';

// 환경 변수에서 설정 로드
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

/**
 * 시트 이름 상수 (Database_ERD.md 기준 13개 시트)
 */
export const SHEET_NAMES = {
  USERS: 'Users',
  PROJECTS: 'Projects',
  WORKLOGS: 'WorkLogs',
  WEEKLY_REPORTS: 'WeeklyReports',
  WEEKLY_REPORT_NOTICES: 'WeeklyReportNotices',
  WEEKLY_REPORT_SUMMARY: 'WeeklyReportSummary',
  PROJECT_SCHEDULES: 'ProjectSchedules',
  PROJECT_HISTORY: 'ProjectHistory',
  FAVORITES: 'Favorites',
  COMMENTS: 'Comments',
  ATTACHMENTS: 'Attachments',
  MEETING_MINUTES: 'MeetingMinutes',
  REPORT_CATEGORIES: 'ReportCategories',
  SETTINGS: 'Settings',
  SAVED_SEARCHES: 'SavedSearches',
} as const;

export type SheetName = (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES];

/**
 * Google Sheets API 클라이언트 싱글톤
 */
let sheetsClient: sheets_v4.Sheets | null = null;

/**
 * Google Sheets API 클라이언트를 가져옵니다.
 * Service Account 인증을 사용합니다.
 */
export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (sheetsClient) {
    return sheetsClient;
  }

  // 환경 변수 검증
  if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY || !SPREADSHEET_ID) {
    throw new Error(
      'Google Sheets 환경 변수가 설정되지 않았습니다. ' +
        'GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SPREADSHEET_ID를 확인하세요.'
    );
  }

  // JWT 인증 클라이언트 생성
  const auth = new google.auth.JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  // Sheets API 클라이언트 생성
  sheetsClient = google.sheets({ version: 'v4', auth });

  return sheetsClient;
}

/**
 * 스프레드시트 ID를 가져옵니다.
 */
export function getSpreadsheetId(): string {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SPREADSHEET_ID 환경 변수가 설정되지 않았습니다.');
  }
  return SPREADSHEET_ID;
}

// ============================================
// 기본 CRUD 함수
// ============================================

/**
 * 시트에서 모든 행을 읽어옵니다.
 *
 * @param sheetName - 시트 이름
 * @param includeHeader - 헤더 행 포함 여부 (기본값: false)
 * @returns 행 데이터 배열 (각 행은 문자열 배열)
 */
export async function getRows(
  sheetName: SheetName,
  includeHeader: boolean = false
): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // A:Z 범위로 전체 데이터 읽기
  const range = includeHeader ? `${sheetName}!A1:Z` : `${sheetName}!A2:Z`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values || [];
}

/**
 * 시트의 헤더(컬럼명)를 가져옵니다.
 *
 * @param sheetName - 시트 이름
 * @returns 헤더 배열
 */
export async function getHeaders(sheetName: SheetName): Promise<string[]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z1`,
  });

  return response.data.values?.[0] || [];
}

/**
 * 시트에 새 행을 추가합니다.
 *
 * @param sheetName - 시트 이름
 * @param values - 추가할 값 배열
 * @returns 업데이트된 행 수
 */
export async function appendRow(
  sheetName: SheetName,
  values: (string | number | boolean)[]
): Promise<number> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [values.map((v) => String(v))],
    },
  });

  return response.data.updates?.updatedRows || 0;
}

/**
 * 시트의 특정 행을 수정합니다.
 *
 * @param sheetName - 시트 이름
 * @param rowIndex - 행 번호 (1부터 시작, 헤더 제외하면 2부터)
 * @param values - 수정할 값 배열
 * @returns 업데이트된 셀 수
 */
export async function updateRow(
  sheetName: SheetName,
  rowIndex: number,
  values: (string | number | boolean)[]
): Promise<number> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values.map((v) => String(v))],
    },
  });

  return response.data.updatedCells || 0;
}

/**
 * 시트의 특정 행을 삭제합니다.
 * 실제로 행을 삭제하지 않고 내용을 비웁니다.
 * (Google Sheets API에서 행 삭제는 별도 batchUpdate 필요)
 *
 * @param sheetName - 시트 이름
 * @param rowIndex - 행 번호 (1부터 시작)
 * @returns 성공 여부
 */
export async function clearRow(
  sheetName: SheetName,
  rowIndex: number
): Promise<boolean> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
  });

  return !!response.data.clearedRange;
}

/**
 * 시트에서 특정 행을 실제로 삭제합니다.
 * (batchUpdate 사용)
 *
 * @param sheetName - 시트 이름
 * @param rowIndex - 삭제할 행 번호 (1부터 시작)
 * @returns 성공 여부
 */
export async function deleteRow(
  sheetName: SheetName,
  rowIndex: number
): Promise<boolean> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // 시트 ID 가져오기
  const sheetId = await getSheetId(sheetName);
  if (sheetId === null) {
    throw new Error(`시트를 찾을 수 없습니다: ${sheetName}`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-based index
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });

  return true;
}

/**
 * 시트의 ID를 가져옵니다.
 *
 * @param sheetName - 시트 이름
 * @returns 시트 ID (없으면 null)
 */
async function getSheetId(sheetName: SheetName): Promise<number | null> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });

  const sheet = response.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );

  return sheet?.properties?.sheetId ?? null;
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 행 데이터를 객체로 변환합니다.
 *
 * @param headers - 헤더 배열
 * @param row - 행 데이터 배열
 * @returns 객체 (헤더를 키로 사용)
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
 * 객체를 행 데이터로 변환합니다.
 *
 * @param headers - 헤더 배열 (순서 결정)
 * @param obj - 변환할 객체
 * @returns 값 배열
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
 * 시트의 모든 데이터를 객체 배열로 가져옵니다.
 *
 * @param sheetName - 시트 이름
 * @returns 객체 배열
 */
export async function getAllAsObjects<T extends Record<string, unknown>>(
  sheetName: SheetName
): Promise<T[]> {
  const headers = await getHeaders(sheetName);
  const rows = await getRows(sheetName);

  return rows.map((row) => rowToObject<T>(headers, row));
}

/**
 * 특정 컬럼 값으로 행을 찾습니다.
 *
 * @param sheetName - 시트 이름
 * @param columnName - 컬럼 이름
 * @param value - 찾을 값
 * @returns { rowIndex, data } 또는 null
 */
export async function findRowByColumn<T extends Record<string, unknown>>(
  sheetName: SheetName,
  columnName: string,
  value: string
): Promise<{ rowIndex: number; data: T } | null> {
  const headers = await getHeaders(sheetName);
  const columnIndex = headers.indexOf(columnName);

  if (columnIndex === -1) {
    throw new Error(`컬럼을 찾을 수 없습니다: ${columnName}`);
  }

  const rows = await getRows(sheetName);

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][columnIndex] === value) {
      return {
        rowIndex: i + 2, // 헤더 제외, 1-based index
        data: rowToObject<T>(headers, rows[i]),
      };
    }
  }

  return null;
}

/**
 * 연결 상태를 확인합니다.
 *
 * @returns 연결 정보 객체
 */
export async function checkConnection(): Promise<{
  connected: boolean;
  spreadsheetId: string;
  spreadsheetTitle?: string;
  sheetCount?: number;
  error?: string;
}> {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,sheets.properties.title',
    });

    return {
      connected: true,
      spreadsheetId,
      spreadsheetTitle: response.data.properties?.title ?? undefined,
      sheetCount: response.data.sheets?.length,
    };
  } catch (error) {
    return {
      connected: false,
      spreadsheetId: SPREADSHEET_ID || '',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}
