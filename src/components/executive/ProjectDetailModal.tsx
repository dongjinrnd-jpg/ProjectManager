'use client';

/**
 * 경영진용 프로젝트 상세 모달
 *
 * Roadmap 2.26 기준:
 * - 프로젝트 현황 (단계, 진행률, 상태, 대일정, 팀장)
 * - 단계 진행 시각화 (✅→🟡→⬜)
 * - 최근 진행사항 (주간보고 최근 5건)
 * - 이슈사항
 * - 코멘트 스레드
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { ProjectStage, ProjectStatus, CommentThread } from '@/types';

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

interface RecentProgress {
  id: string;
  date: string;
  content: string;
  author?: string;
}

interface ProjectDetailModalProps {
  project: ExecutiveProject;
  onClose: () => void;
  onCommentClick: () => void;
  onRefresh: () => void;
}

// 상태별 색상
const STATUS_COLORS: Record<string, string> = {
  '진행중': 'bg-blue-100 text-blue-800',
  '보류': 'bg-amber-100 text-amber-800',
  '완료': 'bg-emerald-100 text-emerald-800',
};

/**
 * 날짜를 M/D 형식으로 포맷
 */
function formatShortDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 날짜를 M월 N주차 형식으로 포맷 (주간보고용)
 */
function formatWeekLabel(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;

  // 해당 월의 1일
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  // 1일의 요일 (0=일, 1=월, ...)
  const firstDayOfWeek = firstDayOfMonth.getDay();
  // 월요일 기준 조정 (월=0, 화=1, ... 일=6)
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  // 해당 날짜가 몇 번째 주인지 계산
  const weekOfMonth = Math.ceil((date.getDate() + adjustedFirstDay) / 7);

  return `${month}월 ${weekOfMonth}주차`;
}

export default function ProjectDetailModal({
  project,
  onClose,
  onCommentClick,
  onRefresh,
}: ProjectDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentProgress, setRecentProgress] = useState<RecentProgress[]>([]);
  const [commentThreads, setCommentThreads] = useState<CommentThread[]>([]);
  const [activeTab, setActiveTab] = useState<'progress' | 'issues' | 'comments'>('progress');

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // 모달 외부 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // 데이터 로드
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // 최근 진행사항 (주간보고만)
      const [weeklyRes, commentsRes] = await Promise.all([
        fetch(`/api/weekly-reports?projectId=${project.id}`),
        fetch(`/api/comments?projectId=${project.id}`),
      ]);

      const [weeklyData, commentsData] = await Promise.all([
        weeklyRes.json(),
        commentsRes.json(),
      ]);

      // 주간보고 목록 (최신 5건)
      const progress: RecentProgress[] = [];

      if (weeklyData.success && weeklyData.data) {
        weeklyData.data.slice(0, 5).forEach((r: { id: string; weekStart: string; content: string; createdById: string }) => {
          progress.push({
            id: r.id,
            date: r.weekStart,
            content: r.content?.slice(0, 100) || '',
            author: r.createdById,
          });
        });
      }

      // 날짜순 정렬 (최신순)
      progress.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentProgress(progress);

      // 코멘트 스레드
      if (commentsData.success && commentsData.data) {
        setCommentThreads(commentsData.data);
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 단계 상태 계산
  const getStageStatus = (stage: string): 'completed' | 'current' | 'pending' => {
    const stages = project.stages;
    const currentIndex = stages.indexOf(project.currentStage);
    const stageIndex = stages.indexOf(stage);

    if (stageIndex < currentIndex) return 'completed';
    if (stageIndex === currentIndex) return 'current';
    return 'pending';
  };

  // 단계 아이콘
  const getStageIcon = (status: 'completed' | 'current' | 'pending') => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'current':
        return '🟡';
      default:
        return '⬜';
    }
  };

  // 건강 상태 표시
  const getHealthDisplay = () => {
    switch (project.healthStatus) {
      case 'completed':
        return { icon: '✅', text: '완료', color: 'text-green-600' };
      case 'delayed':
        return { icon: '⚠️', text: '지연', color: 'text-yellow-600' };
      default:
        return { icon: '🟢', text: '정상', color: 'text-green-600' };
    }
  };

  const health = getHealthDisplay();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            📋 {project.customer} - {project.item}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 프로젝트 현황 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">📊 프로젝트 현황</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">현재단계</span>
                <div className="font-medium text-brand-primary">{project.currentStage}</div>
              </div>
              <div>
                <span className="text-gray-500">진행률</span>
                <div className="font-medium">{project.progress}%</div>
              </div>
              <div>
                <span className="text-gray-500">상태</span>
                <div className={`font-medium ${health.color}`}>
                  {health.icon} {health.text}
                </div>
              </div>
              <div>
                <span className="text-gray-500">대일정</span>
                <div className="font-medium">
                  {project.scheduleEnd || '-'}
                </div>
              </div>
              <div>
                <span className="text-gray-500">담당 팀장</span>
                <div className="font-medium">{project.teamLeaderName}</div>
              </div>
              <div>
                <span className="text-gray-500">프로젝트 상태</span>
                <div>
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[project.status] || 'bg-gray-100'}`}>
                    {project.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 단계 진행 시각화 */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">📈 단계 진행</h3>
            <div className="flex flex-wrap items-center gap-1 text-sm">
              {project.stages.map((stage, idx) => {
                const status = getStageStatus(stage);
                const icon = getStageIcon(status);
                return (
                  <div key={stage} className="flex items-center">
                    <span
                      className={`px-2 py-1 rounded ${
                        status === 'current'
                          ? 'bg-brand-orange-light text-brand-primary font-medium'
                          : status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {icon} {stage}
                    </span>
                    {idx < project.stages.length - 1 && (
                      <span className="mx-1 text-gray-400">→</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 탭 */}
          <div>
            <div className="flex border-b mb-4">
              <button
                onClick={() => setActiveTab('progress')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'progress'
                    ? 'border-brand-orange text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📝 최근 진행사항
              </button>
              <button
                onClick={() => setActiveTab('issues')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'issues'
                    ? 'border-brand-orange text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                ⚠️ 이슈사항
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'comments'
                    ? 'border-brand-orange text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                💬 경영진 코멘트 ({commentThreads.length})
              </button>
            </div>

            {/* 탭 내용 */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div>
              </div>
            ) : (
              <>
                {/* 최근 진행사항 */}
                {activeTab === 'progress' && (
                  <div className="space-y-3">
                    {recentProgress.length === 0 ? (
                      <p className="text-gray-500 text-sm py-4 text-center">
                        등록된 주간보고가 없습니다.
                      </p>
                    ) : (
                      recentProgress.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 bg-gray-50 rounded-lg text-sm"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-gray-500">
                              {formatWeekLabel(item.date)}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                              주간보고
                            </span>
                          </div>
                          <p className="text-gray-700">{item.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 이슈사항 */}
                {activeTab === 'issues' && (
                  <div>
                    {project.issues ? (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {project.issues}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm py-4 text-center">
                        등록된 이슈사항이 없습니다.
                      </p>
                    )}
                  </div>
                )}

                {/* 경영진 코멘트 */}
                {activeTab === 'comments' && (
                  <div className="space-y-4">
                    {commentThreads.length === 0 ? (
                      <p className="text-gray-500 text-sm py-4 text-center">
                        등록된 코멘트가 없습니다.
                      </p>
                    ) : (
                      commentThreads.map((thread) => (
                        <div key={thread.comment.id} className="border rounded-lg p-4">
                          {/* 원본 코멘트 */}
                          <div className="mb-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium text-gray-900">
                                {thread.authorName}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatShortDate(thread.comment.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">
                              {thread.comment.content}
                            </p>
                          </div>

                          {/* 답변 */}
                          {thread.replies.length > 0 && (
                            <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
                              {thread.replies.map((reply) => (
                                <div key={reply.id} className="text-sm">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-gray-700">
                                      ↳ {reply.authorId}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {formatShortDate(reply.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-gray-600">{reply.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {/* 코멘트 작성 버튼 */}
                    <button
                      onClick={onCommentClick}
                      className="w-full py-2 text-sm text-brand-orange border border-brand-orange rounded-lg hover:bg-brand-orange-light transition-colors"
                    >
                      + 코멘트 작성
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            닫기
          </button>
          <Link
            href={`/projects/${project.id}`}
            className="px-4 py-2 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90"
          >
            프로젝트 상세 페이지 이동 →
          </Link>
        </div>
      </div>
    </div>
  );
}
