'use client';

/**
 * 개선요청 상세 클라이언트 컴포넌트
 *
 * Roadmap 2.31 기준
 * - 기본 정보 표시
 * - 처리 이력 (sysadmin만 추가 가능)
 * - 댓글 섹션
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  ImprovementDetail,
  ImprovementStatus,
  ImprovementPriority,
} from '@/types/improvement';
import AppLayout from '@/components/layout/AppLayout';

// 유형 레이블
const TYPE_LABELS = {
  bug: { label: '버그', icon: '🐛' },
  improvement: { label: '개선요청', icon: '💡' },
  feature: { label: '기능추가', icon: '✨' },
  other: { label: '기타', icon: '📝' },
};

// 상태 레이블
const STATUS_LABELS = {
  submitted: { label: '접수', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  reviewing: { label: '검토중', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  in_progress: { label: '진행중', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  completed: { label: '완료', color: 'text-green-700', bgColor: 'bg-green-100' },
  hold: { label: '보류', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  rejected: { label: '반려', color: 'text-red-700', bgColor: 'bg-red-100' },
};

// 우선순위 레이블
const PRIORITY_LABELS = {
  urgent: { label: '긴급', color: 'text-red-700', bgColor: 'bg-red-100' },
  high: { label: '높음', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  normal: { label: '보통', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  low: { label: '낮음', color: 'text-green-700', bgColor: 'bg-green-100' },
};

// 관련 메뉴 레이블
const MENU_LABELS = {
  dashboard: '대시보드',
  projects: '프로젝트',
  worklogs: '업무일지',
  weekly: '주간보고',
  schedules: '일정',
  search: '검색',
  settings: '설정',
  other: '기타',
};

interface ImprovementDetailClientProps {
  id: string;
}

export default function ImprovementDetailClient({ id }: ImprovementDetailClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [improvement, setImprovement] = useState<ImprovementDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 상태 변경 모달
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<ImprovementStatus>('submitted');
  const [newPriority, setNewPriority] = useState<ImprovementPriority>('normal');
  const [newDueDate, setNewDueDate] = useState('');
  const [statusMemo, setStatusMemo] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // 댓글
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // 삭제
  const [isDeleting, setIsDeleting] = useState(false);

  const isSysadmin = session?.user?.role === 'sysadmin';
  const isAuthor = session?.user?.id === improvement?.authorId;
  const canEdit = isAuthor || isSysadmin;
  const canDelete = isAuthor || isSysadmin;

  // 데이터 로드
  const fetchImprovement = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/improvements/${id}`);
      const data = await response.json();

      if (data.success) {
        setImprovement(data.data);
        setNewStatus(data.data.status);
        setNewPriority(data.data.priority);
        setNewDueDate(data.data.dueDate || '');
        setError(null);
      } else {
        setError(data.error || '데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('개선요청 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchImprovement();
  }, [fetchImprovement]);

  // 날짜 포맷
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // 상태 변경
  const handleStatusChange = async () => {
    if (!statusMemo.trim()) {
      alert('처리 메모를 입력해주세요.');
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/improvements/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          memo: statusMemo.trim(),
          priority: newPriority,
          dueDate: newDueDate || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowStatusModal(false);
        setStatusMemo('');
        fetchImprovement();
      } else {
        alert(data.error || '상태 변경에 실패했습니다.');
      }
    } catch (err) {
      alert('서버 연결 오류가 발생했습니다.');
      console.error('상태 변경 오류:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 댓글 등록
  const handleCommentSubmit = async () => {
    if (!newComment.trim()) {
      return;
    }

    setIsSubmittingComment(true);
    try {
      const response = await fetch(`/api/improvements/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setNewComment('');
        fetchImprovement();
      } else {
        alert(data.error || '댓글 등록에 실패했습니다.');
      }
    } catch (err) {
      alert('서버 연결 오류가 발생했습니다.');
      console.error('댓글 등록 오류:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 댓글 삭제
  const handleCommentDelete = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/improvements/${id}/comments/${commentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        fetchImprovement();
      } else {
        alert(data.error || '댓글 삭제에 실패했습니다.');
      }
    } catch (err) {
      alert('서버 연결 오류가 발생했습니다.');
      console.error('댓글 삭제 오류:', err);
    }
  };

  // 개선요청 삭제
  const handleDelete = async () => {
    if (!confirm('이 개선요청을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/improvements/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        router.push('/improvements');
      } else {
        alert(data.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      alert('서버 연결 오류가 발생했습니다.');
      console.error('삭제 오류:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-gray-500">로딩 중...</div>
      </AppLayout>
    );
  }

  if (error || !improvement) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <p className="text-red-600 mb-4">{error || '개선요청을 찾을 수 없습니다.'}</p>
          <Link href="/improvements" className="text-brand-orange hover:underline">
            목록으로 돌아가기
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/improvements"
            className="text-gray-500 hover:text-gray-700"
          >
            ← 목록
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{improvement.id}</h1>
        </div>
        <div className="flex gap-2">
          {isSysadmin && (
            <button
              onClick={() => setShowStatusModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              상태 변경
            </button>
          )}
          {canEdit && (
            <Link
              href={`/improvements/${id}/edit`}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors"
            >
              수정
            </Link>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-red-600 border border-red-300 rounded-md bg-white hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </button>
          )}
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        {/* 상태 및 유형 배지 */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${STATUS_LABELS[improvement.status].bgColor} ${STATUS_LABELS[improvement.status].color}`}>
            {STATUS_LABELS[improvement.status].label}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 rounded-full">
            {TYPE_LABELS[improvement.type].icon} {TYPE_LABELS[improvement.type].label}
          </span>
          <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${PRIORITY_LABELS[improvement.priority].bgColor} ${PRIORITY_LABELS[improvement.priority].color}`}>
            {PRIORITY_LABELS[improvement.priority].label}
          </span>
        </div>

        {/* 제목 */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">{improvement.title}</h2>

        {/* 메타 정보 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-6 pb-6 border-b">
          <div>
            <span className="text-gray-400">작성자</span>
            <p className="font-medium text-gray-900">{improvement.authorName}</p>
          </div>
          <div>
            <span className="text-gray-400">작성일</span>
            <p className="font-medium text-gray-900">{formatDate(improvement.createdAt)}</p>
          </div>
          <div>
            <span className="text-gray-400">관련 메뉴</span>
            <p className="font-medium text-gray-900">{MENU_LABELS[improvement.relatedMenu]}</p>
          </div>
          <div>
            <span className="text-gray-400">처리예정일</span>
            <p className="font-medium text-gray-900">{improvement.dueDate || '-'}</p>
          </div>
        </div>

        {/* 내용 */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">내용</h3>
          <div className="whitespace-pre-wrap text-gray-800 bg-gray-50 p-4 rounded-md">
            {improvement.content}
          </div>
        </div>

        {/* 재현 방법 (버그인 경우) */}
        {improvement.type === 'bug' && improvement.reproductionSteps && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">재현 방법</h3>
            <div className="whitespace-pre-wrap text-gray-800 bg-yellow-50 p-4 rounded-md">
              {improvement.reproductionSteps}
            </div>
          </div>
        )}

        {/* 스크린샷 */}
        {improvement.screenshotUrl && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">스크린샷</h3>
            <a
              href={improvement.screenshotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {improvement.screenshotUrl}
            </a>
          </div>
        )}
      </div>

      {/* 처리 이력 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          📋 처리 이력
        </h3>
        {improvement.histories.length === 0 ? (
          <p className="text-gray-500">처리 이력이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {improvement.histories.map((history) => (
              <div
                key={history.id}
                className="flex items-start gap-4 p-3 bg-gray-50 rounded-md"
              >
                <div className="flex-shrink-0">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_LABELS[history.status].bgColor} ${STATUS_LABELS[history.status].color}`}>
                    {STATUS_LABELS[history.status].label}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-800">{history.memo}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {history.changedByName} · {formatDateTime(history.changedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 댓글 섹션 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          💬 댓글 ({improvement.comments.length})
        </h3>

        {/* 댓글 목록 */}
        {improvement.comments.length > 0 && (
          <div className="space-y-4 mb-6">
            {improvement.comments.map((comment) => (
              <div key={comment.id} className="border-b pb-4 last:border-0">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium text-gray-900">{comment.authorName}</span>
                    <span className="text-gray-400 text-sm ml-2">
                      {formatDateTime(comment.createdAt)}
                    </span>
                  </div>
                  {(session?.user?.id === comment.authorId || isSysadmin) && (
                    <button
                      onClick={() => handleCommentDelete(comment.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <p className="mt-2 text-gray-700 whitespace-pre-wrap">{comment.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* 댓글 입력 */}
        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="댓글을 입력하세요..."
            rows={2}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900 resize-none"
          />
          <button
            onClick={handleCommentSubmit}
            disabled={isSubmittingComment || !newComment.trim()}
            className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 transition-colors disabled:opacity-50 self-end"
          >
            {isSubmittingComment ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>

      {/* 상태 변경 모달 */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">상태 변경</h3>

            <div className="space-y-4">
              {/* 상태 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ImprovementStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
                >
                  {Object.entries(STATUS_LABELS).map(([value, { label }]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* 우선순위 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as ImprovementPriority)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, { label }]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* 처리예정일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">처리예정일</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>

              {/* 처리 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  처리 메모 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={statusMemo}
                  onChange={(e) => setStatusMemo(e.target.value)}
                  placeholder="상태 변경 사유를 입력하세요..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setStatusMemo('');
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleStatusChange}
                disabled={isUpdatingStatus}
                className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 disabled:opacity-50"
              >
                {isUpdatingStatus ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
