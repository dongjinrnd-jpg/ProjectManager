'use client';

/**
 * 계획 vs 실적 비교 클라이언트 컴포넌트
 *
 * Roadmap 2.24 기준:
 * - 년도 필터
 * - 즐겨찾기 토글
 * - 월별 계획/실적 바 표시
 * - 상태 표시 (정상/지연/완료)
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import type { ProjectStatus } from '@/types';

interface MonthlyData {
  month: number;
  hasPlan: boolean;
  hasActual: boolean;
  planProgress: number;
  actualProgress: number;
}

interface ComparisonProject {
  id: string;
  customer: string;
  item: string;
  currentStage: string;
  status: ProjectStatus;
  scheduleStart: string;
  scheduleEnd: string;
  teamLeaderName: string;
  healthStatus: 'normal' | 'delayed' | 'completed';
  progress: number;
  monthlyData: MonthlyData[];
}

interface ComparisonData {
  projects: ComparisonProject[];
  year: number;
  favoritesOnly: boolean;
}

// 월 이름
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export default function ComparisonClient() {
  const currentYear = new Date().getFullYear();

  const [data, setData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(currentYear);
  const [favoritesOnly, setFavoritesOnly] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/executive/comparison?year=${year}&favoritesOnly=${favoritesOnly}`
      );
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || '데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('비교 데이터 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [year, favoritesOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 상태 아이콘/색상
  const getHealthIcon = (health: 'normal' | 'delayed' | 'completed') => {
    switch (health) {
      case 'completed':
        return { icon: '✅', color: 'text-green-600' };
      case 'delayed':
        return { icon: '🔴', color: 'text-red-600' };
      default:
        return { icon: '🟢', color: 'text-green-600' };
    }
  };

  // 년도 옵션 (현재년도 -2 ~ +1)
  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    yearOptions.push(y);
  }

  return (
    <AppLayout>
      {/* 페이지 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/executive"
            className="text-gray-500 hover:text-gray-700"
          >
            ← 대시보드
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            📊 계획 vs 실적 비교
          </h1>
        </div>
        <div className="flex gap-2">
          {/* 년도 선택 */}
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>

          {/* 즐겨찾기 토글 */}
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              favoritesOnly
                ? 'bg-brand-orange text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            ⭐ 즐겨찾기만
          </button>

          <button
            onClick={fetchData}
            className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            🔄
          </button>
        </div>
      </div>

      {/* 범례 */}
      <div className="mb-4 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 bg-blue-500 rounded-sm"></div>
          <span className="text-gray-600">계획</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 bg-green-500 rounded-sm" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)' }}></div>
          <span className="text-gray-600">실적</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🟢</span>
          <span className="text-gray-600">정상</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🟡</span>
          <span className="text-gray-600">지연</span>
        </div>
        <div className="flex items-center gap-2">
          <span>✅</span>
          <span className="text-gray-600">완료</span>
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
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                  프로젝트
                </th>
                {MONTHS.map((month, idx) => (
                  <th
                    key={idx}
                    className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px]"
                  >
                    {month}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px]">
                  상태
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.projects.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                    {favoritesOnly
                      ? '즐겨찾기한 프로젝트가 없습니다.'
                      : '프로젝트가 없습니다.'}
                  </td>
                </tr>
              ) : (
                data.projects.map((project) => {
                  const health = getHealthIcon(project.healthStatus);
                  return (
                    <tr key={project.id} className="hover:bg-gray-50">
                      {/* 프로젝트 정보 */}
                      <td className="px-4 py-3 sticky left-0 bg-white z-10">
                        <Link
                          href={`/projects/${project.id}`}
                          className="block hover:text-brand-orange"
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {project.customer}
                          </div>
                          <div className="text-sm text-gray-500 truncate max-w-[180px]">
                            {project.item}
                          </div>
                        </Link>
                      </td>

                      {/* 월별 바 */}
                      {project.monthlyData.map((monthData, idx) => (
                        <td key={idx} className="px-1 py-3">
                          <div className="h-8 flex flex-col justify-center gap-0.5">
                            {/* 계획 바 */}
                            {monthData.hasPlan && (
                              <div
                                className="h-3 bg-blue-500 rounded-sm"
                                style={{ width: '100%', opacity: 0.8 }}
                                title={`계획: ${monthData.planProgress}%`}
                              ></div>
                            )}
                            {/* 실적 바 */}
                            {monthData.hasActual && (
                              <div
                                className="h-3 bg-green-500 rounded-sm"
                                style={{
                                  width: '100%',
                                  backgroundImage:
                                    'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)',
                                }}
                                title="실적 진행중"
                              ></div>
                            )}
                          </div>
                        </td>
                      ))}

                      {/* 상태 */}
                      <td className="px-4 py-3 text-center">
                        <span className={health.color}>{health.icon}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* 하단 안내 */}
      {data && data.projects.length > 0 && (
        <div className="mt-4 text-sm text-gray-500">
          총 {data.projects.length}개 프로젝트 |{' '}
          <span className="text-green-600">정상: {data.projects.filter(p => p.healthStatus === 'normal').length}</span> |{' '}
          <span className="text-red-600">지연: {data.projects.filter(p => p.healthStatus === 'delayed').length}</span> |{' '}
          <span className="text-blue-600">완료: {data.projects.filter(p => p.healthStatus === 'completed').length}</span>
        </div>
      )}
    </AppLayout>
  );
}
