'use client';

/**
 * 애플리케이션 레이아웃
 *
 * Roadmap 2.1 기준
 * - Header (상단 고정)
 * - Sidebar (좌측 네비게이션)
 * - Main Content (우측 콘텐츠 영역)
 */

import Header from './Header';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header />

      {/* Body: Sidebar + Main Content */}
      <div className="flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}