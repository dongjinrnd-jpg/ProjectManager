'use client';

/**
 * 매뉴얼 클라이언트 컴포넌트
 *
 * 역할별 사용자 매뉴얼 페이지
 */

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';

// 역할 정보
const ROLE_INFO: Record<string, { label: string; description: string }> = {
  user: { label: '일반 사용자', description: '조회 권한' },
  engineer: { label: '엔지니어', description: '프로젝트 및 업무일지 작성 권한' },
  admin: { label: '관리자', description: '프로젝트 삭제 포함 관리 권한' },
  executive: { label: '경영진', description: '프로젝트 모니터링 및 의사결정 지원' },
  sysadmin: { label: '시스템 관리자', description: '시스템 전반의 설정 및 운영 담당' },
};

// 메뉴 접근 권한
const MENU_ACCESS: Record<string, { menu: string; icon: string; description: string; access: string }[]> = {
  user: [
    { menu: '대시보드', icon: '📊', description: '전체 프로젝트 현황 요약', access: '조회' },
    { menu: '프로젝트', icon: '📁', description: '프로젝트 목록 및 상세', access: '조회' },
    { menu: '전체 일정', icon: '📅', description: '캘린더 형태의 일정', access: '조회' },
  ],
  engineer: [
    { menu: '대시보드', icon: '📊', description: '본인 담당 프로젝트 현황', access: '조회' },
    { menu: '프로젝트', icon: '📁', description: '프로젝트 생성/수정/조회', access: 'CRUD' },
    { menu: '업무일지', icon: '📝', description: '일별 업무 기록', access: 'CRUD' },
    { menu: '고급 검색', icon: '🔍', description: '업무일지 통합 검색', access: '조회' },
    { menu: '전체 일정', icon: '📅', description: '캘린더 형태의 일정', access: '조회' },
    { menu: '주간보고', icon: '📋', description: '주간 단위 업무 보고서', access: 'CRUD' },
    { menu: '개선요청', icon: '💡', description: '버그/개선요청 관리', access: 'CRUD' },
  ],
  admin: [
    { menu: '대시보드', icon: '📊', description: '팀 전체 프로젝트 현황', access: '조회' },
    { menu: '프로젝트', icon: '📁', description: '프로젝트 생성/수정/삭제', access: 'CRUD+삭제' },
    { menu: '업무일지', icon: '📝', description: '팀원 업무일지 조회', access: 'CRUD' },
    { menu: '고급 검색', icon: '🔍', description: '업무일지 통합 검색', access: '조회' },
    { menu: '전체 일정', icon: '📅', description: '캘린더 형태의 일정', access: '조회' },
    { menu: '주간보고', icon: '📋', description: '주간 단위 업무 보고서', access: 'CRUD' },
    { menu: '개선요청', icon: '💡', description: '버그/개선요청 관리', access: 'CRUD' },
  ],
  executive: [
    { menu: '대시보드', icon: '📊', description: '전체 프로젝트 현황 요약', access: '조회' },
    { menu: '프로젝트', icon: '📁', description: '프로젝트 목록 조회', access: '조회' },
    { menu: '업무일지', icon: '📝', description: '팀 업무일지 조회', access: '조회' },
    { menu: '고급 검색', icon: '🔍', description: '업무일지 통합 검색', access: '조회' },
    { menu: '전체 일정', icon: '📅', description: '캘린더 형태의 일정', access: '조회' },
    { menu: '주간보고', icon: '📋', description: '주간 단위 업무 보고서', access: '조회' },
    { menu: '경영진', icon: '👔', description: '경영진 전용 대시보드', access: '조회' },
  ],
  sysadmin: [
    { menu: '대시보드', icon: '📊', description: '전체 프로젝트 현황 요약', access: '조회' },
    { menu: '프로젝트', icon: '📁', description: '프로젝트 목록 조회/관리', access: 'CRUD' },
    { menu: '전체 일정', icon: '📅', description: '캘린더 형태의 일정', access: '조회' },
    { menu: '개선요청', icon: '💡', description: '버그/개선요청 관리', access: 'CRUD+상태변경' },
    { menu: '경영진', icon: '👔', description: '경영진 대시보드', access: '조회' },
    { menu: '사용자 관리', icon: '👥', description: '사용자 계정 관리', access: 'CRUD' },
    { menu: '시스템 설정', icon: '⚙️', description: '공통 코드, 시스템 설정', access: '설정' },
  ],
};

export default function ManualClient() {
  const [role, setRole] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchManual = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/manual');
        const data = await response.json();

        if (data.success) {
          setRole(data.data.role);
          setError(null);
        } else {
          setError(data.error || '매뉴얼을 불러올 수 없습니다.');
        }
      } catch (err) {
        setError('서버 연결 오류가 발생했습니다.');
        console.error('매뉴얼 조회 오류:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchManual();
  }, []);

  const roleInfo = ROLE_INFO[role] || { label: role, description: '' };
  const menuAccess = MENU_ACCESS[role] || [];

  return (
    <AppLayout>
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          📖 사용자 매뉴얼
        </h1>
        {role && (
          <p className="mt-1 text-gray-600">
            {roleInfo.label} ({roleInfo.description})
          </p>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 로딩 */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          로딩 중...
        </div>
      ) : (
        <div className="space-y-6">
          {/* 메뉴 접근 권한 */}
          <section className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">접근 가능 메뉴</h2>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">메뉴</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">설명</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">권한</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuAccess.map((item, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="mr-2">{item.icon}</span>
                          <span className="font-medium text-gray-900">{item.menu}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{item.description}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                            item.access === '조회' ? 'bg-gray-100 text-gray-700' :
                            item.access.includes('CRUD') ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {item.access}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 역할별 주요 기능 */}
          {role === 'engineer' && <EngineerGuide />}
          {role === 'admin' && <AdminGuide />}
          {role === 'executive' && <ExecutiveGuide />}
          {role === 'sysadmin' && <SysadminGuide />}
          {role === 'user' && <UserGuide />}

          {/* 공통 팁 */}
          <section className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">💡 유용한 팁</h2>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-brand-orange font-bold">•</span>
                  <div>
                    <strong className="text-gray-900">날짜 입력</strong>
                    <p className="text-gray-600 text-sm mt-1">
                      <code className="bg-gray-100 px-2 py-0.5 rounded text-brand-orange">20260211</code> 입력 → 자동으로 <code className="bg-gray-100 px-2 py-0.5 rounded text-brand-orange">2026-02-11</code> 변환
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-brand-orange font-bold">•</span>
                  <div>
                    <strong className="text-gray-900">즐겨찾기</strong>
                    <p className="text-gray-600 text-sm mt-1">
                      프로젝트 즐겨찾기 등록 시 대시보드에서 우선 표시됩니다.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-brand-orange font-bold">•</span>
                  <div>
                    <strong className="text-gray-900">검색 조건 저장</strong>
                    <p className="text-gray-600 text-sm mt-1">
                      고급 검색에서 자주 사용하는 검색 조건을 저장해두면 빠르게 불러올 수 있습니다.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* 문의처 */}
          <section className="bg-gray-50 rounded-lg p-6 text-center">
            <p className="text-gray-600">
              시스템 관련 문의사항은 <strong className="text-gray-900">시스템 관리자</strong>에게 연락해주세요.
            </p>
          </section>
        </div>
      )}
    </AppLayout>
  );
}

// 엔지니어 가이드
function EngineerGuide() {
  return (
    <>
      <section className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">📁 프로젝트 관리</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">프로젝트 생성</h3>
            <p className="text-gray-600 text-sm">
              <strong>[+ 새 프로젝트]</strong> 버튼 클릭 후 필수 정보 입력: 고객사, ITEM, 팀장, 시작일, 종료일
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">세부추진항목 상태</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                <span className="text-sm text-gray-700">예정</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                <span className="text-sm text-gray-700">진행중</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-sm text-gray-700">완료</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-sm text-gray-700">지연</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">📝 업무일지</h2>
        </div>
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">필수 입력</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 날짜 (기본: 오늘)</li>
                <li>• 프로젝트</li>
                <li>• 단계</li>
                <li>• 업무 내용</li>
              </ul>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">선택 입력</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 세부추진항목 (실적 자동 연동)</li>
                <li>• 참여자</li>
                <li>• 계획</li>
                <li>• 이슈사항</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// 관리자 가이드
function AdminGuide() {
  return (
    <>
      <EngineerGuide />
      <section className="bg-white rounded-lg shadow border-l-4 border-red-500">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-red-600">⚠️ 관리자 전용 기능</h2>
        </div>
        <div className="p-6">
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="font-medium text-red-800 mb-2">프로젝트 삭제 시 주의</h3>
            <p className="text-red-700 text-sm mb-3">
              프로젝트 삭제는 <strong>되돌릴 수 없습니다.</strong>
            </p>
            <p className="text-red-600 text-sm">
              삭제되는 데이터: 프로젝트 정보, 업무일지, 세부추진항목, 주간보고, 회의록
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

// 경영진 가이드
function ExecutiveGuide() {
  return (
    <section className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">👔 경영진 대시보드</h2>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <h3 className="font-medium text-gray-900 mb-2">상태 카드 의미</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg text-center">
              <div className="text-blue-600 font-bold text-lg">● 정상</div>
              <div className="text-sm text-blue-700 mt-1">계획대로 진행</div>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg text-center">
              <div className="text-yellow-600 font-bold text-lg">▲ 지연</div>
              <div className="text-sm text-yellow-700 mt-1">일정 지연 발생</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <div className="text-green-600 font-bold text-lg">✓ 완료</div>
              <div className="text-sm text-green-700 mt-1">프로젝트 완료</div>
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-medium text-gray-900 mb-2">활용 팁</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• <strong>일일</strong>: 경영진 대시보드에서 지연 프로젝트 확인</li>
            <li>• <strong>주간</strong>: 주간보고 검토, 계획vs실적 분석</li>
            <li>• <strong>월간</strong>: 전체 일정(간트차트) 확인, 회의록 검토</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

// 시스템 관리자 가이드
function SysadminGuide() {
  return (
    <>
      <section className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">👥 사용자 관리</h2>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">역할</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">권한 범위</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">용도</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-900">user</td>
                  <td className="py-2 px-3">조회만</td>
                  <td className="py-2 px-3">외부 열람자, 인턴</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-900">engineer</td>
                  <td className="py-2 px-3">CRUD</td>
                  <td className="py-2 px-3">프로젝트 담당자</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-900">admin</td>
                  <td className="py-2 px-3">CRUD + 삭제</td>
                  <td className="py-2 px-3">팀장, 부서장</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-900">executive</td>
                  <td className="py-2 px-3">조회 + 대시보드</td>
                  <td className="py-2 px-3">임원, 경영진</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-gray-900">sysadmin</td>
                  <td className="py-2 px-3">전체</td>
                  <td className="py-2 px-3">IT 담당자</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">💡 개선요청 상태 관리</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            <strong>sysadmin만</strong> 개선요청의 상태를 변경할 수 있습니다.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-sm text-gray-700">접수</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span className="text-sm text-gray-700">검토중</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-orange-50 rounded">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span>
              <span className="text-sm text-gray-700">진행중</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-sm text-gray-700">완료</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-gray-100 rounded">
              <span className="w-3 h-3 rounded-full bg-gray-400"></span>
              <span className="text-sm text-gray-700">보류</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-red-50 rounded">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-sm text-gray-700">반려</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// 일반 사용자 가이드
function UserGuide() {
  return (
    <section className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">📋 이용 안내</h2>
      </div>
      <div className="p-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-blue-800 text-sm">
            일반 사용자(user) 등급은 <strong>조회 권한</strong>만 제공됩니다.
          </p>
          <p className="text-blue-700 text-sm mt-2">
            업무일지 작성이나 프로젝트 수정이 필요한 경우 관리자에게 권한 변경을 요청해주세요.
          </p>
        </div>
      </div>
    </section>
  );
}
