'use client';

/**
 * 회의록 상세 보기 모달
 *
 * 회의록 데이터를 구조화하여 표시
 */

import { useEffect, useRef } from 'react';
import type { MeetingMinutesDetail } from '@/types';

interface MeetingMinutesViewerProps {
  meeting: MeetingMinutesDetail;
  onClose: () => void;
  onEdit: () => void;
  canEdit: boolean;
}

/**
 * 회의일시 포맷
 */
function formatMeetingDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '';

  const [year, month, day] = datePart.split('-');
  if (timePart) {
    return `${year}년 ${month}월 ${day}일 ${timePart}`;
  }
  return `${year}년 ${month}월 ${day}일`;
}

export default function MeetingMinutesViewer({
  meeting,
  onClose,
  onEdit,
  canEdit,
}: MeetingMinutesViewerProps) {
  const modalRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            📋 {meeting.title}
          </h2>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={onEdit}
                className="px-3 py-1.5 text-sm text-brand-orange border border-brand-orange rounded-lg hover:bg-brand-orange/10"
              >
                수정
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 기본 정보 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">기본 정보</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">회의일시:</span>
                <span className="ml-2 text-gray-900">{formatMeetingDate(meeting.meetingDate)}</span>
              </div>
              <div>
                <span className="text-gray-500">주관부서:</span>
                <span className="ml-2 text-gray-900">{meeting.hostDepartment || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">장소:</span>
                <span className="ml-2 text-gray-900">{meeting.location || '-'}</span>
              </div>
            </div>
          </div>

          {/* 참석자 */}
          {meeting.attendees && meeting.attendees.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">참석자</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">소속</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">직위</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">성명</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {meeting.attendees.map((attendee, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-700">{attendee.department || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{attendee.position || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{attendee.name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 안건 */}
          {meeting.agenda && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-2">안건</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {meeting.agenda}
              </div>
            </div>
          )}

          {/* 회의내용 */}
          {meeting.discussion && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-2">회의내용</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {meeting.discussion}
              </div>
            </div>
          )}

          {/* 결정사항 */}
          {meeting.decisions && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-2">결정사항</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {meeting.decisions}
              </div>
            </div>
          )}

          {/* 향후일정 */}
          {meeting.nextSteps && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-2">향후일정</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {meeting.nextSteps}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 - 메타 정보 */}
        <div className="p-4 border-t bg-gray-50 text-sm text-gray-500 flex justify-between items-center">
          <span>
            작성자: {meeting.createdByName} | 작성일: {new Date(meeting.createdAt).toLocaleString('ko-KR')}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
