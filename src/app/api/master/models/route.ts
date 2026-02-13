/**
 * 모델 마스터 데이터 API
 *
 * GET /api/master/models - 모델 목록 조회
 * POST /api/master/models - 모델 추가
 * DELETE /api/master/models - 모델 삭제
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getSheetsClient,
  getSpreadsheetId,
  SHEET_NAMES,
} from '@/lib/google/sheets';
import type { Model, ModelsResponse } from '@/types';

// 모델 시트 컬럼 정의
const MODEL_COLUMNS = {
  ID: 0,
  NAME: 1,
  ORDER: 2,
  IS_ACTIVE: 3,
  CREATED_AT: 4,
  UPDATED_AT: 5,
};

/**
 * 행 데이터를 Model 객체로 변환
 */
function rowToModel(row: string[]): Model {
  return {
    id: row[MODEL_COLUMNS.ID] || '',
    name: row[MODEL_COLUMNS.NAME] || '',
    order: parseInt(row[MODEL_COLUMNS.ORDER] || '0', 10),
    isActive: row[MODEL_COLUMNS.IS_ACTIVE] !== 'false',
    createdAt: row[MODEL_COLUMNS.CREATED_AT] || '',
    updatedAt: row[MODEL_COLUMNS.UPDATED_AT] || '',
  };
}

/**
 * GET: 모델 목록 조회
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // Models 시트에서 데이터 읽기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.MODELS}!A2:F`,
    });

    const rows = response.data.values || [];

    // 활성화된 모델만 필터링하고 순서대로 정렬
    const models: Model[] = rows
      .map(rowToModel)
      .filter((m) => m.isActive && m.name)
      .sort((a, b) => a.order - b.order);

    const result: ModelsResponse = {
      models,
      total: models.length,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('모델 목록 조회 실패:', error);

    // 시트가 없는 경우 빈 배열 반환
    if (
      error instanceof Error &&
      error.message.includes('Unable to parse range')
    ) {
      return NextResponse.json({ models: [], total: 0 });
    }

    return NextResponse.json(
      { error: '모델 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST: 모델 추가
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // sysadmin 권한 확인
    if (session.user.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: '모델명을 입력하세요.' }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // 기존 데이터 조회 (중복 체크 및 order 계산)
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.MODELS}!A2:F`,
    });

    const existingRows = existingResponse.data.values || [];
    const existingModels = existingRows.map(rowToModel);

    // 중복 체크
    if (existingModels.some(m => m.name === name.trim() && m.isActive)) {
      return NextResponse.json({ error: '이미 존재하는 모델입니다.' }, { status: 400 });
    }

    // 새 ID 생성
    const maxId = existingModels.reduce((max, m) => {
      const num = parseInt(m.id.replace('MOD-', ''), 10);
      return num > max ? num : max;
    }, 0);
    const newId = `MOD-${String(maxId + 1).padStart(3, '0')}`;

    // 새 order 계산
    const maxOrder = existingModels.reduce((max, m) => (m.order > max ? m.order : max), 0);

    const now = new Date().toISOString();
    const newRow = [newId, name.trim(), String(maxOrder + 1), 'true', now, now];

    // 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAMES.MODELS}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [newRow],
      },
    });

    return NextResponse.json({
      success: true,
      model: {
        id: newId,
        name: name.trim(),
        order: maxOrder + 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error('모델 추가 실패:', error);
    return NextResponse.json({ error: '모델 추가에 실패했습니다.' }, { status: 500 });
  }
}

/**
 * 직접 순서 변경 (특정 위치로 이동)
 */
async function handleDirectOrderChange(id: string, newOrder: number) {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // 기존 데이터 조회
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.MODELS}!A2:F`,
    });

    const existingRows = existingResponse.data.values || [];
    const models = existingRows
      .map(rowToModel)
      .filter((m) => m.isActive)
      .sort((a, b) => a.order - b.order);

    // 이동할 항목 찾기
    const currentIndex = models.findIndex((m) => m.id === id);
    if (currentIndex === -1) {
      return NextResponse.json({ error: '모델을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 유효한 순서 범위 체크
    const targetOrder = Math.max(1, Math.min(newOrder, models.length));
    const targetIndex = targetOrder - 1;

    if (currentIndex === targetIndex) {
      return NextResponse.json({ success: true }); // 이미 해당 위치
    }

    // 새 순서 계산: 항목을 제거하고 새 위치에 삽입
    const reorderedModels = [...models];
    const [movedItem] = reorderedModels.splice(currentIndex, 1);
    reorderedModels.splice(targetIndex, 0, movedItem);

    // 모든 항목의 순서를 1부터 다시 매김
    const now = new Date().toISOString();
    const updates: { range: string; values: string[][] }[] = [];

    reorderedModels.forEach((model, index) => {
      const newOrderValue = index + 1;
      if (model.order !== newOrderValue) {
        // 시트에서 해당 행 찾기
        const rowIndex = existingRows.findIndex((row) => row[MODEL_COLUMNS.ID] === model.id);
        if (rowIndex !== -1) {
          updates.push({
            range: `${SHEET_NAMES.MODELS}!C${rowIndex + 2}`,
            values: [[String(newOrderValue)]],
          });
          updates.push({
            range: `${SHEET_NAMES.MODELS}!F${rowIndex + 2}`,
            values: [[now]],
          });
        }
      }
    });

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('모델 순서 변경 실패:', error);
    return NextResponse.json({ error: '순서 변경에 실패했습니다.' }, { status: 500 });
  }
}

/**
 * PUT: 모델 순서 변경
 */
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // sysadmin 권한 확인
    if (session.user.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, direction, newOrder } = body;

    // newOrder가 있으면 직접 순서 변경, 없으면 up/down 방식
    if (newOrder !== undefined) {
      return handleDirectOrderChange(id, newOrder);
    }

    if (!id || !direction || !['up', 'down'].includes(direction)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // 기존 데이터 조회
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.MODELS}!A2:F`,
    });

    const existingRows = existingResponse.data.values || [];
    const models = existingRows.map(rowToModel).filter((m) => m.isActive);

    // 현재 항목 찾기
    const currentIndex = models.findIndex((m) => m.id === id);
    if (currentIndex === -1) {
      return NextResponse.json({ error: '모델을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 교환할 대상 찾기
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= models.length) {
      return NextResponse.json({ error: '이동할 수 없습니다.' }, { status: 400 });
    }

    const currentModel = models[currentIndex];
    const targetModel = models[targetIndex];

    // 실제 시트에서의 행 번호 찾기
    const currentRowIndex = existingRows.findIndex((row) => row[MODEL_COLUMNS.ID] === currentModel.id);
    const targetRowIndex = existingRows.findIndex((row) => row[MODEL_COLUMNS.ID] === targetModel.id);

    // order 값 교환
    const now = new Date().toISOString();
    const updates = [
      {
        range: `${SHEET_NAMES.MODELS}!C${currentRowIndex + 2}:C${currentRowIndex + 2}`,
        values: [[String(targetModel.order)]],
      },
      {
        range: `${SHEET_NAMES.MODELS}!F${currentRowIndex + 2}:F${currentRowIndex + 2}`,
        values: [[now]],
      },
      {
        range: `${SHEET_NAMES.MODELS}!C${targetRowIndex + 2}:C${targetRowIndex + 2}`,
        values: [[String(currentModel.order)]],
      },
      {
        range: `${SHEET_NAMES.MODELS}!F${targetRowIndex + 2}:F${targetRowIndex + 2}`,
        values: [[now]],
      },
    ];

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('모델 순서 변경 실패:', error);
    return NextResponse.json({ error: '순서 변경에 실패했습니다.' }, { status: 500 });
  }
}

/**
 * DELETE: 모델 삭제 (실제 행 삭제)
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // sysadmin 권한 확인
    if (session.user.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID를 입력하세요.' }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // 스프레드시트 정보 조회 (시트 ID 얻기)
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const modelsSheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === SHEET_NAMES.MODELS
    );

    if (!modelsSheet?.properties?.sheetId) {
      return NextResponse.json({ error: '시트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const sheetId = modelsSheet.properties.sheetId;

    // 기존 데이터 조회
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.MODELS}!A2:F`,
    });

    const existingRows = existingResponse.data.values || [];

    // 삭제할 행 찾기
    const rowIndex = existingRows.findIndex(row => row[MODEL_COLUMNS.ID] === id);
    if (rowIndex === -1) {
      return NextResponse.json({ error: '모델을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 실제 행 삭제 (헤더가 1행이므로 rowIndex + 2가 실제 행 번호, 0-indexed이므로 rowIndex + 1)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex + 1, // 헤더 다음 행부터 시작 (0-indexed)
                endIndex: rowIndex + 2,   // endIndex는 exclusive
              },
            },
          },
        ],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('모델 삭제 실패:', error);
    return NextResponse.json({ error: '모델 삭제에 실패했습니다.' }, { status: 500 });
  }
}
