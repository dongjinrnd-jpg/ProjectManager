'use client';

/**
 * 경영진 대시보드 클라이언트 컴포넌트
 *
 * Roadmap 2.23 기준
 * - 상단: 타이틀 + 현재 주차
 * - 요약: 정상/지연/완료 건수
 * - 프로젝트 카드 그리드 (6~8개)
 * - 주간 보고 요약
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import ProjectDetailModal from '@/components/executive/ProjectDetailModal';
import CommentModal from '@/components/executive/CommentModal';
import type { ProjectStage, ProjectStatus } from '@/types';

interface ExecutiveProject {
  id: string;
  customer: string;
  item: string;
  division: string;
  category: string;
  currentStage: ProjectStage;
  stages: string[];
  stageHistory: Record<string, string>;
  status: ProjectStatus;
  scheduleStart: string;
  scheduleEnd: string;
  teamLeaderId: string;
  teamLeaderName: string;
  issues: string;
  progress: number;
  healthStatus: 'normal' | 'delayed' | 'completed';
  commentCount: number;
}

interface ExecutiveDashboardData {
  favoriteProjects: ExecutiveProject[];
  statusSummary: {
    normal: number;
    delayed: number;
    completed: number;
  };
  weeklyReportSummary: string;
  currentWeek: {
    year: number;
    month: number;
    week: number;
    weekStart: string;
    weekEnd: string;
  };
}

export default function ExecutiveClient() {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 모달 상태
  const [selectedProject, setSelectedProject] = useState<ExecutiveProject | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/executive/dashboard');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || '대시보드 데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('경영진 대시보드 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // 프로젝트 카드 클릭
  const handleProjectClick = (project: ExecutiveProject) => {
    setSelectedProject(project);
    setShowDetailModal(true);
  };

  // 코멘트 버튼 클릭
  const handleCommentClick = (e: React.MouseEvent, project: ExecutiveProject) => {
    e.stopPropagation();
    setSelectedProject(project);
    setShowCommentModal(true);
  };

  // 모달 닫기
  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedProject(null);
  };

  const handleCloseCommentModal = () => {
    setShowCommentModal(false);
  };

  // 코멘트 작성 후 새로고침
  const handleCommentCreated = () => {
    fetchDashboard();
    setShowCommentModal(false);
  };

  // 상태별 아이콘/색상
  const getHealthIcon = (health: 'normal' | 'delayed' | 'completed') => {
    switch (health) {
      case 'completed':
        return { icon: '✅', text: '완료', color: 'text-green-600', bg: 'bg-green-100' };
      case 'delayed':
        return { icon: '⚠️', text: '지연', color: 'text-yellow-600', bg: 'bg-yellow-100' };
      default:
        return { icon: '🟢', text: '정상', color: 'text-green-600', bg: 'bg-green-100' };
    }
  };

  return (
    <AppLayout>
      {/* 페이지 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>👔</span> 경영진 대시보드
          </h1>
          {data && (
            <p className="text-sm text-gray-500 mt-1">
              {data.currentWeek.year}년 {data.currentWeek.month}월 {data.currentWeek.week}주차
              <span className="ml-2 text-gray-400">
                ({data.currentWeek.weekStart} ~ {data.currentWeek.weekEnd})
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/executive/comparison"
            className="px-4 py-2 bg-brand-orange text-white rounded-md text-sm font-medium hover:bg-brand-orange/90 transition-colors"
          >
            📊 계획vs실적 상세
          </Link>
          <Link
            href="/projects?favorites=true"
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            ⭐ 즐겨찾기 관리
          </Link>
          <button
            onClick={fetchDashboard}
            className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            🔄
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        </div>
      ) : data ? (
        <>
          {/* 상태 요약 카드 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-500 mb-1">🟢 정상</div>
              <div className="text-3xl font-bold text-green-600">{data.statusSummary.normal}건</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <div className="text-sm text-gray-500 mb-1">⚠️ 지연</div>
              <div className="text-3xl font-bold text-yellow-600">{data.statusSummary.delayed}건</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="text-sm text-gray-500 mb-1">✅ 완료</div>
              <div className="text-3xl font-bold text-blue-600">{data.statusSummary.completed}건</div>
            </div>
          </div>

          {/* 프로젝트 카드 섹션 */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              📊 주요 프로젝트 현황
              <span className="text-sm font-normal text-gray-500">
                (즐겨찾기 {data.favoriteProjects.length}개)
              </span>
            </h2>

            {data.favoriteProjects.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500 mb-4">즐겨찾기한 프로젝트가 없습니다.</p>
                <Link
                  href="/projects"
                  className="text-brand-orange hover:underline"
                >
                  프로젝트 목록에서 즐겨찾기를 추가하세요 →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {data.favoriteProjects.map((project) => {
                  const health = getHealthIcon(project.healthStatus);
                  return (
                    <div
                      key={project.id}
                      onClick={() => handleProjectClick(project)}
                      className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow cursor-pointer border-l-4"
                      style={{
                        borderLeftColor:
                          project.healthStatus === 'completed'
                            ? '#10B981'
                            : project.healthStatus === 'delayed'
                            ? '#F59E0B'
                            : '#10B981',
                      }}
                    >
                      {/* 헤더: 고객사/ITEM */}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-sm text-gray-500">{project.customer}</div>
                          <div className="font-semibold text-gray-900 truncate" title={project.item}>
                            {project.item}
                          </div>
                        </div>
                        {/* 코멘트 버튼 */}
                        <button
                          onClick={(e) => handleCommentClick(e, project)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          💬
                          {project.commentCount > 0 && (
                            <span className="bg-brand-orange text-white text-xs px-1.5 rounded-full">
                              {project.commentCount}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* 현재 단계 */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs px-2 py-1 bg-brand-orange-light text-brand-primary rounded font-medium">
                          {project.currentStage}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${health.bg} ${health.color}`}>
                          {health.icon} {health.text}
                        </span>
                      </div>

                      {/* 진행률 바 */}
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>진행률</span>
                          <span>{project.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              project.healthStatus === 'completed'
                                ? 'bg-green-500'
                                : project.healthStatus === 'delayed'
                                ? 'bg-yellow-500'
                                : 'bg-brand-orange'
                            }`}
                            style={{ width: `${project.progress}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* 대일정 */}
                      <div className="text-xs text-gray-400">
                        {project.scheduleStart && project.scheduleEnd
                          ? `${project.scheduleStart} ~ ${project.scheduleEnd}`
                          : '일정 미설정'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 주간 보고 요약 섹션 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              📋 금주 주간 보고 요약
            </h2>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">
              {data.weeklyReportSummary}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link
                href="/weekly-reports"
                className="text-brand-orange hover:underline text-sm"
              >
                주간 보고 전체 보기 →
              </Link>
            </div>
          </div>
        </>
      ) : null}

      {/* 프로젝트 상세 모달 */}
      {showDetailModal && selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={handleCloseDetailModal}
          onCommentClick={() => {
            setShowDetailModal(false);
            setShowCommentModal(true);
          }}
          onRefresh={fetchDashboard}
        />
      )}

      {/* 코멘트 작성 모달 */}
      {showCommentModal && selectedProject && (
        <CommentModal
          project={selectedProject}
          onClose={handleCloseCommentModal}
          onCommentCreated={handleCommentCreated}
        />
      )}
    </AppLayout>
  );
}
