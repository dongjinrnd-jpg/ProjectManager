/**
 * 초기 설정 API
 *
 * 테스트 사용자 생성 (개발용)
 * POST /api/setup
 *
 * ⚠️ 프로덕션에서는 비활성화하거나 삭제하세요!
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { appendRow, getRows, SHEET_NAMES } from '@/lib/google';

// 초기 테스트 사용자 데이터
const TEST_USERS = [
  {
    id: 'admin',
    password: 'admin123',
    name: '관리자',
    email: 'admin@company.com',
    role: 'admin',
    division: '전장',
  },
  {
    id: 'engineer',
    password: 'engineer123',
    name: '개발팀원',
    email: 'engineer@company.com',
    role: 'engineer',
    division: '전장',
  },
  {
    id: 'user',
    password: 'user123',
    name: '일반사용자',
    email: 'user@company.com',
    role: 'user',
    division: '유압',
  },
];

export async function POST() {
  try {
    // 기존 사용자 확인
    const existingUsers = await getRows(SHEET_NAMES.USERS);

    if (existingUsers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: '이미 사용자 데이터가 존재합니다.',
          existingCount: existingUsers.length,
        },
        { status: 400 }
      );
    }

    // 테스트 사용자 생성
    const createdUsers = [];
    const now = new Date().toISOString();

    for (const user of TEST_USERS) {
      // 비밀번호 해시
      const hashedPassword = await bcrypt.hash(user.password, 10);

      // 시트에 추가
      await appendRow(SHEET_NAMES.USERS, [
        user.id,
        hashedPassword,
        user.name,
        user.email,
        user.role,
        user.division,
        'TRUE', // isActive
        now, // createdAt
        now, // updatedAt
      ]);

      createdUsers.push({
        id: user.id,
        name: user.name,
        role: user.role,
        // 테스트용 평문 비밀번호 (로그 확인용)
        testPassword: user.password,
      });
    }

    return NextResponse.json({
      success: true,
      message: '테스트 사용자가 생성되었습니다.',
      users: createdUsers,
    });
  } catch (error) {
    console.error('Setup 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

// GET: 현재 상태 확인
export async function GET() {
  try {
    const users = await getRows(SHEET_NAMES.USERS);

    return NextResponse.json({
      userCount: users.length,
      users: users.map((row) => ({
        id: row[0],
        name: row[2],
        role: row[4],
        isActive: row[6],
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
