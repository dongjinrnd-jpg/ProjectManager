'use client';

/**
 * 프로젝트 간트차트 컴포넌트
 * 전체 프로젝트의 대일정(scheduleStart ~ scheduleEnd)을 시각화
 *
 * Roadmap 2.13 기준:
 * - 프로젝트별 바 (고객사/ITEM명)
 * - 월별 타임라인 컬럼
 * - 프로젝트 바 클릭 시 상세 팝업
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import type { GanttProject } from '@/app/api/schedules/gantt/route';

// 좌측 프로젝트 목록 너비
const LIST_CELL_WIDTH = '280px';
const CUSTOMER_COL_WIDTH = '120px';
const ITEM_COL_WIDTH = '160px';

// 프로젝트 상태별 색상 (배경=회색, 진행률=상태별 색상)
const STATUS_COLORS: Record<string, { bg: string; progress: string; selected: string }> = {
  '진행중': { bg: '#e5e7eb', progress: '#3b82f6', selected: '#2563eb' }, // 회색 배경 + 파란색 진행
  '보류': { bg: '#e5e7eb', progress: '#f59e0b', selected: '#d97706' }, // 회색 배경 + 주황색 진행
  '완료': { bg: '#10b981', progress: '#059669', selected: '#047857' }, // 초록색 전체 (완료)
};

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface ProjectGanttChartProps {
  projects: GanttProject[];
  onProjectClick?: (project: GanttProject) => void;
}

export default function ProjectGanttChart({ projects, onProjectClick }: ProjectGanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  const [projectMap, setProjectMap] = useState<Map<string, GanttProject>>(new Map());
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // 프로젝트 맵 생성
  useEffect(() => {
    const map = new Map<string, GanttProject>();
    projects.forEach(p => map.set(p.id, p));
    setProjectMap(map);
  }, [projects]);

  // 마우스 위치 추적
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);


  // 프로젝트를 고객사별로 정렬 후 Gantt Task로 변환
  const sortedProjects = useMemo(() => {
    // 고객사 기준 정렬 (같은 고객사끼리 묶음)
    return [...projects].sort((a, b) => {
      const customerCompare = a.customer.localeCompare(b.customer);
      if (customerCompare !== 0) return customerCompare;
      // 같은 고객사면 시작일 기준 정렬
      return new Date(a.scheduleStart).getTime() - new Date(b.scheduleStart).getTime();
    });
  }, [projects]);

  const tasks: Task[] = useMemo(() => {
    if (sortedProjects.length === 0) return [];

    // 프로젝트 태스크 - 유효한 날짜가 있는 프로젝트만 포함
    return sortedProjects
      .filter(project => {
        // 날짜 유효성 검사
        if (!project.scheduleStart || !project.scheduleEnd) return false;
        const start = new Date(project.scheduleStart);
        const end = new Date(project.scheduleEnd);
        return !isNaN(start.getTime()) && !isNaN(end.getTime());
      })
      .map(project => {
        const startDate = new Date(project.scheduleStart);
        const endDate = new Date(project.scheduleEnd);
        const colors = STATUS_COLORS[project.status] || STATUS_COLORS['진행중'];

        return {
          id: project.id,
          name: `${project.customer} - ${project.item}`,
          start: startDate,
          end: endDate,
          progress: project.progress,
          type: 'task' as const,
          styles: {
            backgroundColor: colors.bg,
            backgroundSelectedColor: colors.bg,
            progressColor: colors.progress,
            progressSelectedColor: colors.selected,
          },
        };
      });
  }, [sortedProjects]);

  // 날짜 범위 계산 - 1월~12월 전체 연도 표시 (항상 정의됨)
  const dateRange = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const minStart = new Date(currentYear, 0, 1); // 1월 1일
    const maxEnd = new Date(currentYear, 11, 31); // 12월 31일
    return { minStart, maxEnd };
  }, []);

  // 컬럼 너비 계산
  const columnWidth = useMemo(() => {
    if (viewMode === ViewMode.Month) return 120;
    if (viewMode === ViewMode.Week) return 80;
    return 50;
  }, [viewMode]);

  // 바 텍스트 숨기기 + 줄무늬 배경 제거 (렌더링 후)
  useEffect(() => {
    const cleanupGanttStyles = () => {
      const container = document.querySelector('.project-gantt-container');
      if (!container) return;

      // SVG 내 모든 text 요소 중 바 영역의 텍스트만 숨김
      const svgTexts = container.querySelectorAll('svg text');
      svgTexts.forEach((text) => {
        const textContent = text.textContent || '';
        // 프로젝트 이름 패턴 (고객사 - ITEM) 매칭
        if (textContent.includes(' - ')) {
          (text as SVGTextElement).style.display = 'none';
        }
      });

      // 짝수 행 줄무늬 배경 제거 (#f5f5f5 색상)
      const svgRects = container.querySelectorAll('svg rect');
      svgRects.forEach((rect) => {
        const fill = rect.getAttribute('fill');
        if (fill === '#f5f5f5' || fill === 'rgb(245, 245, 245)') {
          rect.setAttribute('fill', 'white');
        }
      });
    };

    // 약간의 딜레이 후 실행 (Gantt 렌더링 완료 대기)
    const timer = setTimeout(cleanupGanttStyles, 100);
    return () => clearTimeout(timer);
  }, [tasks, viewMode]);

  // 커스텀 툴팁
  const CustomTooltip = useCallback(({ task }: { task: Task; fontSize: string; fontFamily: string }) => {
    const project = projectMap.get(task.id);
    if (!project) return null;

    const duration = Math.ceil(
      (task.end.getTime() - task.start.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    return (
      <div
        className="bg-white border border-gray-300 rounded shadow-lg p-3 text-sm"
        style={{
          position: 'fixed',
          left: mousePos.x + 15,
          top: mousePos.y + 15,
          zIndex: 9999,
          pointerEvents: 'none',
          minWidth: '250px',
        }}
      >
        {project.isFavorite && (
          <span className="text-yellow-500 text-lg mr-1">⭐</span>
        )}
        <div className="font-semibold text-gray-900">
          {project.customer} - {project.item}
        </div>

        <div className="mt-2 space-y-1 text-gray-600">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
              {project.division || '미지정'}
            </span>
            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
              {project.category || '미지정'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[project.status]?.bg || '#3b82f6' }}
            />
            <span>{project.status}</span>
            <span className="text-xs px-2 py-0.5 bg-brand-orange-light text-brand-primary rounded">
              {project.currentStage}
            </span>
          </div>

          <div className="pt-2 border-t border-gray-200 mt-2">
            <div>기간: {formatDate(task.start)} ~ {formatDate(task.end)}</div>
            <div>총 {duration}일 ({task.progress}% 경과)</div>
          </div>
        </div>
      </div>
    );
  }, [projectMap, mousePos]);

  // 태스크 클릭 핸들러
  const handleTaskClick = (task: Task) => {
    const project = projectMap.get(task.id);
    if (project && onProjectClick) {
      onProjectClick(project);
    }
  };

  if (sortedProjects.length === 0 || tasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        표시할 프로젝트 일정이 없습니다.
      </div>
    );
  }

  return (
    <div className="project-gantt-container">
      {/* 뷰 모드 선택 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode(ViewMode.Day)}
          className={`px-3 py-1 text-sm rounded ${
            viewMode === ViewMode.Day
              ? 'bg-brand-primary text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          일
        </button>
        <button
          onClick={() => setViewMode(ViewMode.Week)}
          className={`px-3 py-1 text-sm rounded ${
            viewMode === ViewMode.Week
              ? 'bg-brand-primary text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          주
        </button>
        <button
          onClick={() => setViewMode(ViewMode.Month)}
          className={`px-3 py-1 text-sm rounded ${
            viewMode === ViewMode.Month
              ? 'bg-brand-primary text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          월
        </button>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: '#e5e7eb' }} />
          <span>예정 (회색)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS['진행중'].progress }} />
          <span>진행됨 (파란색)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS['보류'].progress }} />
          <span>보류 (주황색)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS['완료'].bg }} />
          <span>완료 (초록색)</span>
        </div>
        <div className="text-gray-400 ml-4">
          | 진행률은 단계 기반 계산
        </div>
      </div>

      {/* 오늘 날짜 표시 */}
      <div className="text-sm text-gray-500 mb-2">
        오늘: {formatDate(new Date())}
      </div>

      {/* 간트 차트 */}
      <div className="border rounded overflow-hidden bg-white">
        <div
          className="gantt-wrapper overflow-x-auto"
        >
          <Gantt
            tasks={tasks}
            viewMode={viewMode}
            viewDate={dateRange.minStart}
            preStepsCount={0}
            onClick={handleTaskClick}
            listCellWidth={LIST_CELL_WIDTH}
            columnWidth={columnWidth}
            ganttHeight={Math.min(600, tasks.length * 35 + 50)}
            rowHeight={35}
            barCornerRadius={3}
            locale="ko"
            TooltipContent={CustomTooltip}
            TaskListHeader={TaskListHeader}
            TaskListTable={TaskListTable}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 커스텀 태스크 목록 헤더
 */
function TaskListHeader({ headerHeight }: { headerHeight: number }) {
  return (
    <div
      className="bg-gray-100 border-b border-gray-300 flex items-center text-sm font-semibold text-gray-700"
      style={{ height: headerHeight, width: LIST_CELL_WIDTH }}
    >
      <div
        className="px-2 border-r border-gray-300 flex items-center"
        style={{ width: CUSTOMER_COL_WIDTH, height: '100%' }}
      >
        고객사
      </div>
      <div
        className="px-2 flex items-center"
        style={{ width: ITEM_COL_WIDTH }}
      >
        프로젝트
      </div>
    </div>
  );
}

/**
 * 커스텀 태스크 목록 테이블
 * 동일 고객사는 셀 병합 효과 적용
 */
function TaskListTable({
  tasks,
  rowHeight,
  rowWidth,
  onExpanderClick,
}: {
  tasks: Task[];
  rowHeight: number;
  rowWidth: string;
  onExpanderClick: (task: Task) => void;
}) {
  // 고객사별 그룹 정보 계산
  const customerGroups = useMemo(() => {
    const groups: Record<string, { startIndex: number; count: number }> = {};
    let currentCustomer = '';

    tasks.forEach((task, index) => {
      const [customer] = task.name.split(' - ');
      if (customer !== currentCustomer) {
        currentCustomer = customer;
        groups[`${customer}-${index}`] = { startIndex: index, count: 1 };
      } else {
        // 이전 그룹의 count 증가
        const keys = Object.keys(groups);
        const lastKey = keys[keys.length - 1];
        if (lastKey) {
          groups[lastKey].count++;
        }
      }
    });

    return groups;
  }, [tasks]);

  // 각 인덱스가 그룹의 첫 번째인지 확인
  const isFirstInGroup = (index: number): boolean => {
    return Object.values(customerGroups).some(g => g.startIndex === index);
  };

  // 해당 인덱스의 그룹 크기 반환
  const getGroupSize = (index: number): number => {
    const group = Object.values(customerGroups).find(g => g.startIndex === index);
    return group ? group.count : 1;
  };

  return (
    <div
      className="border-r border-gray-200"
      style={{ width: rowWidth }}
    >
      {tasks.map((task: Task, index: number) => {
        // task.name은 "고객사 - ITEM" 형식
        const [customer, item] = task.name.split(' - ');
        const isFirst = isFirstInGroup(index);
        const groupSize = isFirst ? getGroupSize(index) : 0;

        return (
          <div
            key={task.id}
            className="flex items-center border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
            style={{ height: rowHeight }}
            onClick={() => onExpanderClick(task)}
          >
            {/* 고객사 셀 - 그룹 첫 번째 행에서만 텍스트 표시 */}
            <div
              className={`px-2 text-sm font-medium text-gray-900 truncate border-r ${
                isFirst ? 'border-gray-200' : 'border-gray-100'
              } ${isFirst && groupSize > 1 ? 'bg-gray-50' : ''}`}
              style={{ width: CUSTOMER_COL_WIDTH }}
              title={customer}
            >
              {isFirst ? customer : ''}
            </div>
            <div
              className="px-2 text-sm text-gray-700 truncate"
              style={{ width: ITEM_COL_WIDTH }}
              title={item}
            >
              {item}
            </div>
          </div>
        );
      })}
    </div>
  );
}