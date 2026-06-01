/**
 * 업무일지 목록 페이지 통합 API
 *
 * GET /api/worklogs/list-page
 *
 * 한 번의 API 호출로 업무일지 목록 페이지에 필요한 모든 데이터를 반환:
 * - 업무일지 목록 (필터링 적용)
 * - 사용자 목록 (이름 표시용)
 * - 프로젝트 목록 (프로젝트 필터 드롭다운 + 이름 표시용)
 *
 * API 왕복 절약: 3회 → 1회
 */

import { NextResponse } from 'next/server';
import { query, getAllAsObjects, SHEET_NAMES } from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type { ProjectStage } from '@/types';

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
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const projectId = searchParams.get('projectId') || '';
    const assigneeId = searchParams.get('assigneeId') || '';
    const stage = searchParams.get('stage') as ProjectStage | null;
    const keyword = searchParams.get('keyword') || '';

    // 업무일지 필터 구성
    const filters: Array<{ column: string; op: 'eq' | 'gte' | 'lte'; value: unknown }> = [];
    if (startDate) filters.push({ column: 'date', op: 'gte', value: startDate });
    if (endDate) filters.push({ column: 'date', op: 'lte', value: endDate });
    if (projectId) filters.push({ column: 'projectId', op: 'eq', value: projectId });
    if (stage) filters.push({ column: 'stage', op: 'eq', value: stage });
    // 담당자 필터는 참여자(participants)도 함께 매칭해야 하므로 DB 필터가 아닌
    // 메모리에서 처리한다 (participants는 쉼표 구분 ID 문자열).

    const orFilter = keyword
      ? `content.ilike.%${keyword}%,plan.ilike.%${keyword}%,item.ilike.%${keyword}%,customer.ilike.%${keyword}%`
      : undefined;

    // 3개를 병렬로 조회 (DB 레벨 병렬, 네트워크 왕복 1회)
    const [allWorklogs, users, projects] = await Promise.all([
      query<Record<string, unknown>>(SHEET_NAMES.WORKLOGS, {
        filters,
        or: orFilter,
        orderBy: [
          { column: 'date', ascending: false },
          { column: 'createdAt', ascending: false },
        ],
      }),
      getAllAsObjects<Record<string, unknown>>(SHEET_NAMES.USERS),
      query<Record<string, unknown>>(SHEET_NAMES.PROJECTS, {
        select: 'id,customer,item',
        orderBy: { column: 'createdAt', ascending: false },
      }),
    ]);

    // 담당자 필터: 작성자(assigneeId) 또는 참여자(participants)에 포함되면 매칭
    const worklogs = assigneeId
      ? allWorklogs.filter((w) => {
          if (w.assigneeId === assigneeId) return true;
          const participants = String(w.participants || '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);
          return participants.includes(assigneeId);
        })
      : allWorklogs;

    return NextResponse.json({
      success: true,
      data: {
        worklogs,
        users: users.filter(u => u.isActive === true || u.isActive === 'TRUE'),
        projects,
      },
      total: worklogs.length,
    });
  } catch (error) {
    console.error('업무일지 목록 통합 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
