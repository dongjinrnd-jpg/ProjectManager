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
  admin: { label: '관리자 (팀장)', description: '프로젝트 삭제 포함 관리 권한' },
  executive: { label: '경영진', description: '프로젝트 모니터링 및 의사결정 지원' },
  sysadmin: { label: '시스템 관리자', description: '시스템 전반의 설정 및 운영 담당' },
};

export default function ManualClient() {
  const [role, setRole] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('overview');

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

  // 역할별 메뉴 목록
  const getMenuSections = () => {
    const common = [
      { id: 'overview', label: '시스템 개요' },
      { id: 'dashboard', label: '대시보드' },
      { id: 'project', label: '프로젝트 관리' },
    ];

    if (role === 'user') {
      return [...common, { id: 'schedule', label: '전체 일정' }, { id: 'faq', label: 'FAQ' }];
    }

    if (role === 'engineer' || role === 'admin') {
      return [
        ...common,
        { id: 'worklog', label: '업무일지' },
        { id: 'search', label: '고급 검색' },
        { id: 'schedule', label: '전체 일정' },
        { id: 'weekly', label: '주간보고' },
        { id: 'improvement', label: '개선요청' },
        { id: 'tips', label: '팁 & 단축키' },
        { id: 'faq', label: 'FAQ' },
      ];
    }

    if (role === 'executive') {
      return [
        ...common,
        { id: 'executive-dashboard', label: '경영진 대시보드' },
        { id: 'comparison', label: '계획vs실적' },
        { id: 'schedule', label: '전체 일정' },
        { id: 'weekly', label: '주간보고' },
        { id: 'tips', label: '활용 팁' },
        { id: 'faq', label: 'FAQ' },
      ];
    }

    if (role === 'sysadmin') {
      return [
        { id: 'overview', label: '시스템 개요' },
        { id: 'user-management', label: '사용자 관리' },
        { id: 'settings', label: '시스템 설정' },
        { id: 'improvement', label: '개선요청 관리' },
        { id: 'troubleshooting', label: '트러블슈팅' },
        { id: 'faq', label: 'FAQ' },
      ];
    }

    return common;
  };

  return (
    <AppLayout>
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          📖 사용자 매뉴얼
        </h1>
        {role && (
          <p className="mt-1 text-gray-600">
            {roleInfo.label} - {roleInfo.description}
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
        <div className="flex gap-6">
          {/* 사이드 메뉴 */}
          <nav className="w-48 flex-shrink-0">
            <div className="bg-white rounded-lg shadow p-4 sticky top-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">목차</h3>
              <ul className="space-y-1">
                {getMenuSections().map((section) => (
                  <li key={section.id}>
                    <button
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        activeSection === section.id
                          ? 'bg-brand-orange text-white font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {section.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* 메인 콘텐츠 */}
          <div className="flex-1 min-w-0">
            {role === 'engineer' && <EngineerManual activeSection={activeSection} />}
            {role === 'admin' && <AdminManual activeSection={activeSection} />}
            {role === 'executive' && <ExecutiveManual activeSection={activeSection} />}
            {role === 'sysadmin' && <SysadminManual activeSection={activeSection} />}
            {role === 'user' && <UserManual activeSection={activeSection} />}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// 섹션 컴포넌트
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-lg shadow mb-6">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

// 테이블 컴포넌트
function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {headers.map((header, i) => (
              <th key={i} className="text-left py-3 px-4 font-semibold text-gray-700">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100">
              {row.map((cell, j) => (
                <td key={j} className="py-3 px-4 text-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 상태 배지
function StatusBadge({ color, label }: { color: string; label: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    orange: 'bg-orange-100 text-orange-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${colors[color] || colors.gray}`}>
      {label}
    </span>
  );
}

// ===========================================
// 엔지니어 매뉴얼
// ===========================================
function EngineerManual({ activeSection }: { activeSection: string }) {
  return (
    <>
      {activeSection === 'overview' && <OverviewSection role="engineer" />}
      {activeSection === 'dashboard' && <DashboardSection />}
      {activeSection === 'project' && <ProjectSection />}
      {activeSection === 'worklog' && <WorklogSection />}
      {activeSection === 'search' && <SearchSection />}
      {activeSection === 'schedule' && <ScheduleSection />}
      {activeSection === 'weekly' && <WeeklySection />}
      {activeSection === 'improvement' && <ImprovementSection isAdmin={false} />}
      {activeSection === 'tips' && <TipsSection />}
      {activeSection === 'faq' && <FAQSection role="engineer" />}
    </>
  );
}

// ===========================================
// 관리자 매뉴얼
// ===========================================
function AdminManual({ activeSection }: { activeSection: string }) {
  return (
    <>
      {activeSection === 'overview' && <OverviewSection role="admin" />}
      {activeSection === 'dashboard' && <DashboardSection />}
      {activeSection === 'project' && (
        <>
          <ProjectSection />
          <AdminDeleteWarning />
        </>
      )}
      {activeSection === 'worklog' && <WorklogSection />}
      {activeSection === 'search' && <SearchSection />}
      {activeSection === 'schedule' && <ScheduleSection />}
      {activeSection === 'weekly' && <WeeklySection />}
      {activeSection === 'improvement' && <ImprovementSection isAdmin={false} />}
      {activeSection === 'tips' && <TipsSection />}
      {activeSection === 'faq' && <FAQSection role="admin" />}
    </>
  );
}

// ===========================================
// 경영진 매뉴얼
// ===========================================
function ExecutiveManual({ activeSection }: { activeSection: string }) {
  return (
    <>
      {activeSection === 'overview' && <OverviewSection role="executive" />}
      {activeSection === 'dashboard' && <DashboardSection />}
      {activeSection === 'project' && <ProjectSection viewOnly />}
      {activeSection === 'executive-dashboard' && <ExecutiveDashboardSection />}
      {activeSection === 'comparison' && <ComparisonSection />}
      {activeSection === 'schedule' && <ScheduleSection />}
      {activeSection === 'weekly' && <WeeklySection viewOnly />}
      {activeSection === 'tips' && <ExecutiveTipsSection />}
      {activeSection === 'faq' && <FAQSection role="executive" />}
    </>
  );
}

// ===========================================
// 시스템 관리자 매뉴얼
// ===========================================
function SysadminManual({ activeSection }: { activeSection: string }) {
  return (
    <>
      {activeSection === 'overview' && <OverviewSection role="sysadmin" />}
      {activeSection === 'user-management' && <UserManagementSection />}
      {activeSection === 'settings' && <SettingsSection />}
      {activeSection === 'improvement' && <ImprovementSection isAdmin />}
      {activeSection === 'troubleshooting' && <TroubleshootingSection />}
      {activeSection === 'faq' && <FAQSection role="sysadmin" />}
    </>
  );
}

// ===========================================
// 일반 사용자 매뉴얼
// ===========================================
function UserManual({ activeSection }: { activeSection: string }) {
  return (
    <>
      {activeSection === 'overview' && <OverviewSection role="user" />}
      {activeSection === 'dashboard' && <DashboardSection />}
      {activeSection === 'project' && <ProjectSection viewOnly />}
      {activeSection === 'schedule' && <ScheduleSection />}
      {activeSection === 'faq' && <FAQSection role="user" />}
    </>
  );
}

// ===========================================
// 공통 섹션들
// ===========================================

// 시스템 개요
function OverviewSection({ role }: { role: string }) {
  const menuData: Record<string, { menu: string; icon: string; desc: string; access: string }[]> = {
    user: [
      { menu: '대시보드', icon: '📊', desc: '전체 프로젝트 현황 요약', access: '조회' },
      { menu: '프로젝트', icon: '📁', desc: '프로젝트 목록 및 상세', access: '조회' },
      { menu: '전체 일정', icon: '📅', desc: '캘린더 형태의 일정', access: '조회' },
    ],
    engineer: [
      { menu: '대시보드', icon: '📊', desc: '본인 담당 프로젝트 현황', access: '조회' },
      { menu: '프로젝트', icon: '📁', desc: '프로젝트 생성/수정/조회', access: 'CRUD' },
      { menu: '업무일지', icon: '📝', desc: '일별 업무 기록', access: 'CRUD' },
      { menu: '고급 검색', icon: '🔍', desc: '업무일지 통합 검색', access: '조회' },
      { menu: '전체 일정', icon: '📅', desc: '캘린더 형태의 일정', access: '조회' },
      { menu: '주간보고', icon: '📋', desc: '주간 단위 업무 보고서', access: 'CRUD' },
      { menu: '개선요청', icon: '💡', desc: '버그/개선요청 관리', access: 'CRUD' },
    ],
    admin: [
      { menu: '대시보드', icon: '📊', desc: '팀 전체 프로젝트 현황', access: '조회' },
      { menu: '프로젝트', icon: '📁', desc: '프로젝트 생성/수정/삭제', access: 'CRUD+삭제' },
      { menu: '업무일지', icon: '📝', desc: '팀원 업무일지 조회', access: 'CRUD' },
      { menu: '고급 검색', icon: '🔍', desc: '업무일지 통합 검색', access: '조회' },
      { menu: '전체 일정', icon: '📅', desc: '캘린더 형태의 일정', access: '조회' },
      { menu: '주간보고', icon: '📋', desc: '주간 단위 업무 보고서', access: 'CRUD' },
      { menu: '개선요청', icon: '💡', desc: '버그/개선요청 관리', access: 'CRUD' },
    ],
    executive: [
      { menu: '대시보드', icon: '📊', desc: '전체 프로젝트 현황 요약', access: '조회' },
      { menu: '프로젝트', icon: '📁', desc: '프로젝트 목록 조회', access: '조회' },
      { menu: '업무일지', icon: '📝', desc: '팀 업무일지 조회', access: '조회' },
      { menu: '고급 검색', icon: '🔍', desc: '업무일지 통합 검색', access: '조회' },
      { menu: '전체 일정', icon: '📅', desc: '캘린더 형태의 일정', access: '조회' },
      { menu: '주간보고', icon: '📋', desc: '주간 단위 업무 보고서', access: '조회' },
      { menu: '경영진', icon: '👔', desc: '경영진 전용 대시보드', access: '조회' },
    ],
    sysadmin: [
      { menu: '대시보드', icon: '📊', desc: '전체 프로젝트 현황', access: '조회' },
      { menu: '프로젝트', icon: '📁', desc: '프로젝트 관리', access: 'CRUD' },
      { menu: '전체 일정', icon: '📅', desc: '캘린더 형태의 일정', access: '조회' },
      { menu: '개선요청', icon: '💡', desc: '버그/개선요청 관리', access: 'CRUD+상태변경' },
      { menu: '경영진', icon: '👔', desc: '경영진 대시보드', access: '조회' },
      { menu: '사용자 관리', icon: '👥', desc: '사용자 계정 관리', access: 'CRUD' },
      { menu: '시스템 설정', icon: '⚙️', desc: '공통 코드/설정', access: '설정' },
    ],
  };

  return (
    <Section title="1. 시스템 개요">
      <h3 className="font-medium text-gray-900 mb-4">접근 가능 메뉴</h3>
      <Table
        headers={['메뉴', '설명', '권한']}
        rows={(menuData[role] || []).map((item) => [
          <span key={item.menu}>
            <span className="mr-2">{item.icon}</span>
            <span className="font-medium">{item.menu}</span>
          </span>,
          item.desc,
          <StatusBadge
            key={item.access}
            color={item.access === '조회' ? 'gray' : item.access.includes('CRUD') ? 'blue' : 'green'}
            label={item.access}
          />,
        ])}
      />

      {role === 'admin' && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            <strong>관리자 특별 권한:</strong> 프로젝트 삭제 권한
          </p>
        </div>
      )}

      {role === 'sysadmin' && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>참고:</strong> 업무일지/주간보고 메뉴는 sysadmin에게 제공되지 않습니다.
            업무 기록이 필요한 경우 별도의 engineer 계정을 사용하세요.
          </p>
        </div>
      )}
    </Section>
  );
}

// 대시보드 섹션
function DashboardSection() {
  return (
    <Section title="2. 대시보드">
      <h3 className="font-medium text-gray-900 mb-3">화면 구성</h3>

      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600">87</div>
          <div className="text-sm text-blue-700">전체</div>
        </div>
        <div className="p-4 bg-green-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">72</div>
          <div className="text-sm text-green-700">진행중</div>
        </div>
        <div className="p-4 bg-gray-100 rounded-lg text-center">
          <div className="text-2xl font-bold text-gray-600">10</div>
          <div className="text-sm text-gray-700">보류</div>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-600">12</div>
          <div className="text-sm text-yellow-700">⭐ 즐겨찾기</div>
        </div>
      </div>

      <h4 className="font-medium text-gray-900 mb-2">단계별 현황</h4>
      <div className="flex flex-wrap gap-2 mb-6">
        {['검토', '설계', '개발', 'PROTO', '신뢰성', 'P1', 'P2', '승인', '양산'].map((stage) => (
          <div key={stage} className="px-3 py-2 bg-gray-100 rounded text-sm">
            <span className="font-medium">{stage}</span>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">📋 최근 업무일지</h4>
          <p className="text-sm text-gray-600">최근 작성된 업무일지 목록</p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">⚠️ 이슈사항 현황</h4>
          <p className="text-sm text-gray-600">미해결 이슈 현황</p>
        </div>
      </div>
    </Section>
  );
}

// 프로젝트 관리 섹션
function ProjectSection({ viewOnly = false }: { viewOnly?: boolean }) {
  return (
    <>
      <Section title="3. 프로젝트 관리">
        <h3 className="font-medium text-gray-900 mb-3">3.1 프로젝트 목록</h3>
        <p className="text-gray-600 text-sm mb-4">
          프로젝트 목록에서 필터링, 검색, Excel 다운로드가 가능합니다.
        </p>

        {/* 프로젝트 목록 와이어프레임 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
          <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────────────────┐
│  📁 프로젝트 목록                              [📥 Excel] [+ 새 프로젝트]  │
│  ───────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  필터: [전체 ▼] [전장 ▼] [진행중 ▼] [⭐즐겨찾기]  🔍 검색                   │
│                                                                              │
│  ┌───┬────┬────────┬──────────┬──────┬──────┬──────┬──────────┬───┐        │
│  │ ⭐│ 📷 │ 고객사  │   ITEM   │ 소속 │ 팀장 │ 단계 │  대일정  │   │        │
│  ├───┼────┼────────┼──────────┼──────┼──────┼──────┼──────────┼───┤        │
│  │ ★ │[img]│기아군수│CAB TILT  │ 전장 │엄용조│🟡양산│25.01~50.01│ → │        │
│  │ ★ │[img]│KUBOTA  │CYLINDER  │ 유압 │정성민│🟢PROTO│25.03~25.12│ → │        │
│  │ ☆ │ -- │YAMADA  │TEST-ITM  │ 유압 │김강동│🟡검토│26.01~26.06│ → │        │
│  └───┴────┴────────┴──────────┴──────┴──────┴──────┴──────────┴───┘        │
│                                                                              │
│  < 1 2 3 4 5 ... 10 >                                            총 87건   │
└─────────────────────────────────────────────────────────────────────────────┘`}</pre>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">고객사 필터</span>
          <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">소속 필터</span>
          <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">상태 필터</span>
          <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">⭐ 즐겨찾기</span>
          <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">🔍 검색</span>
        </div>

        {!viewOnly && (
          <>
            <h3 className="font-medium text-gray-900 mb-3 mt-6">3.2 프로젝트 생성</h3>
            <p className="text-gray-600 text-sm mb-3">
              <strong>[+ 새 프로젝트]</strong> 버튼 클릭 후 정보를 입력합니다.
            </p>

            {/* 프로젝트 생성 와이어프레임 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
              <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  📁 프로젝트 생성                                  [저장] [취소] │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 기본 정보                                                 │  │
│  │                                                           │  │
│  │  고객사 *       [                        ▼]              │  │
│  │  ITEM *         [                          ]              │  │
│  │  PART NO        [                          ]              │  │
│  │  소속           [전장           ▼]                        │  │
│  │  구분           [농기           ▼] (농기/중공업/해외/기타)│  │
│  │  모델           [                          ]              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 팀 구성                                                   │  │
│  │                                                           │  │
│  │  팀장 * (1명)   [김개발           ▼]                      │  │
│  │  팀원 (여러 명) [박연구 ×] [이설계 ×] [+ 추가]            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 대일정 *                                                  │  │
│  │                                                           │  │
│  │  시작일         [2026-02-01        📅]                    │  │
│  │  종료일         [2026-12-31        📅]                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 개발 단계 선택 (필요한 단계만 선택)                       │  │
│  │                                                           │  │
│  │  ☑️ 검토   ☑️ 설계   ☑️ 개발   ☑️ PROTO                   │  │
│  │  ☑️ 신뢰성 ☑️ P1     ☑️ P2     ☑️ 승인                    │  │
│  │  ☐ 양산이관 ☐ 초도양산 ☐ 품질관리 ☐ 원가절감              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘`}</pre>
            </div>

            <h4 className="font-medium text-gray-800 mb-2">필수 입력 항목</h4>
            <Table
              headers={['항목', '설명', '예시']}
              rows={[
                ['고객사 *', '고객사 선택 (드롭다운)', '삼성전자, LG전자'],
                ['ITEM *', '프로젝트명/코드', 'CAB TILT SYSTEM'],
                ['팀장 *', '프로젝트 책임자 (1명)', '김팀장'],
                ['시작일 *', '프로젝트 시작 예정일', '2026-02-01'],
                ['종료일 *', '프로젝트 종료 예정일', '2026-12-31'],
              ]}
            />
          </>
        )}

        <h3 className="font-medium text-gray-900 mb-3 mt-6">3.3 프로젝트 상세 - 업무진행사항 탭</h3>
        {/* 업무진행사항 와이어프레임 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
          <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  [📝 업무진행사항] [📅 일정] [💰 원가]                          │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  📋 업무 진행사항  [📅시작일]~[📅종료일] [🔍검색] [+ 업무일지]  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📅 2026-02-06 | 김팀장 | 🟠개발 | 📋회로설계     상세→ │   │
│  │ ┌───────────────┬───────────────────────────────┐      │   │
│  │ │ 📋 계획       │ ✅ 업무내용                  │      │   │
│  │ ├───────────────┼───────────────────────────────┤      │   │
│  │ │ • 프로젝트 상세│ • 프로젝트 상세 업무진행     │      │   │
│  │ │   에서 업무진행│   사항 추가완료              │      │   │
│  │ │   사항 추가   │ • 1주일간 업무일지 현황      │      │   │
│  │ │               │   볼수 있음                  │      │   │
│  │ └───────────────┴───────────────────────────────┘      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ⚠️ 이슈사항 (3건, 미해결 1건)                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │🟥 2026-02-06 | 김팀장 | 개발 | 회로설계          [해결] │   │
│  │🟥 어제 계획한 업무 작성 지연으로 일정 미뤄짐            │   │
│  │🟩 2026-02-05 | 김팀장 | 개발 | PCB설계       ✅ 해결됨  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘`}</pre>
        </div>

        <h3 className="font-medium text-gray-900 mb-3 mt-6">3.4 프로젝트 상세 - 일정 탭 (세부추진항목)</h3>
        {/* 일정 탭 와이어프레임 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
          <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────────────────────┐
│  📅 개별 일정표   [📋 표] [📊 간트]      [🔄 일정표 갱신] [+ 항목 추가]        │
│  ───────────────────────────────────────────────────────────────────────────────│
│                                                                                  │
│  ┌──────┬─────────┬─────────────────────┬─────────────────────┬──────────┬──────┬───────────┐
│  │ 단계 │ 항목명  │       계획          │       실적          │   구분   │ 상태 │   관리    │
│  ├──────┼─────────┼─────────────────────┼─────────────────────┼──────────┼──────┼───────────┤
│  │ 검토 │시장조사 │2026-02-02~2026-02-05│2026-02-05~2026-02-05│주관(설계)│🟢완료│ 수정 삭제 │
│  │ 검토 │경쟁사조사│2026-02-02~2026-02-20│         -           │주관(설계)│🔴지연│ 수정 삭제 │
│  │ 설계 │A모델 설계│2026-02-23~2026-02-27│2026-02-06~2026-02-06│주관(설계)│🟠진행│ 수정 완료 │
│  │ 개발 │A모델 가공│2026-03-02~2026-03-06│         -           │주관(설계)│⚪예정│ 수정 삭제 │
│  └──────┴─────────┴─────────────────────┴─────────────────────┴──────────┴──────┴───────────┘
│                                                                                  │
│  ○ 예정(회색)  ○ 진행중(주황)  ○ 완료(초록)  ○ 지연(빨강)                      │
└─────────────────────────────────────────────────────────────────────────────────┘`}</pre>
        </div>

        <h4 className="font-medium text-gray-800 mb-2">세부추진항목 상태 자동 계산</h4>
        <Table
          headers={['상태', '조건', '색상']}
          rows={[
            [
              '예정',
              '계획 시작일 > 오늘 AND 실적 시작일 없음',
              <span key="gray" className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-gray-400"></span> 회색
              </span>,
            ],
            [
              '진행중',
              '실적 시작일 있음 AND 실적 종료일 없음',
              <span key="orange" className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span> 주황
              </span>,
            ],
            [
              '완료',
              '실적 종료일 있음',
              <span key="green" className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500"></span> 초록
              </span>,
            ],
            [
              '지연',
              '계획 시작일 ≤ 오늘 AND 실적 시작일 없음',
              <span key="red" className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-500"></span> 빨강
              </span>,
            ],
          ]}
        />

        {!viewOnly && (
          <>
            <h3 className="font-medium text-gray-900 mb-3 mt-6">3.5 세부추진항목 등록/수정</h3>
            {/* 세부추진항목 등록 와이어프레임 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
              <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  📅 세부추진항목 등록                              [X 닫기]     │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  프로젝트 단계  [검토           ▼]                              │
│                                                                  │
│  항목명 *       [도면 검토                 ]                     │
│                                                                  │
│  ── 계획 일정 ────────────────────────────────────────────────  │
│  계획 시작일 *  [2026-05-01        📅]                          │
│  계획 종료일 *  [2026-05-31        📅]                          │
│                                                                  │
│  ── 실적 일정 (선택) ─────────────────────────────────────────  │
│  실적 시작일    [2026-05-03        📅]                          │
│  실적 종료일    [                  📅]                          │
│                                                                  │
│  ── 업무 정보 ────────────────────────────────────────────────  │
│  업무 구분 *    ◉ 주관  ○ 협조                                  │
│  관련 부문      [설계           ▼]                              │
│  비고           [                         ]                      │
│                                                                  │
│          [취소]            [저장]                                │
└─────────────────────────────────────────────────────────────────┘`}</pre>
            </div>
          </>
        )}
      </Section>
    </>
  );
}

// 관리자 삭제 경고
function AdminDeleteWarning() {
  return (
    <Section title="⚠️ 프로젝트 삭제 (관리자 전용)">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h4 className="font-medium text-red-800 mb-2">프로젝트 삭제 시 주의</h4>
        <p className="text-red-700 text-sm mb-3">
          프로젝트 삭제는 <strong>되돌릴 수 없습니다.</strong>
        </p>
        <p className="text-red-600 text-sm mb-2">삭제되는 데이터:</p>
        <ul className="text-red-600 text-sm list-disc list-inside">
          <li>프로젝트 기본 정보</li>
          <li>관련 업무일지</li>
          <li>세부추진항목</li>
          <li>주간보고</li>
          <li>회의록</li>
        </ul>
      </div>
    </Section>
  );
}

// 업무일지 섹션
function WorklogSection() {
  return (
    <Section title="4. 업무일지">
      <h3 className="font-medium text-gray-900 mb-3">4.1 업무일지 목록</h3>

      {/* 업무일지 목록 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  📝 업무일지                        [📥 Excel] [+ 새 업무일지]  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  필터: [날짜 범위] [프로젝트 ▼] [담당자 ▼]  🔍 검색             │
│                                                                  │
│  ┌───────────┬────────┬────────┬──────┬───────────┐            │
│  │   날짜    │ ITEM   │ 고객사 │ 단계 │  담당자   │            │
│  ├───────────┼────────┼────────┼──────┼───────────┤            │
│  │2026-01-23 │기타업무│ 자체   │ 검토 │ 김태석    │            │
│  │2026-01-23 │42LPM   │현대인프│ 승인 │ 정성민    │            │
│  │2026-01-22 │HST구동 │ LS엔트론│ 검토 │ 정성민    │            │
│  └───────────┴────────┴────────┴──────┴───────────┘            │
│                                                                  │
│  < 1 2 3 4 5 ... >                                  총 156건   │
└─────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <p className="text-gray-600 text-sm mb-4">
        날짜 범위, 프로젝트, 담당자별로 필터링하여 조회할 수 있습니다.
      </p>

      <h3 className="font-medium text-gray-900 mb-3 mt-6">4.2 업무일지 작성</h3>

      {/* 업무일지 작성 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  📝 업무일지 작성                              [저장] [취소]    │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  날짜 *        [2026-01-23        📅]                           │
│                                                                  │
│  프로젝트 *    [선택하세요             ▼]                       │
│                ※ 본인이 소속된 프로젝트만 표시                   │
│                                                                  │
│  단계 *        [선택하세요             ▼]                       │
│                ※ 팀장만 변경 가능                                │
│                ⚠️ 변경 시 프로젝트 자동 반영                     │
│                                                                  │
│  세부추진항목   [A모델 설계 (2026-02-23~27) ▼]                  │
│                ※ 선택 시 해당 항목 실적 자동 업데이트            │
│                                                                  │
│  담당자 *      [자동: 로그인 사용자] (수정 불가)                 │
│                                                                  │
│  참여자        [박연구 ×] [이설계 ×] [+ 추가]                   │
│                                                                  │
│  계획                                                            │
│  ┌───────────────────────────────────────────┐                  │
│  │ (계획했던 업무 내용 입력)                 │                  │
│  └───────────────────────────────────────────┘                  │
│                                                                  │
│  업무 내용 *                                                     │
│  ┌───────────────────────────────────────────┐                  │
│  │ (실제 수행한 업무 상세 입력)              │                  │
│  └───────────────────────────────────────────┘                  │
│                                                                  │
│  이슈사항 (선택)                                                 │
│  ┌───────────────────────────────────────────┐                  │
│  │ (발생한 문제점 기록)                      │                  │
│  └───────────────────────────────────────────┘                  │
│  ☐ 해결됨 (수정 시)                                             │
│                                                                  │
│  ☑️ 프로젝트 '업무진행사항'에 자동 반영                         │
└─────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <h4 className="font-medium text-gray-800 mb-2">입력 항목 설명</h4>
      <Table
        headers={['항목', '필수', '설명']}
        rows={[
          ['날짜', '●', '업무 수행일 (기본: 오늘)'],
          ['프로젝트', '●', '본인 소속 프로젝트 중 선택'],
          ['단계', '●', '현재 단계 (팀장만 변경 가능)'],
          ['세부추진항목', '-', '선택 시 해당 항목 실적 자동 연동'],
          ['담당자', '●', '로그인 사용자 자동 입력 (수정 불가)'],
          ['참여자', '-', '함께 작업한 팀원 선택'],
          ['계획', '-', '계획했던 업무 내용'],
          ['업무 내용', '●', '실제 수행한 업무 상세'],
          ['이슈사항', '-', '발생한 문제점 기록'],
        ]}
      />

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800 text-sm">
          <strong>💡 팁:</strong> 세부추진항목을 선택하면 해당 항목의 실적 시작일/종료일이 자동으로 업데이트됩니다.
        </p>
      </div>

      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800 text-sm">
          <strong>⚠️ 단계 변경 주의:</strong> 팀장만 단계를 변경할 수 있으며, 변경 시 프로젝트의 현재 단계가 자동으로 업데이트됩니다.
        </p>
      </div>
    </Section>
  );
}

// 고급 검색 섹션
function SearchSection() {
  return (
    <Section title="5. 고급 검색">
      {/* 고급 검색 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  🔍 고급 검색                                 [📂 저장된 검색]  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 검색 조건                                               │   │
│  │                                                         │   │
│  │ 날짜 범위   [2026-01-01] ~ [2026-01-31]                │   │
│  │                                                         │   │
│  │ 고객사      [전체            ▼]                        │   │
│  │ 소속        [전체            ▼]                        │   │
│  │ 단계        [전체            ▼]                        │   │
│  │ 담당자      [전체            ▼]                        │   │
│  │ 진행여부    [전체            ▼]                        │   │
│  │                                                         │   │
│  │ 키워드      [________________________]                  │   │
│  │             ☑️ 업무진행사항  ☑️ 이슈사항                │   │
│  │                                                         │   │
│  │          [🔍 검색]  [초기화]  [⭐ 저장]                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  검색 결과: 24건                                                 │
│  ┌───────────┬────────┬────────┬──────┬───────────┐            │
│  │   날짜    │ ITEM   │ 고객사 │ 단계 │  담당자   │            │
│  │   ...     │  ...   │  ...   │ ...  │   ...     │            │
│  └───────────┴────────┴────────┴──────┴───────────┘            │
└─────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <h3 className="font-medium text-gray-900 mb-3">5.1 검색 조건</h3>
      <Table
        headers={['필터', '설명']}
        rows={[
          ['기간', '시작일 ~ 종료일 범위'],
          ['고객사', '특정 고객사 선택'],
          ['소속', '전장/유압/기타 중 선택'],
          ['단계', 'PoC, 설계, 개발, 검수 등'],
          ['담당자', '특정 담당자 선택'],
          ['진행여부', '진행중/완료/보류'],
          ['키워드', '텍스트 검색'],
        ]}
      />

      <h4 className="font-medium text-gray-900 mt-6 mb-2">5.2 키워드 검색 범위</h4>
      <ul className="text-sm text-gray-600 space-y-1">
        <li>• <strong>☑️ 업무진행사항</strong>: 업무 내용에서 검색</li>
        <li>• <strong>☑️ 이슈사항</strong>: 이슈 내용에서 검색</li>
        <li>• 둘 다 체크하면 두 필드 모두에서 검색</li>
      </ul>

      <h4 className="font-medium text-gray-900 mt-6 mb-2">5.3 검색 조건 저장</h4>
      <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
        <li>검색 조건 설정</li>
        <li><strong>[⭐ 저장]</strong> 클릭</li>
        <li>검색 조건 이름 입력 (예: &ldquo;이번 달 A사 현황&rdquo;)</li>
        <li>우측 상단 <strong>[📂 저장된 검색]</strong> 드롭다운에서 불러오기</li>
      </ol>

      <h4 className="font-medium text-gray-900 mt-6 mb-2">5.4 결과 정렬</h4>
      <p className="text-sm text-gray-600">
        테이블 헤더 클릭으로 정렬 변경:
      </p>
      <ul className="text-sm text-gray-600 space-y-1 mt-2">
        <li>• 날짜, 프로젝트, 고객사, 단계, 담당자 기준 정렬 가능</li>
        <li>• 같은 헤더 재클릭 시 오름차순/내림차순 전환</li>
      </ul>
    </Section>
  );
}

// 전체 일정 섹션
function ScheduleSection() {
  return (
    <Section title="6. 전체 일정">
      <h3 className="font-medium text-gray-900 mb-3">6.1 간트차트 보기</h3>

      {/* 간트차트 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  📅 전체 일정 (간트차트)                      [필터] [확대/축소]│
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  프로젝트     │ 1월 │ 2월 │ 3월 │ 4월 │ 5월 │ 6월 │            │
│  ─────────────┼─────┼─────┼─────┼─────┼─────┼─────┤            │
│  기아군수     │█████│█████│█████│█████│█████│█████│            │
│  CAB TILT     │     │     │     │     │     │     │            │
│  ─────────────┼─────┼─────┼─────┼─────┼─────┼─────┤            │
│  KUBOTA       │     │█████│█████│█████│     │     │            │
│  CYLINDER     │     │     │     │     │     │     │            │
│                                                                  │
│  오늘: 2026-01-23                           ◀ 이전  다음 ▶     │
└─────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <p className="text-gray-600 text-sm mb-4">
        전체 프로젝트의 일정을 간트차트 형태로 확인할 수 있습니다.
      </p>

      <h4 className="font-medium text-gray-900 mb-2">사용 방법</h4>
      <Table
        headers={['기능', '설명']}
        rows={[
          ['프로젝트 바 클릭', '해당 프로젝트의 상세 진행 현황 팝업 표시'],
          ['◀ 이전 / 다음 ▶', '이전/다음 기간으로 이동'],
          ['필터', '특정 조건의 프로젝트만 표시'],
          ['확대/축소', '일/주/월 단위 보기 전환'],
        ]}
      />

      <h3 className="font-medium text-gray-900 mb-3 mt-6">6.2 프로젝트 바 클릭 시 (드릴다운 모달)</h3>
      {/* 드릴다운 모달 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  📊 기간별 진행현황                              [X 닫기]       │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  프로젝트: 기아군수 - CAB TILT SYSTEM                           │
│  조회 기간: [2026년 ▼] [1월 ▼]                                  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 📋 주간 보고 (1월달)                                      │ │
│  │ ───────────────────────────────────────────────────────── │ │
│  │  📅 1월 4주차 (1/20 ~ 1/24)                               │ │
│  │  • 시작품 제작 착수, 금형 수정 완료              [보기 →] │ │
│  │ ───────────────────────────────────────────────────────── │ │
│  │  📅 1월 3주차 (1/13 ~ 1/17)                               │ │
│  │  • P2 → 양산이관 단계 전환, 금형 수정 진행      [보기 →] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🔄 단계 변경 이력 (1건)                                   │ │
│  │ ───────────────────────────────────────────────────────── │ │
│  │  2026-01-10: P2 → 양산이관 (엄용조)                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│                              [프로젝트 상세 보기 →]             │
└─────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <h4 className="font-medium text-gray-900 mb-2">6.3 상태 표시</h4>
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-green-500"></span>
          <span className="text-sm text-gray-700">정상 진행</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-yellow-500"></span>
          <span className="text-sm text-gray-700">지연 위험</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-red-500"></span>
          <span className="text-sm text-gray-700">지연</span>
        </div>
      </div>
    </Section>
  );
}

// 주간보고 섹션
function WeeklySection({ viewOnly = false }: { viewOnly?: boolean }) {
  return (
    <Section title="7. 주간보고">
      <h3 className="font-medium text-gray-900 mb-3">7.1 주간보고 목록</h3>

      {/* 주간보고 목록 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────────────────────┐
│  📋 주간 업무 보고                    [📥 Excel] [📄 PDF] [+ 보고 등록]        │
│  ───────────────────────────────────────────────────────────────────────────────│
│                                                                                  │
│  주차 선택: [◀] 2025년 7월 5주차 (7/28 ~ 8/1) [▶]                              │
│                                                                                  │
│  ═══════════════════════════════════════════════════════════════════════════════│
│  📄 2025년 7월 5주차 연구소 업무 보고                                            │
│  ═══════════════════════════════════════════════════════════════════════════════│
│                                                                                  │
│  ┌────┬────────┬──────────────┬────────────────────────────┬────────┐          │
│  │ No │  구분  │ 고객사/ITEM  │    주요 추진 실적 및 계획  │ 관리   │          │
│  ├────┼────────┼──────────────┼────────────────────────────┼────────┤          │
│  │ 1  │  농기  │ LS엠트론     │ ■ 중국 PISTON 초도품 입고  │ ✏️ 🗑️ │          │
│  │    │        │ 스트로크     │ - 점접 조립성 검증완료     │        │          │
│  │    │        │ 실린더       │ - 차주 신뢰성 시험용 샘플  │        │          │
│  ├────┼────────┼──────────────┼────────────────────────────┼────────┤          │
│  │ 2  │ 중공업 │ 현대인프라   │ ■ 35LPM 교차판매용 펌프    │ ✏️ 🗑️ │          │
│  │    │        │ FUEL FILLER  │ - 400909-00279-CP 조립도   │        │          │
│  └────┴────────┴──────────────┴────────────────────────────┴────────┘          │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐│
│  │ 📊 주간 보고 요약                                               [편집]    ││
│  │ ──────────────────────────────────────────────────────────────────────────││
│  │ 금주 주요 진행사항:                                                        ││
│  │ • 농기 부문: LS엠트론 스트로크 실린더 초도품 검증 완료                     ││
│  │ • 중공업 부문: 현대인프라 35LPM 펌프 조립도 작성 진행                      ││
│  └────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <p className="text-gray-600 text-sm mb-4">
        주차 선택하여 해당 주의 업무 보고서를 {viewOnly ? '조회' : '작성/조회'}합니다.
      </p>

      <h4 className="font-medium text-gray-900 mb-2">보고서 구성</h4>
      <Table
        headers={['섹션', '내용']}
        rows={[
          ['보고 항목', '구분별(농기/중공업/해외/기타) 프로젝트 진행 현황'],
          ['공지사항', '요청사항 및 공지'],
          ['주간 보고 요약', '금주 주요 진행사항 및 차주 계획'],
        ]}
      />

      {!viewOnly && (
        <>
          <h3 className="font-medium text-gray-900 mb-3 mt-6">7.2 주간보고 등록</h3>
          {/* 주간보고 등록 와이어프레임 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
            <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  📋 주간 보고 등록                              [저장] [취소]   │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 기본 정보                                                 │ │
│  │                                                           │ │
│  │  주차 *        [2025년 7월 5주차 (7/28~8/1) ▼]            │ │
│  │  구분 *        [농기             ▼]                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 보고 항목                                                 │ │
│  │                                                           │ │
│  │  고객사 *      [LS엠트론           ▼]                     │ │
│  │               (선택한 구분의 고객사만 표시)                │ │
│  │                                                           │ │
│  │  개발 ITEM *   [스트로크 실린더   ▼]                       │ │
│  │               (선택한 고객사의 ITEM만 표시)                │ │
│  │                                                           │ │
│  │  주요 추진 실적 및 계획 *                                 │ │
│  │  ┌───────────────────────────────────────────┐            │ │
│  │  │ ■ 중국 PISTON 초도품 입고/조립검증       │            │ │
│  │  │ - 점접 조립성 검증완료                   │            │ │
│  │  │ - 차주 신뢰성 시험용 샘플제작            │            │ │
│  │  └───────────────────────────────────────────┘            │ │
│  │  [📝 업무일지에서 불러오기]                               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│               [취소]              [저장]                        │
└─────────────────────────────────────────────────────────────────┘`}</pre>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              <strong>💡 팁:</strong> [📝 업무일지에서 불러오기] 버튼으로 해당 주의 업무일지 내용을 가져올 수 있습니다.
            </p>
          </div>
        </>
      )}
    </Section>
  );
}

// 개선요청 섹션
function ImprovementSection({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Section title="8. 개선요청 게시판">
      <p className="text-gray-600 text-sm mb-4">
        시스템 사용 중 발생한 버그, 개선요청, 기능추가 요청을 등록합니다.
      </p>

      {/* 개선요청 목록 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────────────────────┐
│  📋 개선요청 게시판                                              [+ 새 요청]    │
│  ════════════════════════════════════════════════════════════════════════════════│
│                                                                                  │
│  [전체 상태 ▼] [전체 유형 ▼] [전체 우선순위 ▼]  🔍 제목, 내용 검색...          │
│                                                                                  │
│  ┌─────────┬────────┬────────┬──────────┬──────────────────────┬────────┬──────┐│
│  │ No      │ 상태   │ 유형   │ 우선순위 │ 제목                 │ 작성자 │ 작성일││
│  ├─────────┼────────┼────────┼──────────┼──────────────────────┼────────┼──────┤│
│  │ IMP-003 │ 🔵접수 │ 🐛버그 │ 🔴긴급   │ 로그인 오류 발생     │ 김철수 │ 02-23││
│  │ IMP-002 │ 🟡검토 │ 💡개선 │ 🟡보통   │ 필터 기능 추가 요청  │ 홍길동 │ 02-22││
│  │ IMP-001 │ 🟢완료 │ ✨기능 │ 🟢낮음   │ 다크모드 지원        │ 이영희 │ 02-20││
│  └─────────┴────────┴────────┴──────────┴──────────────────────┴────────┴──────┘│
│                                                                                  │
│                              < 1 2 3 >                          총 3건          │
└─────────────────────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <h3 className="font-medium text-gray-900 mb-3">8.1 상태/유형/우선순위</h3>

      <h4 className="font-medium text-gray-800 mb-2">상태</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
          <span className="text-sm">접수 - 새로 등록된 요청</span>
        </div>
        <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span className="text-sm">검토중 - 담당자가 검토 중</span>
        </div>
        <div className="flex items-center gap-2 p-2 bg-orange-50 rounded">
          <span className="w-3 h-3 rounded-full bg-orange-500"></span>
          <span className="text-sm">진행중 - 개발/수정 진행 중</span>
        </div>
        <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span className="text-sm">완료 - 처리 완료</span>
        </div>
        <div className="flex items-center gap-2 p-2 bg-gray-100 rounded">
          <span className="w-3 h-3 rounded-full bg-gray-400"></span>
          <span className="text-sm">보류 - 일시 보류</span>
        </div>
        <div className="flex items-center gap-2 p-2 bg-red-50 rounded">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span className="text-sm">반려 - 처리 불가</span>
        </div>
      </div>

      <h4 className="font-medium text-gray-800 mb-2">유형</h4>
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-3 py-1 bg-gray-100 rounded text-sm">🐛 버그 - 시스템 오류/버그</span>
        <span className="px-3 py-1 bg-gray-100 rounded text-sm">💡 개선요청 - 기존 기능 개선</span>
        <span className="px-3 py-1 bg-gray-100 rounded text-sm">✨ 기능추가 - 새로운 기능 요청</span>
        <span className="px-3 py-1 bg-gray-100 rounded text-sm">📝 기타 - 기타 문의사항</span>
      </div>

      <h4 className="font-medium text-gray-800 mb-2">우선순위</h4>
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">🔴 긴급 - 즉시 처리 필요</span>
        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm">🟠 높음 - 우선 처리</span>
        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm">🟡 보통 - 일반 처리</span>
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm">🟢 낮음 - 여유있게 처리</span>
      </div>

      <h3 className="font-medium text-gray-900 mb-3 mt-6">8.2 요청 등록</h3>
      {/* 요청 등록 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  📝 개선요청 등록                                [취소] [저장]   │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  제목 *         [                                           ]   │
│                                                      0/100자    │
│                                                                  │
│  유형 *         [개선요청      ▼]                               │
│  관련 메뉴      [프로젝트      ▼]                               │
│  우선순위       [보통          ▼]                               │
│                                                                  │
│  내용 *                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ (상세 내용 입력)                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  재현 방법 (버그인 경우)                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. ...                                                  │   │
│  │ 2. ...                                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  스크린샷 URL   [https://...                                ]   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <h4 className="font-medium text-gray-800 mb-2">입력 항목 설명</h4>
      <Table
        headers={['항목', '필수', '설명']}
        rows={[
          ['제목', '●', '요청 제목 (최대 100자)'],
          ['유형', '●', '버그/개선요청/기능추가/기타'],
          ['관련 메뉴', '-', '문제가 발생한 메뉴'],
          ['우선순위', '-', '긴급/높음/보통/낮음 (기본: 보통)'],
          ['내용', '●', '상세 내용'],
          ['재현 방법', '-', '버그 재현 방법 (버그인 경우)'],
          ['스크린샷 URL', '-', '관련 이미지 URL'],
        ]}
      />

      <h4 className="font-medium text-gray-800 mb-2 mt-6">8.3 권한 안내</h4>
      <Table
        headers={['기능', '가능 여부']}
        rows={[
          ['목록 조회', 'O'],
          ['요청 등록', 'O'],
          ['본인 글 수정/삭제', 'O'],
          ['타인 글 수정/삭제', isAdmin ? 'O' : 'X'],
          ['상태 변경', isAdmin ? 'O (sysadmin 전용)' : 'X (sysadmin만 가능)'],
          ['댓글 작성', 'O'],
        ]}
      />

      {isAdmin && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>💡 sysadmin 권장 운영:</strong>
          </p>
          <ul className="text-blue-800 text-sm mt-2 space-y-1">
            <li>• 접수 후 24시간 내 검토: 신규 요청은 빠르게 검토하여 사용자에게 피드백</li>
            <li>• 진행중 상태 관리: 개발 착수 시 상태 변경 및 처리예정일 설정</li>
            <li>• 반려 시 사유 명확히: 사용자가 이해할 수 있도록 구체적 사유 기재</li>
            <li>• 정기 리뷰: 보류 상태 요청들 정기적으로 재검토</li>
          </ul>
        </div>
      )}
    </Section>
  );
}

// 팁 & 단축키 섹션
function TipsSection() {
  return (
    <Section title="9. 팁 & 단축키">
      <h3 className="font-medium text-gray-900 mb-3">효율적인 업무일지 작성</h3>
      <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside mb-6">
        <li><strong>매일 작성</strong>: 업무 종료 전 당일 업무 기록</li>
        <li><strong>구체적 기록</strong>: &ldquo;회의 참석&rdquo; → &ldquo;A사 킥오프 회의 참석 (요구사항 검토)&rdquo;</li>
        <li><strong>이슈 즉시 기록</strong>: 발생 즉시 기록하여 누락 방지</li>
        <li><strong>세부추진항목 연동</strong>: 항목 선택 시 자동으로 실적 반영</li>
      </ol>

      <h3 className="font-medium text-gray-900 mb-3">날짜 입력 팁</h3>
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-700">
          <code className="bg-gray-200 px-2 py-1 rounded text-brand-orange">20260211</code> 입력
          → 자동으로 <code className="bg-gray-200 px-2 py-1 rounded text-brand-orange">2026-02-11</code> 변환
        </p>
        <p className="text-sm text-gray-500 mt-2">모든 날짜 입력 필드에서 동일하게 적용</p>
      </div>

      <h3 className="font-medium text-gray-900 mb-3 mt-6">프로젝트 진행 관리</h3>
      <ul className="text-sm text-gray-600 space-y-1">
        <li>• 단계 변경 시 확인 팝업 표시 → 프로젝트 상태 자동 반영</li>
        <li>• 세부추진항목의 <strong>[완료]</strong> 버튼 클릭 → 실적 종료일 자동 입력</li>
      </ul>
    </Section>
  );
}

// FAQ 섹션
function FAQSection({ role }: { role: string }) {
  const faqs: Record<string, { q: string; a: string }[]> = {
    engineer: [
      { q: '다른 사람의 업무일지를 수정할 수 있나요?', a: '아니요. 본인이 작성한 업무일지만 수정 가능합니다.' },
      { q: '지난 날짜의 업무일지를 작성할 수 있나요?', a: '네. 날짜를 선택하여 과거 날짜의 업무일지도 작성 가능합니다.' },
      { q: '프로젝트 삭제는 어떻게 하나요?', a: '프로젝트 삭제는 관리자만 가능합니다. 관리자에게 요청해주세요.' },
      { q: '단계를 변경하면 어떻게 되나요?', a: '팀장만 단계를 변경할 수 있습니다. 변경 시 프로젝트의 현재 단계가 자동 업데이트되고 변경 이력이 기록됩니다.' },
      { q: '검색 조건을 저장하면 어디서 볼 수 있나요?', a: '고급 검색 화면 우측 상단의 [📂 저장된 검색] 드롭다운에서 확인할 수 있습니다.' },
      { q: '개선요청의 상태를 변경할 수 있나요?', a: '아니요. 개선요청의 상태 변경은 시스템 관리자(sysadmin)만 가능합니다.' },
    ],
    admin: [
      { q: '팀원의 업무일지를 수정할 수 있나요?', a: '아니요. 업무일지는 작성자 본인만 수정 가능합니다. 내용 수정이 필요하면 해당 팀원에게 요청해주세요.' },
      { q: '삭제된 프로젝트를 복구할 수 있나요?', a: '아니요. 삭제된 데이터는 복구할 수 없습니다. 삭제 전 신중히 확인해주세요.' },
      { q: '개선요청의 상태를 변경할 수 있나요?', a: '아니요. 개선요청의 상태 변경은 시스템 관리자(sysadmin)만 가능합니다.' },
    ],
    executive: [
      { q: '프로젝트를 직접 수정할 수 있나요?', a: '경영진 역할은 조회 중심입니다. 수정이 필요하면 담당자 또는 관리자에게 요청해주세요.' },
      { q: '즐겨찾기는 몇 개까지 등록할 수 있나요?', a: '제한 없이 등록 가능합니다. 단, 대시보드에서 한 눈에 보기 위해 5~10개 정도를 권장합니다.' },
      { q: '특정 담당자의 업무만 보고 싶습니다.', a: '고급 검색에서 담당자 필터를 사용하세요. 자주 사용하면 검색 조건을 저장해두세요.' },
    ],
    sysadmin: [
      { q: '왜 업무일지 메뉴가 없나요?', a: 'sysadmin은 시스템 관리 역할입니다. 업무 기록이 필요하면 별도의 engineer 계정을 사용하세요.' },
      { q: '삭제한 사용자를 복구할 수 있나요?', a: '아니요. 동일한 정보로 새로 등록해야 합니다. 권장: 삭제보다 비활성화 처리' },
      { q: 'Google Sheets 할당량 초과 시 어떻게 하나요?', a: '24시간 대기 (자동 리셋) 또는 Google Cloud Console에서 할당량 상향 요청' },
    ],
    user: [
      { q: '업무일지 메뉴가 보이지 않습니다.', a: '일반 사용자(user) 등급에서는 업무일지 기능을 사용할 수 없습니다. 권한 변경이 필요하면 관리자에게 요청하세요.' },
      { q: '프로젝트를 수정하고 싶습니다.', a: '일반 사용자는 조회만 가능합니다. 수정이 필요하면 담당자 또는 관리자에게 요청해주세요.' },
    ],
  };

  return (
    <Section title="자주 묻는 질문 (FAQ)">
      <div className="space-y-4">
        {(faqs[role] || []).map((faq, i) => (
          <div key={i} className="border-b border-gray-100 pb-4 last:border-0">
            <h4 className="font-medium text-gray-900 mb-2">Q{i + 1}. {faq.q}</h4>
            <p className="text-gray-600 text-sm pl-4 border-l-2 border-brand-orange">{faq.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center">
        <p className="text-gray-600 text-sm">
          시스템 관련 문의사항은 <strong>시스템 관리자</strong>에게 연락해주세요.
        </p>
      </div>
    </Section>
  );
}

// 경영진 대시보드 섹션
function ExecutiveDashboardSection() {
  return (
    <Section title="4. 경영진 대시보드">
      <p className="text-gray-600 text-sm mb-4">
        사이드바에서 <strong>&ldquo;👔 경영진&rdquo;</strong> 클릭하여 접근 (또는 URL: /executive)
      </p>

      {/* 경영진 대시보드 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  👔 경영진 대시보드                                                              │
│  2026년 2월 2주차 (2026-02-09 ~ 2026-02-13)                                     │
│                              [📊 계획vs실적 상세] [⭐ 즐겨찾기 관리] [💬]       │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │                 │  │                 │  │                 │                 │
│  │    ● 정상       │  │    ▲ 지연       │  │    ✓ 완료       │                 │
│  │      3건        │  │      1건        │  │      0건        │                 │
│  │   (파란색)      │  │   (노란색)      │  │   (녹색)        │                 │
│  │                 │  │                 │  │                 │                 │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                 │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  📊 주요 프로젝트 현황 (즐겨찾기 4개)                                            │
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ Customer01      │  │ Customer02      │  │ Customer01      │                 │
│  │ ITEM01          │  │ B0001           │  │ ITEM02          │                 │
│  │ ────────────────│  │ ────────────────│  │ ────────────────│                 │
│  │ 설계   ▲ 지연   │  │ 검토   ● 정상   │  │ 검토   ● 정상   │                 │
│  │ ████░░░░░░ 10%  │  │ ░░░░░░░░░░  0%  │  │ ░░░░░░░░░░  0%  │                 │
│  │ 2026-02-05~02-28│  │ 2026-02-06~12-31│  │ 2026-02-09~06-30│                 │
│  │           [💬 1]│  │           [💬]  │  │           [💬]  │                 │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                 │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  📋 최근 회의록 (최근 1개월)                                                     │
│  ┌───────────────────┬────────────┬────────────┬──────────┬────────┐           │
│  │ 프로젝트          │ 회의명     │ 회의일     │ 주관부서 │ 작성자 │           │
│  ├───────────────────┼────────────┼────────────┼──────────┼────────┤           │
│  │ Customer01 ITEM01 │ 킥오프회의 │ 2026.02.11 │ R&D팀    │ 김팀장 │           │
│  └───────────────────┴────────────┴────────────┴──────────┴────────┘           │
│                                                                                  │
│  📋 금주 주간 보고 요약                                                          │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  Customer01 ITEM01: ■ 02/05 개발                                                │
│  개발업무를 이제부터 시작...                                                     │
│                                                    [주간 보고 전체 보기 →]      │
└─────────────────────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <h3 className="font-medium text-gray-900 mb-3">4.1 상태 카드 의미</h3>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg text-center">
          <div className="text-blue-600 font-bold text-lg">● 정상</div>
          <div className="text-sm text-blue-700 mt-1">계획대로 진행</div>
          <div className="text-xs text-blue-600 mt-1">차이 ≤ 10%</div>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg text-center">
          <div className="text-yellow-600 font-bold text-lg">▲ 지연</div>
          <div className="text-sm text-yellow-700 mt-1">일정 지연 발생</div>
          <div className="text-xs text-yellow-600 mt-1">차이 &gt; 10%</div>
        </div>
        <div className="p-4 bg-green-50 rounded-lg text-center">
          <div className="text-green-600 font-bold text-lg">✓ 완료</div>
          <div className="text-sm text-green-700 mt-1">프로젝트 완료</div>
        </div>
      </div>

      <h3 className="font-medium text-gray-900 mb-3">4.2 프로젝트 카드 정보</h3>
      <Table
        headers={['항목', '설명']}
        rows={[
          ['고객사', '고객사명'],
          ['ITEM', '프로젝트명/코드'],
          ['단계', '현재 진행 단계 (검토, 설계, 개발...)'],
          ['상태', '정상/지연 표시'],
          ['진행률', '프로그레스 바 + 퍼센트'],
          ['기간', '프로젝트 시작일 ~ 종료일'],
          ['[💬]', '코멘트 아이콘 (숫자는 미읽은 코멘트 수)'],
        ]}
      />

      <h3 className="font-medium text-gray-900 mb-3 mt-6">4.3 즐겨찾기 관리</h3>
      <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
        <li>우측 상단 <strong>[⭐ 즐겨찾기 관리]</strong> 클릭</li>
        <li>모니터링할 프로젝트 선택/해제</li>
        <li>선택된 프로젝트가 대시보드에 카드로 표시</li>
      </ol>
      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800 text-sm">
          <strong>권장:</strong> 5~10개 정도의 핵심 프로젝트만 즐겨찾기 등록
        </p>
      </div>
    </Section>
  );
}

// 계획vs실적 섹션
function ComparisonSection() {
  return (
    <Section title="5. 계획 vs 실적 비교">
      <p className="text-gray-600 text-sm mb-4">
        경영진 대시보드에서 <strong>[📊 계획vs실적 상세]</strong> 버튼 클릭
      </p>

      {/* 계획vs실적 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────────────────────┐
│  📊 계획 vs 실적 비교                                [📥 PDF] [← 대시보드]     │
│  ════════════════════════════════════════════════════════════════════════════════│
│                                                                                  │
│  기간: [2026년 ▼]  표시: [⭐ 즐겨찾기 프로젝트만]                               │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ 프로젝트        │ 1월 │ 2월 │ 3월 │ 4월 │ 5월 │ 6월 │ 상태 │ 차이      │   │
│  │─────────────────┼─────┼─────┼─────┼─────┼─────┼─────┼──────┼───────────│   │
│  │ ITEM01          │     │     │     │     │     │     │      │           │   │
│  │  계획           │▓▓▓▓▓│▓▓▓▓▓│▓▓▓▓▓│▓▓▓▓▓│     │     │ 🟡   │           │   │
│  │  실적           │████ │██   │     │     │     │     │ 지연 │ -15%      │   │
│  │─────────────────┼─────┼─────┼─────┼─────┼─────┼─────┼──────┼───────────│   │
│  │ B0001           │     │     │     │     │     │     │      │           │   │
│  │  계획           │     │▓▓▓  │▓▓▓▓▓│▓▓▓▓▓│▓▓▓▓▓│▓▓   │ 🟢   │           │   │
│  │  실적           │     │██   │     │     │     │     │ 정상 │ 0%        │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  범례: ▓▓▓ 계획 (파란색)  ███ 실적 (빨간색=지연, 초록색=정상)                    │
│                                                                                  │
│  상태: 🟢 정상 (차이 ≤10%)  🟡 지연 (차이 >10%)  ✅ 완료                        │
└─────────────────────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <h3 className="font-medium text-gray-900 mb-3">5.1 분석 포인트</h3>
      <Table
        headers={['지표', '의미', '대응 방안']}
        rows={[
          ['차이(-)', '계획 대비 실적 부족', '원인 파악, 자원 재배치 검토'],
          ['차이(+)', '계획 대비 초과 달성', '긍정적, 여유 자원 활용 검토'],
          ['차이(0)', '계획대로 진행', '현 상태 유지'],
        ]}
      />

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800 text-sm">
          <strong>💡 PDF 다운로드:</strong> 화면 우측 상단 <strong>[📥 PDF]</strong> 버튼을 클릭하면
          현재 화면을 PDF로 다운로드할 수 있습니다.
        </p>
      </div>
    </Section>
  );
}

// 경영진 활용 팁 섹션
function ExecutiveTipsSection() {
  return (
    <Section title="활용 팁">
      <h3 className="font-medium text-gray-900 mb-3">일일 체크 루틴</h3>
      <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside mb-6">
        <li><strong>경영진 대시보드</strong> 확인 - 지연 프로젝트 유무 확인, 주요 프로젝트 카드 상태 확인</li>
        <li><strong>이슈 있는 업무일지</strong> 확인 - 고급 검색에서 이슈 필터링, 미해결 이슈 팔로업</li>
      </ol>

      <h3 className="font-medium text-gray-900 mb-3">주간 체크 루틴</h3>
      <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside mb-6">
        <li><strong>주간보고</strong> 검토 - 각 프로젝트 진행 상황 파악, 차주 계획 확인</li>
        <li><strong>계획vs실적</strong> 분석 - 지연 프로젝트 원인 파악, 필요시 자원 재배치 검토</li>
      </ol>

      <h3 className="font-medium text-gray-900 mb-3">월간 체크 루틴</h3>
      <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
        <li><strong>전체 일정 (간트차트)</strong> 확인 - 향후 일정 파악, 병목 구간 확인</li>
        <li><strong>회의록</strong> 검토 - 주요 의사결정 사항 확인, 후속 조치 확인</li>
      </ol>
    </Section>
  );
}

// 사용자 관리 섹션
function UserManagementSection() {
  return (
    <Section title="2. 사용자 관리">
      <h3 className="font-medium text-gray-900 mb-3">2.1 사용자 목록 화면</h3>

      {/* 사용자 목록 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  👥 사용자 관리                                  [+ 사용자 추가] │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  검색: [________________] [역할 ▼] [소속 ▼]                     │
│                                                                  │
│  ┌──────┬─────────────────┬──────────┬──────────┬─────────────┐│
│  │ 이름 │ 이메일          │ 역할     │ 소속     │ 액션        ││
│  ├──────┼─────────────────┼──────────┼──────────┼─────────────┤│
│  │ 홍길동│ hong@test.com  │ engineer │ R&D팀    │ [수정] [삭제]││
│  │ 김관리│ kim@test.com   │ admin    │ 관리팀   │ [수정] [삭제]││
│  │ 박경영│ park@test.com  │ executive│ 경영진   │ [수정] [삭제]││
│  │ 이시스│ lee@test.com   │ sysadmin │ IT팀     │ [수정]      ││
│  └──────┴─────────────────┴──────────┴──────────┴─────────────┘│
│                                                                  │
│  < 1 2 3 >                                          총 20명    │
└─────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <h3 className="font-medium text-gray-900 mb-3">2.2 사용자 등록</h3>

      {/* 사용자 등록 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  👤 사용자 등록                                    [X 닫기]     │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  이름 *         [홍길동                    ]                    │
│                                                                  │
│  이메일 *       [hong@company.com          ]                    │
│                  ※ 로그인 ID로 사용됩니다                       │
│                                                                  │
│  비밀번호 *     [●●●●●●●●●●                ]                    │
│                  ※ 8자 이상 권장                                │
│                                                                  │
│  역할 *         [engineer         ▼]                            │
│                 ┌──────────────────┐                            │
│                 │ user      - 일반 사용자 (조회만)              │
│                 │ engineer  - 엔지니어 (CRUD) ✓                 │
│                 │ admin     - 관리자 (사용자/시스템 관리)       │
│                 │ executive - 경영진 (조회 + 대시보드)          │
│                 │ sysadmin  - 시스템 관리자                     │
│                 └──────────────────┘                            │
│                                                                  │
│  소속 *         [R&D팀             ▼]                           │
│                                                                  │
│          [취소]            [저장]                                │
└─────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <p className="text-gray-600 text-sm mb-4">
        <strong>[+ 사용자 추가]</strong> 클릭 후 정보 입력
      </p>

      <h4 className="font-medium text-gray-800 mb-2">입력 항목 상세</h4>
      <Table
        headers={['항목', '필수', '설명', '예시']}
        rows={[
          ['이름', '●', '사용자 이름', '홍길동'],
          ['이메일', '●', '로그인 ID (이메일 형식)', 'hong@company.com'],
          ['비밀번호', '●', '초기 비밀번호 (8자 이상 권장)', '-'],
          ['역할', '●', '권한 등급', 'engineer'],
          ['소속', '●', '부서/팀명', 'R&D팀'],
        ]}
      />

      <h3 className="font-medium text-gray-900 mb-3 mt-6">2.3 역할(Role) 상세</h3>
      <Table
        headers={['역할', '코드', '권한 범위', '주요 용도']}
        rows={[
          ['일반 사용자', 'user', '조회만 가능', '외부 열람자, 인턴'],
          ['엔지니어', 'engineer', '프로젝트/업무일지 CRUD', '프로젝트 담당자'],
          ['관리자', 'admin', '사용자/시스템 관리 포함', '팀장, 부서장'],
          ['경영진', 'executive', '조회 + 경영진 대시보드', '임원, 경영진'],
          ['시스템 관리자', 'sysadmin', '시스템 전체 관리', 'IT 담당자'],
        ]}
      />

      <h3 className="font-medium text-gray-900 mb-3 mt-6">2.4 비밀번호 재설정</h3>
      <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
        <li>사용자 목록에서 <strong>[수정]</strong> 클릭</li>
        <li><strong>[비밀번호 재설정]</strong> 버튼 클릭</li>
        <li>새 비밀번호 입력</li>
        <li><strong>[저장]</strong> 클릭</li>
      </ol>

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800 text-sm">
          <strong>보안 주의:</strong> 비밀번호 재설정 후 사용자에게 초기 비밀번호를 안전하게 전달하세요.
          이메일, 메신저 등을 통해 직접 전달하고, 첫 로그인 시 변경을 권장하세요.
        </p>
      </div>

      <h3 className="font-medium text-gray-900 mb-3 mt-6">2.5 사용자 삭제</h3>
      <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
        <li>사용자 목록에서 <strong>[삭제]</strong> 클릭</li>
        <li>확인 팝업에서 <strong>[삭제]</strong> 클릭</li>
      </ol>

      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm">
          <strong>⚠️ 주의:</strong>
        </p>
        <ul className="text-red-800 text-sm mt-1 space-y-1">
          <li>• 삭제된 사용자는 복구할 수 없습니다</li>
          <li>• 해당 사용자의 업무일지는 유지되지만 &ldquo;작성자 없음&rdquo;으로 표시됩니다</li>
          <li>• 퇴사자는 삭제보다 <strong>비활성화</strong> 처리를 권장합니다</li>
        </ul>
      </div>
    </Section>
  );
}

// 시스템 설정 섹션
function SettingsSection() {
  return (
    <Section title="3. 시스템 설정">
      {/* 시스템 설정 와이어프레임 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-700">{`┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ 시스템 설정                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📋 프로젝트 목록 컬럼 설정                               │   │
│  │                                                         │   │
│  │  표시할 컬럼 선택:                                       │   │
│  │  ☑️ 즐겨찾기    ☑️ 고객사     ☑️ ITEM                   │   │
│  │  ☑️ 소속        ☑️ 팀장       ☑️ 현재단계                │   │
│  │  ☑️ 대일정      ☐ PART NO    ☐ 팀원                     │   │
│  │  ☐ 모델        ☐ 진행상태    ☐ 최종수정일               │   │
│  │                                                         │   │
│  │  컬럼 순서: [드래그하여 순서 변경]                       │   │
│  │  ┌────────────────────────────────────────────┐         │   │
│  │  │ ≡ 즐겨찾기 │ ≡ 고객사 │ ≡ ITEM │ ≡ 소속 │...       │   │
│  │  └────────────────────────────────────────────┘         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🏢 개발 단계 관리                                        │   │
│  │                                                         │   │
│  │  사용 가능한 단계:                                       │   │
│  │  ☑️ 검토    ☑️ 설계    ☑️ 개발    ☑️ PROTO              │   │
│  │  ☑️ 신뢰성  ☑️ P1      ☑️ P2      ☑️ 승인               │   │
│  │  ☑️ 양산이관 ☑️ 초도양산 ☑️ 품질관리 ☑️ 원가절감        │   │
│  │                                                         │   │
│  │  [+ 커스텀 단계 추가]                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔧 기타 설정                                             │   │
│  │                                                         │   │
│  │  기본 페이지당 항목 수: [20      ▼]                      │   │
│  │  날짜 표시 형식:        [YY.MM.DD ▼]                     │   │
│  │  소속 옵션 관리:        [전장, 유압, 기타] [편집]        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│                      [취소]        [저장]                       │
└─────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <h3 className="font-medium text-gray-900 mb-3">3.1 설정 가능 항목</h3>
      <ul className="text-sm text-gray-600 space-y-2">
        <li>• <strong>프로젝트 목록 컬럼 설정</strong>: 표시할 컬럼 선택 및 순서 변경</li>
        <li>• <strong>개발 단계 관리</strong>: 사용 가능한 단계 설정, 커스텀 단계 추가</li>
        <li>• <strong>기본 페이지당 항목 수</strong>: 목록 페이지의 기본 항목 수</li>
        <li>• <strong>날짜 표시 형식</strong>: YY.MM.DD, YYYY-MM-DD 등</li>
        <li>• <strong>소속 옵션 관리</strong>: 전장, 유압, 기타 등</li>
      </ul>

      <h3 className="font-medium text-gray-900 mb-3 mt-6">3.2 공통 코드 관리</h3>
      <Table
        headers={['카테고리', '설명', '예시']}
        rows={[
          ['고객사', '고객사 목록', '삼성, LG, 현대...'],
          ['소속', '사업부/팀 구분', '전장, 유압, 기타'],
          ['프로젝트 단계', '진행 단계', 'PoC, 설계, 개발, 검수...'],
          ['구분', '주간보고 구분', '농기, 중공업, 해외, 기타'],
        ]}
      />

      <h4 className="font-medium text-gray-800 mb-2 mt-4">코드 추가</h4>
      <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
        <li>카테고리 선택</li>
        <li>코드명 입력</li>
        <li><strong>[+ 추가]</strong> 클릭</li>
      </ol>

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800 text-sm">
          <strong>⚠️ 코드 삭제 주의:</strong> 사용 중인 코드를 삭제하면 기존 데이터에 영향을 줄 수 있습니다.
          삭제 전 해당 코드를 사용하는 데이터가 없는지 확인하세요.
        </p>
      </div>
    </Section>
  );
}

// 트러블슈팅 섹션
function TroubleshootingSection() {
  return (
    <>
      <Section title="트러블슈팅">
        <h3 className="font-medium text-gray-900 mb-3">로그인 문제</h3>
        <Table
          headers={['증상', '원인', '해결 방법']}
          rows={[
            ['비밀번호 분실', '-', '사용자 관리에서 비밀번호 재설정'],
            ['권한 오류', '역할 설정 오류', '역할(Role) 확인 및 수정'],
            ['로그인 불가', '계정 비활성화', '계정 상태 확인'],
          ]}
        />

        <h3 className="font-medium text-gray-900 mb-3 mt-6">데이터 문제</h3>
        <Table
          headers={['증상', '원인', '해결 방법']}
          rows={[
            ['데이터 누락', '동기화 지연', '페이지 새로고침, Google Sheets 직접 확인'],
            ['중복 데이터', '동시 저장', '중복 데이터 수동 삭제'],
            ['연결 오류', 'API 문제', '잠시 후 재시도, API 상태 확인'],
          ]}
        />

        <h3 className="font-medium text-gray-900 mb-3 mt-6">시스템 오류</h3>
        <Table
          headers={['증상', '원인', '해결 방법']}
          rows={[
            ['500 에러', 'Google API 할당량 초과', '24시간 대기 또는 할당량 상향'],
            ['느린 응답', '데이터량 과다', '불필요한 데이터 정리'],
            ['배포 실패', '빌드 에러', 'Vercel 로그 확인, 코드 수정'],
          ]}
        />

        <h3 className="font-medium text-gray-900 mb-3 mt-6">Google API 할당량</h3>
        <div className="p-4 bg-gray-50 rounded-lg">
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 기본 할당량: <strong>분당 60회</strong> 요청</li>
            <li>• 초과 시 24시간 후 자동 리셋</li>
            <li>• 필요 시 Google Cloud Console에서 할당량 상향 요청</li>
          </ul>
        </div>
      </Section>

      <Section title="시스템 운영 가이드">
        <h3 className="font-medium text-gray-900 mb-3">정기 점검 사항</h3>
        <Table
          headers={['주기', '점검 항목', '조치']}
          rows={[
            ['일간', '로그인 현황 확인', '비정상 접근 시 계정 확인'],
            ['주간', '비활성 사용자 확인', '30일 이상 미접속 계정 확인'],
            ['월간', '불필요한 데이터 정리', '테스트 데이터 삭제'],
            ['분기', '권한 검토', '퇴사자/부서이동자 권한 정리'],
          ]}
        />

        <h3 className="font-medium text-gray-900 mb-3 mt-6">데이터 백업</h3>
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-blue-800 text-sm mb-2">
            <strong>Google Sheets 기반이므로:</strong>
          </p>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>• Google Sheets 자체 버전 기록 활용 (파일 &gt; 버전 기록)</li>
            <li>• 정기적으로 스프레드시트 다운로드 권장 (xlsx, csv)</li>
          </ul>
        </div>

        <h3 className="font-medium text-gray-900 mb-3 mt-6">보안 관리</h3>
        <Table
          headers={['항목', '권장 사항']}
          rows={[
            ['비밀번호 정책', '8자 이상, 영문+숫자 조합'],
            ['계정 관리', '퇴사자 계정 즉시 비활성화/삭제'],
            ['권한 관리', '최소 권한 원칙 적용'],
            ['접근 로그', '정기적인 로그 확인'],
          ]}
        />

        <h3 className="font-medium text-gray-900 mb-3 mt-6">퇴사자 처리 절차</h3>
        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li>해당 사용자 계정 <strong>비활성화</strong> 처리</li>
          <li>담당 프로젝트의 팀장/팀원 재지정</li>
          <li>필요시 인수인계 확인 후 계정 삭제</li>
        </ol>
      </Section>

      <Section title="Google Sheets 구조">
        <h3 className="font-medium text-gray-900 mb-3">시트 목록</h3>
        <Table
          headers={['시트명', '용도', '주요 컬럼']}
          rows={[
            ['Users', '사용자 정보', 'id, name, email, password, role, division'],
            ['Projects', '프로젝트 정보', 'id, customer, item, leaderId, startDate, endDate'],
            ['WorkLogs', '업무일지', 'id, projectId, date, content, issue'],
            ['WeeklyReports', '주간보고', 'id, weekNumber, division, content'],
            ['MeetingMinutes', '회의록', 'id, projectId, title, meetingDate'],
            ['Favorites', '즐겨찾기', 'id, userId, projectId'],
            ['SavedSearches', '저장된 검색', 'id, userId, name, filtersJson'],
            ['ScheduleItems', '세부추진항목', 'id, projectId, stage, itemName'],
          ]}
        />

        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">
            <strong>⚠️ 경고:</strong> Google Sheets 직접 수정은 권장하지 않습니다.
          </p>
          <p className="text-red-700 text-sm mt-2">불가피한 경우 주의사항:</p>
          <ul className="text-red-700 text-sm mt-1 space-y-1">
            <li>• <strong>ID 컬럼</strong>은 절대 수정하지 마세요 (참조 무결성 깨짐)</li>
            <li>• <strong>날짜 형식</strong> 유지 (YYYY-MM-DD)</li>
            <li>• <strong>빈 행 삽입</strong> 금지</li>
            <li>• 수정 전 해당 시트 <strong>백업</strong> 필수</li>
          </ul>
        </div>
      </Section>
    </>
  );
}
