/**
 * 일정 데이터 Excel 다운로드 API
 *
 * GET /api/export/schedules
 *
 * 쿼리 파라미터:
 * - projectId: 특정 프로젝트 ID (없으면 전체)
 * - type: 'gantt' (전체 간트차트) | 'detail' (세부추진항목, 기본값)
 * - favorites: true면 즐겨찾기 프로젝트만 (gantt 타입에서만)
 * - status: 프로젝트 상태 필터 (gantt 타입에서만)
 * - division: 소속 필터 (gantt 타입에서만)
 *
 * 권한: 모든 로그인 사용자
 */

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getAllAsObjects, SHEET_NAMES } from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { ProjectStatus, ScheduleStatus } from '@/types';

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
  currentStage: string;
  stages: string;
  scheduleStart: string;
  scheduleEnd: string;
  createdAt: string;
  updatedAt: string;
}

interface SheetSchedule {
  id: string;
  projectId: string;
  stage: string;
  taskName: string;
  category: string;
  responsibility: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  status: ScheduleStatus;
  note: string;
  order: string;
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

// 상태 한글 변환
function getStatusLabel(status: ScheduleStatus): string {
  const labels: Record<ScheduleStatus, string> = {
    planned: '예정',
    in_progress: '진행중',
    completed: '완료',
    delayed: '지연',
  };
  return labels[status] || status;
}

// 업무 구분 한글 변환
function getResponsibilityLabel(responsibility: string): string {
  const labels: Record<string, string> = {
    lead: '주관',
    support: '협조',
  };
  return labels[responsibility] || responsibility || '';
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
    const projectId = searchParams.get('projectId') || '';
    const type = searchParams.get('type') || 'detail';
    const favoritesOnly = searchParams.get('favorites') === 'true';
    const status = searchParams.get('status') as ProjectStatus | null;
    const division = searchParams.get('division') || '';

    // 데이터 조회
    const [allProjects, allSchedules, allUsers, allFavorites] = await Promise.all([
      getAllAsObjects<SheetProject>(SHEET_NAMES.PROJECTS),
      getAllAsObjects<SheetSchedule>(SHEET_NAMES.PROJECT_SCHEDULES),
      getAllAsObjects<SheetUser>(SHEET_NAMES.USERS),
      getAllAsObjects<SheetFavorite>(SHEET_NAMES.FAVORITES),
    ]);

    // 사용자 ID -> 이름 매핑
    const userMap = new Map(allUsers.map(u => [u.id, u.name]));

    // 프로젝트 ID -> 프로젝트 매핑
    const projectMap = new Map(allProjects.map(p => [p.id, p]));

    // 현재 사용자의 즐겨찾기 프로젝트 ID Set
    const favoriteProjectIds = new Set(
      allFavorites
        .filter(f => f.userId === session.user.id)
        .map(f => f.projectId)
    );

    let filename: string;
    let ws: XLSX.WorkSheet;

    if (type === 'gantt') {
      // 전체 간트차트: 프로젝트 대일정 데이터
      let projects = allProjects.filter((project) => {
        // 상태 필터
        if (status && project.status !== status) {
          return false;
        }

        // 소속 필터
        if (division && project.division !== division) {
          return false;
        }

        // 즐겨찾기 필터
        if (favoritesOnly && !favoriteProjectIds.has(project.id)) {
          return false;
        }

        return true;
      });

      // 시작일 순 정렬
      projects.sort((a, b) =>
        new Date(a.scheduleStart).getTime() - new Date(b.scheduleStart).getTime()
      );

      // Excel 데이터 생성
      const excelData = projects.map((project, index) => ({
        'No': index + 1,
        '프로젝트ID': project.id,
        '상태': project.status,
        '고객사': project.customer,
        'ITEM': project.item,
        '소속': project.division,
        '구분': project.category,
        '팀장': userMap.get(project.teamLeaderId) || project.teamLeaderId,
        '현재단계': project.currentStage,
        '시작일': project.scheduleStart,
        '종료일': project.scheduleEnd,
      }));

      ws = XLSX.utils.json_to_sheet(excelData);

      // 컬럼 너비 설정
      ws['!cols'] = [
        { wch: 5 },   // No
        { wch: 15 },  // 프로젝트ID
        { wch: 8 },   // 상태
        { wch: 15 },  // 고객사
        { wch: 20 },  // ITEM
        { wch: 8 },   // 소속
        { wch: 8 },   // 구분
        { wch: 10 },  // 팀장
        { wch: 10 },  // 현재단계
        { wch: 12 },  // 시작일
        { wch: 12 },  // 종료일
      ];

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      filename = `전체일정표_${today}.xlsx`;
    } else {
      // 세부추진항목: 특정 프로젝트 또는 전체
      let schedules = allSchedules;

      if (projectId) {
        schedules = schedules.filter(s => s.projectId === projectId);
      }

      // 프로젝트ID, order 순 정렬
      schedules.sort((a, b) => {
        if (a.projectId !== b.projectId) {
          return a.projectId.localeCompare(b.projectId);
        }
        return (parseInt(a.order) || 0) - (parseInt(b.order) || 0);
      });

      // Excel 데이터 생성
      const excelData = schedules.map((schedule, index) => {
        const project = projectMap.get(schedule.projectId);
        return {
          'No': index + 1,
          '프로젝트': project ? `${project.customer} - ${project.item}` : schedule.projectId,
          '단계': schedule.stage || '',
          '항목명': schedule.taskName,
          '계획시작일': schedule.plannedStart,
          '계획종료일': schedule.plannedEnd,
          '실적시작일': schedule.actualStart || '',
          '실적종료일': schedule.actualEnd || '',
          '업무구분': getResponsibilityLabel(schedule.responsibility),
          '관련부문': schedule.category || '',
          '상태': getStatusLabel(schedule.status),
          '비고': schedule.note || '',
        };
      });

      ws = XLSX.utils.json_to_sheet(excelData);

      // 컬럼 너비 설정
      ws['!cols'] = [
        { wch: 5 },   // No
        { wch: 30 },  // 프로젝트
        { wch: 10 },  // 단계
        { wch: 30 },  // 항목명
        { wch: 12 },  // 계획시작일
        { wch: 12 },  // 계획종료일
        { wch: 12 },  // 실적시작일
        { wch: 12 },  // 실적종료일
        { wch: 8 },   // 업무구분
        { wch: 10 },  // 관련부문
        { wch: 8 },   // 상태
        { wch: 30 },  // 비고
      ];

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      if (projectId) {
        const project = projectMap.get(projectId);
        const projectName = project ? `${project.customer}_${project.item}`.replace(/[/\\?%*:|"<>]/g, '_') : projectId;
        filename = `일정표_${projectName}_${today}.xlsx`;
      } else {
        filename = `세부추진항목_${today}.xlsx`;
      }
    }

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    const sheetName = type === 'gantt' ? '전체일정' : '세부추진항목';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Excel 파일 생성
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 응답 반환
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error('일정 Excel 다운로드 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
