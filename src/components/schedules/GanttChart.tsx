'use client';

/**
 * 간트차트 컴포넌트
 * 세부추진항목의 계획/실적 일정을 시각화
 * - 계획(Planned): 파란색 바
 * - 실적(Actual): 상태별 색상 바 (완료-초록, 진행중-주황, 지연-빨강)
 */

import { useMemo, useState, useEffect } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import type { ProjectSchedule } from '@/types';

// 마우스 위치 저장용 전역 변수
let mouseX = 0;
let mouseY = 0;

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


interface GanttChartProps {
  schedules: ProjectSchedule[];
  onTaskClick?: (schedule: ProjectSchedule) => void;
}

/**
 * 실적 상태를 status 필드 기반으로 판단
 * (날짜 기반 X → status 필드 기반 O)
 *
 * - status === 'completed' → 완료 (초록색)
 * - status === 'delayed' → 지연 (빨간색)
 * - status === 'in_progress' → 진행중 (주황색)
 * - status === 'planned' → 예정 (회색)
 */
function determineActualStatus(schedule: ProjectSchedule): 'in_progress' | 'completed' | 'delayed' {
  // status 필드 기반으로 상태 판단
  if (schedule.status === 'completed') {
    return 'completed';
  }
  if (schedule.status === 'delayed') {
    return 'delayed';
  }
  // in_progress 또는 planned는 진행중으로 표시
  return 'in_progress';
}

/**
 * ProjectSchedule을 Gantt Task 배열로 변환
 * 실적 데이터가 있으면 계획 바와 실적 바를 모두 생성
 *
 * 실적 상태 자동 판단 (날짜 기반):
 * - actualStart만 있음 → 진행중 (주황색)
 * - actualStart + actualEnd 있고 actualEnd <= plannedEnd → 완료 (초록색)
 * - actualStart + actualEnd 있고 actualEnd > plannedEnd → 지연 (빨간색)
 */
function scheduleToTasks(schedule: ProjectSchedule): Task[] {
  const tasks: Task[] = [];
  const plannedStart = new Date(schedule.plannedStart);
  const plannedEnd = new Date(schedule.plannedEnd);

  // 실적 데이터 여부 확인 (actualStart만 있어도 진행중으로 표시)
  const hasActualStart = !!schedule.actualStart;

  // 1. 계획 바 (항상 표시)
  tasks.push({
    id: `${schedule.id}-plan`,
    name: `${schedule.taskName} (계획)`,
    start: plannedStart,
    end: plannedEnd,
    progress: 0,
    type: 'task',
    project: schedule.id,
    styles: {
      backgroundColor: '#93c5fd', // blue-300
      backgroundSelectedColor: '#60a5fa', // blue-400
      progressColor: '#3b82f6',
      progressSelectedColor: '#2563eb',
    },
  });

  // 2. 실적 바 (actualStart가 있을 때 표시)
  if (hasActualStart) {
    const actualStart = new Date(schedule.actualStart!);
    // actualEnd가 없으면 오늘 날짜까지 표시 (진행중)
    const actualEnd = schedule.actualEnd
      ? new Date(schedule.actualEnd)
      : new Date();

    // 날짜 기반 상태 자동 판단
    const actualStatus = determineActualStatus(schedule);

    // 상태별 색상
    let backgroundColor: string;
    let backgroundSelectedColor: string;

    switch (actualStatus) {
      case 'in_progress':
        backgroundColor = '#f97316'; // orange - 진행중
        backgroundSelectedColor = '#ea580c';
        break;
      case 'delayed':
        backgroundColor = '#ef4444'; // red - 지연
        backgroundSelectedColor = '#dc2626';
        break;
      case 'completed':
      default:
        backgroundColor = '#10b981'; // green - 완료
        backgroundSelectedColor = '#059669';
        break;
    }

    tasks.push({
      id: `${schedule.id}-actual`,
      name: `${schedule.taskName} (실적)`,
      start: actualStart,
      end: actualEnd,
      progress: actualStatus === 'completed' ? 100 : 50,
      type: 'task',
      project: schedule.id,
      styles: {
        backgroundColor,
        backgroundSelectedColor,
        progressColor: backgroundSelectedColor,
        progressSelectedColor: backgroundSelectedColor,
      },
    });
  }

  return tasks;
}

export default function GanttChart({ schedules, onTaskClick }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);

  // 마우스 위치 추적
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // 커스텀 툴팁 (schedules에 접근 가능, 마우스 위치 기반)
  const CustomTooltip = ({ task }: { task: Task; fontSize: string; fontFamily: string }) => {
    // task.id에서 원본 schedule id 추출 (예: "PS-001-plan" -> "PS-001")
    const scheduleId = task.id.replace(/-plan$/, '').replace(/-actual$/, '');
    const schedule = schedules.find(s => s.id === scheduleId);
    const isPlan = task.id.endsWith('-plan');
    const isActual = task.id.endsWith('-actual');

    const duration = Math.ceil(
      (task.end.getTime() - task.start.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1; // 시작일 포함

    // 실적 상태 자동 판단
    const actualStatus = schedule ? determineActualStatus(schedule) : 'in_progress';
    const statusLabel = actualStatus === 'completed' ? '완료' :
                        actualStatus === 'delayed' ? '지연' : '진행중';
    const statusColor = actualStatus === 'completed' ? 'bg-green-500' :
                        actualStatus === 'delayed' ? 'bg-red-500' : 'bg-orange-500';

    return (
      <div
        className="bg-white border border-gray-300 rounded shadow-lg p-3 text-sm"
        style={{
          position: 'fixed',
          left: mouseX + 15,
          top: mouseY - 80,
          zIndex: 9999,
          pointerEvents: 'none',
          minWidth: '220px'
        }}
      >
        {schedule?.stage && (
          <div className="text-xs text-brand-primary bg-brand-orange-light px-2 py-0.5 rounded inline-block mb-1">
            {schedule.stage}
          </div>
        )}
        <div className="font-semibold text-gray-900">
          {schedule?.taskName || task.name}
        </div>

        {/* 계획/실적 구분 표시 */}
        <div className="mt-2 space-y-1">
          {isPlan && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-300"></span>
              <span className="text-gray-600">
                계획: {formatDate(task.start)} ~ {formatDate(task.end)} ({duration}일)
              </span>
            </div>
          )}
          {isActual && (
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded ${statusColor}`}></span>
              <span className="text-gray-600">
                실적({statusLabel}): {formatDate(task.start)} ~ {formatDate(task.end)} ({duration}일)
              </span>
            </div>
          )}
        </div>

        {/* 전체 정보 (계획 바에만 표시) */}
        {isPlan && schedule?.actualStart && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded ${statusColor}`}></span>
              <span className="text-gray-600">
                실적({statusLabel}): {schedule.actualStart} ~ {schedule.actualEnd || '진행중'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 날짜 범위 계산 (계획과 실적 모두 포함)
  const dateRange = useMemo(() => {
    if (schedules.length === 0) return null;

    let minStart = new Date(schedules[0].plannedStart);
    let maxEnd = new Date(schedules[0].plannedEnd);

    schedules.forEach(s => {
      const plannedStart = new Date(s.plannedStart);
      const plannedEnd = new Date(s.plannedEnd);
      if (plannedStart < minStart) minStart = plannedStart;
      if (plannedEnd > maxEnd) maxEnd = plannedEnd;

      // 실적 날짜도 고려
      if (s.actualStart) {
        const actualStart = new Date(s.actualStart);
        if (actualStart < minStart) minStart = actualStart;
      }
      if (s.actualEnd) {
        const actualEnd = new Date(s.actualEnd);
        if (actualEnd > maxEnd) maxEnd = actualEnd;
      }
    });

    // 버퍼 추가 (뷰 모드에 따라 다름)
    const buffer = new Date(maxEnd);
    if (viewMode === ViewMode.Month) {
      buffer.setMonth(buffer.getMonth() + 1); // 1달 버퍼
    } else if (viewMode === ViewMode.Week) {
      buffer.setDate(buffer.getDate() + 14); // 2주 버퍼
    } else {
      buffer.setDate(buffer.getDate() + 7); // 1주 버퍼
    }

    return { minStart, maxEnd: buffer };
  }, [schedules, viewMode]);

  // 스케줄을 Gantt Task로 변환 (계획 + 실적)
  const tasks: Task[] = useMemo(() => {
    if (schedules.length === 0) return [];
    return schedules.flatMap(scheduleToTasks);
  }, [schedules]);

  // 컨테이너 너비 계산 (날짜 범위 기반)
  const containerWidth = useMemo(() => {
    if (!dateRange) return undefined;

    const { minStart, maxEnd } = dateRange;

    // 뷰 모드별 컬럼 너비
    const colWidth = viewMode === ViewMode.Month ? 150 : viewMode === ViewMode.Week ? 100 : 60;

    // 정확한 개월/주/일 수 계산
    let columns = 0;
    if (viewMode === ViewMode.Month) {
      // 월 단위: 시작월부터 종료월까지의 개월 수
      const startMonth = minStart.getMonth() + minStart.getFullYear() * 12;
      const endMonth = maxEnd.getMonth() + maxEnd.getFullYear() * 12;
      columns = endMonth - startMonth + 1;
    } else if (viewMode === ViewMode.Week) {
      const diffTime = maxEnd.getTime() - minStart.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      columns = Math.ceil(diffDays / 7) + 1;
    } else {
      const diffTime = maxEnd.getTime() - minStart.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      columns = diffDays + 1;
    }

    return columns * colWidth;
  }, [dateRange, viewMode]);

  // 태스크 클릭 핸들러
  const handleTaskClick = (task: Task) => {
    // task.id에서 원본 schedule id 추출
    const scheduleId = task.id.replace(/-plan$/, '').replace(/-actual$/, '');
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (schedule && onTaskClick) {
      onTaskClick(schedule);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        등록된 일정이 없습니다.
      </div>
    );
  }

  return (
    <div className="gantt-container">
      {/* 뷰 모드 선택 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode(ViewMode.Day)}
          className={`px-3 py-1 text-sm rounded ${
            viewMode === ViewMode.Day
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          일
        </button>
        <button
          onClick={() => setViewMode(ViewMode.Week)}
          className={`px-3 py-1 text-sm rounded ${
            viewMode === ViewMode.Week
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          주
        </button>
        <button
          onClick={() => setViewMode(ViewMode.Month)}
          className={`px-3 py-1 text-sm rounded ${
            viewMode === ViewMode.Month
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          월
        </button>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-300 border border-blue-400" />
          <span>계획</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-orange-500" />
          <span>실적(진행중)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500" />
          <span>실적(완료)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500" />
          <span>실적(지연)</span>
        </div>
      </div>

      {/* 간트 차트 - 날짜 범위 제한 */}
      <div className="border rounded overflow-hidden">
        <div
          className="gantt-wrapper"
          style={{
            width: containerWidth ? `${containerWidth}px` : 'auto',
            overflow: 'hidden'
          }}
        >
          <Gantt
            tasks={tasks}
            viewMode={viewMode}
            viewDate={dateRange?.minStart}
            preStepsCount={0}
            onClick={handleTaskClick}
            listCellWidth=""
            columnWidth={viewMode === ViewMode.Month ? 150 : viewMode === ViewMode.Week ? 100 : 60}
            ganttHeight={Math.min(500, tasks.length * 40 + 50)}
            rowHeight={35}
            barCornerRadius={3}
            locale="ko"
            TooltipContent={CustomTooltip}
          />
        </div>
      </div>
    </div>
  );
}