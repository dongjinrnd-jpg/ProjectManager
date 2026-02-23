/**
 * 매뉴얼 API
 *
 * 사용자 role에 맞는 매뉴얼 파일을 반환
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import fs from 'fs';
import path from 'path';

// role별 매뉴얼 파일 매핑
const MANUAL_FILES: Record<string, string> = {
  user: 'USER_MANUAL_user.md',
  engineer: 'USER_MANUAL_engineer.md',
  admin: 'USER_MANUAL_admin.md',
  executive: 'USER_MANUAL_executive.md',
  sysadmin: 'USER_MANUAL_sysadmin.md',
};

export async function GET() {
  try {
    // 인증 확인
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const userRole = session.user.role;
    const manualFileName = MANUAL_FILES[userRole];

    if (!manualFileName) {
      return NextResponse.json(
        { success: false, error: '해당 역할의 매뉴얼이 없습니다.' },
        { status: 404 }
      );
    }

    // 매뉴얼 파일 경로
    const manualPath = path.join(process.cwd(), 'docs', 'manual', manualFileName);

    // 파일 존재 확인
    if (!fs.existsSync(manualPath)) {
      return NextResponse.json(
        { success: false, error: '매뉴얼 파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 파일 읽기
    const content = fs.readFileSync(manualPath, 'utf-8');

    return NextResponse.json({
      success: true,
      data: {
        role: userRole,
        fileName: manualFileName,
        content,
      },
    });
  } catch (error) {
    console.error('매뉴얼 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '매뉴얼을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
