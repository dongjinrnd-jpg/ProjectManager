'use client';

/**
 * 전체 일정 클라이언트 컴포넌트
 *
 * Roadmap 2.13 기준:
 * - 전체 프로젝트 간트차트
 * - 필터: 즐겨찾기, 상태, 소속, 구분
 * - 프로젝트 바 클릭 시 상세 페이지 이동
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import ProjectGanttChart from '@/components/schedules/ProjectGanttChart';
import ProjectDrilldownModal from '@/components/schedules/ProjectDrilldownModal';
import type { GanttProject } from '@/app/api/schedules/gantt/route';

interface SchedulesData {
  projects: GanttProject[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
  totalCount: number;
}

export default function SchedulesClient() {
  const router = useRouter();
  const [data, setData] = useState<SchedulesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 드릴다운 모달 상태
  const [selectedProject, setSelectedProject] = useState<GanttProject | null>(null);
  const [showDrilldownModal, setShowDrilldownModal] = useState(false);

  // 필터 상태
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('진행중');
  const [divisionFilter, setDivisionFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // 필터 옵션
  const statusOptions = ['', '진행중', '보류', '완료'];
  const divisionOptions = ['', '전장', '유압', '기타'];
  const categoryOptions = ['', '농기', '중공업', '해외', '기타'];

  // 데이터 조회
  const fetchSchedules = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (showFavoritesOnly) params.set('favorites', 'true');
      if (statusFilter) params.set('status', statusFilter);
      if (divisionFilter) params.set('division', divisionFilter);
      if (categoryFilter) params.set('category', categoryFilter);

      const response = await fetch(`/api/schedules/gantt?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || '일정 데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('전체 일정 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [showFavoritesOnly, statusFilter, divisionFilter, categoryFilter]);

  // 초기 로드 및 필터 변경 시 재조회
  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // 프로젝트 클릭 핸들러 - 드릴다운 모달 표시
  const handleProjectClick = (project: GanttProject) => {
    setSelectedProject(project);
    setShowDrilldownModal(true);
  };

  // 모달에서 프로젝트 상세 페이지로 이동
  const handleNavigateToProject = (projectId: string) => {
    setShowDrilldownModal(false);
    router.push(`/projects/${projectId}`);
  };

  // 드릴다운 모달 닫기
  const handleCloseDrilldownModal = () => {
    setShowDrilldownModal(false);
    setSelectedProject(null);
  };

  // 필터 초기화
  const resetFilters = () => {
    setShowFavoritesOnly(false);
    setStatusFilter('');
    setDivisionFilter('');
    setCategoryFilter('');
  };

  return (
    <AppLayout>
      {/* 페이지 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📅</span> 전체 일정
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams();
              params.set('type', 'gantt');
              if (showFavoritesOnly) params.set('favorites', 'true');
              if (statusFilter) params.set('status', statusFilter);
              if (divisionFilter) params.set('division', divisionFilter);
              window.location.href = `/api/export/schedules?${params.toString()}`;
            }}
            className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 cursor-pointer"
            title="현재 필터 조건으로 Excel 다운로드"
          >
            📥 Excel
          </button>
          <button
            onClick={fetchSchedules}
            className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            🔄 새로고침
          </button>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* 즐겨찾기 필터 */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              showFavoritesOnly
                ? 'bg-brand-orange text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ⭐ 즐겨찾기만
          </button>

          {/* 상태 필터 */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">상태:</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="">전체</option>
              {statusOptions.filter(s => s).map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* 소속 필터 */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">소속:</label>
            <select
              value={divisionFilter}
              onChange={e => setDivisionFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="">전체</option>
              {divisionOptions.filter(d => d).map(division => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
          </div>

          {/* 구분 필터 */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">구분:</label>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="">전체</option>
              {categoryOptions.filter(c => c).map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* 필터 초기화 */}
          <button
            onClick={resetFilters}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 로딩 */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      ) : data ? (
        <>
          {/* 통계 */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600">
              총 <span className="font-semibold text-brand-primary">{data.totalCount}</span>개 프로젝트
              {showFavoritesOnly && <span className="ml-1 text-brand-orange">(즐겨찾기)</span>}
            </div>
            {data.dateRange.start && data.dateRange.end && (
              <div className="text-sm text-gray-500">
                기간: {data.dateRange.start} ~ {data.dateRange.end}
              </div>
            )}
          </div>

          {/* 간트차트 */}
          <div className="bg-white rounded-lg shadow p-4">
            <ProjectGanttChart
              key={`gantt-${showDrilldownModal}`}
              projects={data.projects}
              onProjectClick={handleProjectClick}
            />
          </div>
        </>
      ) : null}

      {/* 드릴다운 모달 */}
      {showDrilldownModal && (
        <ProjectDrilldownModal
          project={selectedProject}
          onClose={handleCloseDrilldownModal}
          onNavigate={handleNavigateToProject}
        />
      )}
    </AppLayout>
  );
}