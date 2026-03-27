'use client';

/**
 * 업무일지 작성/수정 클라이언트 컴포넌트
 *
 * Roadmap 2.12 기준
 * - 전체 페이지 형식
 * - 날짜, 프로젝트, 단계, 담당자(자동), 참여자, 계획, 업무 내용
 * - 프로젝트 '업무진행사항' 자동 반영 체크박스
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Project, User, ProjectStage, WorkLog, ProjectSchedule, Attachment } from '@/types';
import AppLayout from '@/components/layout/AppLayout';

// 단계 목록
const STAGES: ProjectStage[] = [
  '검토', '설계', '개발', 'PROTO', '신뢰성', 'P1', 'P2',
  '승인', '양산이관', '초도양산', '품질관리', '원가절감', '품질개선', '설계변경'
];

interface WorklogFormData {
  date: string;
  projectId: string;
  stage: ProjectStage;
  participants: string[];
  plan: string;
  content: string;
  issue: string;
  issueStatus: 'open' | 'resolved' | '';
  autoSync: boolean;
  scheduleId: string;  // 세부추진항목 ID (실적 자동 연동용)
}

const today = new Date().toISOString().split('T')[0];

const initialFormData: WorklogFormData = {
  date: today,
  projectId: '',
  stage: '검토',
  participants: [],
  plan: '',
  content: '',
  issue: '',
  issueStatus: '',
  autoSync: true,
  scheduleId: '',
};


interface WorklogFormClientProps {
  worklog?: WorkLog;
  isEdit?: boolean;
}

export default function WorklogFormClient({ worklog, isEdit }: WorklogFormClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<ProjectSchedule[]>([]);
  const [formData, setFormData] = useState<WorklogFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // 첨부파일
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // PDF 파일 선택
  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('PDF 파일만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하여야 합니다.');
      return;
    }
    setPendingPdf(file);
  };

  // 첨부파일 업로드 (업무일지 ID 필요)
  const uploadPdf = async (worklogId: string) => {
    if (!pendingPdf) return;
    setIsUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', pendingPdf);
      formData.append('entityType', 'worklog');
      formData.append('entityId', worklogId);

      const response = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        setAttachments(prev => [...prev, data.data]);
        setPendingPdf(null);
        if (pdfInputRef.current) pdfInputRef.current.value = '';
      } else {
        alert(data.error || '파일 업로드에 실패했습니다.');
      }
    } catch (err) {
      console.error('PDF 업로드 오류:', err);
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // 첨부파일 삭제
  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('첨부파일을 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      } else {
        alert(data.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('첨부파일 삭제 오류:', err);
    }
  };

  // 수정 모드: 기존 첨부파일 로드
  useEffect(() => {
    if (isEdit && worklog) {
      fetch(`/api/attachments?entityType=worklog&entityId=${worklog.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.success) setAttachments(data.data);
        })
        .catch(err => console.error('첨부파일 로드 오류:', err));
    }
  }, [isEdit, worklog]);

  // 팀장 여부 확인
  const isTeamLeader = (projectId: string): boolean => {
    const project = projects.find(p => p.id === projectId);
    return project?.teamLeaderId === session?.user?.id;
  };

  // 프로젝트 현재 단계 가져오기
  const getProjectCurrentStage = (projectId: string): ProjectStage | null => {
    const project = projects.find(p => p.id === projectId);
    return project?.currentStage || null;
  };

  // 단계 변경 여부 확인
  const isStageChanged = (): boolean => {
    if (!formData.projectId || !isTeamLeader(formData.projectId)) return false;
    const currentStage = getProjectCurrentStage(formData.projectId);
    return currentStage !== null && currentStage !== formData.stage;
  };

  // 프로젝트 목록 가져오기
  // 본인이 팀장 또는 팀원으로 소속된 프로젝트만 표시
  const fetchProjects = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        const userId = session.user.id;
        // 진행중인 프로젝트 중 본인 소속 프로젝트만 필터링
        const filteredProjects = data.data.filter((p: Project) => {
          if (p.status !== '진행중') return false;

          // 팀장인 경우
          if (p.teamLeaderId === userId) return true;

          // 팀원인 경우
          if (p.teamMembers) {
            const memberIds = p.teamMembers.split(',').map((id: string) => id.trim());
            if (memberIds.includes(userId)) return true;
          }

          return false;
        });
        setProjects(filteredProjects);
      }
    } catch (err) {
      console.error('프로젝트 목록 조회 오류:', err);
    }
  }, [session?.user?.id]);

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

  // 세부추진항목 목록 가져오기 (프로젝트 선택 시)
  const fetchSchedules = useCallback(async (projectId: string) => {
    if (!projectId) {
      setSchedules([]);
      return;
    }
    try {
      const response = await fetch(`/api/schedules?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        // 진행중(planned, in_progress)인 항목만 표시
        setSchedules(data.data.filter((s: ProjectSchedule) =>
          s.status === 'planned' || s.status === 'in_progress'
        ));
      }
    } catch (err) {
      console.error('세부추진항목 목록 조회 오류:', err);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, [fetchProjects, fetchUsers]);

  // 수정 모드일 때 초기 데이터 설정
  useEffect(() => {
    if (worklog && isEdit) {
      setFormData({
        date: worklog.date,
        projectId: worklog.projectId,
        stage: worklog.stage,
        participants: worklog.participants ? worklog.participants.split(',') : [],
        plan: worklog.plan || '',
        content: worklog.content,
        issue: worklog.issue || '',
        issueStatus: worklog.issueStatus || '',
        autoSync: true,
        scheduleId: worklog.scheduleId || '',
      });
      // 수정 모드일 때 세부추진항목 목록도 가져오기
      if (worklog.projectId) {
        fetchSchedules(worklog.projectId);
      }
    }
  }, [worklog, isEdit, fetchSchedules]);

  // 프로젝트 선택 시 해당 프로젝트의 단계만 표시
  const getProjectStages = (projectId: string): ProjectStage[] => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.stages) return STAGES;
    return project.stages.split(',') as ProjectStage[];
  };

  // 선택된 프로젝트의 팀원 목록
  const getProjectTeamMembers = (projectId: string): User[] => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return [];

    const teamMemberIds: string[] = [];

    // 팀장 추가
    if (project.teamLeaderId) {
      teamMemberIds.push(project.teamLeaderId);
    }

    // 팀원들 추가
    if (project.teamMembers) {
      teamMemberIds.push(...project.teamMembers.split(',').map(id => id.trim()));
    }

    // 현재 로그인한 사용자 제외 (본인은 담당자로 자동 입력되므로)
    return users.filter(u =>
      teamMemberIds.includes(u.id) && u.id !== session?.user?.id
    );
  };

  // 참여자 토글
  const toggleParticipant = (userId: string) => {
    if (formData.participants.includes(userId)) {
      setFormData({
        ...formData,
        participants: formData.participants.filter(id => id !== userId),
      });
    } else {
      setFormData({
        ...formData,
        participants: [...formData.participants, userId],
      });
    }
  };

  // 사용자 이름 찾기
  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || userId;
  };


  // 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.projectId || !formData.content) {
      alert('필수 항목을 입력해주세요.');
      return;
    }

    // 단계 변경 확인
    if (isStageChanged()) {
      const currentStage = getProjectCurrentStage(formData.projectId);
      const confirmed = confirm(
        `프로젝트 단계를 '${currentStage}'에서 '${formData.stage}'로 변경하시겠습니까?\n\n이 변경은 프로젝트에 즉시 반영됩니다.`
      );
      if (!confirmed) {
        return;
      }
    }

    setIsSaving(true);
    try {
      const url = isEdit && worklog ? `/api/worklogs/${worklog.id}` : '/api/worklogs';
      const method = isEdit ? 'PUT' : 'POST';

      // 팀장인 경우에만 단계 변경 정보 포함
      const canChangeStage = isTeamLeader(formData.projectId);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          projectId: formData.projectId,
          stage: formData.stage,
          participants: formData.participants.join(','),
          plan: formData.plan,
          content: formData.content,
          issue: formData.issue || undefined,
          issueStatus: formData.issue ? (formData.issueStatus || 'open') : undefined,
          updateProjectStage: canChangeStage, // 팀장인 경우 프로젝트 단계도 업데이트
          scheduleId: formData.scheduleId || undefined, // 세부추진항목 ID (실적 자동 연동)
        }),
      });

      const data = await response.json();
      if (data.success) {
        // 대기 중인 PDF가 있으면 업로드
        const savedId = data.data?.id || worklog?.id;
        if (pendingPdf && savedId) {
          await uploadPdf(savedId);
        }
        alert('저장되었습니다.');
        if (!isEdit) setIsSaved(true);
      } else {
        alert(data.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      alert('서버 오류가 발생했습니다.');
      console.error('업무일지 저장 오류:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout>
      {/* 페이지 헤더 (Roadmap 2.12) */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/worklogs"
            className="text-gray-500 hover:text-gray-700"
          >
            ← 목록으로
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📝</span> {isEdit ? '업무일지 수정' : '업무일지 작성'}
          </h1>
        </div>
        <div className="flex gap-2">
          {isSaved && !isEdit && (
            <button
              type="button"
              onClick={() => {
                setFormData(initialFormData);
                setIsSaved(false);
                setAttachments([]);
                setPendingPdf(null);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              + 신규 작성
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push('/worklogs')}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isSaving}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !formData.date || !formData.projectId || !formData.content}
            className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 폼 영역 */}
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              날짜 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>

          {/* 프로젝트 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              프로젝트 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 items-center">
              <select
                value={formData.projectId}
                onChange={(e) => {
                  const newProjectId = e.target.value;
                  const project = projects.find(p => p.id === newProjectId);
                  // 프로젝트의 currentStage를 기본값으로 사용
                  const defaultStage = project?.currentStage || '검토';
                  setFormData({
                    ...formData,
                    projectId: newProjectId,
                    stage: defaultStage,
                    participants: [], // 프로젝트 변경 시 참여자 초기화
                    scheduleId: '', // 프로젝트 변경 시 세부추진항목 초기화
                  });
                  // 세부추진항목 목록 가져오기
                  fetchSchedules(newProjectId);
                }}
                className="w-full md:w-2/3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
              >
                <option value="">프로젝트를 선택하세요</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.customer} - {project.item}
                  </option>
                ))}
              </select>
              {formData.projectId && (
                <Link
                  href={`/projects/${formData.projectId}`}
                  target="_blank"
                  className="px-3 py-2 text-sm text-brand-orange border border-brand-orange rounded-md hover:bg-brand-orange-light whitespace-nowrap"
                  title="프로젝트 상세 보기"
                >
                  상세 →
                </Link>
              )}
            </div>
          </div>

          {/* 단계 + 세부추진항목 (같은 행) */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* 단계 선택 */}
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                단계 <span className="text-red-500">*</span>
                {formData.projectId && !isTeamLeader(formData.projectId) && (
                  <span className="text-gray-400 text-xs ml-2">(팀장만 변경 가능)</span>
                )}
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value as ProjectStage, scheduleId: '' })}
                className={`w-full md:w-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange ${
                  formData.projectId && !isTeamLeader(formData.projectId) ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                disabled={!formData.projectId || !isTeamLeader(formData.projectId)}
              >
                {(formData.projectId ? getProjectStages(formData.projectId) : STAGES).map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>

            {/* 세부추진항목 선택 (실적 자동 연동) */}
            {formData.projectId && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  세부추진항목 <span className="text-gray-400">(선택 - 실적 자동 연동)</span>
                </label>
                <select
                  value={formData.scheduleId}
                  onChange={(e) => setFormData({ ...formData, scheduleId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
                >
                  <option value="">선택 안함</option>
                  {schedules
                    .filter(schedule => !schedule.stage || schedule.stage === formData.stage)
                    .map(schedule => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.taskName}
                        {' '}({schedule.plannedStart} ~ {schedule.plannedEnd})
                      </option>
                    ))}
                </select>
                {schedules.filter(s => !s.stage || s.stage === formData.stage).length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    현재 단계({formData.stage})의 세부추진항목이 없습니다.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 단계 변경 안내 메시지 */}
          {isStageChanged() && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                ⚠️ 프로젝트 단계가 <strong>'{getProjectCurrentStage(formData.projectId)}'</strong>에서 <strong>'{formData.stage}'</strong>로 변경됩니다.
              </p>
            </div>
          )}

          {/* 담당자 (자동 입력) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              담당자 <span className="text-red-500">*</span>
            </label>
            <div className="bg-gray-50 px-4 py-3 rounded-md border border-gray-200">
              <span className="font-medium">{session?.user?.name || session?.user?.id}</span>
              <span className="text-gray-500 text-sm ml-2">(자동 입력 - 수정 불가)</span>
            </div>
          </div>

          {/* 참여자 선택 */}
          {formData.projectId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                참여자 <span className="text-gray-400">(선택)</span>
              </label>
              <p className="text-xs text-gray-500 mb-3">
                ※ 담당자 외 함께 작업한 팀원을 선택하세요
              </p>
              <div className="flex flex-wrap gap-2">
                {getProjectTeamMembers(formData.projectId).length === 0 ? (
                  <p className="text-gray-500 text-sm">선택 가능한 팀원이 없습니다.</p>
                ) : (
                  getProjectTeamMembers(formData.projectId).map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleParticipant(user.id)}
                      className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                        formData.participants.includes(user.id)
                          ? 'bg-brand-orange text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {formData.participants.includes(user.id) ? '✓ ' : ''}{user.name}
                    </button>
                  ))
                )}
              </div>
              {formData.participants.length > 0 && (
                <div className="mt-3 text-sm text-gray-600">
                  선택된 참여자: {formData.participants.map(id => getUserName(id)).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* 계획 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              계획
            </label>
            <textarea
              value={formData.plan}
              onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
              placeholder="오늘 계획한 업무 내용"
            />
          </div>

          {/* 업무 내용 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              업무 내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
              placeholder="실제 수행한 업무 내용을 상세히 작성하세요"
            />
          </div>

          {/* 이슈사항 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이슈사항 <span className="text-gray-400">(선택)</span>
            </label>
            <textarea
              value={formData.issue}
              onChange={(e) => setFormData({ ...formData, issue: e.target.value, issueStatus: e.target.value ? 'open' : '' })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
              placeholder="프로젝트 진행 중 발생한 이슈사항이 있다면 작성하세요"
            />
            {isEdit && worklog?.issue && formData.issue && (
              <div className="mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.issueStatus === 'resolved'}
                    onChange={(e) => setFormData({ ...formData, issueStatus: e.target.checked ? 'resolved' : 'open' })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">
                    ✅ 이슈사항 해결됨
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* 첨부파일 (PDF만) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              첨부파일 <span className="text-gray-400">(PDF만, 10MB 이하)</span>
            </label>
            <input
              type="file"
              accept=".pdf"
              ref={pdfInputRef}
              className="hidden"
              onChange={handlePdfSelect}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={isUploadingPdf}
                className="px-4 py-2 text-brand-orange border border-brand-orange rounded-md hover:bg-orange-50 disabled:opacity-50"
              >
                {isUploadingPdf ? '업로드 중...' : '📎 PDF 선택'}
              </button>
              {pendingPdf && (
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  📄 {pendingPdf.name} ({(pendingPdf.size / 1024).toFixed(0)}KB)
                  <button
                    type="button"
                    onClick={() => { setPendingPdf(null); if (pdfInputRef.current) pdfInputRef.current.value = ''; }}
                    className="text-red-400 hover:text-red-600 ml-1"
                  >
                    X
                  </button>
                </span>
              )}
            </div>
            {/* 저장된 첨부파일 목록 */}
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachments.map(att => (
                  <li key={att.id} className="flex items-center gap-2 text-sm text-gray-600">
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-orange hover:underline flex items-center gap-1"
                    >
                      📄 {att.fileName}
                    </a>
                    <span className="text-gray-400">({(att.fileSize / 1024).toFixed(0)}KB)</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 자동 반영 체크박스 */}
          <div className="border-t border-gray-200 pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoSync}
                onChange={(e) => setFormData({ ...formData, autoSync: e.target.checked })}
                className="w-4 h-4 text-brand-orange border-gray-300 rounded focus:ring-brand-orange"
              />
              <span className="text-sm text-gray-700">
                ☑️ 프로젝트 &apos;업무진행사항&apos;에 자동 반영
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              ※ 체크 시 업무일지 내용이 프로젝트의 업무진행사항에 자동으로 추가됩니다
            </p>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}