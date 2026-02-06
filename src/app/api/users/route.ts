/**
 * 사용자 API Routes
 *
 * GET /api/users - 사용자 목록 조회
 * POST /api/users - 사용자 생성
 *
 * 권한: sysadmin만 접근 가능
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
  getAllAsObjects,
  findRowByColumn,
  appendRow,
  getHeaders,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession, canManageUsers } from '@/lib/auth';
import type { User, CreateUserInput, UserRole, Division } from '@/types';

// 비밀번호를 제외한 사용자 정보 타입
type SafeUser = Omit<User, 'password'>;

/**
 * GET /api/users
 * 사용자 목록 조회
 * - 로그인한 모든 사용자가 조회 가능 (팀장/팀원 선택 등에 필요)
 * - 비밀번호는 제외하고 반환
 */
export async function GET(request: Request) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 사용자 목록 조회는 로그인한 모든 사용자에게 허용
    // (사용자 생성/수정/삭제는 POST/PUT/DELETE에서 sysadmin만 허용)

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') as UserRole | null;
    const division = searchParams.get('division') as Division | null;
    const isActive = searchParams.get('isActive');

    // 모든 사용자 조회
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

    const allUsers = await getAllAsObjects<SheetUser>(SHEET_NAMES.USERS);

    // 필터링
    let users = allUsers.filter((user) => {
      // 검색어 필터
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !user.id.toLowerCase().includes(searchLower) &&
          !user.name.toLowerCase().includes(searchLower) &&
          !user.email.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // 권한 필터
      if (role && user.role !== role) {
        return false;
      }

      // 소속 필터
      if (division && user.division !== division) {
        return false;
      }

      // 활성화 상태 필터
      if (isActive !== null) {
        const activeValue = user.isActive === 'TRUE' || user.isActive === 'true';
        if (isActive === 'true' && !activeValue) return false;
        if (isActive === 'false' && activeValue) return false;
      }

      return true;
    });

    // 비밀번호 제외하고 반환
    const safeUsers: SafeUser[] = users.map(({ password, ...rest }) => ({
      ...rest,
      isActive: rest.isActive === 'TRUE' || rest.isActive === 'true',
    }));

    return NextResponse.json({
      success: true,
      data: safeUsers,
      total: safeUsers.length,
    });
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
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
 * POST /api/users
 * 사용자 생성
 */
export async function POST(request: Request) {
  try {
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
    const body: CreateUserInput = await request.json();

    // 필수 필드 검증
    if (!body.id || !body.password || !body.name || !body.role || !body.division) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다. (id, password, name, role, division)' },
        { status: 400 }
      );
    }

    // ID 중복 확인
    const existing = await findRowByColumn(SHEET_NAMES.USERS, 'id', body.id);
    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 존재하는 아이디입니다.' },
        { status: 400 }
      );
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(body.password, 10);

    // 현재 시간
    const now = new Date().toISOString();

    // 헤더 가져오기
    const headers = await getHeaders(SHEET_NAMES.USERS);

    // 새 사용자 데이터
    const newUser: Record<string, unknown> = {
      id: body.id,
      password: hashedPassword,
      name: body.name,
      email: body.email || '',
      role: body.role,
      division: body.division,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    // 행 데이터 생성
    const rowValues = headers.map((header) => {
      const value = newUser[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
      return String(value);
    });

    // 시트에 추가
    await appendRow(SHEET_NAMES.USERS, rowValues);

    // 비밀번호 제외하고 반환
    const safeUser: SafeUser = {
      id: body.id,
      name: body.name,
      email: body.email || '',
      role: body.role,
      division: body.division,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    return NextResponse.json({
      success: true,
      data: safeUser,
      message: '사용자가 생성되었습니다.',
    });
  } catch (error) {
    console.error('사용자 생성 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
