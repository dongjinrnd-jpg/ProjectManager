'use client';

/**
 * 경영진 코멘트 작성 모달
 *
 * Roadmap 2.25 기준:
 * - 대상 프로젝트 표시
 * - 코멘트 내용 입력
 * - 알림 체크박스
 * - 이전 코멘트 히스토리
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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

interface CommentModalProps {
  project: ExecutiveProject;
  onClose: () => void;
  onCommentCreated: () => void;
}

/**
 * 날짜를 M/D HH:MM 형식으로 포맷
 */
function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

export default function CommentModal({
  project,
  onClose,
  onCommentCreated,
}: CommentModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [content, setContent] = useState('');
  const [notifyTeamLead, setNotifyTeamLead] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousComments, setPreviousComments] = useState<CommentThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // textarea 포커스
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // 이전 코멘트 로드
  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/comments?projectId=${project.id}`);
      const result = await response.json();

      if (result.success) {
        setPreviousComments(result.data);
      }
    } catch (error) {
      console.error('코멘트 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // 코멘트 등록
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setError('코멘트 내용을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          content: content.trim(),
          // notifyTeamLead는 추후 알림 기능에서 사용
        }),
      });

      const result = await response.json();

      if (result.success) {
        onCommentCreated();
      } else {
        setError(result.error || '코멘트 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('코멘트 등록 오류:', error);
      setError('서버 연결 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            💬 코멘트 작성
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* 대상 프로젝트 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                대상
              </label>
              <div className="p-3 bg-gray-100 rounded-lg text-sm">
                <span className="font-medium">{project.customer}</span>
                <span className="mx-2">-</span>
                <span>{project.item}</span>
              </div>
            </div>

            {/* 코멘트 내용 */}
            <div>
              <label
                htmlFor="content"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                코멘트 내용 <span className="text-red-500">*</span>
              </label>
              <textarea
                ref={textareaRef}
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="코멘트를 입력하세요..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange resize-none"
              />
            </div>

            {/* 알림 체크박스 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notify"
                checked={notifyTeamLead}
                onChange={(e) => setNotifyTeamLead(e.target.checked)}
                className="rounded border-gray-300 text-brand-orange focus:ring-brand-orange"
              />
              <label htmlFor="notify" className="text-sm text-gray-700">
                담당 팀장에게 알림 발송
                <span className="ml-1 text-gray-400 text-xs">(추후 지원 예정)</span>
              </label>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* 이전 코멘트 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs text-gray-500">이전 코멘트</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary"></div>
                </div>
              ) : previousComments.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-4">
                  이전 코멘트가 없습니다.
                </p>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {previousComments.map((thread) => (
                    <div
                      key={thread.comment.id}
                      className="p-3 bg-gray-50 rounded-lg text-sm"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-gray-900">
                          {thread.authorName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDateTime(thread.comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-gray-700">{thread.comment.content}</p>

                      {/* 답변 */}
                      {thread.replies.length > 0 && (
                        <div className="mt-2 pl-3 border-l-2 border-gray-200">
                          {thread.replies.map((reply) => (
                            <div key={reply.id} className="text-xs text-gray-600">
                              <span className="font-medium">↳ {reply.authorId}</span>
                              <span className="mx-1">·</span>
                              <span>{reply.content}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 푸터 */}
          <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="px-4 py-2 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '등록 중...' : '코멘트 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
