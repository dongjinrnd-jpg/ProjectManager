/**
 * Health Check API
 *
 * Supabase 연결 상태를 확인합니다.
 * GET /api/health
 */

import { NextResponse } from 'next/server';
import { checkConnection, SHEET_NAMES } from '@/lib/supabase/db';

export async function GET() {
  try {
    const status = await checkConnection();

    const healthData = {
      status: status.connected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        supabase: {
          connected: status.connected,
          tableCount: Object.keys(SHEET_NAMES).length,
          error: status.error,
        },
      },
    };

    if (!status.connected) {
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
