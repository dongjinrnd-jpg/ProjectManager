'use client';

/**
 * 프로젝트 상세 클라이언트 컴포넌트
 *
 * Roadmap 2.6 기준
 * - 기본 정보 카드 (이미지 + 정보)
 * - 단계 진행 (가로 프로그레스 바)
 * - 단계 클릭 → 완료 처리 (팀장/관리자)
 * - 단계 관리 팝업 (단계 추가/삭제)
 * - 탭: 업무일지, 일정, 원가, 첨부파일
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Project, ProjectStatus, ProjectStage, User, WorkLog, ProjectSchedule } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import GanttChart from '@/components/schedules/GanttChart';
import ExecutiveCommentsSection from '@/components/projects/ExecutiveCommentsSection';
import { MeetingMinutesSection } from '@/components/meeting-minutes';

// 전체 단계 목록 (선택 가능한 단계)
const ALL_STAGES: ProjectStage[] = [
  '검토', '설계', '개발', 'PROTO', '신뢰성', 'P1', 'P2',
  '승인', '양산이관', '초도양산', '품질관리', '원가절감', '품질개선', '설계변경'
];

// 상태 목록
const STATUSES: { value: ProjectStatus; label: string; icon: string }[] = [
  { value: '진행중', label: '진행중', icon: '🟢' },
  { value: '보류', label: '보류', icon: '🟡' },
  { value: '완료', label: '완료', icon: '✅' },
];

// 탭 목록
const TABS = [
  { id: 'worklog', label: '📝 업무진행사항', disabled: false },
  { id: 'schedule', label: '📅 일정', disabled: false },
  { id: 'comments', label: '💬 경영진코멘트', disabled: false },
  { id: 'meeting', label: '📋 회의록', disabled: false },
  { id: 'cost', label: '💰 원가', disabled: true },
  { id: 'attachment', label: '📎 첨부파일', disabled: true }, // Google Workspace 필요
];

interface ProjectDetailClientProps {
  projectId: string;
}

export default function ProjectDetailClient({ projectId }: ProjectDetailClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('worklog');

  // 업무일지 목록
  const [worklogs, setWorklogs] = useState<WorkLog[]>([]);
  const [isLoadingWorklogs, setIsLoadingWorklogs] = useState(false);

  // 세부추진항목 (일정)
  const [schedules, setSchedules] = useState<ProjectSchedule[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [scheduleViewMode, setScheduleViewMode] = useState<'table' | 'gantt'>('table');

  // 날짜 필터 (기본: 최근 1주일)
  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  };
  const getDefaultEndDate = () => {
    return new Date().toISOString().split('T')[0];
  };
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());

  // 상태 변경 (로컬 상태)
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // 삭제 모달
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 단계 관리 모달
  const [showStageModal, setShowStageModal] = useState(false);
  const [editingStages, setEditingStages] = useState<string[]>([]);
  const [isSavingStages, setIsSavingStages] = useState(false);

  // 단계 완료 처리
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

  // 세부추진항목 모달
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ProjectSchedule | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // 즐겨찾기 상태
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    stage: '',
    taskName: '',
    plannedStart: '',
    plannedEnd: '',
    actualStart: '',
    actualEnd: '',
    responsibility: '' as 'lead' | 'support' | '',
    category: '' as '영업' | '생산' | '구매' | '품질' | '설계' | '',
    status: 'planned' as 'planned' | 'in_progress' | 'completed' | 'delayed',
    note: '',
  });

  // 권한 체크
  const userRole = session?.user?.role;
  const userId = session?.user?.id;
  const canEdit = userRole === 'engineer' || userRole === 'admin';
  const canDelete = userRole === 'admin';
  // 실적 날짜 수동 편집 권한: sysadmin, admin만 가능
  const canEditActualDates = userRole === 'sysadmin' || userRole === 'admin';
  // 세부추진항목 삭제 권한: 팀장 또는 sysadmin/admin만 가능
  const isTeamLeader = project?.teamLeaderId === userId;
  const canDeleteSchedule = isTeamLeader || userRole === 'sysadmin' || userRole === 'admin';

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

  // 즐겨찾기 상태 조회
  const fetchFavoriteStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/favorites');
      const data = await response.json();
      if (data.success) {
        const favoriteProjectIds = data.data.map((f: { projectId: string }) => f.projectId);
        setIsFavorite(favoriteProjectIds.includes(projectId));
      }
    } catch (err) {
      console.error('즐겨찾기 상태 조회 오류:', err);
    }
  }, [projectId]);

  // 즐겨찾기 토글
  const toggleFavorite = async () => {
    if (isFavoriteLoading) return;
    setIsFavoriteLoading(true);

    try {
      if (isFavorite) {
        // 즐겨찾기 해제
        const response = await fetch(`/api/favorites?projectId=${projectId}`, {
          method: 'DELETE',
        });
        const data = await response.json();
        if (data.success) {
          setIsFavorite(false);
        }
      } else {
        // 즐겨찾기 등록
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });
        const data = await response.json();
        if (data.success) {
          setIsFavorite(true);
        }
      }
    } catch (err) {
      console.error('즐겨찾기 토글 오류:', err);
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  // 프로젝트 조회
  const fetchProject = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();

      if (data.success) {
        setProject(data.data);
        setSelectedStatus(data.data.status); // 초기 상태 설정
        setError(null);
      } else {
        setError(data.error || '프로젝트를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('프로젝트 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // 업무일지 조회
  const fetchWorklogs = useCallback(async () => {
    try {
      setIsLoadingWorklogs(true);
      const response = await fetch(`/api/worklogs?projectId=${projectId}`);
      const data = await response.json();

      if (data.success) {
        // 날짜순 정렬 (최신순)
        const sorted = [...data.data].sort(
          (a: WorkLog, b: WorkLog) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setWorklogs(sorted);
      }
    } catch (err) {
      console.error('업무일지 조회 오류:', err);
    } finally {
      setIsLoadingWorklogs(false);
    }
  }, [projectId]);

  // 세부추진항목 조회
  const fetchSchedules = useCallback(async () => {
    try {
      setIsLoadingSchedules(true);
      const response = await fetch(`/api/schedules?projectId=${projectId}`);
      const data = await response.json();

      if (data.success) {
        setSchedules(data.data);
      }
    } catch (err) {
      console.error('세부추진항목 조회 오류:', err);
    } finally {
      setIsLoadingSchedules(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchUsers();
    fetchProject();
    fetchWorklogs();
    fetchFavoriteStatus();
  }, [fetchUsers, fetchProject, fetchWorklogs, fetchFavoriteStatus]);

  // 업무진행사항/일정 탭에서 세부추진항목 필요 (배지 표시용)
  useEffect(() => {
    if (activeTab === 'worklog' || activeTab === 'schedule') {
      fetchSchedules();
    }
  }, [activeTab, fetchSchedules]);

  // 사용자 이름 찾기
  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || userId;
  };

  // 팀원 이름 목록
  const getTeamMemberNames = (teamMembers: string | undefined) => {
    if (!teamMembers) return '-';
    return teamMembers
      .split(',')
      .map(id => getUserName(id.trim()))
      .join(', ');
  };

  // 세부추진항목 이름 찾기
  const getScheduleName = (scheduleId: string | undefined) => {
    if (!scheduleId) return null;
    const schedule = schedules.find(s => s.id === scheduleId);
    return schedule?.taskName || null;
  };

  // 상태 변경 여부
  const isStatusChanged = project && selectedStatus && selectedStatus !== project.status;

  // 상태 저장
  const handleStatusSave = async () => {
    if (!project || !selectedStatus || selectedStatus === project.status) return;

    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus }),
      });

      const data = await response.json();
      if (data.success) {
        setProject({ ...project, status: selectedStatus });
      } else {
        alert(data.error || '상태 변경에 실패했습니다.');
      }
    } catch (err) {
      alert('서버 오류가 발생했습니다.');
      console.error('상태 변경 오류:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 상태 변경 취소
  const handleStatusCancel = () => {
    if (project) {
      setSelectedStatus(project.status);
    }
  };

  // 세부추진항목 모달 열기 (신규)
  const openNewScheduleModal = () => {
    setEditingSchedule(null);
    setScheduleForm({
      stage: '',
      taskName: '',
      plannedStart: '',
      plannedEnd: '',
      actualStart: '',
      actualEnd: '',
      responsibility: '',
      category: '',
      status: 'planned',
      note: '',
    });
    setShowScheduleModal(true);
  };

  // 세부추진항목 모달 열기 (수정)
  const openEditScheduleModal = (schedule: ProjectSchedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      stage: schedule.stage || '',
      taskName: schedule.taskName,
      plannedStart: schedule.plannedStart,
      plannedEnd: schedule.plannedEnd,
      actualStart: schedule.actualStart || '',
      actualEnd: schedule.actualEnd || '',
      responsibility: schedule.responsibility || '',
      category: schedule.category || '',
      status: schedule.status,
      note: schedule.note || '',
    });
    setShowScheduleModal(true);
  };

  // 세부추진항목 저장
  const handleSaveSchedule = async () => {
    if (!scheduleForm.taskName || !scheduleForm.plannedStart || !scheduleForm.plannedEnd) {
      alert('항목명, 계획 시작일, 계획 종료일은 필수입니다.');
      return;
    }

    setIsSavingSchedule(true);
    try {
      const url = editingSchedule
        ? `/api/schedules/${editingSchedule.id}`
        : '/api/schedules';
      const method = editingSchedule ? 'PUT' : 'POST';

      const body = editingSchedule
        ? {
            stage: scheduleForm.stage || undefined,
            taskName: scheduleForm.taskName,
            plannedStart: scheduleForm.plannedStart,
            plannedEnd: scheduleForm.plannedEnd,
            actualStart: scheduleForm.actualStart || undefined,
            actualEnd: scheduleForm.actualEnd || undefined,
            responsibility: scheduleForm.responsibility || undefined,
            category: scheduleForm.category || undefined,
            status: scheduleForm.status,
            note: scheduleForm.note || undefined,
          }
        : {
            projectId,
            stage: scheduleForm.stage || undefined,
            taskName: scheduleForm.taskName,
            plannedStart: scheduleForm.plannedStart,
            plannedEnd: scheduleForm.plannedEnd,
            responsibility: scheduleForm.responsibility || undefined,
            category: scheduleForm.category || undefined,
            note: scheduleForm.note || undefined,
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        setShowScheduleModal(false);
        fetchSchedules();
      } else {
        alert(data.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('세��추진항목 저장 오류:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // 세부추진항목 삭제
  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('이 세부추진항목을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        fetchSchedules();
      } else {
        alert(data.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('세부추진항목 삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 세부추진항목 완료 갱신 (actualEnd 유지, status = completed)
  const handleCompleteSchedule = async (schedule: ProjectSchedule) => {
    if (!confirm(`'${schedule.taskName}'을(를) 완료 처리하시겠습니까?\n\n실적 종료일: ${schedule.actualEnd || schedule.plannedEnd}`)) {
      return;
    }

    try {
      const response = await fetch(`/api/schedules/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
        }),
      });

      const data = await response.json();

      if (data.success) {
        fetchSchedules();
      } else {
        alert(data.error || '완료 처리에 실패했습니다.');
      }
    } catch (err) {
      console.error('세부추진항목 완료 처리 오류:', err);
      alert('완료 처리 중 오류가 발생했습니다.');
    }
  };

  // 일정표 일괄 갱신 (지연 항목 자동 처리)
  const handleRefreshSchedules = async () => {
    const today = new Date().toISOString().split('T')[0];
    const stages = project?.stages?.split(',') || [];
    const currentStageIndex = stages.indexOf(project?.currentStage || '');

    // 지연 대상:
    // 1. 이전 단계 항목 중 실적이 없고 완료가 아닌 것 (단계가 넘어갔는데 시작도 안함)
    // 2. 현재 단계라도 계획종료일이 지났는데 진행중인 것
    //
    // 실적이 있는 경우: 지연 처리 안함 (진행중 유지 → 완료 버튼으로 처리)
    const delayedSchedules = schedules.filter((s) => {
      // 이미 완료 또는 지연 상태면 제외
      if (s.status === 'completed' || s.status === 'delayed') return false;

      const scheduleStageIndex = stages.indexOf(s.stage || '');
      const isPreviousStage = s.stage && scheduleStageIndex >= 0 && scheduleStageIndex < currentStageIndex;
      const hasActual = !!s.actualStart; // 실적 시작일이 있는지

      // 조건 1: 이전 단계 + 실적 없음 + 미완료 → 지연
      if (isPreviousStage && !hasActual) return true;

      // 조건 2: 계획종료일이 지났는데 진행중인 경우 (실적 없음)
      if (s.plannedEnd < today && s.status === 'in_progress' && !hasActual) return true;

      return false;
    });

    if (delayedSchedules.length === 0) {
      alert('지연 처리할 항목이 없습니다.');
      return;
    }

    if (!confirm(`${delayedSchedules.length}개 항목을 지연 상태로 변경하시겠습니까?\n\n대상:\n${delayedSchedules.map(s => `- ${s.taskName} (${s.stage}, ${s.plannedEnd})`).join('\n')}`)) {
      return;
    }

    try {
      // 각 항목을 지연 상태로 업데이트
      for (const schedule of delayedSchedules) {
        await fetch(`/api/schedules/${schedule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'delayed',
          }),
        });
      }

      fetchSchedules();
      alert(`${delayedSchedules.length}개 항목이 지연 상태로 변경되었습니다.`);
    } catch (err) {
      console.error('일정표 갱신 오류:', err);
      alert('일정표 갱신 중 오류가 발생했습니다.');
    }
  };

  // 프로젝트 삭제
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        router.push('/projects?message=deleted');
      } else {
        alert(data.error || '프로젝트 삭제에 실패했습니다.');
      }
    } catch (err) {
      alert('서버 오류가 발생했습니다.');
      console.error('프로젝트 삭제 오류:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // 단계 클릭 → 완료 처리 또는 되돌리기
  const handleStageClick = async (clickedStage: string) => {
    if (!project || !canEdit || isUpdatingStage) return;

    const stages = project.stages ? project.stages.split(',') : [];
    const clickedIndex = stages.indexOf(clickedStage);
    const currentIndex = stages.indexOf(project.currentStage);

    // 완료된 단계 클릭 → 되돌리기
    if (clickedIndex < currentIndex) {
      if (!confirm(`'${clickedStage}' 단계로 되돌아가시겠습니까?\n\n※ 이후 단계는 다시 '예정' 상태가 됩니다.`)) {
        return;
      }

      setIsUpdatingStage(true);
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentStage: clickedStage }),
        });

        const data = await response.json();
        if (data.success) {
          setProject({ ...project, currentStage: clickedStage as ProjectStage });
        } else {
          alert(data.error || '단계 변경에 실패했습니다.');
        }
      } catch (err) {
        alert('서버 오류가 발생했습니다.');
        console.error('단계 변경 오류:', err);
      } finally {
        setIsUpdatingStage(false);
      }
      return;
    }

    // 현재 단계를 클릭하면 다음 단계로 이동
    if (clickedIndex === currentIndex) {
      const nextStage = stages[currentIndex + 1];
      if (!nextStage) {
        alert('마지막 단계입니다.');
        return;
      }

      if (!confirm(`'${clickedStage}' 단계를 완료하고 '${nextStage}' 단계로 이동하시겠습니까?`)) {
        return;
      }

      setIsUpdatingStage(true);
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentStage: nextStage }),
        });

        const data = await response.json();
        if (data.success) {
          setProject({ ...project, currentStage: nextStage as ProjectStage });
        } else {
          alert(data.error || '단계 변경에 실패했습니다.');
        }
      } catch (err) {
        alert('서버 오류가 발생했습니다.');
        console.error('단계 변경 오류:', err);
      } finally {
        setIsUpdatingStage(false);
      }
    }

    // 미래 단계를 클릭하면 중간 단계 모두 완료하고 해당 단계로 이동
    if (clickedIndex > currentIndex) {
      if (!confirm(`'${project.currentStage}'부터 '${stages[clickedIndex - 1]}'까지 모두 완료 처리하고 '${clickedStage}' 단계로 이동하시겠습니까?`)) {
        return;
      }

      setIsUpdatingStage(true);
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentStage: clickedStage }),
        });

        const data = await response.json();
        if (data.success) {
          setProject({ ...project, currentStage: clickedStage as ProjectStage });
        } else {
          alert(data.error || '단계 변경에 실패했습니다.');
        }
      } catch (err) {
        alert('서버 오류가 발생했습니다.');
        console.error('단계 변경 오류:', err);
      } finally {
        setIsUpdatingStage(false);
      }
    }
  };

  // 단계 관리 모달 열기
  const openStageModal = () => {
    if (project) {
      setEditingStages(project.stages ? project.stages.split(',') : []);
      setShowStageModal(true);
    }
  };

  // 단계 추가
  const handleAddStage = (stage: string) => {
    if (!editingStages.includes(stage)) {
      setEditingStages([...editingStages, stage]);
    }
  };

  // 단계 삭제 (완료된 단계는 삭제 불가)
  const handleRemoveStage = (stage: string) => {
    if (!project) return;

    const currentIndex = editingStages.indexOf(project.currentStage);
    const stageIndex = editingStages.indexOf(stage);

    // 완료된 단계는 삭제 불가
    if (stageIndex < currentIndex) {
      alert('이미 완료된 단계는 삭제할 수 없습니다.');
      return;
    }

    // 현재 단계는 삭제 불가
    if (stage === project.currentStage) {
      alert('현재 진행 중인 단계는 삭제할 수 없습니다.');
      return;
    }

    setEditingStages(editingStages.filter(s => s !== stage));
  };

  // 단계 저장
  const handleSaveStages = async () => {
    if (!project || editingStages.length === 0) return;

    // 현재 단계가 포함되어 있는지 확인
    if (!editingStages.includes(project.currentStage)) {
      alert('현재 진행 중인 단계가 포함되어야 합니다.');
      return;
    }

    setIsSavingStages(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: editingStages.join(',') }),
      });

      const data = await response.json();
      if (data.success) {
        setProject({ ...project, stages: editingStages.join(',') });
        setShowStageModal(false);
      } else {
        alert(data.error || '단계 저장에 실패했습니다.');
      }
    } catch (err) {
      alert('서버 오류가 발생했습니다.');
      console.error('단계 저장 오류:', err);
    } finally {
      setIsSavingStages(false);
    }
  };

  // 단계 상태 (현재 단계 기준으로 이전=완료, 현재=진행중, 이후=예정)
  const getStageStatus = (stage: string, stages: string[], currentStage: string) => {
    const stageIndex = stages.indexOf(stage);
    const currentIndex = stages.indexOf(currentStage);

    if (stageIndex < currentIndex) {
      return { bg: 'bg-green-500', text: 'text-white', icon: '🟢' };
    } else if (stageIndex === currentIndex) {
      return { bg: 'bg-yellow-400', text: 'text-gray-900', icon: '🟡' };
    } else {
      return { bg: 'bg-gray-200', text: 'text-gray-600', icon: '⚪' };
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

  if (error || !project) {
    return (
      <AppLayout>
        <div className="bg-red-50 border border-red-200 rounded-md p-6 text-center">
          <p className="text-red-600 mb-4">{error || '프로젝트를 찾을 수 없습니다.'}</p>
          <Link href="/projects" className="text-brand-orange hover:underline">
            ← 목록으로 돌아가기
          </Link>
        </div>
      </AppLayout>
    );
  }

  const stages = project.stages ? project.stages.split(',') : [];

  return (
    <AppLayout>
      {/* 페이지 헤더 (Roadmap 2.6) */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/projects"
            className="text-gray-500 hover:text-gray-700"
          >
            ← 목록으로
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📁</span> 프로젝트 상세
          </h1>
        </div>
        <div className="flex gap-2">
          {/* 즐겨찾기 버튼 */}
          <button
            onClick={toggleFavorite}
            disabled={isFavoriteLoading}
            className={`px-3 py-2 text-lg border rounded-md transition-all hover:scale-105 ${
              isFavorite
                ? 'bg-brand-orange text-white border-brand-orange'
                : 'text-gray-400 border-gray-300 hover:border-brand-orange hover:text-brand-orange'
            } ${isFavoriteLoading ? 'opacity-50' : ''}`}
            title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            {isFavorite ? '⭐' : '☆'}
          </button>
          {canEdit && (
            <Link
              href={`/projects/${projectId}/edit`}
              className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 transition-colors"
            >
              수정
            </Link>
          )}
          {canDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {/* 기본 정보 카드 (Roadmap 2.6) */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>
          {/* 상태 드롭다운 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">상태:</span>
            <select
              value={selectedStatus || project.status}
              onChange={(e) => setSelectedStatus(e.target.value as ProjectStatus)}
              disabled={!canEdit || isUpdatingStatus}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {STATUSES.map(status => (
                <option key={status.value} value={status.value}>
                  {status.icon} {status.label}
                </option>
              ))}
            </select>
            {/* 상태 변경 시 저장/취소 버튼 */}
            {isStatusChanged && (
              <>
                <button
                  onClick={handleStatusSave}
                  disabled={isUpdatingStatus}
                  className="px-3 py-1.5 bg-brand-orange text-white text-sm rounded-md hover:opacity-90 disabled:opacity-50"
                >
                  {isUpdatingStatus ? '저장중...' : '저장'}
                </button>
                <button
                  onClick={handleStatusCancel}
                  disabled={isUpdatingStatus}
                  className="px-3 py-1.5 text-gray-600 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-6">
          {/* 제품 이미지 */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
              <span className="text-3xl mb-1">📷</span>
              <span className="text-xs">제품 이미지</span>
            </div>
            <button
              disabled
              className="mt-2 w-full text-xs text-gray-400 border border-gray-200 rounded py-1 cursor-not-allowed"
            >
              [변경]
            </button>
          </div>

          {/* 정보 그리드 */}
          <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <span className="text-gray-500">고객사:</span>
              <span className="ml-2 font-medium text-gray-900">{project.customer}</span>
            </div>
            <div>
              <span className="text-gray-500">ITEM:</span>
              <span className="ml-2 font-medium text-gray-900">{project.item}</span>
            </div>
            <div>
              <span className="text-gray-500">PART NO:</span>
              <span className="ml-2 text-gray-900">{project.partNo || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">소속:</span>
              <span className="ml-2 text-gray-900">{project.division}</span>
            </div>
            <div>
              <span className="text-gray-500">팀장:</span>
              <span className="ml-2 text-gray-900">{getUserName(project.teamLeaderId)}</span>
            </div>
            <div>
              <span className="text-gray-500">팀원:</span>
              <span className="ml-2 text-gray-900">{getTeamMemberNames(project.teamMembers)}</span>
            </div>
            <div>
              <span className="text-gray-500">현재단계:</span>
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                🟡 {project.currentStage}
              </span>
            </div>
            <div>
              <span className="text-gray-500">대일정:</span>
              <span className="ml-2 text-gray-900">{project.scheduleStart} ~ {project.scheduleEnd}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 단계 진행 (Roadmap 2.6 - 가로 프로그레스) */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">단계 진행</h2>
          {canEdit && (
            <button
              onClick={openStageModal}
              className="text-sm text-brand-orange flex items-center gap-1 hover:underline"
            >
              단계 관리 ⚙️
            </button>
          )}
        </div>

        {stages.length > 0 ? (
          <>
            <div className="flex gap-1 overflow-x-auto pb-2">
              {stages.map((stage) => {
                const stageStatus = getStageStatus(stage, stages, project.currentStage);
                const stageIndex = stages.indexOf(stage);
                const currentIndex = stages.indexOf(project.currentStage);
                const isCompleted = stageIndex < currentIndex;
                const isCurrent = stageIndex === currentIndex;
                const isClickable = canEdit; // 모든 단계 클릭 가능 (완료된 단계는 되돌리기)
                const buttonTitle = isCompleted
                  ? '클릭하여 이 단계로 되돌아가기'
                  : isCurrent
                    ? '클릭하여 완료 처리'
                    : '클릭하여 이 단계로 건너뛰기';
                return (
                  <button
                    key={stage}
                    onClick={() => handleStageClick(stage)}
                    disabled={!isClickable || isUpdatingStage}
                    className={`flex-1 min-w-[70px] px-2 py-3 text-center rounded transition-all ${stageStatus.bg} ${stageStatus.text} ${
                      isClickable ? 'cursor-pointer hover:opacity-80 hover:scale-105' : 'cursor-default'
                    } ${isUpdatingStage ? 'opacity-50' : ''}`}
                    title={isClickable ? buttonTitle : ''}
                  >
                    <div className="text-xs font-medium truncate">{stage}</div>
                    <div className="text-lg mt-1">{stageStatus.icon}</div>
                  </button>
                );
              })}
            </div>
            {canEdit && (
              <p className="text-xs text-gray-500 mt-3">
                ※ 현재 단계 클릭 시 완료 처리 / 완료된 단계 클릭 시 되돌아가기
              </p>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-sm">등록된 단계가 없습니다.</p>
        )}
      </div>

      {/* 탭 영역 (Roadmap 2.6) */}
      <div className="bg-white rounded-lg shadow">
        {/* 탭 헤더 */}
        <div className="border-b border-gray-200">
          <div className="flex">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-orange text-brand-orange'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="p-6">
          {activeTab === 'worklog' ? (
            <>
              {/* 업무 진행사항 헤더 */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span>📝</span> 업무 진행사항
                  </h3>
                  {/* 기간 필터 */}
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-gray-400">~</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => fetchWorklogs()}
                      className="px-3 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200 text-sm"
                    >
                      🔍 검색
                    </button>
                  </div>
                </div>
                {canEdit && (
                  <Link
                    href="/worklogs/new"
                    className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 text-sm"
                  >
                    + 업무일지 추가
                  </Link>
                )}
              </div>

              {/* 업무일지 목록 (기간 필터 적용) */}
              {(() => {
                const filteredWorklogs = worklogs.filter((w) => {
                  const worklogDate = w.date;
                  return worklogDate >= startDate && worklogDate <= endDate;
                });

                if (isLoadingWorklogs) {
                  return <div className="text-center text-gray-500 py-8">로딩 중...</div>;
                }

                if (filteredWorklogs.length === 0) {
                  return (
                    <div className="text-center text-gray-500 py-8">
                      <span className="text-3xl mb-2 block">📋</span>
                      <p>해당 기간에 등록된 업무일지가 없습니다.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3 mb-6">
                    {filteredWorklogs.map((worklog) => (
                    <div
                      key={worklog.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>📅</span>
                          <span>{worklog.date}</span>
                          <span className="text-gray-300">|</span>
                          <span>{getUserName(worklog.assigneeId)}</span>
                          <span className="px-2 py-0.5 bg-brand-orange-light text-brand-primary rounded text-xs">
                            {worklog.stage}
                          </span>
                          {getScheduleName(worklog.scheduleId) && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              📋 {getScheduleName(worklog.scheduleId)}
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/worklogs/${worklog.id}/edit`}
                          className="text-xs text-brand-orange hover:underline"
                        >
                          상세 →
                        </Link>
                      </div>
                      {/* 계획 & 업무내용 2열 레이아웃 (4:6 비율) */}
                      <div className="grid grid-cols-[2fr_3fr] gap-4">
                        {/* 계획 */}
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
                        {/* 업무내용 */}
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
                    </div>
                  ))}
                </div>
                );
              })()}

              {/* 이슈사항 섹션 (전체 이슈 표시) */}
              {(() => {
                const allIssues = worklogs
                  .filter((w) => w.issue && w.issue.trim() !== '')
                  .sort((a, b) => {
                    // 미해결 이슈 먼저, 그 다음 날짜순 (최신순)
                    const aResolved = a.issueStatus === 'resolved' ? 1 : 0;
                    const bResolved = b.issueStatus === 'resolved' ? 1 : 0;
                    if (aResolved !== bResolved) return aResolved - bResolved;
                    return b.date.localeCompare(a.date);
                  });
                if (allIssues.length === 0) return null;

                const unresolvedCount = allIssues.filter((w) => w.issueStatus !== 'resolved').length;

                return (
                  <>
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
                        <span>⚠️</span> 이슈사항 ({allIssues.length}건{unresolvedCount > 0 && `, 미해결 ${unresolvedCount}건`})
                      </h3>
                      <div className="space-y-2">
                        {allIssues.map((worklog) => {
                          const isResolved = worklog.issueStatus === 'resolved';
                          return (
                            <div
                              key={worklog.id}
                              className={`border-l-2 pl-3 py-2 rounded-r ${
                                isResolved
                                  ? 'border-green-400 bg-green-50'
                                  : 'border-red-400 bg-red-50'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                    <span>{worklog.date}</span>
                                    <span>|</span>
                                    <span>{getUserName(worklog.assigneeId)}</span>
                                    <span className="px-1.5 py-0.5 bg-brand-orange-light text-brand-primary rounded">
                                      {worklog.stage}
                                    </span>
                                    {getScheduleName(worklog.scheduleId) && (
                                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                        📋 {getScheduleName(worklog.scheduleId)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-700">{worklog.issue}</p>
                                </div>
                                {isResolved ? (
                                  <span className="text-sm text-green-600 whitespace-nowrap ml-2 pr-[10px]">
                                    ✅ 해결됨
                                  </span>
                                ) : (
                                  <Link
                                    href={`/worklogs/${worklog.id}/edit`}
                                    className="text-sm font-bold text-red-600 hover:text-red-800 hover:underline whitespace-nowrap ml-2 pr-[10px]"
                                  >
                                    [해결]
                                  </Link>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          ) : activeTab === 'schedule' ? (
            <>
              {/* 일정 헤더 */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span>📅</span> 개별 일정표
                  </h3>
                  {/* 뷰 모드 토글 */}
                  <div className="flex rounded-md overflow-hidden border border-gray-300">
                    <button
                      onClick={() => setScheduleViewMode('table')}
                      className={`px-3 py-1 text-sm ${
                        scheduleViewMode === 'table'
                          ? 'bg-brand-primary text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      📋 표
                    </button>
                    <button
                      onClick={() => setScheduleViewMode('gantt')}
                      className={`px-3 py-1 text-sm border-l border-gray-300 ${
                        scheduleViewMode === 'gantt'
                          ? 'bg-brand-primary text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      📊 간트
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canDeleteSchedule && (
                    <button
                      onClick={handleRefreshSchedules}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                      title="계획일 지난 진행중 항목을 지연 상태로 변경"
                    >
                      🔄 일정표 갱신
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={openNewScheduleModal}
                      className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 text-sm"
                    >
                      + 항목 추가
                    </button>
                  )}
                </div>
              </div>

              {/* 세부추진항목 목록 */}
              {isLoadingSchedules ? (
                <div className="text-center py-8 text-gray-500">
                  로딩 중...
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl mb-4 block">📅</span>
                  <p>등록된 세부추진항목이 없습니다.</p>
                  {canEdit && (
                    <button
                      onClick={openNewScheduleModal}
                      className="mt-4 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 text-sm"
                    >
                      + 첫 항목 추가하기
                    </button>
                  )}
                </div>
              ) : scheduleViewMode === 'gantt' ? (
                <GanttChart
                  schedules={schedules}
                  onTaskClick={(schedule) => openEditScheduleModal(schedule)}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          단계
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          항목명
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          계획
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          실적
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          구분
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          상태
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          관리
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedules.map((schedule) => (
                        <tr key={schedule.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {schedule.stage ? (
                              <span className="inline-flex px-2 py-0.5 bg-brand-orange-light text-brand-primary rounded text-xs">
                                {schedule.stage}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {schedule.taskName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {schedule.plannedStart} ~ {schedule.plannedEnd}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {schedule.actualStart && schedule.actualEnd
                              ? `${schedule.actualStart} ~ ${schedule.actualEnd}`
                              : schedule.actualStart
                              ? `${schedule.actualStart} ~`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {schedule.responsibility === 'lead' ? '주관' : schedule.responsibility === 'support' ? '협조' : '-'}
                            {schedule.category && ` (${schedule.category})`}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                schedule.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : schedule.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : schedule.status === 'delayed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {schedule.status === 'completed'
                                ? '완료'
                                : schedule.status === 'in_progress'
                                ? '진행중'
                                : schedule.status === 'delayed'
                                ? '지연'
                                : '예정'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              {canEdit && (
                                <button
                                  onClick={() => openEditScheduleModal(schedule)}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  수정
                                </button>
                              )}
                              {/* 완료 갱신: 진행중이고 이전 단계 항목만 표시 (팀장/관리자) */}
                              {(() => {
                                // 프로젝트 단계 목록
                                const stages = project?.stages?.split(',') || [];
                                const currentStageIndex = stages.indexOf(project?.currentStage || '');
                                const scheduleStageIndex = stages.indexOf(schedule.stage || '');
                                // 이전 단계 항목인지 확인 (단계가 지정되지 않은 항목은 제외)
                                const isPreviousStage = schedule.stage && scheduleStageIndex >= 0 && scheduleStageIndex < currentStageIndex;

                                return schedule.status === 'in_progress' && isPreviousStage && canDeleteSchedule && (
                                  <button
                                    onClick={() => handleCompleteSchedule(schedule)}
                                    className="text-green-600 hover:text-green-800 hover:underline"
                                  >
                                    완료
                                  </button>
                                );
                              })()}
                              {canDeleteSchedule && (
                                <button
                                  onClick={() => handleDeleteSchedule(schedule.id)}
                                  className="text-red-600 hover:text-red-800 hover:underline"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 범례 (테이블 뷰에서만 표시) */}
              {scheduleViewMode === 'table' && schedules.length > 0 && (
                <div className="mt-4 text-xs text-gray-500 flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-gray-100 border border-gray-300 rounded"></span> 예정
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-blue-100 border border-blue-300 rounded"></span> 진행중
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-green-100 border border-green-300 rounded"></span> 완료
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-red-100 border border-red-300 rounded"></span> 지연
                  </span>
                </div>
              )}
            </>
          ) : activeTab === 'comments' ? (
            <ExecutiveCommentsSection
              projectId={projectId}
              isTeamLeader={isTeamLeader}
            />
          ) : activeTab === 'meeting' ? (
            <MeetingMinutesSection
              projectId={projectId}
              canEdit={canEdit}
            />
          ) : (
            <div className="text-center text-gray-500 py-12">
              <span className="text-4xl mb-4 block">🚧</span>
              <p>이 기능은 추후 지원됩니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-red-600 mb-4">
              프로젝트 삭제
            </h2>
            <p className="text-gray-700 mb-6">
              <strong>{project.id}</strong> ({project.customer} - {project.item}) 프로젝트를 삭제하시겠습니까?
              <br />
              <span className="text-sm text-red-500">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={isDeleting}
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 단계 관리 모달 */}
      {showStageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              단계 관리
            </h2>

            {/* 현재 선택된 단계 */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">현재 단계 목록</h3>
              <div className="flex flex-wrap gap-2">
                {editingStages.length === 0 ? (
                  <p className="text-gray-500 text-sm">선택된 단계가 없습니다.</p>
                ) : (
                  editingStages.map((stage) => {
                    const currentIndex = editingStages.indexOf(project.currentStage);
                    const stageIndex = editingStages.indexOf(stage);
                    const isCompleted = stageIndex < currentIndex;
                    const isCurrent = stage === project.currentStage;
                    const canRemove = !isCompleted && !isCurrent;

                    return (
                      <div
                        key={stage}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                          isCompleted
                            ? 'bg-green-100 text-green-800'
                            : isCurrent
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <span>
                          {isCompleted ? '🟢' : isCurrent ? '🟡' : '⚪'} {stage}
                        </span>
                        {canRemove && (
                          <button
                            onClick={() => handleRemoveStage(stage)}
                            className="ml-1 text-gray-500 hover:text-red-600"
                            title="삭제"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                🟢 완료 (삭제불가) | 🟡 진행중 (삭제불가) | ⚪ 예정 (삭제가능)
              </p>
            </div>

            {/* 단계 추가 */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">단계 추가</h3>
              <div className="flex flex-wrap gap-2">
                {ALL_STAGES.filter(stage => !editingStages.includes(stage)).map((stage) => (
                  <button
                    key={stage}
                    onClick={() => handleAddStage(stage)}
                    className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
                  >
                    + {stage}
                  </button>
                ))}
              </div>
              {ALL_STAGES.filter(stage => !editingStages.includes(stage)).length === 0 && (
                <p className="text-gray-500 text-sm">모든 단계가 이미 추가되어 있습니다.</p>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowStageModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={isSavingStages}
              >
                취소
              </button>
              <button
                onClick={handleSaveStages}
                disabled={isSavingStages || editingStages.length === 0}
                className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 disabled:opacity-50"
              >
                {isSavingStages ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 세부추진항목 등록/수정 모달 */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingSchedule ? '세부추진항목 수정' : '세부추진항목 등록'}
            </h2>

            <div className="space-y-4">
              {/* 프로젝트 단계 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  프로젝트 단계
                </label>
                <select
                  value={scheduleForm.stage}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, stage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="">선택하세요</option>
                  {stages.map((stage) => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </div>

              {/* 항목명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  항목명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={scheduleForm.taskName}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, taskName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="예: 금형 수정"
                />
              </div>

              {/* 계획 일정 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    계획 시작일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.plannedStart}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, plannedStart: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    계획 종료일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.plannedEnd}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, plannedEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              </div>

              {/* 실적 일정 (수정 시에만 표시, sysadmin/admin만 편집 가능) */}
              {editingSchedule && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      실적 시작일
                      {!canEditActualDates && (
                        <span className="text-xs text-gray-400 ml-2">(관리자만 편집 가능)</span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={scheduleForm.actualStart}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, actualStart: e.target.value })}
                      disabled={!canEditActualDates}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary ${
                        !canEditActualDates ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      실적 종료일
                      {!canEditActualDates && (
                        <span className="text-xs text-gray-400 ml-2">(관리자만 편집 가능)</span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={scheduleForm.actualEnd}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, actualEnd: e.target.value })}
                      disabled={!canEditActualDates}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary ${
                        !canEditActualDates ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* 업무 구분 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  업무 구분
                </label>
                <div className="flex gap-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="responsibility"
                      value="lead"
                      checked={scheduleForm.responsibility === 'lead'}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, responsibility: e.target.value as 'lead' })}
                      className="form-radio text-brand-primary"
                    />
                    <span className="ml-2">주관</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="responsibility"
                      value="support"
                      checked={scheduleForm.responsibility === 'support'}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, responsibility: e.target.value as 'support' })}
                      className="form-radio text-brand-primary"
                    />
                    <span className="ml-2">협조</span>
                  </label>
                </div>
              </div>

              {/* 관련 부문 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  관련 부문
                </label>
                <select
                  value={scheduleForm.category}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, category: e.target.value as typeof scheduleForm.category })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="">선택하세요</option>
                  <option value="영업">영업</option>
                  <option value="생산">생산</option>
                  <option value="구매">구매</option>
                  <option value="품질">품질</option>
                  <option value="설계">설계</option>
                </select>
              </div>

              {/* 상태 (수정 시에만 표시) */}
              {editingSchedule && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상태
                  </label>
                  <select
                    value={scheduleForm.status}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, status: e.target.value as typeof scheduleForm.status })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value="planned">예정</option>
                    <option value="in_progress">진행중</option>
                    <option value="completed">완료</option>
                    <option value="delayed">지연</option>
                  </select>
                </div>
              )}

              {/* 비고 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비고
                </label>
                <textarea
                  value={scheduleForm.note}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, note: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="추가 메모"
                />
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={isSavingSchedule}
              >
                취소
              </button>
              <button
                onClick={handleSaveSchedule}
                disabled={isSavingSchedule}
                className="px-4 py-2 bg-brand-primary text-white rounded-md hover:opacity-90 disabled:opacity-50"
              >
                {isSavingSchedule ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}