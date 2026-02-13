/**
 * 시스템 설정 API
 *
 * GET /api/settings - 설정 조회
 * PUT /api/settings - 설정 저장
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { google } from 'googleapis';

// 구글 시트 설정
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SETTINGS_SHEET = '설정';

// 기본 14개 개발 단계
const DEFAULT_STAGES = [
  { id: 'review', name: '검토', order: 1, isActive: true },
  { id: 'design', name: '설계', order: 2, isActive: true },
  { id: 'development', name: '개발', order: 3, isActive: true },
  { id: 'proto', name: 'PROTO', order: 4, isActive: true },
  { id: 'reliability', name: '신뢰성', order: 5, isActive: true },
  { id: 'p1', name: 'P1', order: 6, isActive: true },
  { id: 'p2', name: 'P2', order: 7, isActive: true },
  { id: 'approval', name: '승인', order: 8, isActive: true },
  { id: 'transfer', name: '양산이관', order: 9, isActive: true },
  { id: 'initial_production', name: '초도양산', order: 10, isActive: true },
  { id: 'quality_control', name: '품질관리', order: 11, isActive: true },
  { id: 'cost_reduction', name: '원가절감', order: 12, isActive: true },
  { id: 'quality_improvement', name: '품질개선', order: 13, isActive: true },
  { id: 'design_change', name: '설계변경', order: 14, isActive: true },
];

const DEFAULT_SETTINGS = {
  itemsPerPage: 20,
  dateFormat: 'YYYY-MM-DD',
  divisions: ['전장', '유압', '기타'],
  categories: ['농기', '중공업', '해외', '기타'],
};

async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

// GET: 설정 조회
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // sysadmin만 접근 가능
    if (session.user.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sheets = await getGoogleSheetsClient();

    // 설정 시트에서 데이터 읽기 시도
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SETTINGS_SHEET}!A:B`,
      });

      const rows = response.data.values || [];

      if (rows.length > 0) {
        // 설정 파싱
        const settingsMap: Record<string, string> = {};
        rows.forEach(row => {
          if (row[0] && row[1]) {
            settingsMap[row[0]] = row[1];
          }
        });

        const stages = settingsMap['stages']
          ? JSON.parse(settingsMap['stages'])
          : DEFAULT_STAGES;

        const settings = settingsMap['settings']
          ? JSON.parse(settingsMap['settings'])
          : DEFAULT_SETTINGS;

        return NextResponse.json({ stages, settings });
      }
    } catch {
      // 설정 시트가 없으면 기본값 반환
      console.log('설정 시트가 없거나 비어있음, 기본값 사용');
    }

    return NextResponse.json({
      stages: DEFAULT_STAGES,
      settings: DEFAULT_SETTINGS,
    });
  } catch (error) {
    console.error('설정 조회 실패:', error);
    return NextResponse.json(
      { error: '설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 설정 저장
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // sysadmin만 접근 가능
    if (session.user.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { stages, settings } = body;

    const sheets = await getGoogleSheetsClient();

    // 설정 시트 존재 확인 및 생성
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });

      const settingsSheet = spreadsheet.data.sheets?.find(
        s => s.properties?.title === SETTINGS_SHEET
      );

      if (!settingsSheet) {
        // 설정 시트 생성
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: SETTINGS_SHEET,
                  },
                },
              },
            ],
          },
        });
      }
    } catch (error) {
      console.error('시트 확인/생성 실패:', error);
    }

    // 설정 저장
    const values = [
      ['stages', JSON.stringify(stages)],
      ['settings', JSON.stringify(settings)],
      ['updatedAt', new Date().toISOString()],
      ['updatedBy', session.user.id],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SETTINGS_SHEET}!A1:B4`,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('설정 저장 실패:', error);
    return NextResponse.json(
      { error: '설정 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
