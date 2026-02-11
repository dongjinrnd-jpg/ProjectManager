/**
 * 고급 검색 API
 *
 * GET /api/search - 복합 조건으로 업무일지 검색
 *
 * 파라미터:
 * - startDate, endDate: 날짜 범위
 * - customer: 고객사
 * - division: 소속 (전장/유압/기타)
 * - stage: 단계
 * - assigneeId: 담당자 ID
 * - status: 프로젝트 진행여부 (진행중/보류/완료)
 * - keyword: 검색어
 * - keywordScope: 검색 범위 (content,issue)
 * - sortBy: 정렬 필드 (date/project/stage/assignee/customer)
 * - sortOrder: 정렬 순서 (asc/desc)
 * - page: 페이지 번호 (1부터)
 * - pageSize: 페이지 크기 (기본 20)
 *
 * 권한: engineer, admin, executive (업무일지 열람 가능자)
 */

import { NextResponse } from 'next/server';
import { getAllAsObjects, SHEET_NAMES } from '@/lib/google';
import { getSession, hasMinRole } from '@/lib/auth';
import type {
  ProjectStage,
  ProjectStatus,
  SearchResultItem,
  SearchSortField,
} from '@/types';

// 시트에서 가져온 업무일지 타입
interface SheetWorkLog extends Record<string, unknown> {
  id: string;
  date: string;
  projectId: string;
  item: string;
  customer: string;
  stage: ProjectStage;
  assigneeId: string;
  participants: string;
  plan: string;
  content: string;
  issue: string;
  issueStatus: string;
  createdAt: string;
}

// 시트에서 가져온 프로젝트 타입
interface SheetProject extends Record<string, unknown> {
  id: string;
  item: string;
  customer: string;
  division: string;
  status: ProjectStatus;
  currentStage: ProjectStage;
  teamLeaderId: string;
  teamMembers: string;
}

// 시트에서 가져온 사용자 타입
interface SheetUser extends Record<string, unknown> {
  id: string;
  name: string;
}

/**
 * GET /api/search
 * 복합 조건 검색
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

    // 권한 확인 (engineer 이상 또는 executive)
    const userRole = session.user.role;
    if (!hasMinRole(userRole, 'engineer') && userRole !== 'executive') {
      return NextResponse.json(
        { success: false, error: '업무일지 검색 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const customer = searchParams.get('customer') || '';
    const division = searchParams.get('division') || '';
    const stage = searchParams.get('stage') as ProjectStage | null;
    const assigneeId = searchParams.get('assigneeId') || '';
    const status = searchParams.get('status') as ProjectStatus | null;
    const keyword = searchParams.get('keyword') || '';
    const keywordScopeParam = searchParams.get('keywordScope') || 'content,issue';
    const sortBy = (searchParams.get('sortBy') || 'date') as SearchSortField;
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // 키워드 검색 범위 파싱
    const keywordScope = {
      content: keywordScopeParam.includes('content'),
      issue: keywordScopeParam.includes('issue'),
    };

    // 데이터 로드
    const [workLogs, projects, users] = await Promise.all([
      getAllAsObjects<SheetWorkLog>(SHEET_NAMES.WORKLOGS),
      getAllAsObjects<SheetProject>(SHEET_NAMES.PROJECTS),
      getAllAsObjects<SheetUser>(SHEET_NAMES.USERS),
    ]);

    // 프로젝트 맵 생성 (빠른 조회용)
    const projectMap = new Map<string, SheetProject>();
    projects.forEach((p) => projectMap.set(p.id, p));

    // 사용자 맵 생성
    const userMap = new Map<string, string>();
    users.forEach((u) => userMap.set(u.id, u.name));

    // 필터링
    let results: SearchResultItem[] = [];

    for (const log of workLogs) {
      const project = projectMap.get(log.projectId);
      if (!project) continue; // 프로젝트가 없으면 스킵

      // 날짜 범위 필터
      if (startDate && log.date < startDate) continue;
      if (endDate && log.date > endDate) continue;

      // 고객사 필터 (프로젝트의 고객사)
      if (customer && !project.customer.toLowerCase().includes(customer.toLowerCase())) {
        continue;
      }

      // 소속 필터 (프로젝트의 소속)
      if (division && project.division !== division) continue;

      // 단계 필터
      if (stage && log.stage !== stage) continue;

      // 담당자 필터
      if (assigneeId && log.assigneeId !== assigneeId) continue;

      // 프로젝트 진행여부 필터
      if (status && project.status !== status) continue;

      // 키워드 검색
      if (keyword) {
        const keywordLower = keyword.toLowerCase();
        let found = false;

        if (keywordScope.content) {
          if (
            log.content.toLowerCase().includes(keywordLower) ||
            (log.plan || '').toLowerCase().includes(keywordLower)
          ) {
            found = true;
          }
        }

        if (keywordScope.issue && !found) {
          if ((log.issue || '').toLowerCase().includes(keywordLower)) {
            found = true;
          }
        }

        // 키워드 범위가 둘 다 false면 기본 검색 (고객사, ITEM, 내용)
        if (!keywordScope.content && !keywordScope.issue) {
          if (
            log.content.toLowerCase().includes(keywordLower) ||
            log.item.toLowerCase().includes(keywordLower) ||
            log.customer.toLowerCase().includes(keywordLower)
          ) {
            found = true;
          }
        }

        if (!found) continue;
      }

      // 검색 결과 항목 생성
      results.push({
        id: log.id,
        date: log.date,
        projectId: log.projectId,
        item: log.item,
        customer: log.customer,
        division: project.division,
        stage: log.stage,
        assigneeId: log.assigneeId,
        assigneeName: userMap.get(log.assigneeId) || log.assigneeId,
        content: log.content,
        plan: log.plan || undefined,
        issue: log.issue || undefined,
        issueStatus: log.issueStatus as 'open' | 'resolved' | undefined,
        projectStatus: project.status,
      });
    }

    // 정렬
    results.sort((a, b) => {
      let compare = 0;

      switch (sortBy) {
        case 'date':
          compare = a.date.localeCompare(b.date);
          break;
        case 'project':
          compare = a.item.localeCompare(b.item);
          break;
        case 'customer':
          compare = a.customer.localeCompare(b.customer);
          break;
        case 'stage':
          compare = a.stage.localeCompare(b.stage);
          break;
        case 'assignee':
          compare = a.assigneeName.localeCompare(b.assigneeName);
          break;
        default:
          compare = a.date.localeCompare(b.date);
      }

      return sortOrder === 'desc' ? -compare : compare;
    });

    // 페이지네이션
    const total = results.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    return NextResponse.json({
      success: true,
      data: {
        items: paginatedResults,
        total,
        page,
        pageSize,
        totalPages,
      },
    });
  } catch (error) {
    console.error('고급 검색 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '검색 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
