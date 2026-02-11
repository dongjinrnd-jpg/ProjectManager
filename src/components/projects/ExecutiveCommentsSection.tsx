'use client';

/**
 * 경영진 코멘트 섹션 컴포넌트
 *
 * 프로젝트 상세 페이지 탭 내부에 표시
 * - 경영진 코멘트 목록
 * - 팀장 답변 작성 기능
 */

import { useState, useEffect, useCallback } from 'react';
import type { CommentThread } from '@/types';

interface ExecutiveCommentsSectionProps {
  projectId: string;
  isTeamLeader: boolean;
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

export default function ExecutiveCommentsSection({
  projectId,
  isTeamLeader,
}: ExecutiveCommentsSectionProps) {
  const [comments, setComments] = useState<CommentThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 답변 모달 상태
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 코멘트 목록 조회
  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/comments?projectId=${projectId}`);
      const result = await response.json();

      if (result.success) {
        setComments(result.data);
        setError(null);
      } else {
        setError(result.error || '코멘트를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('코멘트 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // 답변 등록
  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) {
      alert('답변 내용을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          parentId,
          content: replyContent.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setReplyingTo(null);
        setReplyContent('');
        fetchComments();
      } else {
        alert(result.error || '답변 등록에 실패했습니다.');
      }
    } catch (err) {
      console.error('답변 등록 오류:', err);
      alert('서버 연결 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 에러
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  // 로딩
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  // 코멘트가 없는 경우
  if (comments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <span className="text-4xl mb-4 block">💬</span>
        <p>경영진 코멘트가 없습니다.</p>
        <p className="text-sm mt-2">경영진 대시보드에서 코멘트를 남기면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span>💬</span> 경영진 코멘트
          <span className="text-sm font-normal text-gray-500">
            ({comments.length}건)
          </span>
        </h3>
      </div>

      {comments.map((thread) => (
        <div
          key={thread.comment.id}
          className="border border-gray-200 rounded-lg p-4"
        >
          {/* 경영진 코멘트 */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {thread.authorName}
                </span>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                  경영진
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {formatDateTime(thread.comment.createdAt)}
              </span>
            </div>
            <p className="text-gray-700 whitespace-pre-line">
              {thread.comment.content}
            </p>
          </div>

          {/* 답변 목록 */}
          {thread.replies.length > 0 && (
            <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
              {thread.replies.map((reply) => (
                <div key={reply.id} className="bg-gray-50 rounded p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-gray-900 text-sm">
                      ↳ 팀장 답변
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(reply.createdAt)}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm whitespace-pre-line">
                    {reply.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 답변 작성 (팀장만) */}
          {isTeamLeader && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {replyingTo === thread.comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="답변을 입력하세요..."
                    rows={3}
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
                      className="px-3 py-1.5 text-gray-600 border border-gray-300 rounded text-sm hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleSubmitReply(thread.comment.id)}
                      disabled={isSubmitting || !replyContent.trim()}
                      className="px-3 py-1.5 bg-brand-orange text-white rounded text-sm hover:bg-brand-orange/90 disabled:opacity-50"
                    >
                      {isSubmitting ? '등록 중...' : '답변 등록'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setReplyingTo(thread.comment.id)}
                  className="text-sm text-brand-orange hover:underline"
                >
                  + 답변 작성
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
