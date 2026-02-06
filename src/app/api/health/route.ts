/**
 * Health Check API
 *
 * Google Sheets 연결 상태를 확인합니다.
 * GET /api/health
 */

import { NextResponse } from 'next/server';
import { checkConnection, SHEET_NAMES } from '@/lib/google';

export async function GET() {
  try {
    // Google Sheets 연결 확인
    const sheetsStatus = await checkConnection();

    // 응답 데이터
    const healthData = {
      status: sheetsStatus.connected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        googleSheets: {
          connected: sheetsStatus.connected,
          spreadsheetId: sheetsStatus.spreadsheetId,
          spreadsheetTitle: sheetsStatus.spreadsheetTitle,
          sheetCount: sheetsStatus.sheetCount,
          expectedSheets: Object.keys(SHEET_NAMES).length,
          error: sheetsStatus.error,
        },
      },
    };

    // 연결 실패 시 503 반환
    if (!sheetsStatus.connected) {
      return NextResponse.json(healthData, { status: 503 });
    }

    return NextResponse.json(healthData);
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
