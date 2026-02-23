/**
 * 개선요청 시트 초기화 API
 *
 * POST /api/improvements/init - Improvements, ImprovementHistories, ImprovementComments 시트 생성
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

/**
 * POST: 개선요청 시트 초기화
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
    const sheetNames = ['Improvements', 'ImprovementHistories', 'ImprovementComments'];

    const results: string[] = [];

    // force 옵션이면 기존 시트 삭제
    if (force) {
      for (const sheet of existingSheets) {
        if (sheetNames.includes(sheet.properties?.title || '')) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
              requests: [
                {
                  deleteSheet: {
                    sheetId: sheet.properties?.sheetId,
                  },
                },
              ],
            },
          });
          results.push(`${sheet.properties?.title} 시트 삭제됨`);
        }
      }
    }

    // 시트 목록 다시 확인
    const updatedSpreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const updatedSheetNames = updatedSpreadsheet.data.sheets?.map((s) => s.properties?.title) || [];

    // Improvements 시트 생성
    if (!updatedSheetNames.includes('Improvements')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Improvements',
                },
              },
            },
          ],
        },
      });

      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Improvements!A1:N1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'id',              // A
            'title',           // B
            'type',            // C
            'status',          // D
            'priority',        // E
            'content',         // F
            'relatedMenu',     // G
            'reproductionSteps', // H
            'screenshotUrl',   // I
            'authorId',        // J
            'authorName',      // K
            'createdAt',       // L
            'updatedAt',       // M
            'dueDate',         // N
            'completedAt',     // O
          ]],
        },
      });
      results.push('Improvements 시트 생성됨');
    } else {
      results.push('Improvements 시트 이미 존재함');
    }

    // ImprovementHistories 시트 생성
    if (!updatedSheetNames.includes('ImprovementHistories')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'ImprovementHistories',
                },
              },
            },
          ],
        },
      });

      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'ImprovementHistories!A1:G1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'id',              // A
            'improvementId',   // B
            'status',          // C
            'memo',            // D
            'changedBy',       // E
            'changedByName',   // F
            'changedAt',       // G
          ]],
        },
      });
      results.push('ImprovementHistories 시트 생성됨');
    } else {
      results.push('ImprovementHistories 시트 이미 존재함');
    }

    // ImprovementComments 시트 생성
    if (!updatedSheetNames.includes('ImprovementComments')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'ImprovementComments',
                },
              },
            },
          ],
        },
      });

      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'ImprovementComments!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'id',              // A
            'improvementId',   // B
            'content',         // C
            'authorId',        // D
            'authorName',      // E
            'createdAt',       // F
          ]],
        },
      });
      results.push('ImprovementComments 시트 생성됨');
    } else {
      results.push('ImprovementComments 시트 이미 존재함');
    }

    return NextResponse.json({
      success: true,
      message: '개선요청 시트 초기화 완료',
      results,
    });
  } catch (error) {
    console.error('개선요청 시트 초기화 실패:', error);
    return NextResponse.json(
      { error: '개선요청 시트 초기화에 실패했습니다.' },
      { status: 500 }
    );
  }
}
