/**
 * 사용자 상세 API Routes
 *
 * GET /api/users/[id] - 사용자 상세 조회
 * PUT /api/users/[id] - 사용자 수정
 * DELETE /api/users/[id] - 사용자 비활성화
 *
 * 권한: sysadmin만 접근 가능
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
  findRowByColumn,
  updateRow,
  getHeaders,
  objectToRow,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession, canManageUsers } from '@/lib/auth';
import type { User, UpdateUserInput, UserRole, Division } from '@/types';

// 시트에서 가져온 사용자 타입
interface SheetUser extends Record<string, unknown> {
  id: string;
  password: string;
  name: string;
  email: string;
  role: UserRole;
  division: Division;
  isActive: string;
  createdAt: string;
  updatedAt: string;
}

// 비밀번호를 제외한 사용자 정보 타입
type SafeUser = Omit<User, 'password'>;

/**
 * GET /api/users/[id]
 * 사용자 상세 조회
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 권한 확인 (sysadmin만)
    if (!canManageUsers(session.user.role as UserRole)) {
      return NextResponse.json(
        { success: false, error: '사용자 관리 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 사용자 찾기
    const result = await findRowByColumn<SheetUser>(
      SHEET_NAMES.USERS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 비밀번호 제외하고 반환
    const { password, ...userData } = result.data;
    const safeUser: SafeUser = {
      ...userData,
      isActive: userData.isActive === 'TRUE' || userData.isActive === 'true',
    };

    return NextResponse.json({
      success: true,
      data: safeUser,
    });
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/[id]
 * 사용자 수정
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 권한 확인 (sysadmin만)
    if (!canManageUsers(session.user.role as UserRole)) {
      return NextResponse.json(
        { success: false, error: '사용자 관리 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body: UpdateUserInput & { password?: string } = await request.json();

    // 사용자 찾기
    const result = await findRowByColumn<SheetUser>(
      SHEET_NAMES.USERS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { rowIndex, data: existingUser } = result;

    // 현재 시간
    const now = new Date().toISOString();

    // 업데이트할 데이터 병합
    const updatedUser: Record<string, unknown> = {
      ...existingUser,
      name: body.name ?? existingUser.name,
      email: body.email ?? existingUser.email,
      role: body.role ?? existingUser.role,
      division: body.division ?? existingUser.division,
      isActive: body.isActive !== undefined
        ? body.isActive
        : existingUser.isActive === 'TRUE' || existingUser.isActive === 'true',
      updatedAt: now,
    };

    // 비밀번호 변경이 있는 경우
    if (body.password) {
      updatedUser.password = await bcrypt.hash(body.password, 10);
    }

    // 헤더 가져오기
    const headers = await getHeaders(SHEET_NAMES.USERS);

    // 행 데이터 생성
    const rowValues = objectToRow(headers, updatedUser);

    // 시트 업데이트
    await updateRow(SHEET_NAMES.USERS, rowIndex, rowValues);

    // 비밀번호 제외하고 반환
    const safeUser: SafeUser = {
      id: existingUser.id,
      name: updatedUser.name as string,
      email: updatedUser.email as string,
      role: updatedUser.role as UserRole,
      division: updatedUser.division as Division,
      isActive: updatedUser.isActive as boolean,
      createdAt: existingUser.createdAt,
      updatedAt: now,
    };

    return NextResponse.json({
      success: true,
      data: safeUser,
      message: '사용자 정보가 수정되었습니다.',
    });
  } catch (error) {
    console.error('사용자 수정 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[id]
 * 사용자 비활성화 (실제 삭제하지 않음)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 권한 확인 (sysadmin만)
    if (!canManageUsers(session.user.role as UserRole)) {
      return NextResponse.json(
        { success: false, error: '사용자 관리 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 자기 자신 삭제 방지
    if (session.user.id === id) {
      return NextResponse.json(
        { success: false, error: '자기 자신은 비활성화할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 사용자 찾기
    const result = await findRowByColumn<SheetUser>(
      SHEET_NAMES.USERS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { rowIndex, data: existingUser } = result;

    // 현재 시간
    const now = new Date().toISOString();

    // 비활성화 처리
    const updatedUser: Record<string, unknown> = {
      ...existingUser,
      isActive: false,
      updatedAt: now,
    };

    // 헤더 가져오기
    const headers = await getHeaders(SHEET_NAMES.USERS);

    // 행 데이터 생성
    const rowValues = objectToRow(headers, updatedUser);

    // 시트 업데이트
    await updateRow(SHEET_NAMES.USERS, rowIndex, rowValues);

    return NextResponse.json({
      success: true,
      message: '사용자가 비활성화되었습니다.',
    });
  } catch (error) {
    console.error('사용자 비활성화 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
