/**
 * Google Apps Script cho K76.A11 Map
 *
 * HƯỚNG DẪN DEPLOY:
 * 1. Mở Google Sheet của bạn
 * 2. Chọn Extensions > Apps Script
 * 3. Dán toàn bộ code này vào editor
 * 4. Click Deploy > New deployment > Web app
 * 5. Execute as: "Me" | Who has access: "Anyone"
 * 6. Copy URL deployment, dán vào localStorage của trang web:
 *    localStorage.setItem('gas_url', 'YOUR_DEPLOYMENT_URL')
 *    hoặc nhập khi ứng dụng yêu cầu
 */

// ⚠️ QUAN TRỌNG: Điền ID Google Sheet của bạn vào đây
// Cách lấy: Mở Google Sheet → nhìn URL dạng:
// https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
// Sao chép phần [SPREADSHEET_ID] và dán vào bên dưới
const SPREADSHEET_ID = 'THAY_BANG_ID_CUA_BAN';

const SHEET_NAME = 'Sheet1'; // Tên tab sheet (góc dưới màn hình)

function getSheet() {
  // Thử getActiveSpreadsheet trước (nếu script gắn với Sheet)
  // Nếu không được thì dùng openById
  const ss = SpreadsheetApp.getActiveSpreadsheet()
          || SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const payload = JSON.parse(e.postData.contents);
    let result;
    if (payload.action === 'update') {
      result = updateRow(payload.row);
    } else if (payload.action === 'updateCoords') {
      result = updateCoords(payload.name, payload.lat, payload.lon);
    } else {
      result = { status: 'error', message: 'Unknown action' };
    }
    return buildResponse(result);
  } catch(err) {
    return buildResponse({ status: 'error', message: err.message });
  } finally {
    lock.releaseLock();
  }
}

function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const action = e.parameter.action;
    if (action === 'updateCoords') {
      const name = e.parameter.name || '';
      const lat  = parseFloat(e.parameter.lat);
      const lon  = parseFloat(e.parameter.lon);
      if (!name || isNaN(lat) || isNaN(lon))
        return buildResponse({ status: 'error', message: 'Thiếu tham số name/lat/lon' });
      return buildResponse(updateCoords(name, lat, lon));
    }
    if (action === 'update') {
      const data = e.parameter.data || '';
      if (!data) return buildResponse({ status: 'error', message: 'Thiếu tham số data' });
      const row = JSON.parse(data);
      return buildResponse(updateRow(row));
    }
    if (action === 'getGallery') return buildResponse(getTabData('Gallery'));
    if (action === 'getBooks')   return buildResponse(getTabData('Books'));
    if (action === 'addGallery') {
      const data = e.parameter.data || '';
      if (!data) return buildResponse({ status: 'error', message: 'Thiếu tham số data' });
      return buildResponse(appendTabRow('Gallery', JSON.parse(data), ['title','desc','url','type','videoId']));
    }
    if (action === 'addBook') {
      const data = e.parameter.data || '';
      if (!data) return buildResponse({ status: 'error', message: 'Thiếu tham số data' });
      return buildResponse(appendTabRow('Books', JSON.parse(data), ['title','desc','url','tag','icon']));
    }
    if (action === 'deleteGallery' || action === 'deleteBook') {
      const tab   = action === 'deleteGallery' ? 'Gallery' : 'Books';
      const index = parseInt(e.parameter.index);
      if (isNaN(index)) return buildResponse({ status: 'error', message: 'Thiếu index' });
      return buildResponse(deleteTabRow(tab, index));
    }
    // Ping / test kết nối
    return buildResponse({ status: 'ok', message: 'K76.A11 Apps Script running' });
  } catch(err) {
    return buildResponse({ status: 'error', message: err.message });
  } finally {
    lock.releaseLock();
  }
}

function updateRow(row) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());

  const nameCol = findCol(headers, ['name', 'tên', 'ho_ten', 'họ và tên']);
  const idCol   = findCol(headers, ['id']);

  const rowName = String(row['name'] || '').trim().toLowerCase();
  const rowId   = String(row['ID'] || '').trim();

  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    const cellName = String(data[i][nameCol] || '').trim().toLowerCase();
    const cellId   = String(data[i][idCol]   || '').trim();
    if ((rowId && cellId === rowId) || (rowName && cellName === rowName)) {
      targetRow = i + 1; // 1-based
      break;
    }
  }

  if (targetRow === -1) {
    // Thêm dòng mới
    sheet.appendRow(buildRowArray(row, headers));
    return { status: 'ok', message: 'Đã thêm dòng mới' };
  }

  // Cập nhật từng cột
  const mapping = {
    'name': ['name','tên','ho_ten'],
    'latitude': ['latitude','lat'],
    'longtitude': ['longitude','longtitude','lon'],
    'trạng thái': ['trạng thái','status','trang_thai'],
    'địa chỉ nhà riêng': ['địa chỉ nhà riêng','home_address'],
    'địa chỉ cơ quan': ['địa chỉ cơ quan','office_address'],
    'cơ quan công tác': ['cơ quan công tác','company','organization'],
    'điện thoại 1': ['điện thoại 1','phone1'],
    'điện thoại 2': ['điện thoại 2','phone2'],
    'facebook': ['facebook'],
    'chức vụ': ['chức vụ','title'],
  };

  Object.entries(mapping).forEach(([rowKey, headerAliases]) => {
    const col = findCol(headers, headerAliases);
    if (col !== -1 && row[rowKey] !== undefined) {
      sheet.getRange(targetRow, col + 1).setValue(row[rowKey]);
    }
  });

  return { status: 'ok', message: 'Đã cập nhật' };
}

function updateCoords(name, lat, lon) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());

  const nameCol = findCol(headers, ['name', 'tên', 'ho_ten', 'họ và tên']);
  const idCol   = findCol(headers, ['id']);
  const latCol  = findCol(headers, ['latitude', 'lat']);
  const lonCol  = findCol(headers, ['longitude', 'longtitude', 'lon']);

  const normName = normalize(name);

  for (let i = 1; i < data.length; i++) {
    const cellName = normalize(String(data[i][nameCol] || ''));
    const cellId   = String(data[i][idCol] || '').trim();
    if (cellName === normName || cellId === name.trim()) {
      const rowNum = i + 1;
      if (latCol !== -1) sheet.getRange(rowNum, latCol + 1).setValue(lat);
      if (lonCol !== -1) sheet.getRange(rowNum, lonCol + 1).setValue(lon);
      return { status: 'ok', message: `Đã cập nhật tọa độ cho "${name}"` };
    }
  }
  return { status: 'error', message: `Không tìm thấy "${name}" trong danh sách` };
}

function findCol(headers, aliases) {
  for (const alias of aliases) {
    const idx = headers.findIndex(h => h === alias || h.includes(normalize(alias)));
    if (idx !== -1) return idx;
  }
  return -1;
}

function normalize(s) {
  return String(s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function getTabData(tabName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
          || SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) return { status: 'ok', data: [] };
  const vals = sheet.getDataRange().getValues();
  if (vals.length < 2) return { status: 'ok', data: [] };
  const headers = vals[0].map(h => String(h).trim());
  const data = vals.slice(1)
    .filter(r => r.some(c => String(c).trim() !== ''))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = String(r[i] || '').trim(); });
      return obj;
    });
  return { status: 'ok', data };
}

function appendTabRow(tabName, item, defaultHeaders) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
          || SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(defaultHeaders);
    sheet.setFrozenRows(1);
  }
  const lastCol = Math.max(sheet.getLastColumn(), defaultHeaders.length);
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const row = headerRow.map(h => (item[h] !== undefined ? item[h] : ''));
  sheet.appendRow(row);
  return { status: 'ok', message: 'Đã thêm thành công' };
}

function deleteTabRow(tabName, dataIndex) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
          || SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) return { status: 'error', message: 'Sheet không tồn tại' };
  // dataIndex là 0-based trong data rows (row 1 = header)
  const sheetRow = dataIndex + 2;
  if (sheetRow > sheet.getLastRow()) return { status: 'error', message: 'Index ngoài phạm vi' };
  sheet.deleteRow(sheetRow);
  return { status: 'ok', message: 'Đã xóa' };
}

function buildRowArray(row, headers) {
  const map = {
    'id': row['ID'],
    'name': row['name'],
    'tên': row['name'],
    'latitude': row['latitude'],
    'lat': row['latitude'],
    'longitude': row['longtitude'],
    'longtitude': row['longtitude'],
    'lon': row['longtitude'],
    'trạng thái': row['trạng thái'],
    'địa chỉ nhà riêng': row['địa chỉ nhà riêng'],
    'địa chỉ cơ quan': row['địa chỉ cơ quan'],
    'cơ quan công tác': row['cơ quan công tác'],
    'điện thoại 1': row['điện thoại 1'],
    'điện thoại 2': row['điện thoại 2'],
    'facebook': row['facebook'],
    'chức vụ': row['chức vụ'],
  };
  return headers.map(h => map[h] !== undefined ? map[h] : '');
}
