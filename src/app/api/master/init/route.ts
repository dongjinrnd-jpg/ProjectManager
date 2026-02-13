/**
 * 마스터 데이터 시트 초기화 API
 *
 * POST /api/master/init - Customers, Models 시트 생성 및 초기 데이터 입력
 *
 * 권한: sysadmin만 실행 가능
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function getGoogleSheetsClient() {
  const authClient = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth: authClient });
}

// 초기 고객사 데이터
const INITIAL_CUSTOMERS = [
  'KIA',
  '한화에어로스페이스',
  '마루이앤지',
  'HMC',
  'TTDW모빌리티',
  'KOBELCO',
  'KOMATSU',
  'HITACHI',
  'HITACHI Tierra',
  'SUMITOMO',
  '자체',
  '현대인프라코어',
  '현대사이트솔루션',
  'YAMADA',
  '타케우치',
  '하이드로텍',
  '대동',
  '대동기어',
  'TYM',
  '렌드솔루션',
  'KUBOTA',
  'DORMAN',
  'WEXCO',
  'ROCA',
  'AME',
  'YANMAR(SPK)',
  'LS엠트론',
  '삼우농기(대동)',
  'HDX',
  'HKMC',
  'TDVC',
  'KAMS',
  '기아군수',
  '대동모빌리티',
  '볼보건설기계',
  '현대건설기계',
  'ISEKI',
];

// 초기 모델 데이터
const INITIAL_MODELS = [
  'CAB TILT SYSTEM',
  'FUEL FILLER PUMP',
  'PUMP',
  'CYLINDER',
  'ETB',
  'TC ACTUATOR MOTOR',
  'MOTOR',
  'OUTLIGGER',
  '스트로크 실린더',
  'HST 구동 모터',
  'CAT-2 실린더 확대적용 검토',
  'ABH16',
  'AIR BLOWER',
  'BLDC MOTOR',
  'DC MOTOR',
  '빙수기',
  'TURBO CHARGER',
  'MOTORHOME',
  'MAGNETIC VALVE',
  '검사기',
  '도면, 서류 관리',
  '기타업무',
  '협력로봇',
];

/**
 * POST: 마스터 데이터 시트 초기화
 *
 * body: { force: true } - 기존 시트 삭제 후 재생성
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // sysadmin 권한 확인
    if (session.user.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // force 옵션 확인
    let force = false;
    try {
      const body = await request.json();
      force = body.force === true;
    } catch {
      // body가 없어도 됨
    }

    const sheets = await getGoogleSheetsClient();

    // 현재 시트 목록 확인
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheets = spreadsheet.data.sheets || [];

    const results: string[] = [];

    // force 옵션이면 기존 시트 삭제
    if (force) {
      for (const sheet of existingSheets) {
        if (sheet.properties?.title === 'Customers' || sheet.properties?.title === 'Models') {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
              requests: [
                {
                  deleteSheet: {
                    sheetId: sheet.properties.sheetId,
                  },
                },
              ],
            },
          });
          results.push(`${sheet.properties.title} 시트 삭제됨`);
        }
      }
    }

    // 시트 목록 다시 확인
    const updatedSpreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const updatedSheetNames = updatedSpreadsheet.data.sheets?.map((s) => s.properties?.title) || [];

    // Customers 시트 생성
    if (!updatedSheetNames.includes('Customers')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Customers',
                },
              },
            },
          ],
        },
      });
      results.push('Customers 시트 생성됨');

      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Customers!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['id', 'name', 'order', 'isActive', 'createdAt', 'updatedAt']],
        },
      });

      // 초기 데이터 추가
      const now = new Date().toISOString();
      const customerRows = INITIAL_CUSTOMERS.map((name, index) => [
        `CUS-${String(index + 1).padStart(3, '0')}`,
        name,
        String(index + 1),
        'true',
        now,
        now,
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Customers!A2',
        valueInputOption: 'RAW',
        requestBody: {
          values: customerRows,
        },
      });
      results.push(`고객사 ${INITIAL_CUSTOMERS.length}건 입력됨`);
    } else {
      results.push('Customers 시트 이미 존재함');
    }

    // Models 시트 생성
    if (!updatedSheetNames.includes('Models')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Models',
                },
              },
            },
          ],
        },
      });
      results.push('Models 시트 생성됨');

      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Models!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['id', 'name', 'order', 'isActive', 'createdAt', 'updatedAt']],
        },
      });

      // 초기 데이터 추가
      const now = new Date().toISOString();
      const modelRows = INITIAL_MODELS.map((name, index) => [
        `MOD-${String(index + 1).padStart(3, '0')}`,
        name,
        String(index + 1),
        'true',
        now,
        now,
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Models!A2',
        valueInputOption: 'RAW',
        requestBody: {
          values: modelRows,
        },
      });
      results.push(`모델 ${INITIAL_MODELS.length}건 입력됨`);
    } else {
      results.push('Models 시트 이미 존재함');
    }

    return NextResponse.json({
      success: true,
      message: '마스터 데이터 초기화 완료',
      results,
    });
  } catch (error) {
    console.error('마스터 데이터 초기화 실패:', error);
    return NextResponse.json(
      { error: '마스터 데이터 초기화에 실패했습니다.' },
      { status: 500 }
    );
  }
}
