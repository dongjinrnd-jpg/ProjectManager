/**
 * 즐겨찾기 API Routes
 *
 * GET /api/favorites - 내 즐겨찾기 목록 조회
 * POST /api/favorites - 즐겨찾기 등록
 * DELETE /api/favorites - 즐겨찾기 해제
 *
 * 권한: 로그인 필수
 */

import { NextResponse } from 'next/server';
import {
  getAllAsObjects,
  findRowByColumn,
  insertRow,
  deleteById,
  SHEET_NAMES,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type { Favorite } from '@/types';

/**
 * 새 즐겨찾기 ID 생성
 */
async function generateFavoriteId(): Promise<string> {
  const allItems = await getAllAsObjects<Record<string, unknown>>(SHEET_NAMES.FAVORITES);

  // 최대 번호 계산
  const prefix = 'FAV-';
  let maxNum = 0;

  for (const item of allItems) {
    const id = item.id as string;
    if (id && id.startsWith(prefix)) {
      const num = parseInt(id.replace(prefix, ''), 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * GET /api/favorites
 * 내 즐겨찾기 목록 조회
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

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || session.user.id;

    // 모든 즐겨찾기 조회
    const allFavorites = await getAllAsObjects<Record<string, unknown> & {
      id: string;
      userId: string;
      projectId: string;
      createdAt: string;
    }>(SHEET_NAMES.FAVORITES);

    // 사용자별 필터링
    const favorites = allFavorites.filter((fav) => fav.userId === userId);

    // 최신순 정렬
    favorites.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      data: favorites,
      total: favorites.length,
    });
  } catch (error) {
    console.error('즐겨찾기 목록 조회 오류:', error);
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
 * POST /api/favorites
 * 즐겨찾기 등록
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

    // 요청 본문 파싱
    const body: { projectId: string } = await request.json();

    // 필수 필드 검증
    if (!body.projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 프로젝트 존재 확인
    const project = await findRowByColumn(SHEET_NAMES.PROJECTS, 'id', body.projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: '존재하지 않는 프로젝트입니다.' },
        { status: 400 }
      );
    }

    // 이미 즐겨찾기 등록된 프로젝트인지 확인
    const allFavorites = await getAllAsObjects<Record<string, unknown> & {
      id: string;
      userId: string;
      projectId: string;
      createdAt: string;
    }>(SHEET_NAMES.FAVORITES);
    const existingFavorite = allFavorites.find(
      (fav) => fav.userId === session.user.id && fav.projectId === body.projectId
    );

    if (existingFavorite) {
      return NextResponse.json(
        { success: false, error: '이미 즐겨찾기에 등록된 프로젝트입니다.' },
        { status: 400 }
      );
    }

    // 새 ID 생성
    const favoriteId = await generateFavoriteId();

    // 현재 시간
    const now = new Date().toISOString();

    // 새 즐겨찾기 데이터
    const newFavorite: Record<string, unknown> = {
      id: favoriteId,
      userId: session.user.id,
      projectId: body.projectId,
      createdAt: now,
    };

    // 시트에 추가
    await insertRow(SHEET_NAMES.FAVORITES, newFavorite);

    return NextResponse.json({
      success: true,
      data: newFavorite as unknown as Favorite,
      message: '즐겨찾기에 추가되었습니다.',
    });
  } catch (error) {
    console.error('즐겨찾기 등록 오류:', error);
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
 * DELETE /api/favorites
 * 즐겨찾기 해제
 */
export async function DELETE(request: Request) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 쿼리 파라미터에서 projectId 가져오기
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 해당 사용자의 즐겨찾기 찾기
    const allFavorites = await getAllAsObjects<Record<string, unknown> & {
      id: string;
      userId: string;
      projectId: string;
      createdAt: string;
    }>(SHEET_NAMES.FAVORITES);

    const foundFavorite = allFavorites.find(
      (fav) => fav.userId === session.user.id && fav.projectId === projectId
    );

    if (!foundFavorite) {
      return NextResponse.json(
        { success: false, error: '즐겨찾기를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Supabase에서 삭제
    await deleteById(SHEET_NAMES.FAVORITES, foundFavorite.id);

    return NextResponse.json({
      success: true,
      message: '즐겨찾기가 해제되었습니다.',
    });
  } catch (error) {
    console.error('즐겨찾기 해제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
