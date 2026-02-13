/**
 * 고객사 마스터 데이터 API
 *
 * GET /api/master/customers - 고객사 목록 조회
 * POST /api/master/customers - 고객사 추가
 * DELETE /api/master/customers - 고객사 삭제
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getSheetsClient,
  getSpreadsheetId,
  SHEET_NAMES,
} from '@/lib/google/sheets';
import type { Customer, CustomersResponse } from '@/types';

// 고객사 시트 컬럼 정의
const CUSTOMER_COLUMNS = {
  ID: 0,
  NAME: 1,
  ORDER: 2,
  IS_ACTIVE: 3,
  CREATED_AT: 4,
  UPDATED_AT: 5,
};

/**
 * 행 데이터를 Customer 객체로 변환
 */
function rowToCustomer(row: string[]): Customer {
  return {
    id: row[CUSTOMER_COLUMNS.ID] || '',
    name: row[CUSTOMER_COLUMNS.NAME] || '',
    order: parseInt(row[CUSTOMER_COLUMNS.ORDER] || '0', 10),
    isActive: row[CUSTOMER_COLUMNS.IS_ACTIVE] !== 'false',
    createdAt: row[CUSTOMER_COLUMNS.CREATED_AT] || '',
    updatedAt: row[CUSTOMER_COLUMNS.UPDATED_AT] || '',
  };
}

/**
 * GET: 고객사 목록 조회
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // Customers 시트에서 데이터 읽기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.CUSTOMERS}!A2:F`,
    });

    const rows = response.data.values || [];

    // 활성화된 고객사만 필터링하고 순서대로 정렬
    const customers: Customer[] = rows
      .map(rowToCustomer)
      .filter((c) => c.isActive && c.name)
      .sort((a, b) => a.order - b.order);

    const result: CustomersResponse = {
      customers,
      total: customers.length,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('고객사 목록 조회 실패:', error);

    // 시트가 없는 경우 빈 배열 반환
    if (
      error instanceof Error &&
      error.message.includes('Unable to parse range')
    ) {
      return NextResponse.json({ customers: [], total: 0 });
    }

    return NextResponse.json(
      { error: '고객사 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST: 고객사 추가
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
      return NextResponse.json({ error: '고객사명을 입력하세요.' }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // 기존 데이터 조회 (중복 체크 및 order 계산)
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.CUSTOMERS}!A2:F`,
    });

    const existingRows = existingResponse.data.values || [];
    const existingCustomers = existingRows.map(rowToCustomer);

    // 중복 체크
    if (existingCustomers.some(c => c.name === name.trim() && c.isActive)) {
      return NextResponse.json({ error: '이미 존재하는 고객사입니다.' }, { status: 400 });
    }

    // 새 ID 생성
    const maxId = existingCustomers.reduce((max, c) => {
      const num = parseInt(c.id.replace('CUS-', ''), 10);
      return num > max ? num : max;
    }, 0);
    const newId = `CUS-${String(maxId + 1).padStart(3, '0')}`;

    // 새 order 계산
    const maxOrder = existingCustomers.reduce((max, c) => (c.order > max ? c.order : max), 0);

    const now = new Date().toISOString();
    const newRow = [newId, name.trim(), String(maxOrder + 1), 'true', now, now];

    // 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAMES.CUSTOMERS}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [newRow],
      },
    });

    return NextResponse.json({
      success: true,
      customer: {
        id: newId,
        name: name.trim(),
        order: maxOrder + 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error('고객사 추가 실패:', error);
    return NextResponse.json({ error: '고객사 추가에 실패했습니다.' }, { status: 500 });
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
      range: `${SHEET_NAMES.CUSTOMERS}!A2:F`,
    });

    const existingRows = existingResponse.data.values || [];
    const customers = existingRows
      .map(rowToCustomer)
      .filter((c) => c.isActive)
      .sort((a, b) => a.order - b.order);

    // 이동할 항목 찾기
    const currentIndex = customers.findIndex((c) => c.id === id);
    if (currentIndex === -1) {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 유효한 순서 범위 체크
    const targetOrder = Math.max(1, Math.min(newOrder, customers.length));
    const targetIndex = targetOrder - 1;

    if (currentIndex === targetIndex) {
      return NextResponse.json({ success: true }); // 이미 해당 위치
    }

    // 새 순서 계산: 항목을 제거하고 새 위치에 삽입
    const reorderedCustomers = [...customers];
    const [movedItem] = reorderedCustomers.splice(currentIndex, 1);
    reorderedCustomers.splice(targetIndex, 0, movedItem);

    // 모든 항목의 순서를 1부터 다시 매김
    const now = new Date().toISOString();
    const updates: { range: string; values: string[][] }[] = [];

    reorderedCustomers.forEach((customer, index) => {
      const newOrderValue = index + 1;
      if (customer.order !== newOrderValue) {
        // 시트에서 해당 행 찾기
        const rowIndex = existingRows.findIndex((row) => row[CUSTOMER_COLUMNS.ID] === customer.id);
        if (rowIndex !== -1) {
          updates.push({
            range: `${SHEET_NAMES.CUSTOMERS}!C${rowIndex + 2}`,
            values: [[String(newOrderValue)]],
          });
          updates.push({
            range: `${SHEET_NAMES.CUSTOMERS}!F${rowIndex + 2}`,
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
    console.error('고객사 순서 변경 실패:', error);
    return NextResponse.json({ error: '순서 변경에 실패했습니다.' }, { status: 500 });
  }
}

/**
 * PUT: 고객사 순서 변경
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
      range: `${SHEET_NAMES.CUSTOMERS}!A2:F`,
    });

    const existingRows = existingResponse.data.values || [];
    const customers = existingRows.map(rowToCustomer).filter((c) => c.isActive);

    // 현재 항목 찾기
    const currentIndex = customers.findIndex((c) => c.id === id);
    if (currentIndex === -1) {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 교환할 대상 찾기
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= customers.length) {
      return NextResponse.json({ error: '이동할 수 없습니다.' }, { status: 400 });
    }

    const currentCustomer = customers[currentIndex];
    const targetCustomer = customers[targetIndex];

    // 실제 시트에서의 행 번호 찾기
    const currentRowIndex = existingRows.findIndex((row) => row[CUSTOMER_COLUMNS.ID] === currentCustomer.id);
    const targetRowIndex = existingRows.findIndex((row) => row[CUSTOMER_COLUMNS.ID] === targetCustomer.id);

    // order 값 교환
    const now = new Date().toISOString();
    const updates = [
      {
        range: `${SHEET_NAMES.CUSTOMERS}!C${currentRowIndex + 2}:C${currentRowIndex + 2}`,
        values: [[String(targetCustomer.order)]],
      },
      {
        range: `${SHEET_NAMES.CUSTOMERS}!F${currentRowIndex + 2}:F${currentRowIndex + 2}`,
        values: [[now]],
      },
      {
        range: `${SHEET_NAMES.CUSTOMERS}!C${targetRowIndex + 2}:C${targetRowIndex + 2}`,
        values: [[String(currentCustomer.order)]],
      },
      {
        range: `${SHEET_NAMES.CUSTOMERS}!F${targetRowIndex + 2}:F${targetRowIndex + 2}`,
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
    console.error('고객사 순서 변경 실패:', error);
    return NextResponse.json({ error: '순서 변경에 실패했습니다.' }, { status: 500 });
  }
}

/**
 * DELETE: 고객사 삭제 (실제 행 삭제)
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

    const customersSheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === SHEET_NAMES.CUSTOMERS
    );

    if (!customersSheet?.properties?.sheetId) {
      return NextResponse.json({ error: '시트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const sheetId = customersSheet.properties.sheetId;

    // 기존 데이터 조회
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.CUSTOMERS}!A2:F`,
    });

    const existingRows = existingResponse.data.values || [];

    // 삭제할 행 찾기
    const rowIndex = existingRows.findIndex(row => row[CUSTOMER_COLUMNS.ID] === id);
    if (rowIndex === -1) {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다.' }, { status: 404 });
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
    console.error('고객사 삭제 실패:', error);
    return NextResponse.json({ error: '고객사 삭제에 실패했습니다.' }, { status: 500 });
  }
}
