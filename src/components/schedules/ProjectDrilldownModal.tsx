'use client';

/**
 * 프로젝트 드릴다운 모달 (기간별 진행현황)
 *
 * Roadmap 2.19 기준:
 * - 간트차트에서 프로젝트 바 클릭 시 표시
 * - 프로젝트 기본 정보
 * - 주간 보고 목록 (해당 기간)
 * - 단계 변경 이력
 * - 세부추진항목 현황
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GanttProject } from '@/app/api/schedules/gantt/route';
import type { WeeklyReport } from '@/types';

// 프로젝트 상태별 색상
const STATUS_COLORS: Record<string, string> = {
  '진행중': 'bg-blue-100 text-blue-800',
  '보류': 'bg-amber-100 text-amber-800',
  '완료': 'bg-emerald-100 text-emerald-800',
};

// 세부추진항목 상태별 색상
const SCHEDULE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  planned: { bg: 'bg-gray-100', text: 'text-gray-600' },
  in_progress: { bg: 'bg-orange-100', text: 'text-orange-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  delayed: { bg: 'bg-red-100', text: 'text-red-700' },
};

const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  planned: '예정',
  in_progress: '진행중',
  completed: '완료',
  delayed: '지연',
};

interface ProjectHistory {
  id: string;
  projectId: string;
  changedField: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
}

interface ProjectScheduleItem {
  id: string;
  projectId: string;
  stage: string;
  taskName: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  status: string;
}

interface ProjectDrilldownModalProps {
  project: GanttProject | null;
  onClose: () => void;
  onNavigate: (projectId: string) => void;
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 날짜를 M/D 형식으로 포맷
 */
function formatShortDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 주차 계산 (해당 월의 첫 월요일 기준)
 */
function getWeekInfo(dateStr: string): { year: number; month: number; week: number } {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  // 해당 월의 첫 번째 월요일 찾기
  const firstDay = new Date(year, month - 1, 1);
  const dayOfWeek = firstDay.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);
  const firstMonday = new Date(year, month - 1, 1 + daysUntilMonday);

  // 주차 계산
  if (date < firstMonday) {
    return { year, month, week: 1 };
  }

  const diffTime = date.getTime() - firstMonday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;

  return { year, month, week };
}

/**
 * 진행률 계산 (오늘 기준)
 */
function calculateProgress(startStr: string, endStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endStr);
  end.setHours(0, 0, 0, 0);

  if (today < start) return 0;
  if (today >= end) return 100;

  const total = end.getTime() - start.getTime();
  const elapsed = today.getTime() - start.getTime();
  return Math.round((elapsed / total) * 100);
}

export default function ProjectDrilldownModal({
  project,
  onClose,
  onNavigate,
}: ProjectDrilldownModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'weekly' | 'history' | 'schedule'>('weekly');

  // 년/월 선택 상태 (기본값: 현재 년/월)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  // 데이터 상태
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [projectHistory, setProjectHistory] = useState<ProjectHistory[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ProjectScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 년도 옵션 (현재 년도 ± 2년)
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  // 주간 보고 조회 (년/월 필터링)
  const fetchWeeklyReports = useCallback(async (projectId: string, year: number, month: number) => {
    try {
      const response = await fetch(`/api/weekly-reports?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        // 선택된 년/월에 해당하는 주간 보고만 필터링
        const filtered = (data.data || []).filter((report: WeeklyReport) => {
          if (!report.weekStart) return false;
          const reportDate = new Date(report.weekStart);
          return reportDate.getFullYear() === year && reportDate.getMonth() + 1 === month;
        });
        setWeeklyReports(filtered);
      }
    } catch (err) {
      console.error('주간 보고 조회 오류:', err);
    }
  }, []);

  // 프로젝트 이력 조회 (년/월 필터링)
  const fetchProjectHistory = useCallback(async (projectId: string, year: number, month: number) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/history`);
      const data = await response.json();
      if (data.success) {
        // 단계 변경 이력만 필터링 + 년/월 필터
        const stageHistory = (data.data || []).filter((h: ProjectHistory) => {
          if (h.changedField !== 'currentStage' && h.changedField !== '단계') return false;
          if (!h.changedAt) return false;
          const historyDate = new Date(h.changedAt);
          return historyDate.getFullYear() === year && historyDate.getMonth() + 1 === month;
        });
        setProjectHistory(stageHistory);
      }
    } catch (err) {
      console.error('프로젝트 이력 조회 오류:', err);
    }
  }, []);

  // 세부추진항목 조회 (년/월 필터링 - 해당 월에 진행중인 항목)
  const fetchScheduleItems = useCallback(async (projectId: string, year: number, month: number) => {
    try {
      const response = await fetch(`/api/schedules?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        // 선택된 년/월에 해당하는 항목 필터링
        // (계획 시작~종료 또는 실적 시작~종료가 해당 월과 겹치는 항목)
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0); // 해당 월의 마지막 날

        const filtered = (data.data || []).filter((item: ProjectScheduleItem) => {
          const plannedStart = item.plannedStart ? new Date(item.plannedStart) : null;
          const plannedEnd = item.plannedEnd ? new Date(item.plannedEnd) : null;
          const actualStart = item.actualStart ? new Date(item.actualStart) : null;
          const actualEnd = item.actualEnd ? new Date(item.actualEnd) : null;

          // 계획 기간이 해당 월과 겹치는지
          const plannedOverlaps = plannedStart && plannedEnd &&
            plannedStart <= monthEnd && plannedEnd >= monthStart;

          // 실적 기간이 해당 월과 겹치는지
          const actualOverlaps = actualStart &&
            actualStart <= monthEnd && (!actualEnd || actualEnd >= monthStart);

          return plannedOverlaps || actualOverlaps;
        });
        setScheduleItems(filtered);
      }
    } catch (err) {
      console.error('세부추진항목 조회 오류:', err);
    }
  }, []);

  // 프로젝트 또는 년/월 변경 시 데이터 로드
  useEffect(() => {
    if (project) {
      setIsLoading(true);
      Promise.all([
        fetchWeeklyReports(project.id, selectedYear, selectedMonth),
        fetchProjectHistory(project.id, selectedYear, selectedMonth),
        fetchScheduleItems(project.id, selectedYear, selectedMonth),
      ]).finally(() => {
        setIsLoading(false);
      });
    }
  }, [project, selectedYear, selectedMonth, fetchWeeklyReports, fetchProjectHistory, fetchScheduleItems]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // 외부 클릭으로 닫기
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  if (!project) return null;

  const progress = calculateProgress(project.scheduleStart, project.scheduleEnd);
  const statusClass = STATUS_COLORS[project.status] || STATUS_COLORS['진행중'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* 헤더 */}
        <div className="bg-brand-primary text-white px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <h2 className="text-lg font-semibold">기간별 진행현황</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* 프로젝트 기본 정보 */}
        <div className="px-6 py-4 bg-gray-50 border-b flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                {project.isFavorite && <span className="text-yellow-500">⭐</span>}
                <span className="text-lg font-semibold text-gray-900">
                  {project.customer} - {project.item}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-sm">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                  {project.status}
                </span>
                <span className="text-gray-500">
                  {formatDate(project.scheduleStart)} ~ {formatDate(project.scheduleEnd)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">진행률</div>
              <div className="text-2xl font-bold text-brand-primary">{progress}%</div>
            </div>
          </div>

          {/* 진행률 바 */}
          <div className="mt-3">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* 조회 기간 선택 */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-gray-600">조회 기간:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex border-b flex-shrink-0">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'weekly'
                ? 'text-brand-primary border-b-2 border-brand-primary bg-brand-primary/5'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📋 주간 보고 ({selectedMonth}월)
            {weeklyReports.length > 0 && (
              <span className="ml-1 text-xs bg-brand-primary text-white px-1.5 py-0.5 rounded-full">
                {weeklyReports.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-brand-primary border-b-2 border-brand-primary bg-brand-primary/5'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🔄 이력 ({selectedMonth}월)
            {projectHistory.length > 0 && (
              <span className="ml-1 text-xs bg-gray-500 text-white px-1.5 py-0.5 rounded-full">
                {projectHistory.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'schedule'
                ? 'text-brand-primary border-b-2 border-brand-primary bg-brand-primary/5'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📅 추진항목 ({selectedMonth}월)
            {scheduleItems.length > 0 && (
              <span className="ml-1 text-xs bg-gray-500 text-white px-1.5 py-0.5 rounded-full">
                {scheduleItems.length}
              </span>
            )}
          </button>
        </div>

        {/* 탭 내용 */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
            </div>
          ) : (
            <>
              {/* 주간 보고 탭 */}
              {activeTab === 'weekly' && (
                <div className="space-y-3">
                  {weeklyReports.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      {selectedYear}년 {selectedMonth}월에 등록된 주간 보고가 없습니다.
                    </div>
                  ) : (
                    weeklyReports.map((report) => {
                      const weekInfo = getWeekInfo(report.weekStart);
                      return (
                        <div
                          key={report.id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">📅</span>
                              <span className="font-medium text-gray-700">
                                {weekInfo.year}년 {weekInfo.month}월 {weekInfo.week}주차
                              </span>
                              <span className="text-xs text-gray-400">
                                ({formatShortDate(report.weekStart)} ~ {formatShortDate(report.weekEnd)})
                              </span>
                            </div>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                              {report.categoryId}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">
                            {report.content}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* 단계 변경 이력 탭 */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  {projectHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      {selectedYear}년 {selectedMonth}월에 단계 변경 이력이 없습니다.
                    </div>
                  ) : (
                    projectHistory.map((history) => (
                      <div
                        key={history.id}
                        className="flex items-center gap-4 border-l-2 border-brand-primary pl-4 py-2"
                      >
                        <div className="flex-shrink-0 text-sm text-gray-500">
                          {formatDate(history.changedAt)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-sm">
                            {history.oldValue || '없음'}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded text-sm font-medium">
                            {history.newValue}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          by {history.changedBy}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 세부추진항목 탭 */}
              {activeTab === 'schedule' && (
                <div className="space-y-2">
                  {scheduleItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      {selectedYear}년 {selectedMonth}월에 해당하는 세부추진항목이 없습니다.
                    </div>
                  ) : (
                    scheduleItems.map((item) => {
                      const statusColor = SCHEDULE_STATUS_COLORS[item.status] || SCHEDULE_STATUS_COLORS.planned;
                      const statusLabel = SCHEDULE_STATUS_LABELS[item.status] || item.status;

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {item.stage}
                              </span>
                              <span className="font-medium text-gray-800">{item.taskName}</span>
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              계획: {formatShortDate(item.plannedStart)} ~ {formatShortDate(item.plannedEnd)}
                              {item.actualStart && (
                                <span className="ml-2">
                                  | 실적: {formatShortDate(item.actualStart)}
                                  {item.actualEnd && ` ~ ${formatShortDate(item.actualEnd)}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                            {statusLabel}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            닫기
          </button>
          <button
            onClick={() => onNavigate(project.id)}
            className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-dark transition-colors"
          >
            프로젝트 상세 보기 →
          </button>
        </div>
      </div>
    </div>
  );
}