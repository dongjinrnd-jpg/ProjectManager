'use client';

/**
 * 회의록 섹션 컴포넌트
 *
 * 프로젝트 상세 페이지 탭 내부에 표시
 * - 회의록 목록
 * - 회의록 작성 버튼
 * - 회의록 상세 보기
 */

import { useState, useEffect, useCallback } from 'react';
import type { MeetingMinutesListItem, MeetingMinutesDetail } from '@/types';
import MeetingMinutesModal from './MeetingMinutesModal';
import MeetingMinutesViewer from './MeetingMinutesViewer';

interface MeetingMinutesSectionProps {
  projectId: string;
  canEdit: boolean;
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

/**
 * 회의일시를 보기 좋게 포맷
 */
function formatMeetingDate(dateStr: string): string {
  if (!dateStr) return '-';
  // YYYY-MM-DD HH:MM 또는 YYYY-MM-DD 형식
  const parts = dateStr.split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '';

  const [year, month, day] = datePart.split('-');
  if (timePart) {
    return `${year}.${month}.${day} ${timePart}`;
  }
  return `${year}.${month}.${day}`;
}

export default function MeetingMinutesSection({
  projectId,
  canEdit,
}: MeetingMinutesSectionProps) {
  const [meetings, setMeetings] = useState<MeetingMinutesListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingMinutesDetail | null>(null);

  // 뷰어 상태
  const [viewingMeeting, setViewingMeeting] = useState<MeetingMinutesDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // 회의록 목록 조회
  const fetchMeetings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/meeting-minutes?projectId=${projectId}`);
      const result = await response.json();

      if (result.success) {
        setMeetings(result.data);
        setError(null);
      } else {
        setError(result.error || '회의록을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('회의록 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // 회의록 상세 조회
  const handleView = async (id: string) => {
    try {
      setIsLoadingDetail(true);
      const response = await fetch(`/api/meeting-minutes/${id}`);
      const result = await response.json();

      if (result.success) {
        setViewingMeeting(result.data);
      } else {
        alert(result.error || '회의록 상세 조회에 실패했습니다.');
      }
    } catch (err) {
      console.error('회의록 상세 조회 오류:', err);
      alert('서버 연결 오류가 발생했습니다.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // 회의록 수정 모달 열기
  const handleEdit = async (id: string) => {
    try {
      setIsLoadingDetail(true);
      const response = await fetch(`/api/meeting-minutes/${id}`);
      const result = await response.json();

      if (result.success) {
        setEditingMeeting(result.data);
        setShowModal(true);
      } else {
        alert(result.error || '회의록 조회에 실패했습니다.');
      }
    } catch (err) {
      console.error('회의록 조회 오류:', err);
      alert('서버 연결 오류가 발생했습니다.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // 회의록 삭제
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 회의록을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/meeting-minutes/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        fetchMeetings();
      } else {
        alert(result.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('회의록 삭제 오류:', err);
      alert('서버 연결 오류가 발생했습니다.');
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

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span>📋</span> 회의록
          <span className="text-sm font-normal text-gray-500">
            ({meetings.length}건)
          </span>
        </h3>
        {canEdit && (
          <button
            onClick={() => {
              setEditingMeeting(null);
              setShowModal(true);
            }}
            className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 text-sm"
          >
            + 회의록 작성
          </button>
        )}
      </div>

      {/* 회의록 목록 */}
      {meetings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <span className="text-4xl mb-4 block">📋</span>
          <p>등록된 회의록이 없습니다.</p>
          {canEdit && (
            <button
              onClick={() => {
                setEditingMeeting(null);
                setShowModal(true);
              }}
              className="mt-4 px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 text-sm"
            >
              + 첫 회의록 작성하기
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  회의명
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  회의일시
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  주관부서
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  장소
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작성자
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작성일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {meetings.map((meeting, index) => (
                <tr key={`${meeting.id}-${index}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleView(meeting.id)}
                      className="text-brand-primary hover:underline font-medium text-left"
                      disabled={isLoadingDetail}
                    >
                      {meeting.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatMeetingDate(meeting.meetingDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {meeting.hostDepartment || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {meeting.location || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {meeting.createdByName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDateTime(meeting.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleView(meeting.id)}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                        disabled={isLoadingDetail}
                      >
                        보기
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleEdit(meeting.id)}
                          className="text-brand-orange hover:text-brand-orange/80 hover:underline"
                          disabled={isLoadingDetail}
                        >
                          수정
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(meeting.id, meeting.title)}
                        className="text-red-600 hover:text-red-800 hover:underline"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 작성/수정 모달 */}
      {showModal && (
        <MeetingMinutesModal
          projectId={projectId}
          meeting={editingMeeting}
          onClose={() => {
            setShowModal(false);
            setEditingMeeting(null);
          }}
          onSaved={() => {
            setShowModal(false);
            setEditingMeeting(null);
            fetchMeetings();
          }}
        />
      )}

      {/* 상세 보기 모달 */}
      {viewingMeeting && (
        <MeetingMinutesViewer
          meeting={viewingMeeting}
          onClose={() => setViewingMeeting(null)}
          onEdit={() => {
            setEditingMeeting(viewingMeeting);
            setViewingMeeting(null);
            setShowModal(true);
          }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
