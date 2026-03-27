/**
 * 프로젝트 목록 페이지 통합 API
 *
 * GET /api/projects/list-page
 *
 * 한 번의 API 호출로 프로젝트 목록 페이지에 필요한 모든 데이터를 반환:
 * - 프로젝트 목록 (필터링 적용)
 * - 사용자 목록 (이름 표시용)
 * - 즐겨찾기 목록 (즐겨찾기 필터용)
 *
 * API 왕복 절약: 3회 → 1회
 */

import { NextResponse } from 'next/server';
import { query, getAllAsObjects, SHEET_NAMES } from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type { ProjectStatus, ProjectStage } from '@/types';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') as ProjectStatus | null;
    const division = searchParams.get('division') || '';
    const stage = searchParams.get('stage') as ProjectStage | null;
    const teamLeaderId = searchParams.get('teamLeaderId') || '';
    const ids = searchParams.get('ids') || '';

    // 프로젝트 필터 구성
    const filters: Array<{ column: string; op: 'eq' | 'in'; value: unknown }> = [];
    if (ids) {
      const idList = ids.split(',').filter(Boolean);
      if (idList.length === 0) {
        // 빈 즐겨찾기 → 빈 프로젝트
        const [users, favorites] = await Promise.all([
          getAllAsObjects<Record<string, unknown>>(SHEET_NAMES.USERS),
          query<Record<string, unknown>>(SHEET_NAMES.FAVORITES, {
            filters: [{ column: 'userId', op: 'eq', value: session.user.id }],
            select: 'id,user_id,project_id',
          }),
        ]);
        return NextResponse.json({
          success: true,
          data: {
            projects: [],
            users: users.filter(u => u.isActive === true || u.isActive === 'TRUE'),
            favoriteProjectIds: favorites.map(f => f.projectId as string),
          },
        });
      }
      filters.push({ column: 'id', op: 'in', value: idList });
    }
    if (status) filters.push({ column: 'status', op: 'eq', value: status });
    if (division) filters.push({ column: 'division', op: 'eq', value: division });
    if (stage) filters.push({ column: 'currentStage', op: 'eq', value: stage });
    if (teamLeaderId) filters.push({ column: 'teamLeaderId', op: 'eq', value: teamLeaderId });

    const orFilter = search
      ? `customer.ilike.%${search}%,item.ilike.%${search}%,id.ilike.%${search}%`
      : undefined;

    // 3개를 병렬로 조회 (DB 레벨 병렬, 네트워크 왕복 1회)
    const [projects, users, favorites] = await Promise.all([
      query<Record<string, unknown>>(SHEET_NAMES.PROJECTS, {
        filters,
        or: orFilter,
        orderBy: { column: 'createdAt', ascending: false },
      }),
      getAllAsObjects<Record<string, unknown>>(SHEET_NAMES.USERS),
      query<Record<string, unknown>>(SHEET_NAMES.FAVORITES, {
        filters: [{ column: 'userId', op: 'eq', value: session.user.id }],
        select: 'id,user_id,project_id',
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        projects,
        users: users.filter(u => u.isActive === true || u.isActive === 'TRUE'),
        favoriteProjectIds: favorites.map(f => f.projectId as string),
      },
    });
  } catch (error) {
    console.error('프로젝트 목록 통합 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
