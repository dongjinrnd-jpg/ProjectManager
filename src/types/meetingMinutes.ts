/**
 * 회의록 관련 타입 정의
 *
 * Google Sheets: MeetingMinutes 시트 (전체 데이터 저장)
 */

/**
 * 참석자 정보
 */
export interface Attendee {
  /** 소속 */
  department: string;
  /** 직위 */
  position: string;
  /** 성명 */
  name: string;
}

/**
 * 회의록 (Sheets 저장용)
 */
export interface MeetingMinutes {
  /** 회의록 ID (PK) - 예: MTG-001 */
  id: string;
  /** 프로젝트 ID (FK → Projects) */
  projectId: string;
  /** 회의명 */
  title: string;
  /** 주관부서 */
  hostDepartment: string;
  /** 장소 */
  location: string;
  /** 회의일시 (YYYY-MM-DD HH:MM) */
  meetingDate: string;
  /** 참석자 (JSON string) */
  attendeesJson: string;
  /** 안건 */
  agenda: string;
  /** 회의내용 */
  discussion: string;
  /** 결정사항 */
  decisions: string;
  /** 향후일정 */
  nextSteps: string;
  /** 작성자 ID (FK → Users) */
  createdById: string;
  /** 작성일시 */
  createdAt: string;
  /** 수정일시 */
  updatedAt: string;
}

/**
 * 회의록 전체 내용 (입력용)
 */
export interface MeetingMinutesContent {
  /** 회의명 */
  title: string;
  /** 주관부서 */
  hostDepartment: string;
  /** 장소 */
  location: string;
  /** 회의일시 */
  meetingDate: string;
  /** 참석자 목록 */
  attendees: Attendee[];
  /** 안건 */
  agenda: string;
  /** 회의내용 */
  discussion: string;
  /** 결정사항 */
  decisions: string;
  /** 향후일정 */
  nextSteps: string;
}

/**
 * 회의록 생성 입력 타입
 */
export interface CreateMeetingMinutesInput extends MeetingMinutesContent {
  projectId: string;
}

/**
 * 회의록 수정 입력 타입
 */
export interface UpdateMeetingMinutesInput extends Partial<MeetingMinutesContent> {}

/**
 * 회의록 목록 조회 응답 (조인 데이터)
 */
export interface MeetingMinutesListItem {
  id: string;
  projectId: string;
  title: string;
  hostDepartment: string;
  location: string;
  meetingDate: string;
  createdByName: string;
  createdById: string;
  createdAt: string;
}

/**
 * 회의록 상세 조회 응답
 */
export interface MeetingMinutesDetail extends MeetingMinutes {
  /** 작성자 이름 */
  createdByName: string;
  /** 참석자 배열 (JSON 파싱 후) */
  attendees: Attendee[];
}
