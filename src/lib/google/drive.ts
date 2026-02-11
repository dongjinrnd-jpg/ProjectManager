/**
 * Google Drive API 클라이언트
 *
 * Service Account를 사용하여 Google Drive에 연결합니다.
 * 환경 변수는 sheets.ts와 동일하게 재사용:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL
 * - GOOGLE_PRIVATE_KEY
 * - GOOGLE_DRIVE_FOLDER_ID: 최상위 폴더 ID (ProjectManager 폴더)
 */

import { google, drive_v3 } from 'googleapis';
import type { MeetingMinutesContent, Attendee } from '@/types';

// 환경 변수
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// 싱글톤 클라이언트
let driveClient: drive_v3.Drive | null = null;

/**
 * Google Drive API 클라이언트 획득
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (driveClient) return driveClient;

  if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
    throw new Error('Google Drive 환경 변수가 설정되지 않았습니다. (SERVICE_ACCOUNT_EMAIL, PRIVATE_KEY)');
  }

  const auth = new google.auth.JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: PRIVATE_KEY,
    scopes: [
      'https://www.googleapis.com/auth/drive',
    ],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

/**
 * 최상위 폴더 ID 조회
 */
export function getRootFolderId(): string {
  if (!ROOT_FOLDER_ID) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID 환경 변수가 설정되지 않았습니다.');
  }
  return ROOT_FOLDER_ID;
}

/**
 * 폴더 검색
 */
async function findFolder(name: string, parentId: string): Promise<string | null> {
  const drive = await getDriveClient();
  const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return response.data.files?.[0]?.id || null;
}

/**
 * 폴더 생성
 */
async function createFolder(name: string, parentId: string): Promise<string> {
  const drive = await getDriveClient();

  const fileMetadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id',
    supportsAllDrives: true,
  });

  if (!response.data.id) {
    throw new Error(`폴더 생성 실패: ${name}`);
  }

  return response.data.id;
}

/**
 * 폴더 ID 조회 또는 생성
 * 구조: ProjectManager(루트)/MeetingMinutes/{projectId}/
 */
export async function getOrCreateMeetingMinutesFolder(projectId: string): Promise<string> {
  const rootId = getRootFolderId();

  // 1. MeetingMinutes 폴더 찾기/생성
  let meetingMinutesFolderId = await findFolder('MeetingMinutes', rootId);
  if (!meetingMinutesFolderId) {
    meetingMinutesFolderId = await createFolder('MeetingMinutes', rootId);
  }

  // 2. 프로젝트별 폴더 찾기/생성
  let projectFolderId = await findFolder(projectId, meetingMinutesFolderId);
  if (!projectFolderId) {
    projectFolderId = await createFolder(projectId, meetingMinutesFolderId);
  }

  return projectFolderId;
}

/**
 * MD 파일 업로드
 * @returns { fileId, webViewLink }
 */
export async function uploadMarkdownFile(
  fileName: string,
  content: string,
  parentFolderId: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = await getDriveClient();

  const fileMetadata = {
    name: fileName,
    parents: [parentFolderId],
  };

  // 파일 업로드
  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType: 'text/markdown',
      body: content,
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  const fileId = response.data.id;
  if (!fileId) {
    throw new Error('파일 업로드 실패: fileId가 없습니다.');
  }

  // 공개 읽기 권한 설정 (링크 공유)
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
    supportsAllDrives: true,
  });

  return {
    fileId,
    webViewLink: response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
  };
}

/**
 * MD 파일 업데이트
 */
export async function updateMarkdownFile(
  fileId: string,
  content: string
): Promise<void> {
  const drive = await getDriveClient();

  await drive.files.update({
    fileId,
    media: {
      mimeType: 'text/markdown',
      body: content,
    },
    supportsAllDrives: true,
  });
}

/**
 * 파일 삭제
 */
export async function deleteFile(fileId: string): Promise<void> {
  const drive = await getDriveClient();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

/**
 * 파일 내용 조회
 */
export async function getFileContent(fileId: string): Promise<string> {
  const drive = await getDriveClient();

  const response = await drive.files.get({
    fileId,
    alt: 'media',
    supportsAllDrives: true,
  });

  return response.data as string;
}

/**
 * 회의록 파일명 생성
 * 형식: MTG-001_2026-02-11_회의명.md
 */
export function generateMeetingFileName(
  meetingId: string,
  meetingDate: string,
  title: string
): string {
  // 파일명에 사용할 수 없는 문자 제거
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);
  // 날짜에서 시간 부분 제거 (YYYY-MM-DD만)
  const dateOnly = meetingDate.split(' ')[0].split('T')[0];
  return `${meetingId}_${dateOnly}_${safeTitle}.md`;
}

/**
 * 회의록 Markdown 템플릿 생성
 */
export function generateMeetingMarkdown(content: MeetingMinutesContent): string {
  const attendeesTable = content.attendees && content.attendees.length > 0
    ? `| 소속 | 직위 | 성명 |
|------|------|------|
${content.attendees.map((a: Attendee) => `| ${a.department || '-'} | ${a.position || '-'} | ${a.name || '-'} |`).join('\n')}`
    : '(참석자 정보 없음)';

  return `# ${content.title}

## 기본 정보

- **주관부서**: ${content.hostDepartment || '-'}
- **장소**: ${content.location || '-'}
- **회의일시**: ${content.meetingDate || '-'}

---

## 참석자

${attendeesTable}

---

## 안건

${content.agenda || '(안건 없음)'}

---

## 회의내용

${content.discussion || '(내용 없음)'}

---

## 결정사항

${content.decisions || '(결정사항 없음)'}

---

## 향후일정

${content.nextSteps || '(향후일정 없음)'}

---

*Generated by R&D 프로젝트 관리 시스템*
`;
}

/**
 * Drive 연결 상태 확인
 */
export async function checkDriveConnection(): Promise<{
  connected: boolean;
  rootFolderId: string;
  rootFolderName?: string;
  error?: string;
}> {
  try {
    const drive = await getDriveClient();
    const rootId = getRootFolderId();

    // 루트 폴더 정보 조회
    const response = await drive.files.get({
      fileId: rootId,
      fields: 'id, name',
      supportsAllDrives: true,
    });

    return {
      connected: true,
      rootFolderId: rootId,
      rootFolderName: response.data.name || undefined,
    };
  } catch (error) {
    return {
      connected: false,
      rootFolderId: ROOT_FOLDER_ID || '',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}
