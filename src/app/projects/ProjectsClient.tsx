'use client';

/**
 * 프로젝트 목록 클라이언트 컴포넌트
 *
 * Roadmap 2.4 기준
 * - 프로젝트 목록 테이블
 * - 필터링/검색
 * - 생성/수정은 별도 페이지로 이동
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import type { Project, ProjectStatus, ProjectStage, User } from '@/types';
import AppLayout from '@/components/layout/AppLayout';

// 단계 목록
const STAGES: ProjectStage[] = [
  '검토', '설계', '개발', 'PROTO', '신뢰성', 'P1', 'P2',
  '승인', '양산이관', '초도양산', '품질관리', '원가절감', '품질개선', '설계변경'
];

// 소속 목록
const DIVISIONS = ['전장', '유압', '기타'];

// 상태 목록
const STATUSES: ProjectStatus[] = ['진행중', '보류', '완료'];

export default function ProjectsClient() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 권한 체크: engineer, admin만 프로젝트 생성/수정 가능 (PRD 3.5)
  const userRole = session?.user?.role;
  const canManageProjects = userRole === 'engineer' || userRole === 'admin';

  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDivision, setFilterDivision] = useState<string>('');
  const [filterStage, setFilterStage] = useState<string>('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(true);

  // 즐겨찾기 상태
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<string[]>([]);
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 사용자 목록 가져오기
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (data.success) {
        setUsers(data.data.filter((u: User) => u.isActive));
      }
    } catch (err) {
      console.error('사용자 목록 조회 오류:', err);
    }
  }, []);

  // 즐겨찾기 목록 가져오기
  const fetchFavorites = useCallback(async () => {
    try {
      const response = await fetch('/api/favorites');
      const data = await response.json();
      if (data.success) {
        setFavoriteProjectIds(data.data.map((f: { projectId: string }) => f.projectId));
      }
    } catch (err) {
      console.error('즐겨찾기 목록 조회 오류:', err);
    }
  }, []);

  // 즐겨찾기 토글
  const toggleFavorite = async (projectId: string) => {
    if (favoriteLoading) return;
    setFavoriteLoading(projectId);

    try {
      const isFavorite = favoriteProjectIds.includes(projectId);

      if (isFavorite) {
        // 즐겨찾기 해제
        const response = await fetch(`/api/favorites?projectId=${projectId}`, {
          method: 'DELETE',
        });
        const data = await response.json();
        if (data.success) {
          setFavoriteProjectIds(prev => prev.filter(id => id !== projectId));
        }
      } else {
        // 즐겨찾기 등록
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });
        const data = await response.json();
        if (data.success) {
          setFavoriteProjectIds(prev => [...prev, projectId]);
        }
      }
    } catch (err) {
      console.error('즐겨찾기 토글 오류:', err);
    } finally {
      setFavoriteLoading(null);
    }
  };

  // 프로젝트 목록 가져오기
  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filterStatus) params.set('status', filterStatus);
      if (filterDivision) params.set('division', filterDivision);
      if (filterStage) params.set('stage', filterStage);

      const response = await fetch(`/api/projects?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setProjects(data.data);
        setError(null);
      } else {
        setError(data.error || '프로젝트 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('프로젝트 목록 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterStatus, filterDivision, filterStage]);

  useEffect(() => {
    fetchUsers();
    fetchFavorites();
  }, [fetchUsers, fetchFavorites]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 사용자 이름 찾기
  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || userId;
  };

  // 즐겨찾기 필터 적용
  const filteredProjects = showFavoritesOnly
    ? projects.filter(p => favoriteProjectIds.includes(p.id))
    : projects;

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProjects = filteredProjects.slice(startIndex, startIndex + itemsPerPage);

  // 페이지 변경 시 첫 페이지로 리셋 (필터 변경 시)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterDivision, filterStage, showFavoritesOnly]);

  // 페이지 번호 생성 (최대 5개 표시)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  // 상태 배지 색상 (Roadmap: 🟢 완료, 🟡 진행중, 🔴 보류)
  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case '진행중':
        return 'bg-yellow-100 text-yellow-800';
      case '완료':
        return 'bg-green-100 text-green-800';
      case '보류':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 단계 배지 색상 (상태에 따라)
  const getStageBadge = (status: ProjectStatus) => {
    switch (status) {
      case '진행중':
        return { bg: 'bg-yellow-100 text-yellow-800', icon: '🟡' };
      case '완료':
        return { bg: 'bg-green-100 text-green-800', icon: '🟢' };
      case '보류':
        return { bg: 'bg-red-100 text-red-800', icon: '🔴' };
      default:
        return { bg: 'bg-gray-100 text-gray-800', icon: '⚪' };
    }
  };

  return (
    <AppLayout>
      {/* 페이지 헤더 (Roadmap 2.4) */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📁</span> 프로젝트 목록
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (searchQuery) params.set('search', searchQuery);
              if (filterStatus) params.set('status', filterStatus);
              if (filterDivision) params.set('division', filterDivision);
              if (filterStage) params.set('stage', filterStage);
              if (showFavoritesOnly) params.set('favorites', 'true');
              window.location.href = `/api/export/projects?${params.toString()}`;
            }}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors"
            title="현재 필터 조건으로 Excel 다운로드"
          >
            📥 Excel
          </button>
          {canManageProjects && (
            <Link
              href="/projects/new"
              className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 transition-colors"
            >
              + 새 프로젝트
            </Link>
          )}
        </div>
      </div>

      {/* 필터 영역 (Roadmap 2.4) */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">필터:</span>

          {/* 상태 필터 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
          >
            <option value="">전체</option>
            {STATUSES.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          {/* 소속 필터 */}
          <select
            value={filterDivision}
            onChange={(e) => setFilterDivision(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
          >
            <option value="">전체 소속</option>
            {DIVISIONS.map(div => (
              <option key={div} value={div}>{div}</option>
            ))}
          </select>

          {/* 단계 필터 */}
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
          >
            <option value="">전체 단계</option>
            {STAGES.map(stage => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>

          {/* 즐겨찾기 필터 버튼 */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-2 text-sm border rounded-md transition-colors ${
              showFavoritesOnly
                ? 'bg-brand-orange text-white border-brand-orange'
                : 'text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            ⭐ 즐겨찾기 {showFavoritesOnly && `(${favoriteProjectIds.length})`}
          </button>

          {/* 검색 */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="고객사, ITEM 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">로딩 중...</div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            등록된 프로젝트가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                    ⭐
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    고객사
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ITEM
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    소속
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    팀장
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    현재단계
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    대일정
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={() => toggleFavorite(project.id)}
                        disabled={favoriteLoading === project.id}
                        className={`text-lg hover:scale-110 transition-transform ${
                          favoriteLoading === project.id ? 'opacity-50' : ''
                        }`}
                        title={favoriteProjectIds.includes(project.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                      >
                        {favoriteProjectIds.includes(project.id) ? '⭐' : '☆'}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {project.id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(project.status)}`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {project.customer}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {project.item}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {project.division}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {getUserName(project.teamLeaderId)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${getStageBadge(project.status).bg}`}>
                        {getStageBadge(project.status).icon} {project.currentStage}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {project.scheduleStart} ~ {project.scheduleEnd}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-brand-orange hover:text-brand-primary font-medium"
                        title="상세 보기"
                      >
                        상세 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          총 {filteredProjects.length}건 {showFavoritesOnly && `(즐겨찾기 필터 적용)`}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &lt;
            </button>
            {getPageNumbers().map((page, idx) => (
              typeof page === 'number' ? (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 text-sm border rounded ${
                    currentPage === page
                      ? 'bg-brand-orange text-white border-brand-orange'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ) : (
                <span key={idx} className="px-2 text-gray-400">...</span>
              )
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &gt;
            </button>
          </div>
        )}
      </div>

    </AppLayout>
  );
}