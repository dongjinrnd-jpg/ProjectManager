/**
 * 저장된 검색 API
 *
 * GET /api/saved-searches - 내 저장된 검색 목록 조회
 * POST /api/saved-searches - 검색 조건 저장
 *
 * 권한: 로그인 필수
 */

import { NextResponse } from 'next/server';
import {
  getAllAsObjects,
  appendRow,
  getHeaders,
  getRows,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { SavedSearch, SavedSearchParsed, CreateSavedSearchInput } from '@/types';

/**
 * 새 저장된 검색 ID 생성
 * 형식: SS-NNN
 */
async function generateSavedSearchId(): Promise<string> {
  const prefix = 'SS-';
  const rows = await getRows(SHEET_NAMES.SAVED_SEARCHES);

  let maxNum = 0;
  for (const row of rows) {
    if (row[0] && row[0].startsWith(prefix)) {
      const num = parseInt(row[0].replace(prefix, ''), 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * GET /api/saved-searches
 * 내 저장된 검색 목록 조회
 */
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

    const userId = session.user.id;

    // 모든 저장된 검색 조회
    const allSavedSearches = await getAllAsObjects<SavedSearch>(SHEET_NAMES.SAVED_SEARCHES);

    // 본인 것만 필터링
    const mySavedSearches = allSavedSearches.filter((ss) => ss.userId === userId);

    // JSON 파싱하여 반환
    const parsed: SavedSearchParsed[] = mySavedSearches.map((ss) => ({
      id: ss.id,
      userId: ss.userId,
      name: ss.name,
      filters: JSON.parse(ss.filtersJson || '{}'),
      createdAt: ss.createdAt,
      updatedAt: ss.updatedAt,
    }));

    // 최신순 정렬
    parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    console.error('저장된 검색 조회 오류:', error);
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
 * POST /api/saved-searches
 * 검색 조건 저장
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

    const userId = session.user.id;

    // 요청 본문 파싱
    const body: CreateSavedSearchInput = await request.json();

    // 필수 필드 검증
    if (!body.name || !body.filters) {
      return NextResponse.json(
        { success: false, error: '검색 조건 이름과 필터가 필요합니다.' },
        { status: 400 }
      );
    }

    // 새 ID 생성
    const savedSearchId = await generateSavedSearchId();
    const now = new Date().toISOString();

    // 헤더 가져오기
    const headers = await getHeaders(SHEET_NAMES.SAVED_SEARCHES);

    // 새 저장된 검색 객체
    const newSavedSearch: SavedSearch = {
      id: savedSearchId,
      userId: userId,
      name: body.name,
      filtersJson: JSON.stringify(body.filters),
      createdAt: now,
      updatedAt: now,
    };

    // 시트에 추가
    const rowValues = headers.map((h) => {
      const value = newSavedSearch[h as keyof SavedSearch];
      return value !== undefined ? String(value) : '';
    });

    await appendRow(SHEET_NAMES.SAVED_SEARCHES, rowValues);

    // 응답
    const response: SavedSearchParsed = {
      id: savedSearchId,
      userId: userId,
      name: body.name,
      filters: body.filters,
      createdAt: now,
      updatedAt: now,
    };

    return NextResponse.json({
      success: true,
      data: response,
      message: '검색 조건이 저장되었습니다.',
    });
  } catch (error) {
    console.error('검색 조건 저장 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
