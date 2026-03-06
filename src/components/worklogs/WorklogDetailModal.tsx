'use client';

/**
 * 업무일지 상세 + 댓글 모달
 *
 * 프로젝트 상세 → 업무진행사항 탭에서 업무일지 카드 클릭 시 표시
 * - 업무일지 상세 정보 (날짜, 담당자, 단계, 계획, 업무내용, 이슈사항)
 * - 댓글 목록 (스레드 형식)
 * - 댓글 작성/답글/삭제
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import type { WorkLog, WorklogCommentThread } from '@/types';

interface WorklogDetailModalProps {
  worklog: WorkLog;
  assigneeName: string;
  scheduleName?: string;
  onClose: () => void;
  onCommentCountChange?: (worklogId: string, count: number) => void;
}

/** 날짜를 M/D HH:MM 형식으로 포맷 */
function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

/** 댓글 권한 확인 (engineer, admin, sysadmin) */
function canWriteComment(role?: string): boolean {
  return role === 'engineer' || role === 'admin' || role === 'sysadmin';
}

/** 삭제 권한 확인 (본인만) */
function canDeleteComment(
  commentAuthorId: string,
  currentUserId?: string
): boolean {
  return commentAuthorId === currentUserId;
}

export default function WorklogDetailModal({
  worklog,
  assigneeName,
  scheduleName,
  onClose,
  onCommentCountChange,
}: WorklogDetailModalProps) {
  const { data: session } = useSession();
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [comments, setComments] = useState<WorklogCommentThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const userRole = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  // 콜백을 ref에 저장하여 useCallback 의존성에서 제거 (무한 루프 방지)
  const onCommentCountChangeRef = useRef(onCommentCountChange);
  onCommentCountChangeRef.current = onCommentCountChange;

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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

  // 댓글 목록 조회
  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/worklogs/${worklog.id}/comments`
      );
      const result = await response.json();
      if (result.success) {
        setComments(result.data);
        // 전체 댓글 수 계산 (부모 + 답글)
        const totalCount = result.data.reduce(
          (acc: number, t: WorklogCommentThread) => acc + 1 + t.replies.length,
          0
        );
        onCommentCountChangeRef.current?.(worklog.id, totalCount);
      }
    } catch (err) {
      console.error('댓글 로드 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [worklog.id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // 댓글 등록
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch(`/api/worklogs/${worklog.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });
      const result = await response.json();

      if (result.success) {
        setContent('');
        fetchComments();
      } else {
        setError(result.error || '댓글 등록에 실패했습니다.');
      }
    } catch {
      setError('서버 연결 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 답글 등록
  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) return;

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/worklogs/${worklog.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent.trim(),
          parentId,
        }),
      });
      const result = await response.json();

      if (result.success) {
        setReplyingTo(null);
        setReplyContent('');
        fetchComments();
      } else {
        alert(result.error || '답글 등록에 실패했습니다.');
      }
    } catch {
      alert('서버 연결 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;

    try {
      setDeletingId(commentId);
      const response = await fetch(
        `/api/worklogs/${worklog.id}/comments/${commentId}`,
        { method: 'DELETE' }
      );
      const result = await response.json();

      if (result.success) {
        fetchComments();
      } else {
        alert(result.error || '삭제에 실패했습니다.');
      }
    } catch {
      alert('서버 연결 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalComments = comments.reduce(
    (acc, t) => acc + 1 + t.replies.length,
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            📝 업무일지 상세
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 본문 (스크롤) */}
        <div className="flex-1 overflow-y-auto">
          {/* 업무일지 정보 */}
          <div className="p-4 space-y-3">
            {/* 메타 정보 */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>📅 {worklog.date}</span>
              <span className="text-gray-300">|</span>
              <span>{assigneeName}</span>
              <span className="px-2 py-0.5 bg-brand-orange-light text-brand-primary rounded text-xs">
                {worklog.stage}
              </span>
              {scheduleName && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  📋 {scheduleName}
                </span>
              )}
            </div>

            {/* 계획 & 업무내용 */}
            <div className="grid grid-cols-[2fr_3fr] gap-4">
              <div className="text-sm">
                <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <span>📋</span> 계획
                </div>
                <div className="text-gray-700 whitespace-pre-line bg-blue-50 rounded p-2">
                  {worklog.plan ? (
                    worklog.plan.split('\n').map((line, idx) => (
                      <p key={idx} className="flex items-start gap-1">
                        {line.trim() && <span className="text-blue-400">•</span>}
                        <span>{line}</span>
                      </p>
                    ))
                  ) : (
                    <span className="text-gray-400 text-xs">계획 없음</span>
                  )}
                </div>
              </div>
              <div className="text-sm">
                <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <span>✅</span> 업무내용
                </div>
                <div className="text-gray-700 whitespace-pre-line bg-green-50 rounded p-2">
                  {worklog.content ? (
                    worklog.content.split('\n').map((line, idx) => (
                      <p key={idx} className="flex items-start gap-1">
                        {line.trim() && <span className="text-green-500">•</span>}
                        <span>{line}</span>
                      </p>
                    ))
                  ) : (
                    <span className="text-gray-400 text-xs">내용 없음</span>
                  )}
                </div>
              </div>
            </div>

            {/* 이슈사항 */}
            {worklog.issue && (
              <div className="text-sm">
                <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <span>⚠️</span> 이슈사항
                  {worklog.issueStatus === 'resolved' ? (
                    <span className="text-green-600 text-xs ml-1">✅ 해결됨</span>
                  ) : (
                    <span className="text-red-600 text-xs ml-1">미해결</span>
                  )}
                </div>
                <div className={`whitespace-pre-line rounded p-2 ${
                  worklog.issueStatus === 'resolved'
                    ? 'bg-green-50 text-gray-600'
                    : 'bg-red-50 text-gray-700'
                }`}>
                  {worklog.issue}
                </div>
              </div>
            )}

            {/* 수정 링크 */}
            <div className="flex justify-end">
              <Link
                href={`/worklogs/${worklog.id}/edit`}
                className="text-sm text-brand-orange hover:underline"
              >
                수정 페이지로 이동 →
              </Link>
            </div>
          </div>

          {/* 구분선 */}
          <div className="border-t border-gray-200" />

          {/* 댓글 섹션 */}
          <div className="p-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
              💬 댓글
              <span className="text-sm font-normal text-gray-500">
                ({totalComments}건)
              </span>
            </h3>

            {isLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-6">
                댓글이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {comments.map((thread) => (
                  <div
                    key={thread.comment.id}
                    className="border border-gray-200 rounded-lg p-3"
                  >
                    {/* 부모 댓글 */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">
                            {thread.comment.authorName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDateTime(thread.comment.createdAt)}
                          </span>
                        </div>
                        {canDeleteComment(
                          thread.comment.authorId,
                          userId
                        ) && thread.replies.length === 0 && (
                          <button
                            onClick={() =>
                              handleDeleteComment(thread.comment.id)
                            }
                            disabled={deletingId === thread.comment.id}
                            className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
                          >
                            {deletingId === thread.comment.id
                              ? '삭제 중...'
                              : '삭제'}
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {thread.comment.content}
                      </p>
                    </div>

                    {/* 답글 목록 */}
                    {thread.replies.length > 0 && (
                      <div className="mt-2 pl-3 border-l-2 border-gray-200 space-y-2">
                        {thread.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="bg-gray-50 rounded p-2"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 text-xs">
                                  ↳ {reply.authorName}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatDateTime(reply.createdAt)}
                                </span>
                              </div>
                              {canDeleteComment(
                                reply.authorId,
                                userId
                              ) && (
                                <button
                                  onClick={() => handleDeleteComment(reply.id)}
                                  disabled={deletingId === reply.id}
                                  className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
                                >
                                  {deletingId === reply.id
                                    ? '삭제 중...'
                                    : '삭제'}
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 whitespace-pre-line">
                              {reply.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 답글 작성 버튼/폼 */}
                    {canWriteComment(userRole) && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        {replyingTo === thread.comment.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="답글을 입력하세요..."
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-orange focus:border-brand-orange text-sm resize-none"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setReplyingTo(null);
                                  setReplyContent('');
                                }}
                                disabled={isSubmitting}
                                className="px-3 py-1 text-gray-600 border border-gray-300 rounded text-xs hover:bg-gray-50"
                              >
                                취소
                              </button>
                              <button
                                onClick={() =>
                                  handleSubmitReply(thread.comment.id)
                                }
                                disabled={
                                  isSubmitting || !replyContent.trim()
                                }
                                className="px-3 py-1 bg-brand-orange text-white rounded text-xs hover:bg-brand-orange/90 disabled:opacity-50"
                              >
                                {isSubmitting ? '등록 중...' : '답글 등록'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReplyingTo(thread.comment.id)}
                            className="text-xs text-brand-orange hover:underline"
                          >
                            + 답글 작성
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 댓글 입력 푸터 (권한 있는 사용자만) */}
        {canWriteComment(userRole) && (
          <form
            onSubmit={handleSubmitComment}
            className="p-4 border-t bg-gray-50"
          >
            {error && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="댓글을 입력하세요..."
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange text-sm resize-none"
              />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm"
                >
                  닫기
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !content.trim()}
                  className="px-3 py-1 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isSubmitting ? '등록 중...' : '댓글 등록'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
