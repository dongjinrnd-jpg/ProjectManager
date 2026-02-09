'use client';

/**
 * 사이드바 컴포넌트
 *
 * Roadmap 2.1 기준 네비게이션 메뉴
 * - 대시보드, 프로젝트, 업무일지, 일정, 주간보고
 * - 경영진 (경영진/관리자 전용)
 * - 사용자 관리, 설정 (시스템 관리자 전용)
 */

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 기본 메뉴 항목
const mainMenuItems = [
  { href: '/dashboard', label: '대시보드', icon: '📊' },
  { href: '/projects', label: '프로젝트', icon: '📁' },
  { href: '/worklogs', label: '업무일지', icon: '📝' },
  { href: '/schedules', label: '전체 일정', icon: '📅' },
  { href: '/weekly-reports', label: '주간보고', icon: '📋' },
];

// 경영진/관리자 메뉴
const executiveMenuItems = [
  { href: '/executive', label: '경영진', icon: '👔' },
];

// 시스템 관리자 메뉴
const adminMenuItems = [
  { href: '/admin/users', label: '사용자 관리', icon: '👥' },
  { href: '/admin/settings', label: '설정', icon: '⚙️' },
];

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const userRole = session?.user?.role;

  // 업무일지 접근 가능 여부 (user 제외)
  const canAccessWorklogs = userRole !== 'user' && userRole !== 'sysadmin';

  // 경영진/관리자 여부
  const isExecutiveOrAdmin = userRole === 'executive' || userRole === 'admin' || userRole === 'sysadmin';

  // 시스템 관리자 여부
  const isSysAdmin = userRole === 'sysadmin' || userRole === 'admin';

  // 역할별 메뉴 필터링
  const filteredMainMenuItems = mainMenuItems.filter((item) => {
    // 업무일지 메뉴: user, sysadmin 제외
    if (item.href === '/worklogs') {
      return canAccessWorklogs;
    }
    return true;
  });

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-56 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      {/* 메인 메뉴 */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {filteredMainMenuItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-brand-orange-light text-brand-primary'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* 구분선 + 경영진 메뉴 */}
        {isExecutiveOrAdmin && (
          <>
            <hr className="my-4 border-gray-200" />
            <ul className="space-y-1">
              {executiveMenuItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-brand-orange-light text-brand-primary'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* 구분선 + 관리자 메뉴 */}
        {isSysAdmin && (
          <>
            <hr className="my-4 border-gray-200" />
            <ul className="space-y-1">
              {adminMenuItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-brand-orange-light text-brand-primary'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
    </aside>
  );
}
