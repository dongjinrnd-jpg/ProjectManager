'use client';

/**
 * 프로젝트 생성/수정 폼 클라이언트 컴포넌트
 *
 * Roadmap 2.5 기준
 * - 섹션별 카드 레이아웃
 * - 기본정보, 대표이미지, 팀구성, 대일정, 단계선택, 투자비/원가, 비고
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import type { User, ProjectStage, Project, Customer, Model } from '@/types';

// 단계 목록
const STAGES: ProjectStage[] = [
  '검토', '설계', '개발', 'PROTO', '신뢰성', 'P1', 'P2',
  '승인', '양산이관', '초도양산', '품질관리', '원가절감', '품질개선', '설계변경'
];

// 소속 목록
const DIVISIONS = ['전장', '유압', '기타'];

// 구분 목록
const CATEGORIES = ['농기', '중공업', '해외', '기타'];

interface ProjectFormData {
  customer: string;
  item: string;
  teamLeaderId: string;
  scheduleStart: string;
  scheduleEnd: string;
  division: string;
  category: string;
  model: string;
  partNo: string;
  teamMembers: string[];
  stages: string[];
  currentStage: string;
  note: string;
}

const initialFormData: ProjectFormData = {
  customer: '',
  item: '',
  teamLeaderId: '',
  scheduleStart: '',
  scheduleEnd: '',
  division: '전장',
  category: '농기',
  model: '',
  partNo: '',
  teamMembers: [],
  stages: ['검토'],
  currentStage: '검토',
  note: '',
};

interface ProjectFormClientProps {
  project?: Project;
  isEdit?: boolean;
}

export default function ProjectFormClient({ project, isEdit = false }: ProjectFormClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [showCostSection, setShowCostSection] = useState(false);

  // 수정 모드일 때 초기 데이터 설정
  useEffect(() => {
    if (project && isEdit) {
      const stages = project.stages ? project.stages.split(',') : ['검토'];
      setFormData({
        customer: project.customer,
        item: project.item,
        teamLeaderId: project.teamLeaderId,
        scheduleStart: project.scheduleStart,
        scheduleEnd: project.scheduleEnd,
        division: project.division,
        category: project.category || '농기',
        model: project.model || '',
        partNo: project.partNo || '',
        teamMembers: project.teamMembers ? project.teamMembers.split(',') : [],
        stages,
        currentStage: project.currentStage || stages[0],
        note: project.note || '',
      });
    }
  }, [project, isEdit]);

  // 사용자 목록 가져오기
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (data.success) {
        // 팀장/팀원은 admin, engineer만 가능 (user, executive, sysadmin 제외)
        setUsers(data.data.filter((u: User) =>
          u.isActive && (u.role === 'admin' || u.role === 'engineer')
        ));
      }
    } catch (err) {
      console.error('사용자 목록 조회 오류:', err);
    }
  }, []);

  // 고객사 목록 가져오기
  const fetchCustomers = useCallback(async () => {
    try {
      const response = await fetch('/api/master/customers');
      const data = await response.json();
      if (data.customers) {
        setCustomers(data.customers);
      }
    } catch (err) {
      console.error('고객사 목록 조회 오류:', err);
    }
  }, []);

  // 모델 목록 가져오기
  const fetchModels = useCallback(async () => {
    try {
      const response = await fetch('/api/master/models');
      const data = await response.json();
      if (data.models) {
        setModels(data.models);
      }
    } catch (err) {
      console.error('모델 목록 조회 오류:', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchCustomers();
    fetchModels();
  }, [fetchUsers, fetchCustomers, fetchModels]);

  // 저장
  const handleSave = async () => {
    // 필수 필드 검증
    if (!formData.customer || !formData.item || !formData.teamLeaderId ||
        !formData.scheduleStart || !formData.scheduleEnd) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const url = isEdit && project ? `/api/projects/${project.id}` : '/api/projects';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          teamMembers: formData.teamMembers.join(','),
          stages: formData.stages.join(','),
        }),
      });

      const data = await response.json();
      if (data.success) {
        router.push('/projects');
      } else {
        alert(data.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      alert('서버 오류가 발생했습니다.');
      console.error('프로젝트 저장 오류:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 팀원 추가
  const addTeamMember = (userId: string) => {
    if (userId && !formData.teamMembers.includes(userId) && userId !== formData.teamLeaderId) {
      setFormData({ ...formData, teamMembers: [...formData.teamMembers, userId] });
    }
  };

  // 팀원 제거
  const removeTeamMember = (userId: string) => {
    setFormData({ ...formData, teamMembers: formData.teamMembers.filter(m => m !== userId) });
  };

  // 단계 토글
  const toggleStage = (stage: string) => {
    if (formData.stages.includes(stage)) {
      if (formData.stages.length > 1) {
        const newStages = formData.stages.filter(s => s !== stage);
        // 현재 단계가 제거되면 첫 번째 단계로 변경
        const newCurrentStage = newStages.includes(formData.currentStage)
          ? formData.currentStage
          : newStages[0];
        setFormData({ ...formData, stages: newStages, currentStage: newCurrentStage });
      }
    } else {
      setFormData({ ...formData, stages: [...formData.stages, stage] });
    }
  };

  // 사용자 이름 찾기
  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || userId;
  };

  return (
    <AppLayout>
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📁</span> {isEdit ? '프로젝트 수정' : '프로젝트 생성'}
        </h1>
        <div className="flex gap-2">
          <Link
            href="/projects"
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* 기본 정보 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 고객사 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                고객사 <span className="text-red-500">*</span>
              </label>
              {customers.length > 0 ? (
                <select
                  value={formData.customer}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
                >
                  <option value="">고객사를 선택하세요</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.customer}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
                  placeholder="예: 대동공업"
                />
              )}
            </div>

            {/* ITEM */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ITEM <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.item}
                onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
                placeholder="예: 연료펌프"
              />
            </div>

            {/* PART NO */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PART NO
              </label>
              <input
                type="text"
                value={formData.partNo}
                onChange={(e) => setFormData({ ...formData, partNo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
              />
            </div>

            {/* 소속 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                소속
              </label>
              <select
                value={formData.division}
                onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
              >
                {DIVISIONS.map(div => (
                  <option key={div} value={div}>{div}</option>
                ))}
              </select>
            </div>

            {/* 구분 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                구분
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">농기/중공업/해외/기타</p>
            </div>

            {/* 모델 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                모델
              </label>
              {models.length > 0 ? (
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
                >
                  <option value="">모델을 선택하세요</option>
                  {models.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
                />
              )}
            </div>
          </div>
        </div>

        {/* 대표 이미지 (Phase 3에서 구현) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">대표 이미지 (제품 사진/모델링)</h2>
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
              <span className="text-4xl">📷</span>
            </div>
            <div>
              <button
                type="button"
                disabled
                className="px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
              >
                파일 선택 (추후 지원)
              </button>
              <p className="text-xs text-gray-500 mt-2">지원 형식: JPG, PNG, GIF | 최대 크기: 5MB</p>
              <p className="text-xs text-gray-400 mt-1">※ 이미지 미등록 시 기본 플레이스홀더 표시</p>
            </div>
          </div>
        </div>

        {/* 팀 구성 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">팀 구성</h2>
          <div className="space-y-4">
            {/* 팀장 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                팀장 (1명) <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.teamLeaderId}
                onChange={(e) => {
                  const newLeaderId = e.target.value;
                  // 팀장이 팀원에 있으면 제거
                  const newMembers = formData.teamMembers.filter(m => m !== newLeaderId);
                  setFormData({ ...formData, teamLeaderId: newLeaderId, teamMembers: newMembers });
                }}
                className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
              >
                <option value="">팀장을 선택하세요</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name} ({user.division})</option>
                ))}
              </select>
            </div>

            {/* 팀원 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                팀원 (여러 명)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.teamMembers.map(memberId => (
                  <span
                    key={memberId}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-brand-orange-light text-brand-primary rounded-full text-sm"
                  >
                    {getUserName(memberId)}
                    <button
                      type="button"
                      onClick={() => removeTeamMember(memberId)}
                      className="hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <select
                onChange={(e) => {
                  addTeamMember(e.target.value);
                  e.target.value = '';
                }}
                className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
              >
                <option value="">+ 팀원 추가</option>
                {users
                  .filter(u => u.id !== formData.teamLeaderId && !formData.teamMembers.includes(u.id))
                  .map(user => (
                    <option key={user.id} value={user.id}>{user.name} ({user.division})</option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* 대일정 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            대일정 <span className="text-red-500">*</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
              <input
                type="date"
                value={formData.scheduleStart}
                onChange={(e) => setFormData({ ...formData, scheduleStart: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
              <input
                type="date"
                value={formData.scheduleEnd}
                min={formData.scheduleStart}
                onChange={(e) => setFormData({ ...formData, scheduleEnd: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
              />
            </div>
          </div>
        </div>

        {/* 개발 단계 선택 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            개발 단계 선택 (팀장이 필요한 단계만 선택)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STAGES.map(stage => (
              <label
                key={stage}
                className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${
                  formData.stages.includes(stage)
                    ? 'bg-brand-orange-light border-brand-orange text-brand-primary'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.stages.includes(stage)}
                  onChange={() => toggleStage(stage)}
                  className="sr-only"
                />
                <span className={formData.stages.includes(stage) ? 'font-medium' : ''}>
                  {formData.stages.includes(stage) ? '☑️' : '☐'} {stage}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            ※ 선택한 단계만 프로젝트 진행 현황에 표시됩니다
          </p>

          {/* 현재 단계 선택 */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              현재 단계 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.currentStage}
              onChange={(e) => setFormData({ ...formData, currentStage: e.target.value })}
              className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
            >
              {formData.stages.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              ※ 선택한 단계 중 현재 진행 중인 단계를 선택하세요
            </p>
          </div>
        </div>

        {/* 투자비/원가 정보 (접기/펼치기) */}
        <div className="bg-white rounded-lg shadow">
          <button
            type="button"
            onClick={() => setShowCostSection(!showCostSection)}
            className="w-full px-6 py-4 flex justify-between items-center text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900">투자비/원가 정보 (선택)</h2>
            <span className="text-gray-500">{showCostSection ? '▲ 접기' : '▼ 펼치기'}</span>
          </button>
          {showCostSection && (
            <div className="px-6 pb-6 border-t border-gray-100">
              <p className="text-sm text-gray-500 py-4">
                투자비/원가 정보는 Phase 3에서 구현 예정입니다.
              </p>
            </div>
          )}
        </div>

        {/* 비고 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">비고</h2>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
            placeholder="추가 메모 사항"
          />
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-end gap-3 pb-6">
          <Link
            href="/projects"
            className="px-6 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}