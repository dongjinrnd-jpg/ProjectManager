'use client';

/**
 * 대시보드 클라이언트 컴포넌트
 *
 * Roadmap 2.3 기준
 * - 상단: 타이틀 + [⭐ 즐겨찾기만] [새로고침] 버튼
 * - 카드 4개: 전체, 진행중, 보류, 즐겨찾기
 * - 단계별 현황 차트
 * - 업무 진행사항 / 이슈현황
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';

interface StatusCounts {
  total: number;
  active: number;
  hold: number;
  favorites: number;
}

interface DashboardData {
  statusCounts: StatusCounts;
  favoriteStatusCounts: StatusCounts;
  stageCounts: Record<string, number>;
  favoriteStageCounts: Record<string, number>;
  recentWorklogs: {
    id: string;
    projectId: string;
    date: string;
    customer: string;
    item: string;
    stage: string;
    assigneeId: string;
  }[];
  issueProjects: {
    id: string;
    customer: string;
    item: string;
    issues: string;
  }[];
  favoriteProjectIds: string[];
}

// 표시할 주요 단계들
const MAIN_STAGES = ['검토', '설계', '개발', 'PROTO', '신뢰성', 'P1', 'P2', '승인', '양산이관'];

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/dashboard');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || '대시보드 데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('대시보드 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <AppLayout>
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📊</span> 대시보드
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              showFavoritesOnly
                ? 'bg-brand-orange text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            ⭐ 즐겨찾기만
          </button>
          <button
            onClick={fetchDashboard}
            className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            🔄 새로고침
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
          {/* 상태별 카드 */}
          {(() => {
            const counts = showFavoritesOnly ? data.favoriteStatusCounts : data.statusCounts;
            const stages = showFavoritesOnly ? data.favoriteStageCounts : data.stageCounts;
            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Link href="/projects" className="block">
                    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                      <div className="text-sm text-gray-500 mb-1">
                        전체 {showFavoritesOnly && <span className="text-brand-orange">(즐겨찾기)</span>}
                      </div>
                      <div className="text-3xl font-bold text-gray-900">{counts.total}</div>
                    </div>
                  </Link>
                  <Link href="/projects?status=진행중" className="block">
                    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow border-l-4 border-green-500">
                      <div className="text-sm text-gray-500 mb-1">
                        진행중 {showFavoritesOnly && <span className="text-brand-orange">(즐겨찾기)</span>}
                      </div>
                      <div className="text-3xl font-bold text-green-600">{counts.active}</div>
                    </div>
                  </Link>
                  <Link href="/projects?status=보류" className="block">
                    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow border-l-4 border-yellow-500">
                      <div className="text-sm text-gray-500 mb-1">
                        보류 {showFavoritesOnly && <span className="text-brand-orange">(즐겨찾기)</span>}
                      </div>
                      <div className="text-3xl font-bold text-yellow-600">{counts.hold}</div>
                    </div>
                  </Link>
                  <div className="bg-white rounded-lg shadow p-4 border-l-4 border-brand-orange">
                    <div className="text-sm text-gray-500 mb-1">⭐ 즐겨찾기</div>
                    <div className="text-3xl font-bold text-brand-orange">{data.statusCounts.favorites}</div>
                  </div>
                </div>

                {/* 단계별 현황 */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span>📈</span> 단계별 현황
                    {showFavoritesOnly && <span className="text-sm text-brand-orange font-normal">(즐겨찾기)</span>}
                  </h2>
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                    {MAIN_STAGES.map(stage => (
                      <div
                        key={stage}
                        className="bg-gray-50 rounded-lg p-3 text-center hover:bg-gray-100 transition-colors"
                      >
                        <div className="text-xs text-gray-500 mb-1 truncate" title={stage}>
                          {stage}
                        </div>
                        <div className="text-xl font-bold text-brand-primary">
                          {stages[stage] || 0}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}

          {/* 하단 2열: 업무 진행사항 / 이슈현황 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 업무 진행사항 (1주일간 프로젝트별 최신 1개) */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span>📋</span> 업무 진행사항
                </h2>
                <Link href="/worklogs" className="text-sm text-brand-orange hover:underline">
                  더보기 →
                </Link>
              </div>
              {(() => {
                const filteredWorklogs = showFavoritesOnly
                  ? data.recentWorklogs.filter(w => data.favoriteProjectIds?.includes(w.projectId))
                  : data.recentWorklogs;

                if (filteredWorklogs.length === 0) {
                  return <p className="text-gray-500 text-sm">
                    {showFavoritesOnly ? '즐겨찾기 프로젝트의 업무일지가 없습니다.' : '최근 1주일간 업무일지가 없습니다.'}
                  </p>;
                }

                return (
                  <ul className="space-y-2">
                    {filteredWorklogs.map(worklog => (
                      <li
                        key={worklog.id}
                        className="flex items-center gap-3 text-sm p-2 hover:bg-gray-50 rounded"
                      >
                        <span className="text-gray-400">{worklog.date}</span>
                        <span className="font-medium text-gray-900 truncate flex-1">
                          {worklog.customer} - {worklog.item}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-brand-orange-light text-brand-primary rounded">
                          {worklog.stage}
                        </span>
                        {data.favoriteProjectIds?.includes(worklog.projectId) && (
                          <span className="text-yellow-500" title="즐겨찾기">⭐</span>
                        )}
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>

            {/* 이슈현황 */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>⚠️</span> 이슈현황
              </h2>
              {(() => {
                const filteredIssues = showFavoritesOnly
                  ? data.issueProjects.filter(p => data.favoriteProjectIds?.includes(p.id))
                  : data.issueProjects;

                if (filteredIssues.length === 0) {
                  return <p className="text-gray-500 text-sm">
                    {showFavoritesOnly ? '즐겨찾기 프로젝트에 이슈가 없습니다.' : '현재 이슈가 없습니다.'}
                  </p>;
                }

                return (
                  <ul className="space-y-2">
                    {filteredIssues.map(project => (
                      <li
                        key={project.id}
                        className="text-sm p-2 hover:bg-gray-50 rounded border-l-2 border-red-400"
                      >
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {project.customer} - {project.item}
                          {data.favoriteProjectIds?.includes(project.id) && (
                            <span className="text-yellow-500" title="즐겨찾기">⭐</span>
                          )}
                        </div>
                        <div className="text-gray-500 truncate" title={project.issues}>
                          {project.issues}
                        </div>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>
        </>
      ) : null}
    </AppLayout>
  );
}