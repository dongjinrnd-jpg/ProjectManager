'use client';

/**
 * 사용자 관리 클라이언트 컴포넌트
 */

import { useState, useEffect, useCallback } from 'react';
import type { User, UserRole, Division } from '@/types';
import AppLayout from '@/components/layout/AppLayout';

// 비밀번호 제외한 사용자 타입
type SafeUser = Omit<User, 'password'>;

// 사용자 폼 데이터 타입
interface UserFormData {
  id: string;
  password: string;
  name: string;
  email: string;
  role: UserRole;
  division: Division;
  isActive: boolean;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'user', label: '일반' },
  { value: 'engineer', label: '개발팀' },
  { value: 'admin', label: '관리자' },
  { value: 'executive', label: '경영진' },
  { value: 'sysadmin', label: '시스템관리자' },
];

const DIVISIONS: { value: Division; label: string }[] = [
  { value: '전장', label: '전장' },
  { value: '유압', label: '유압' },
  { value: '기타', label: '기타' },
];

export default function UsersClient() {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [divisionFilter, setDivisionFilter] = useState<Division | ''>('');

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    id: '',
    password: '',
    name: '',
    email: '',
    role: 'user',
    division: '전장',
    isActive: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 사용자 목록 조회
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (roleFilter) params.set('role', roleFilter);
      if (divisionFilter) params.set('division', divisionFilter);

      const response = await fetch(`/api/users?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.data);
        setError(null);
      } else {
        setError(data.error || '사용자 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, roleFilter, divisionFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 새 사용자 추가 모달 열기
  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      id: '',
      password: '',
      name: '',
      email: '',
      role: 'user',
      division: '전장',
      isActive: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // 사용자 수정 모달 열기
  const openEditModal = (user: SafeUser) => {
    setEditingUser(user);
    setFormData({
      id: user.id,
      password: '', // 수정 시 비밀번호는 빈 값 (변경하지 않으면 유지)
      name: user.name,
      email: user.email,
      role: user.role,
      division: user.division,
      isActive: user.isActive,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (editingUser) {
        // 수정
        const updateData: Record<string, unknown> = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          division: formData.division,
          isActive: formData.isActive,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }

        const response = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });
        const data = await response.json();

        if (data.success) {
          setIsModalOpen(false);
          fetchUsers();
        } else {
          setFormError(data.error || '수정에 실패했습니다.');
        }
      } else {
        // 생성
        if (!formData.password) {
          setFormError('비밀번호를 입력해주세요.');
          setSubmitting(false);
          return;
        }

        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await response.json();

        if (data.success) {
          setIsModalOpen(false);
          fetchUsers();
        } else {
          setFormError(data.error || '생성에 실패했습니다.');
        }
      }
    } catch (err) {
      setFormError('서버 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 사용자 비활성화
  const handleDelete = async (user: SafeUser) => {
    if (!confirm(`${user.name} 사용자를 비활성화하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || '비활성화에 실패했습니다.');
      }
    } catch (err) {
      alert('서버 오류가 발생했습니다.');
    }
  };

  return (
    <AppLayout>
      {/* 페이지 타이틀 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
      </div>
        {/* 필터 및 추가 버튼 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                검색
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ID, 이름, 이메일로 검색"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none"
              />
            </div>
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                권한
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none"
              >
                <option value="">전체</option>
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                소속
              </label>
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value as Division | '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none"
              >
                <option value="">전체</option>
                {DIVISIONS.map((div) => (
                  <option key={div.value} value={div.value}>
                    {div.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-brand-primary text-white rounded-md hover:opacity-90"
            >
              사용자 추가
            </button>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* 사용자 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              사용자가 없습니다.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    이름
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    이메일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    권한
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    소속
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    상태
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className={!user.isActive ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ROLES.find((r) => r.value === user.role)?.label || user.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.division}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-brand-primary hover:text-brand-orange mr-3"
                      >
                        수정
                      </button>
                      {user.isActive && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-red-600 hover:text-red-900"
                        >
                          비활성화
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      {/* 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingUser ? '사용자 수정' : '사용자 추가'}
              </h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    아이디 *
                  </label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) =>
                      setFormData({ ...formData, id: e.target.value })
                    }
                    disabled={!!editingUser}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    비밀번호 {editingUser ? '(변경 시에만 입력)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required={!editingUser}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이름 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      권한 *
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          role: e.target.value as UserRole,
                        })
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none"
                    >
                      {ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      소속 *
                    </label>
                    <select
                      value={formData.division}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          division: e.target.value as Division,
                        })
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none"
                    >
                      {DIVISIONS.map((div) => (
                        <option key={div.value} value={div.value}>
                          {div.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {editingUser && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="h-4 w-4 text-brand-orange border-gray-300 rounded accent-brand-orange"
                    />
                    <label
                      htmlFor="isActive"
                      className="ml-2 text-sm text-gray-700"
                    >
                      활성화
                    </label>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-primary text-white rounded-md hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? '처리 중...' : editingUser ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
