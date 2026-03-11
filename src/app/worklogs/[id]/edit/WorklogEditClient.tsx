'use client';

/**
 * 업무일지 수정 클라이언트 컴포넌트
 *
 * 업무일지 데이터를 불러온 후 폼으로 전달
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Project, User, ProjectStage, WorkLog, ProjectSchedule } from '@/types';
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

interface WorklogEditClientProps {
  worklogId: string;
}

export default function WorklogEditClient({ worklogId }: WorklogEditClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [worklog, setWorklog] = useState<WorkLog | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<ProjectSchedule[]>([]);
  const [formData, setFormData] = useState<WorklogFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 업무일지 조회
  const fetchWorklog = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/worklogs/${worklogId}`);
      const data = await response.json();

      if (data.success) {
        setWorklog(data.data);
        // 폼 데이터 초기화
        setFormData({
          date: data.data.date,
          projectId: data.data.projectId,
          stage: data.data.stage,
          participants: data.data.participants ? data.data.participants.split(',').filter(Boolean) : [],
          plan: data.data.plan || '',
          content: data.data.content,
          issue: data.data.issue || '',
          issueStatus: data.data.issueStatus || '',
          autoSync: true,
          scheduleId: data.data.scheduleId || '',
        });
        // 세부추진항목 목록 가져오기
        if (data.data.projectId) {
          fetchSchedules(data.data.projectId);
        }
        setError(null);
      } else {
        setError(data.error || '업무일지를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('업무일지 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [worklogId]);

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
    fetchWorklog();
    fetchProjects();
    fetchUsers();
  }, [fetchWorklog, fetchProjects, fetchUsers]);

  // 수정 권한 확인 (본인 또는 관리자 이상 팀원)
  useEffect(() => {
    if (!worklog || !session?.user?.id) return;
    const userId = session.user.id;
    const userRole = (session.user as { role?: string }).role;
    const isAuthor = worklog.assigneeId === userId;
    const isAdminRole = userRole === 'admin' || userRole === 'sysadmin';

    if (isAuthor) return; // 본인은 항상 수정 가능

    if (isAdminRole) {
      // 관리자 이상이면 프로젝트 팀원 여부 확인
      const project = projects.find(p => p.id === worklog.projectId);
      if (project) {
        const isTeamLeader = project.teamLeaderId === userId;
        const isTeamMember = project.teamMembers
          ? project.teamMembers.split(',').map(id => id.trim()).includes(userId)
          : false;
        if (isTeamLeader || isTeamMember) return; // 팀원이면 수정 가능
      }
    }

    setError('수정 권한이 없습니다. 본인 작성 건이거나 관리자 이상의 팀원만 수정할 수 있습니다.');
  }, [worklog, session, projects]);

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
    if (!formData || !formData.projectId || !isTeamLeader(formData.projectId)) return false;
    const currentStage = getProjectCurrentStage(formData.projectId);
    return currentStage !== null && currentStage !== formData.stage;
  };

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
    if (!formData) return;

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

    if (!formData || !formData.date || !formData.projectId || !formData.content) {
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
      // 팀장인 경우에만 단계 변경 정보 포함
      const canChangeStage = isTeamLeader(formData.projectId);

      const response = await fetch(`/api/worklogs/${worklogId}`, {
        method: 'PUT',
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
          updateProjectStage: canChangeStage,
          scheduleId: formData.scheduleId || undefined, // 세부추진항목 ID (실적 자동 연동)
        }),
      });

      const data = await response.json();
      if (data.success) {
        // 저장 성공 - 페이지 유지, 데이터 갱신
        alert('저장되었습니다.');
        router.refresh();
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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </AppLayout>
    );
  }

  if (error || !worklog || !formData) {
    return (
      <AppLayout>
        <div className="bg-red-50 border border-red-200 rounded-md p-6 text-center">
          <p className="text-red-600 mb-4">{error || '업무일지를 찾을 수 없습니다.'}</p>
          <Link href="/worklogs" className="text-brand-orange hover:underline">
            ← 목록으로 돌아가기
          </Link>
        </div>
      </AppLayout>
    );
  }

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
            <span>📝</span> 업무일지 수정 - {worklogId}
          </h1>
        </div>
        <div className="flex gap-2">
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
                  const stages = getProjectStages(newProjectId);
                  setFormData({
                    ...formData,
                    projectId: newProjectId,
                    stage: stages.includes(formData.stage) ? formData.stage : (project?.currentStage || stages[0]),
                    participants: [], // 프로젝트 변경 시 참여자 초기화
                    scheduleId: '', // 프로젝트 변경 시 세부추진항목 초기화
                  });
                  // 세부추진항목 목록 가져오기
                  fetchSchedules(newProjectId);
                }}
                className="w-full md:w-2/3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
              >
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
                {getProjectStages(formData.projectId).map(stage => (
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
              <span className="font-medium">{getUserName(worklog.assigneeId)}</span>
              <span className="text-gray-500 text-sm ml-2">(수정 불가)</span>
            </div>
          </div>

          {/* 참여자 선택 */}
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
            {worklog?.issue && formData.issue && (
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

          {/* 첨부파일 (추후 구현) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              첨부파일 <span className="text-gray-400">(추후 지원)</span>
            </label>
            <button
              type="button"
              disabled
              className="px-4 py-2 text-gray-400 border border-gray-200 rounded-md bg-gray-50 cursor-not-allowed"
            >
              📎 파일 선택
            </button>
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