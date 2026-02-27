'use client';

/**
 * 회의록 작성/수정 모달
 *
 * 회의록 양식:
 * - 회의명, 주관부서, 장소, 회의일시
 * - 참석자 (소속/직위/성명)
 * - 안건, 회의내용, 결정사항, 향후일정
 */

import { useState, useEffect, useRef } from 'react';
import type { MeetingMinutesDetail, Attendee } from '@/types';

interface MeetingMinutesModalProps {
  projectId: string;
  meeting: MeetingMinutesDetail | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function MeetingMinutesModal({
  projectId,
  meeting,
  onClose,
  onSaved,
}: MeetingMinutesModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const isEditing = !!meeting;

  // 폼 상태
  const [title, setTitle] = useState(meeting?.title || '');
  const [hostDepartment, setHostDepartment] = useState(meeting?.hostDepartment || '');
  const [location, setLocation] = useState(meeting?.location || '');
  const [meetingDate, setMeetingDate] = useState(meeting?.meetingDate?.split(' ')[0] || '');
  const [meetingTime, setMeetingTime] = useState(meeting?.meetingDate?.split(' ')[1] || '');
  const [attendees, setAttendees] = useState<Attendee[]>(
    meeting?.attendees || [{ department: '', position: '', name: '' }]
  );
  const [agenda, setAgenda] = useState(meeting?.agenda || '');
  const [discussion, setDiscussion] = useState(meeting?.discussion || '');
  const [decisions, setDecisions] = useState(meeting?.decisions || '');
  const [nextSteps, setNextSteps] = useState(meeting?.nextSteps || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // 모달 외부 클릭 시 - 작성 중 데이터 손실 방지를 위해 닫지 않음
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      e.stopPropagation();
      // 작성 중 실수로 닫히는 것을 방지 - 닫으려면 취소 버튼이나 X 버튼 사용
    }
  };

  // 참석자 추가
  const addAttendee = () => {
    setAttendees([...attendees, { department: '', position: '', name: '' }]);
  };

  // 참석자 삭제
  const removeAttendee = (index: number) => {
    if (attendees.length > 1) {
      setAttendees(attendees.filter((_, i) => i !== index));
    }
  };

  // 참석자 수정
  const updateAttendee = (index: number, field: keyof Attendee, value: string) => {
    const updated = [...attendees];
    updated[index] = { ...updated[index], [field]: value };
    setAttendees(updated);
  };

  // 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('회의명을 입력해주세요.');
      return;
    }

    if (!meetingDate) {
      setError('회의일시를 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const fullMeetingDate = meetingTime
        ? `${meetingDate} ${meetingTime}`
        : meetingDate;

      // 빈 참석자 필터링
      const filteredAttendees = attendees.filter(
        a => a.department.trim() || a.position.trim() || a.name.trim()
      );

      const body = {
        projectId,
        title: title.trim(),
        hostDepartment: hostDepartment.trim(),
        location: location.trim(),
        meetingDate: fullMeetingDate,
        attendees: filteredAttendees,
        agenda: agenda.trim(),
        discussion: discussion.trim(),
        decisions: decisions.trim(),
        nextSteps: nextSteps.trim(),
      };

      const url = isEditing
        ? `/api/meeting-minutes/${meeting.id}`
        : '/api/meeting-minutes';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        onSaved();
      } else {
        setError(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('회의록 저장 오류:', err);
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
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            📋 {isEditing ? '회의록 수정' : '회의록 작성'}
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
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  회의명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 킥오프 회의"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  주관부서
                </label>
                <input
                  type="text"
                  value={hostDepartment}
                  onChange={(e) => setHostDepartment(e.target.value)}
                  placeholder="예: R&D팀"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  장소
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="예: 3층 회의실"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  회의일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  회의시간
                </label>
                <input
                  type="time"
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                />
              </div>
            </div>

            {/* 참석자 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                참석자
              </label>
              <div className="space-y-2">
                {attendees.map((attendee, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={attendee.department}
                      onChange={(e) => updateAttendee(index, 'department', e.target.value)}
                      placeholder="소속"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange text-sm"
                    />
                    <input
                      type="text"
                      value={attendee.position}
                      onChange={(e) => updateAttendee(index, 'position', e.target.value)}
                      placeholder="직위"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange text-sm"
                    />
                    <input
                      type="text"
                      value={attendee.name}
                      onChange={(e) => updateAttendee(index, 'name', e.target.value)}
                      placeholder="성명"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange text-sm"
                    />
                    {attendees.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAttendee(index)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAttendee}
                  className="text-sm text-brand-orange hover:underline"
                >
                  + 참석자 추가
                </button>
              </div>
            </div>

            {/* 안건 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                안건
              </label>
              <textarea
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                placeholder="논의할 안건을 입력하세요"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange resize-none"
              />
            </div>

            {/* 회의내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                회의내용
              </label>
              <textarea
                value={discussion}
                onChange={(e) => setDiscussion(e.target.value)}
                placeholder="회의 진행 내용을 입력하세요"
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange resize-none"
              />
            </div>

            {/* 결정사항 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                결정사항
              </label>
              <textarea
                value={decisions}
                onChange={(e) => setDecisions(e.target.value)}
                placeholder="회의에서 결정된 사항을 입력하세요"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange resize-none"
              />
            </div>

            {/* 향후일정 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                향후일정
              </label>
              <textarea
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                placeholder="다음 단계 및 일정을 입력하세요"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange resize-none"
              />
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
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
              disabled={isSubmitting || !title.trim() || !meetingDate}
              className="px-4 py-2 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '저장 중...' : isEditing ? '수정' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
