'use client';

/**
 * 프로젝트 수정 클라이언트 컴포넌트
 *
 * 프로젝트 데이터를 불러와 폼에 전달
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProjectFormClient from '../../new/ProjectFormClient';
import AppLayout from '@/components/layout/AppLayout';
import type { Project } from '@/types';

interface ProjectEditClientProps {
  projectId: string;
}

export default function ProjectEditClient({ projectId }: ProjectEditClientProps) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        const data = await response.json();

        if (data.success) {
          setProject(data.data);
        } else {
          setError(data.error || '프로젝트를 찾을 수 없습니다.');
        }
      } catch (err) {
        setError('서버 연결 오류가 발생했습니다.');
        console.error('프로젝트 조회 오류:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

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
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">{error || '프로젝트를 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.push('/projects')}
            className="mt-4 px-4 py-2 bg-brand-orange text-white rounded-md"
          >
            목록으로 돌아가기
          </button>
        </div>
      </AppLayout>
    );
  }

  return <ProjectFormClient project={project} isEdit />;
}