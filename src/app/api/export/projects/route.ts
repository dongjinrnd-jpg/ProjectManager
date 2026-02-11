/**
 * 프로젝트 목록 Excel 다운로드 API
 *
 * GET /api/export/projects
 *
 * 쿼리 파라미터:
 * - search: 검색어 (고객사, ITEM)
 * - status: 상태 (진행중/보류/완료)
 * - division: 소속 (전장/유압/기타)
 * - stage: 단계
 * - favorites: true면 즐겨찾기만
 *
 * 권한: 모든 로그인 사용자
 */

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getAllAsObjects, SHEET_NAMES } from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { ProjectStatus, ProjectStage } from '@/types';

interface SheetProject {
  id: string;
  status: ProjectStatus;
  customer: string;
  division: string;
  category: string;
  model: string;
  item: string;
  partNo: string;
  teamLeaderId: string;
  teamMembers: string;
  currentStage: ProjectStage;
  stages: string;
  progress: string;
  issues: string;
  scheduleStart: string;
  scheduleEnd: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

interface SheetUser {
  id: string;
  name: string;
  email: string;
  role: string;
  division: string;
  isActive: string;
}

interface SheetFavorite {
  id: string;
  userId: string;
  projectId: string;
  createdAt: string;
}

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
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') as ProjectStatus | null;
    const division = searchParams.get('division') || '';
    const stage = searchParams.get('stage') as ProjectStage | null;
    const favoritesOnly = searchParams.get('favorites') === 'true';

    // 데이터 조회
    const [allProjects, allUsers, allFavorites] = await Promise.all([
      getAllAsObjects<SheetProject>(SHEET_NAMES.PROJECTS),
      getAllAsObjects<SheetUser>(SHEET_NAMES.USERS),
      getAllAsObjects<SheetFavorite>(SHEET_NAMES.FAVORITES),
    ]);

    // 사용자 ID -> 이름 매핑
    const userMap = new Map(allUsers.map(u => [u.id, u.name]));

    // 현재 사용자의 즐겨찾기 프로젝트 ID Set
    const favoriteProjectIds = new Set(
      allFavorites
        .filter(f => f.userId === session.user.id)
        .map(f => f.projectId)
    );

    // 필터링
    let projects = allProjects.filter((project) => {
      // 검색어 필터
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !project.customer.toLowerCase().includes(searchLower) &&
          !project.item.toLowerCase().includes(searchLower) &&
          !project.id.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // 상태 필터
      if (status && project.status !== status) {
        return false;
      }

      // 소속 필터
      if (division && project.division !== division) {
        return false;
      }

      // 단계 필터
      if (stage && project.currentStage !== stage) {
        return false;
      }

      // 즐겨찾기 필터
      if (favoritesOnly && !favoriteProjectIds.has(project.id)) {
        return false;
      }

      return true;
    });

    // 최신순 정렬
    projects.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Excel 데이터 생성
    const excelData = projects.map((project, index) => ({
      'No': index + 1,
      '상태': project.status,
      '고객사': project.customer,
      'ITEM': project.item,
      'PART NO': project.partNo || '',
      '소속': project.division,
      '구분': project.category,
      '모델': project.model || '',
      '팀장': userMap.get(project.teamLeaderId) || project.teamLeaderId,
      '팀원': project.teamMembers
        ? project.teamMembers.split(',').map(id => userMap.get(id.trim()) || id.trim()).join(', ')
        : '',
      '현재단계': project.currentStage,
      '시작일': project.scheduleStart,
      '종료일': project.scheduleEnd,
      '비고': project.note || '',
    }));

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 5 },   // No
      { wch: 8 },   // 상태
      { wch: 15 },  // 고객사
      { wch: 20 },  // ITEM
      { wch: 15 },  // PART NO
      { wch: 8 },   // 소속
      { wch: 8 },   // 구분
      { wch: 15 },  // 모델
      { wch: 10 },  // 팀장
      { wch: 20 },  // 팀원
      { wch: 10 },  // 현재단계
      { wch: 12 },  // 시작일
      { wch: 12 },  // 종료일
      { wch: 30 },  // 비고
    ];

    XLSX.utils.book_append_sheet(wb, ws, '프로젝트목록');

    // Excel 파일 생성
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 파일명 생성 (프로젝트목록_YYYYMMDD.xlsx)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `프로젝트목록_${today}.xlsx`;

    // 응답 반환
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error('프로젝트 Excel 다운로드 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
