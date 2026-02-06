/**
 * 비밀번호 리셋 API
 *
 * 테스트용 - 모든 사용자의 비밀번호를 해시로 업데이트
 * POST /api/setup/reset-password
 *
 * ⚠️ 프로덕션에서는 비활성화하거나 삭제하세요!
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getRows, updateRow, getHeaders, SHEET_NAMES } from '@/lib/google';

// 기본 테스트 비밀번호
const DEFAULT_PASSWORD = 'test1234';

export async function POST(request: Request) {
  try {
    // force=true 파라미터로 강제 리셋
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const headers = await getHeaders(SHEET_NAMES.USERS);
    const users = await getRows(SHEET_NAMES.USERS);

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, message: '사용자가 없습니다.' },
        { status: 400 }
      );
    }

    // 비밀번호 컬럼 인덱스 찾기
    const passwordIndex = headers.indexOf('password');
    if (passwordIndex === -1) {
      return NextResponse.json(
        { success: false, message: 'password 컬럼을 찾을 수 없습니다.' },
        { status: 400 }
      );
    }

    // 해시된 비밀번호 생성
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // 모든 사용자의 비밀번호 업데이트
    const updatedUsers = [];
    for (let i = 0; i < users.length; i++) {
      const row = users[i];
      const rowIndex = i + 2; // 헤더 제외, 1-based index

      // force=true면 모두 업데이트, 아니면 해시 아닌 것만
      if (force || !row[passwordIndex].startsWith('$2')) {
        row[passwordIndex] = hashedPassword;
        await updateRow(SHEET_NAMES.USERS, rowIndex, row);
        updatedUsers.push(row[0]); // id
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updatedUsers.length}명의 비밀번호가 업데이트되었습니다.`,
      updatedUsers,
      testPassword: DEFAULT_PASSWORD,
    });
  } catch (error) {
    console.error('비밀번호 리셋 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
