'use client';

/**
 * 업무일지 목록 클라이언트 컴포넌트
 *
 * Roadmap 2.11 기준
 * - 업무일지 목록 테이블
 * - 필터링/검색
 * - 작성/수정은 별도 페이지로 이동
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import type { WorkLog, Project, User } from '@/types';
import AppLayout from '@/components/layout/AppLayout';

export default function WorklogsClient() {
  const { data: session } = useSession();
  const [worklogs, setWorklogs] = useState<WorkLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 권한 체크: engineer, admin만 작성 가능 (PRD 3.5)
  const userRole = session?.user?.role;
  const canWriteWorklog = userRole === 'engineer' || userRole === 'admin';

  // 필터 상태
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterAssigneeId, setFilterAssigneeId] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');

  // 삭제 모달
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWorklog, setSelectedWorklog] = useState<WorkLog | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 상세 보기 모달
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 프로젝트 목록 가져오기
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data);
      }
    } catch (err) {
      console.error('프로젝트 목록 조회 오류:', err);
    }
  }, []);

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

  // 업무일지 목록 가져오기
  const fetchWorklogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);
      if (filterProjectId) params.set('projectId', filterProjectId);
      if (filterAssigneeId) params.set('assigneeId', filterAssigneeId);
      if (filterKeyword) params.set('keyword', filterKeyword);

      const response = await fetch(`/api/worklogs?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setWorklogs(data.data);
        setError(null);
      } else {
        setError(data.error || '업무일지 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('업무일지 목록 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterStartDate, filterEndDate, filterProjectId, filterAssigneeId, filterKeyword]);

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, [fetchProjects, fetchUsers]);

  useEffect(() => {
    fetchWorklogs();
  }, [fetchWorklogs]);

  // 사용자 이름 찾기
  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || userId;
  };

  // 프로젝트 정보 찾기 (프로젝트 수정 시 최신 정보 반영)
  const getProjectInfo = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project ? { customer: project.customer, item: project.item } : null;
  };

  // 삭제 모달 열기
  const openDeleteModal = (worklog: WorkLog) => {
    // 본인 작성 건만 삭제 가능
    if (worklog.assigneeId !== session?.user?.id) {
      alert('본인이 작성한 업무일지만 삭제할 수 있습니다.');
      return;
    }
    setSelectedWorklog(worklog);
    setShowDeleteModal(true);
  };

  // 상세 모달 열기
  const openDetailModal = (worklog: WorkLog) => {
    setSelectedWorklog(worklog);
    setShowDetailModal(true);
  };

  // 업무일지 삭제
  const handleDelete = async () => {
    if (!selectedWorklog) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/worklogs/${selectedWorklog.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setShowDeleteModal(false);
        setSelectedWorklog(null);
        fetchWorklogs();
      } else {
        alert(data.error || '업무일지 삭제에 실패했습니다.');
      }
    } catch (err) {
      alert('서버 오류가 발생했습니다.');
      console.error('업무일지 삭제 오류:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // 참여자 이름 목록 가져오기
  const getParticipantNames = (participants: string | undefined) => {
    if (!participants) return '';
    return participants
      .split(',')
      .filter(Boolean)
      .map(id => getUserName(id.trim()))
      .join(',');
  };

  // 담당자 + 참여자 통합 표시
  const getMemberNames = (worklog: WorkLog) => {
    const assignee = getUserName(worklog.assigneeId);
    const participants = getParticipantNames(worklog.participants);
    if (participants) {
      return `${assignee},${participants}`;
    }
    return assignee;
  };

  return (
    <AppLayout>
      {/* 페이지 헤더 (Roadmap 2.11) */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📝</span> 업무일지
        </h1>
        <div className="flex gap-2">
          <button
            disabled
            className="px-4 py-2 text-gray-500 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
            title="추후 지원"
          >
            📥 Excel
          </button>
          {canWriteWorklog && (
            <Link
              href="/worklogs/new"
              className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 transition-colors"
            >
              + 업무일지 작성
            </Link>
          )}
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* 시작 날짜 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">시작일</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
            />
          </div>

          {/* 종료 날짜 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">종료일</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
            />
          </div>

          {/* 프로젝트 필터 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">프로젝트</label>
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
            >
              <option value="">전체</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.customer} - {project.item}
                </option>
              ))}
            </select>
          </div>

          {/* 담당자 필터 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">담당자</label>
            <select
              value={filterAssigneeId}
              onChange={(e) => setFilterAssigneeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
            >
              <option value="">전체</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {/* 키워드 검색 */}
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">검색</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="내용, ITEM, 고객사 검색..."
                value={filterKeyword}
                onChange={(e) => setFilterKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
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
        ) : worklogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            등록된 업무일지가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-base font-medium text-gray-500 w-28">
                    날짜
                  </th>
                  <th className="px-3 py-3 text-left text-base font-medium text-gray-500 w-[450px]">
                    프로젝트
                  </th>
                  <th className="px-3 py-3 text-left text-base font-medium text-gray-500 w-20">
                    단계
                  </th>
                  <th className="px-3 py-3 text-left text-base font-medium text-gray-500 w-56">
                    담당자/참여자
                  </th>
                  <th className="px-3 py-3 text-left text-base font-medium text-gray-500">
                    계획
                  </th>
                  <th className="px-3 py-3 text-center text-base font-medium text-gray-500 w-14">
                    이슈
                  </th>
                  <th className="px-3 py-3 text-left text-base font-medium text-gray-500 w-32">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {worklogs.map((worklog) => (
                  <tr key={worklog.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 whitespace-nowrap text-gray-900">
                      {worklog.date}
                    </td>
                    <td className="px-3 py-3 text-gray-900">
                      {(() => {
                        const projectInfo = getProjectInfo(worklog.projectId);
                        return projectInfo ? (
                          <>
                            <span className="font-medium">{projectInfo.item}</span>
                            <br />
                            <span className="text-gray-500 text-base">{projectInfo.customer}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-medium">{worklog.item}</span>
                            <br />
                            <span className="text-gray-500 text-base">{worklog.customer}</span>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-sm font-semibold rounded-full bg-brand-orange-light text-brand-primary">
                        {worklog.stage}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {getMemberNames(worklog)}
                    </td>
                    <td className="px-3 py-3 text-gray-900">
                      <div className="line-clamp-2" title={worklog.plan || ''}>
                        {(worklog.plan || '').length > 80
                          ? (worklog.plan || '').substring(0, 80) + '...'
                          : (worklog.plan || '-')}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {worklog.issue && worklog.issueStatus === 'open' && (
                        <span title={worklog.issue} className="text-lg cursor-help">⚠️</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <button
                        onClick={() => openDetailModal(worklog)}
                        className="text-blue-600 hover:text-blue-800 mr-2"
                      >
                        상세
                      </button>
                      {canWriteWorklog && worklog.assigneeId === session?.user?.id && (
                        <>
                          <Link
                            href={`/worklogs/${worklog.id}/edit`}
                            className="text-brand-orange hover:text-brand-primary mr-2"
                          >
                            수정
                          </Link>
                          <button
                            onClick={() => openDeleteModal(worklog)}
                            className="text-red-600 hover:text-red-800"
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 총 개수 */}
      <div className="mt-4 text-sm text-gray-500">
        총 {worklogs.length}개의 업무일지
      </div>

      {/* 상세 보기 모달 */}
      {showDetailModal && selectedWorklog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-brand-primary mb-4">
                업무일지 상세 - {selectedWorklog.id}
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">날짜</span>
                    <p className="font-medium">{selectedWorklog.date}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">담당자</span>
                    <p className="font-medium">{getUserName(selectedWorklog.assigneeId)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">프로젝트</span>
                    <p className="font-medium">
                      {(() => {
                        const projectInfo = getProjectInfo(selectedWorklog.projectId);
                        return projectInfo
                          ? `${projectInfo.customer} - ${projectInfo.item}`
                          : `${selectedWorklog.customer} - ${selectedWorklog.item}`;
                      })()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">단계</span>
                    <p>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-brand-orange-light text-brand-primary">
                        {selectedWorklog.stage}
                      </span>
                    </p>
                  </div>
                </div>

                {selectedWorklog.participants && (
                  <div>
                    <span className="text-sm text-gray-500">참여자</span>
                    <p className="mt-1">{getParticipantNames(selectedWorklog.participants)}</p>
                  </div>
                )}

                {selectedWorklog.plan && (
                  <div>
                    <span className="text-sm text-gray-500">계획</span>
                    <p className="mt-1 p-3 bg-gray-50 rounded-md whitespace-pre-wrap">{selectedWorklog.plan}</p>
                  </div>
                )}

                <div>
                  <span className="text-sm text-gray-500">업무 내용</span>
                  <p className="mt-1 p-3 bg-gray-50 rounded-md whitespace-pre-wrap">{selectedWorklog.content}</p>
                </div>

                {selectedWorklog.issue && (
                  <div>
                    <span className="text-sm text-gray-500">이슈사항</span>
                    <div className={`mt-1 p-3 rounded-md whitespace-pre-wrap ${
                      selectedWorklog.issueStatus === 'resolved'
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span>{selectedWorklog.issueStatus === 'resolved' ? '✅' : '⚠️'}</span>
                        <div>
                          <p>{selectedWorklog.issue}</p>
                          {selectedWorklog.issueStatus === 'resolved' && selectedWorklog.issueResolvedAt && (
                            <p className="text-xs text-green-600 mt-1">
                              해결일: {new Date(selectedWorklog.issueResolvedAt).toLocaleString('ko-KR')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-400">
                  작성: {new Date(selectedWorklog.createdAt).toLocaleString('ko-KR')}
                  {selectedWorklog.updatedAt !== selectedWorklog.createdAt && (
                    <> | 수정: {new Date(selectedWorklog.updatedAt).toLocaleString('ko-KR')}</>
                  )}
                </div>
              </div>

              {/* 버튼 */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedWorklog(null);
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  닫기
                </button>
                {canWriteWorklog && selectedWorklog.assigneeId === session?.user?.id && (
                  <Link
                    href={`/worklogs/${selectedWorklog.id}/edit`}
                    className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90"
                  >
                    수정
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && selectedWorklog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-red-600 mb-4">
              업무일지 삭제
            </h2>
            <p className="text-gray-700 mb-6">
              <strong>{selectedWorklog.id}</strong> ({selectedWorklog.date}) 업무일지를 삭제하시겠습니까?
              <br />
              <span className="text-sm text-red-500">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedWorklog(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={isDeleting}
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}