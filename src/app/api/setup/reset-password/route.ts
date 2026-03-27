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
import { getAllAsObjects, updateById, SHEET_NAMES } from '@/lib/supabase/db';

// 기본 테스트 비밀번호
const DEFAULT_PASSWORD = 'test1234';

export async function POST(request: Request) {
  try {
    // force=true 파라미터로 강제 리셋
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const users = await getAllAsObjects<Record<string, unknown> & {
      id: string;
      password: string;
    }>(SHEET_NAMES.USERS);

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, message: '사용자가 없습니다.' },
        { status: 400 }
      );
    }

    // 해시된 비밀번호 생성
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // 모든 사용자의 비밀번호 업데이트
    const updatedUsers = [];
    for (const user of users) {
      // force=true면 모두 업데이트, 아니면 해시 아닌 것만
      if (force || !user.password.startsWith('$2')) {
        await updateById(SHEET_NAMES.USERS, user.id, { password: hashedPassword });
        updatedUsers.push(user.id);
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
