'use client';

/**
 * 시스템 설정 클라이언트 컴포넌트
 *
 * PRD 3.11 시스템 설정:
 * - 개발 단계 관리: 14개 단계 활성화/비활성화, 순서 변경
 * - 시스템 옵션: 페이지당 항목 수, 날짜 형식, 소속 옵션
 * - 데이터 관리: 구글 시트 연동 상태, 수동 동기화
 */

import { useState, useEffect } from 'react';

// 기본 14개 개발 단계
const DEFAULT_STAGES = [
  { id: 'review', name: '검토', order: 1 },
  { id: 'design', name: '설계', order: 2 },
  { id: 'development', name: '개발', order: 3 },
  { id: 'proto', name: 'PROTO', order: 4 },
  { id: 'reliability', name: '신뢰성', order: 5 },
  { id: 'p1', name: 'P1', order: 6 },
  { id: 'p2', name: 'P2', order: 7 },
  { id: 'approval', name: '승인', order: 8 },
  { id: 'transfer', name: '양산이관', order: 9 },
  { id: 'initial_production', name: '초도양산', order: 10 },
  { id: 'quality_control', name: '품질관리', order: 11 },
  { id: 'cost_reduction', name: '원가절감', order: 12 },
  { id: 'quality_improvement', name: '품질개선', order: 13 },
  { id: 'design_change', name: '설계변경', order: 14 },
];

// 기본 소속 옵션
const DEFAULT_DIVISIONS = ['전장', '유압', '기타'];

// 기본 구분 옵션 (주간보고용)
const DEFAULT_CATEGORIES = ['농기', '중공업', '해외', '기타'];

interface Stage {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
}

interface SystemSettings {
  itemsPerPage: number;
  dateFormat: string;
  divisions: string[];
  categories: string[];
}

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState<'stages' | 'options' | 'data' | 'master'>('stages');
  const [stages, setStages] = useState<Stage[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; order: number }[]>([]);
  const [models, setModels] = useState<{ id: string; name: string; order: number }[]>([]);
  const [newCustomer, setNewCustomer] = useState('');
  const [newModel, setNewModel] = useState('');
  const [settings, setSettings] = useState<SystemSettings>({
    itemsPerPage: 20,
    dateFormat: 'YYYY-MM-DD',
    divisions: DEFAULT_DIVISIONS,
    categories: DEFAULT_CATEGORIES,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [masterInitStatus, setMasterInitStatus] = useState<'idle' | 'initializing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 설정 로드
  useEffect(() => {
    loadSettings();
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    try {
      const [customersRes, modelsRes] = await Promise.all([
        fetch('/api/master/customers'),
        fetch('/api/master/models'),
      ]);
      const customersData = await customersRes.json();
      const modelsData = await modelsRes.json();
      if (customersData.customers) setCustomers(customersData.customers);
      if (modelsData.models) setModels(modelsData.models);
    } catch (error) {
      console.error('마스터 데이터 로드 실패:', error);
    }
  };

  const addCustomer = async () => {
    if (!newCustomer.trim()) return;
    try {
      const response = await fetch('/api/master/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomer.trim() }),
      });
      const data = await response.json();
      if (response.ok) {
        setCustomers(prev => [...prev, data.customer]);
        setNewCustomer('');
        setMessage({ type: 'success', text: `고객사 "${newCustomer.trim()}" 추가됨` });
      } else {
        setMessage({ type: 'error', text: data.error || '추가 실패' });
      }
    } catch (error) {
      console.error('고객사 추가 실패:', error);
      setMessage({ type: 'error', text: '고객사 추가에 실패했습니다.' });
    }
  };

  const deleteCustomer = async (id: string, name: string) => {
    if (!confirm(`"${name}" 고객사를 삭제하시겠습니까?`)) return;
    try {
      const response = await fetch(`/api/master/customers?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        setCustomers(prev => prev.filter(c => c.id !== id));
        setMessage({ type: 'success', text: `고객사 "${name}" 삭제됨` });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || '삭제 실패' });
      }
    } catch (error) {
      console.error('고객사 삭제 실패:', error);
      setMessage({ type: 'error', text: '고객사 삭제에 실패했습니다.' });
    }
  };

  const addModel = async () => {
    if (!newModel.trim()) return;
    try {
      const response = await fetch('/api/master/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newModel.trim() }),
      });
      const data = await response.json();
      if (response.ok) {
        setModels(prev => [...prev, data.model]);
        setNewModel('');
        setMessage({ type: 'success', text: `모델 "${newModel.trim()}" 추가됨` });
      } else {
        setMessage({ type: 'error', text: data.error || '추가 실패' });
      }
    } catch (error) {
      console.error('모델 추가 실패:', error);
      setMessage({ type: 'error', text: '모델 추가에 실패했습니다.' });
    }
  };

  const deleteModel = async (id: string, name: string) => {
    if (!confirm(`"${name}" 모델을 삭제하시겠습니까?`)) return;
    try {
      const response = await fetch(`/api/master/models?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        setModels(prev => prev.filter(m => m.id !== id));
        setMessage({ type: 'success', text: `모델 "${name}" 삭제됨` });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || '삭제 실패' });
      }
    } catch (error) {
      console.error('모델 삭제 실패:', error);
      setMessage({ type: 'error', text: '모델 삭제에 실패했습니다.' });
    }
  };

  const moveCustomer = async (id: string, direction: 'up' | 'down') => {
    try {
      const response = await fetch('/api/master/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, direction }),
      });
      if (response.ok) {
        // 로컬 상태 업데이트
        const index = customers.findIndex(c => c.id === id);
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < customers.length) {
          const newCustomers = [...customers];
          const tempOrder = newCustomers[index].order;
          newCustomers[index].order = newCustomers[targetIndex].order;
          newCustomers[targetIndex].order = tempOrder;
          [newCustomers[index], newCustomers[targetIndex]] = [newCustomers[targetIndex], newCustomers[index]];
          setCustomers(newCustomers);
        }
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || '순서 변경 실패' });
      }
    } catch (error) {
      console.error('고객사 순서 변경 실패:', error);
      setMessage({ type: 'error', text: '순서 변경에 실패했습니다.' });
    }
  };

  const moveModel = async (id: string, direction: 'up' | 'down') => {
    try {
      const response = await fetch('/api/master/models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, direction }),
      });
      if (response.ok) {
        // 로컬 상태 업데이트
        const index = models.findIndex(m => m.id === id);
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < models.length) {
          const newModels = [...models];
          const tempOrder = newModels[index].order;
          newModels[index].order = newModels[targetIndex].order;
          newModels[targetIndex].order = tempOrder;
          [newModels[index], newModels[targetIndex]] = [newModels[targetIndex], newModels[index]];
          setModels(newModels);
        }
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || '순서 변경 실패' });
      }
    } catch (error) {
      console.error('모델 순서 변경 실패:', error);
      setMessage({ type: 'error', text: '순서 변경에 실패했습니다.' });
    }
  };

  // 고객사 직접 순서 변경
  const moveCustomerToPosition = async (id: string, newOrder: number) => {
    try {
      const response = await fetch('/api/master/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, newOrder }),
      });
      if (response.ok) {
        // 전체 목록 다시 불러오기
        await loadMasterData();
        setMessage({ type: 'success', text: `${newOrder}번으로 이동 완료` });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || '순서 변경 실패' });
      }
    } catch (error) {
      console.error('고객사 순서 변경 실패:', error);
      setMessage({ type: 'error', text: '순서 변경에 실패했습니다.' });
    }
  };

  // 모델 직접 순서 변경
  const moveModelToPosition = async (id: string, newOrder: number) => {
    try {
      const response = await fetch('/api/master/models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, newOrder }),
      });
      if (response.ok) {
        // 전체 목록 다시 불러오기
        await loadMasterData();
        setMessage({ type: 'success', text: `${newOrder}번으로 이동 완료` });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || '순서 변경 실패' });
      }
    } catch (error) {
      console.error('모델 순서 변경 실패:', error);
      setMessage({ type: 'error', text: '순서 변경에 실패했습니다.' });
    }
  };

  // 순서 번호 클릭 시 입력 처리
  const handleOrderClick = (type: 'customer' | 'model', id: string, currentOrder: number, maxOrder: number) => {
    const input = prompt(`이동할 순서를 입력하세요 (1~${maxOrder}):`, String(currentOrder));
    if (input === null) return;
    const newOrder = parseInt(input, 10);
    if (isNaN(newOrder) || newOrder < 1 || newOrder > maxOrder) {
      setMessage({ type: 'error', text: `1~${maxOrder} 사이의 숫자를 입력하세요.` });
      return;
    }
    if (newOrder === currentOrder) return;

    if (type === 'customer') {
      moveCustomerToPosition(id, newOrder);
    } else {
      moveModelToPosition(id, newOrder);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.stages) {
          setStages(data.stages);
        } else {
          // 기본 단계 설정
          setStages(DEFAULT_STAGES.map(s => ({ ...s, isActive: true })));
        }
        if (data.settings) {
          setSettings(data.settings);
        }
      } else {
        // API가 없으면 기본값 사용
        setStages(DEFAULT_STAGES.map(s => ({ ...s, isActive: true })));
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
      // 기본값 사용
      setStages(DEFAULT_STAGES.map(s => ({ ...s, isActive: true })));
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages, settings }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: '설정이 저장되었습니다.' });
      } else {
        throw new Error('저장 실패');
      }
    } catch (error) {
      console.error('설정 저장 실패:', error);
      setMessage({ type: 'error', text: '설정 저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleStageActive = (stageId: string) => {
    setStages(prev =>
      prev.map(s => (s.id === stageId ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const newStages = [...stages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newStages.length) return;

    // 순서 교환
    [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];

    // order 값 재설정
    newStages.forEach((s, i) => {
      s.order = i + 1;
    });

    setStages(newStages);
  };

  const handleSync = async () => {
    setSyncStatus('syncing');
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      if (response.ok) {
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        throw new Error('동기화 실패');
      }
    } catch (error) {
      console.error('동기화 실패:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const addDivision = () => {
    const newDivision = prompt('새 소속을 입력하세요:');
    if (newDivision && !settings.divisions.includes(newDivision)) {
      setSettings(prev => ({
        ...prev,
        divisions: [...prev.divisions, newDivision],
      }));
    }
  };

  const removeDivision = (division: string) => {
    if (DEFAULT_DIVISIONS.includes(division)) {
      alert('기본 소속은 삭제할 수 없습니다.');
      return;
    }
    if (confirm(`"${division}" 소속을 삭제하시겠습니까?`)) {
      setSettings(prev => ({
        ...prev,
        divisions: prev.divisions.filter(d => d !== division),
      }));
    }
  };

  const addCategory = () => {
    const newCategory = prompt('새 구분을 입력하세요:');
    if (newCategory && !settings.categories.includes(newCategory)) {
      setSettings(prev => ({
        ...prev,
        categories: [...prev.categories, newCategory],
      }));
    }
  };

  const removeCategory = (category: string) => {
    if (DEFAULT_CATEGORIES.includes(category)) {
      alert('기본 구분은 삭제할 수 없습니다.');
      return;
    }
    if (confirm(`"${category}" 구분을 삭제하시겠습니까?`)) {
      setSettings(prev => ({
        ...prev,
        categories: prev.categories.filter(c => c !== category),
      }));
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>설정</span>
        </h1>
        {/* 개발 단계 관리, 시스템 옵션 탭에서만 저장 버튼 표시 */}
        {(activeTab === 'stages' || activeTab === 'options') && (
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        )}
      </div>

      {/* 메시지 */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 탭 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('stages')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'stages'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            개발 단계 관리
          </button>
          <button
            onClick={() => setActiveTab('options')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'options'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            시스템 옵션
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'data'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            데이터 관리
          </button>
          <button
            onClick={() => setActiveTab('master')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'master'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            고객사/모델 관리
          </button>
        </nav>
      </div>

      {/* 탭 내용 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* 개발 단계 관리 */}
        {activeTab === 'stages' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">개발 단계 관리</h2>
            <p className="text-sm text-gray-600 mb-4">
              프로젝트에서 사용할 개발 단계를 활성화/비활성화하고 순서를 변경할 수 있습니다.
            </p>
            <div className="space-y-2">
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    stage.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm w-6">{index + 1}</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stage.isActive}
                        onChange={() => toggleStageActive(stage.id)}
                        className="w-4 h-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary"
                      />
                      <span className={stage.isActive ? 'text-gray-900' : 'text-gray-400'}>
                        {stage.name}
                      </span>
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveStage(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="위로 이동"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveStage(index, 'down')}
                      disabled={index === stages.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="아래로 이동"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 시스템 옵션 */}
        {activeTab === 'options' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold mb-4">시스템 옵션</h2>

            {/* 페이지당 항목 수 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                페이지당 항목 수
              </label>
              <select
                value={settings.itemsPerPage}
                onChange={e => setSettings(prev => ({ ...prev, itemsPerPage: Number(e.target.value) }))}
                className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value={10}>10개</option>
                <option value={20}>20개</option>
                <option value={50}>50개</option>
                <option value={100}>100개</option>
              </select>
            </div>

            {/* 날짜 형식 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                날짜 표시 형식
              </label>
              <select
                value={settings.dateFormat}
                onChange={e => setSettings(prev => ({ ...prev, dateFormat: e.target.value }))}
                className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-02-13)</option>
                <option value="YY.MM.DD">YY.MM.DD (26.02.13)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (02/13/2026)</option>
              </select>
            </div>

            {/* 소속 관리 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                소속 옵션 관리
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {settings.divisions.map(division => (
                  <span
                    key={division}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {division}
                    <button
                      onClick={() => removeDivision(division)}
                      className="ml-1 text-gray-400 hover:text-red-500"
                      title="삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                <button
                  onClick={addDivision}
                  className="inline-flex items-center gap-1 px-3 py-1 border border-dashed border-gray-300 text-gray-500 rounded-full text-sm hover:border-brand-primary hover:text-brand-primary"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  추가
                </button>
              </div>
            </div>

            {/* 구분 관리 (주간보고용) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                구분 옵션 관리 (주간보고)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {settings.categories.map(category => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    {category}
                    <button
                      onClick={() => removeCategory(category)}
                      className="ml-1 text-blue-400 hover:text-red-500"
                      title="삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                <button
                  onClick={addCategory}
                  className="inline-flex items-center gap-1 px-3 py-1 border border-dashed border-blue-300 text-blue-500 rounded-full text-sm hover:border-blue-500 hover:text-blue-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  추가
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 데이터 관리 */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold mb-4">데이터 관리</h2>

            {/* 구글 시트 연동 상태 */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Google Sheets 연동</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                연동 상태: 정상
              </div>
              <div className="text-xs text-gray-500 mb-3">
                Spreadsheet ID: 1koJEgn6xwPNTFsuJdoo5gPGmKBdWZs08lJNQHYvLtJI
              </div>
              <button
                onClick={handleSync}
                disabled={syncStatus === 'syncing'}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  syncStatus === 'syncing'
                    ? 'bg-gray-200 text-gray-500'
                    : syncStatus === 'success'
                    ? 'bg-green-100 text-green-700'
                    : syncStatus === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-brand-primary text-white hover:bg-brand-primary/90'
                }`}
              >
                {syncStatus === 'syncing'
                  ? '동기화 중...'
                  : syncStatus === 'success'
                  ? '동기화 완료!'
                  : syncStatus === 'error'
                  ? '동기화 실패'
                  : '수동 동기화'}
              </button>
            </div>

            {/* 백업 다운로드 */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">데이터 백업</h3>
              <p className="text-sm text-gray-600 mb-3">
                현재 데이터를 Excel 파일로 다운로드합니다.
              </p>
              <div className="flex gap-2">
                <a
                  href="/api/projects/download"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  프로젝트 다운로드
                </a>
                <a
                  href="/api/worklogs/download"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  업무일지 다운로드
                </a>
              </div>
            </div>

            {/* 마스터 데이터 초기화 */}
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="font-medium text-gray-900 mb-2">마스터 데이터 초기화</h3>
              <p className="text-sm text-gray-600 mb-3">
                고객사/모델 마스터 시트를 생성하고 초기 데이터를 입력합니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!confirm('마스터 데이터 시트를 초기화하시겠습니까?\n(이미 있는 시트는 건너뜁니다)')) return;
                    setMasterInitStatus('initializing');
                    try {
                      const response = await fetch('/api/master/init', { method: 'POST' });
                      const data = await response.json();
                      if (response.ok) {
                        setMasterInitStatus('success');
                        setMessage({ type: 'success', text: `마스터 데이터 초기화 완료: ${data.results?.join(', ')}` });
                      } else {
                        throw new Error(data.error || '초기화 실패');
                      }
                    } catch (error) {
                      console.error('마스터 데이터 초기화 실패:', error);
                      setMasterInitStatus('error');
                      setMessage({ type: 'error', text: '마스터 데이터 초기화에 실패했습니다.' });
                    }
                    setTimeout(() => setMasterInitStatus('idle'), 3000);
                  }}
                  disabled={masterInitStatus === 'initializing'}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    masterInitStatus === 'initializing'
                      ? 'bg-gray-200 text-gray-500'
                      : masterInitStatus === 'success'
                      ? 'bg-green-100 text-green-700'
                      : masterInitStatus === 'error'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-500 text-white hover:bg-yellow-600'
                  }`}
                >
                  {masterInitStatus === 'initializing'
                    ? '초기화 중...'
                    : masterInitStatus === 'success'
                    ? '초기화 완료!'
                    : masterInitStatus === 'error'
                    ? '초기화 실패'
                    : '초기화 (새 시트만)'}
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('⚠️ 기존 마스터 시트를 삭제하고 다시 생성합니다.\n기존 데이터가 모두 삭제됩니다. 계속하시겠습니까?')) return;
                    setMasterInitStatus('initializing');
                    try {
                      const response = await fetch('/api/master/init', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ force: true }),
                      });
                      const data = await response.json();
                      if (response.ok) {
                        setMasterInitStatus('success');
                        setMessage({ type: 'success', text: `마스터 데이터 재초기화 완료: ${data.results?.join(', ')}` });
                      } else {
                        throw new Error(data.error || '초기화 실패');
                      }
                    } catch (error) {
                      console.error('마스터 데이터 초기화 실패:', error);
                      setMasterInitStatus('error');
                      setMessage({ type: 'error', text: '마스터 데이터 초기화에 실패했습니다.' });
                    }
                    setTimeout(() => setMasterInitStatus('idle'), 3000);
                  }}
                  disabled={masterInitStatus === 'initializing'}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-500"
                >
                  강제 재초기화
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                고객사 37개, 모델 23개가 초기 데이터로 등록됩니다.
              </p>
            </div>

            {/* 시스템 정보 */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">시스템 정보</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>버전: 1.0.0</p>
                <p>Next.js: 16.1.6</p>
                <p>환경: {process.env.NODE_ENV === 'production' ? '운영' : '개발'}</p>
              </div>
            </div>
          </div>
        )}

        {/* 고객사/모델 관리 */}
        {activeTab === 'master' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">고객사/모델 관리</h2>

            {/* 좌우 배치 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 고객사 관리 (좌) */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">고객사 목록 ({customers.length}개)</h3>
                <p className="text-xs text-gray-500 mb-3">순서 번호를 클릭하여 직접 이동하거나, ↑↓ 버튼으로 순서를 변경할 수 있습니다.</p>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newCustomer}
                    onChange={e => setNewCustomer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomer()}
                    placeholder="새 고객사명 입력"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-primary focus:border-brand-primary"
                  />
                  <button
                    onClick={addCustomer}
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90"
                  >
                    추가
                  </button>
                </div>
                <div className="max-h-[64rem] overflow-y-auto border border-gray-200 rounded-lg bg-white">
                  {customers.map((c, index) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleOrderClick('customer', c.id, index + 1, customers.length)}
                          className="text-gray-400 text-sm w-6 hover:text-brand-primary hover:font-medium cursor-pointer"
                          title="순서 번호 클릭하여 직접 이동"
                        >
                          {index + 1}
                        </button>
                        <span className="text-gray-900">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveCustomer(c.id, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="위로 이동"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveCustomer(c.id, 'down')}
                          disabled={index === customers.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="아래로 이동"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteCustomer(c.id, c.name)}
                          className="p-1 text-gray-400 hover:text-red-500 ml-2"
                          title="삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 모델 관리 (우) */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">모델 목록 ({models.length}개)</h3>
                <p className="text-xs text-gray-500 mb-3">순서 번호를 클릭하여 직접 이동하거나, ↑↓ 버튼으로 순서를 변경할 수 있습니다.</p>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newModel}
                    onChange={e => setNewModel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addModel()}
                    placeholder="새 모델명 입력"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-primary focus:border-brand-primary"
                  />
                  <button
                    onClick={addModel}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    추가
                  </button>
                </div>
                <div className="max-h-[64rem] overflow-y-auto border border-gray-200 rounded-lg bg-white">
                  {models.map((m, index) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleOrderClick('model', m.id, index + 1, models.length)}
                          className="text-gray-400 text-sm w-6 hover:text-blue-600 hover:font-medium cursor-pointer"
                          title="순서 번호 클릭하여 직접 이동"
                        >
                          {index + 1}
                        </button>
                        <span className="text-gray-900">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveModel(m.id, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="위로 이동"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveModel(m.id, 'down')}
                          disabled={index === models.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="아래로 이동"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteModel(m.id, m.name)}
                          className="p-1 text-gray-400 hover:text-red-500 ml-2"
                          title="삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
