'use client';

/**
 * 공통 헤더 컴포넌트
 *
 * Roadmap 2.1 기준
 * - 로고
 * - 검색 (TODO)
 * - 알림 아이콘 (TODO)
 * - 사용자 정보 + 로그아웃
 */

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function Header() {
  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <header className="bg-brand-primary text-white shadow sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* 로고 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-brand-yellow"></div>
              <div className="w-3 h-3 rounded-full bg-brand-orange"></div>
            </div>
            <Link href="/dashboard" className="text-lg font-bold text-white hover:text-brand-yellow">
              R&D 프로젝트 관리
            </Link>
          </div>

          {/* 우측: 검색, 알림, 사용자 */}
          <div className="flex items-center space-x-4">
            {/* 검색 (TODO) */}
            {/* <button className="p-2 text-white/80 hover:text-white">
              <span className="text-lg">🔍</span>
            </button> */}

            {/* 알림 (TODO) */}
            <button className="p-2 text-white/80 hover:text-white relative">
              <span className="text-lg">🔔</span>
              {/* 알림 배지 (TODO) */}
              {/* <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span> */}
            </button>

            {/* 사용자 정보 & 로그아웃 */}
            {session?.user && (
              <div className="flex items-center space-x-3">
                <button className="p-2 text-white/80 hover:text-white flex items-center gap-2">
                  <span className="text-lg">👤</span>
                  <span className="text-sm hidden sm:inline">
                    {session.user.name}
                  </span>
                </button>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}