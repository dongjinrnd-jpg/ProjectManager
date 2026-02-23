/**
 * 개선요청 게시판 타입 정의
 *
 * 시스템 운영 중 발생한 문제점/개선사항을 등록하고 관리하는 게시판
 * 권한: engineer, admin, sysadmin만 접근 가능
 */

// 요청 유형
export type ImprovementType = 'bug' | 'improvement' | 'feature' | 'other';

// 상태
export type ImprovementStatus =
  | 'submitted'    // 접수
  | 'reviewing'    // 검토중
  | 'in_progress'  // 진행중
  | 'completed'    // 완료
  | 'hold'         // 보류
  | 'rejected';    // 반려

// 우선순위
export type ImprovementPriority = 'urgent' | 'high' | 'normal' | 'low';

// 관련 메뉴
export type RelatedMenu =
  | 'dashboard'    // 대시보드
  | 'projects'     // 프로젝트
  | 'worklogs'     // 업무일지
  | 'weekly'       // 주간보고
  | 'schedules'    // 일정
  | 'search'       // 검색
  | 'settings'     // 설정
  | 'other';       // 기타

// 개선요청 기본 타입
export interface Improvement {
  id: string;                    // IMP-001 형식
  title: string;                 // 제목
  type: ImprovementType;         // 유형
  status: ImprovementStatus;     // 상태
  priority: ImprovementPriority; // 우선순위
  content: string;               // 내용
  relatedMenu: RelatedMenu;      // 관련 메뉴
  reproductionSteps: string;     // 재현 방법 (버그인 경우)
  screenshotUrl: string;         // 스크린샷 URL

  authorId: string;              // 작성자 ID
  authorName: string;            // 작성자 이름
  createdAt: string;             // 작성일시
  updatedAt: string;             // 수정일시

  dueDate: string;               // 처리예정일
  completedAt: string;           // 완료일시
}

// 목록 조회용 (간략 정보)
export interface ImprovementListItem {
  id: string;
  title: string;
  type: ImprovementType;
  status: ImprovementStatus;
  priority: ImprovementPriority;
  relatedMenu: RelatedMenu;
  authorId: string;
  authorName: string;
  createdAt: string;
  dueDate: string;
}

// 상세 조회용 (전체 정보 + 처리이력 + 댓글)
export interface ImprovementDetail extends Improvement {
  histories: ImprovementHistory[];
  comments: ImprovementComment[];
}

// 처리 이력
export interface ImprovementHistory {
  id: string;                    // 히스토리 ID
  improvementId: string;         // 개선요청 ID
  status: ImprovementStatus;     // 변경된 상태
  memo: string;                  // 처리 메모
  changedBy: string;             // 변경자 ID
  changedByName: string;         // 변경자 이름
  changedAt: string;             // 변경일시
}

// 댓글
export interface ImprovementComment {
  id: string;                    // 댓글 ID
  improvementId: string;         // 개선요청 ID
  content: string;               // 댓글 내용
  authorId: string;              // 작성자 ID
  authorName: string;            // 작성자 이름
  createdAt: string;             // 작성일시
}

// 생성 입력
export interface CreateImprovementInput {
  title: string;
  type: ImprovementType;
  content: string;
  relatedMenu?: RelatedMenu;
  priority?: ImprovementPriority;
  reproductionSteps?: string;
  screenshotUrl?: string;
}

// 수정 입력
export interface UpdateImprovementInput {
  title?: string;
  type?: ImprovementType;
  content?: string;
  relatedMenu?: RelatedMenu;
  priority?: ImprovementPriority;
  reproductionSteps?: string;
  screenshotUrl?: string;
}

// 상태 변경 입력 (sysadmin 전용)
export interface UpdateStatusInput {
  status: ImprovementStatus;
  memo: string;
  dueDate?: string;
  priority?: ImprovementPriority;
}

// 댓글 생성 입력
export interface CreateCommentInput {
  content: string;
}

// 유형 레이블
export const IMPROVEMENT_TYPE_LABELS: Record<ImprovementType, { label: string; icon: string }> = {
  bug: { label: '버그', icon: '🐛' },
  improvement: { label: '개선요청', icon: '💡' },
  feature: { label: '기능추가', icon: '✨' },
  other: { label: '기타', icon: '📝' },
};

// 상태 레이블
export const IMPROVEMENT_STATUS_LABELS: Record<ImprovementStatus, { label: string; color: string; bgColor: string }> = {
  submitted: { label: '접수', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  reviewing: { label: '검토중', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  in_progress: { label: '진행중', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  completed: { label: '완료', color: 'text-green-700', bgColor: 'bg-green-100' },
  hold: { label: '보류', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  rejected: { label: '반려', color: 'text-red-700', bgColor: 'bg-red-100' },
};

// 우선순위 레이블
export const IMPROVEMENT_PRIORITY_LABELS: Record<ImprovementPriority, { label: string; color: string; bgColor: string }> = {
  urgent: { label: '긴급', color: 'text-red-700', bgColor: 'bg-red-100' },
  high: { label: '높음', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  normal: { label: '보통', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  low: { label: '낮음', color: 'text-green-700', bgColor: 'bg-green-100' },
};

// 관련 메뉴 레이블
export const RELATED_MENU_LABELS: Record<RelatedMenu, string> = {
  dashboard: '대시보드',
  projects: '프로젝트',
  worklogs: '업무일지',
  weekly: '주간보고',
  schedules: '일정',
  search: '검색',
  settings: '설정',
  other: '기타',
};
