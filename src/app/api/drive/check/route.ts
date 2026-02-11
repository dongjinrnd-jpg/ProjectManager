/**
 * Google Drive 연결 확인 API
 *
 * GET /api/drive/check - Drive 연결 상태 확인
 */

import { NextResponse } from 'next/server';
import { checkDriveConnection } from '@/lib/google';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // Drive 연결 확인
    const result = await checkDriveConnection();

    return NextResponse.json({
      success: result.connected,
      data: result,
    });
  } catch (error) {
    console.error('Drive 연결 확인 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
