/**
 * Tách đơn nhập nhà – Apps Script cho danh mục dùng chung (Google Sheets).
 *
 * Cách dùng: xem HUONG-DAN.md. Tóm tắt:
 *   1. Mở file Google Sheets → Tiện ích mở rộng → Apps Script → dán toàn bộ file này.
 *   2. Chạy hàm khoiTao() 1 lần (tạo đủ các sheet).
 *   3. Chạy hàm caiDatSaoLuuTuDong() 1 lần (sao lưu tự động mỗi ngày khoảng 23h).
 *   4. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 *
 * Các sheet:
 *   SKU_NHA           key | sku | ten | nha | nguon | cap_nhat
 *   COMBO             combo_id | ten_combo | khoa | cap_nhat | cach_xuat | ma_he_thong | ten_xuat | nha
 *                     (khoa cách nhau bằng " ;; " ; cach_xuat = tach | nguyen ; trống = tach)
 *   COMBO_THANH_PHAN  combo_id | sku | ten | nha | gia_goc | so_luong
 *   LICH_SU           thoi_gian | hanh_dong | khoa | du_lieu_cu | du_lieu_moi   (chỉ thêm dòng)
 *
 * API:
 *   GET  <url>                  → { ok, skus, combos }
 *   GET  <url>?action=lichSu    → { ok, lich_su }   (100 thay đổi gần nhất, mới nhất trước)
 *   POST <url>  body {action, data}  (Content-Type: text/plain)
 *        action: ping, upsertSku, upsertSkuBatch, deleteSku, upsertCombo, addComboKey, doiKhoaCombo, deleteCombo, importBatch
 *        → { ok, catalog, ... }  hoặc  { ok: false, error }
 */

var SH = { SKU: 'SKU_NHA', COMBO: 'COMBO', TP: 'COMBO_THANH_PHAN', LS: 'LICH_SU' };
var COT = {
  SKU_NHA: ['key', 'sku', 'ten', 'nha', 'nguon', 'cap_nhat'],
  COMBO: ['combo_id', 'ten_combo', 'khoa', 'cap_nhat', 'cach_xuat', 'ma_he_thong', 'ten_xuat', 'nha'],
  COMBO_THANH_PHAN: ['combo_id', 'sku', 'ten', 'nha', 'gia_goc', 'so_luong'],
  LICH_SU: ['thoi_gian', 'hanh_dong', 'khoa', 'du_lieu_cu', 'du_lieu_moi']
};
// Cột lưu dạng chữ (tránh Google Sheets tự đổi mã vạch thành số / ngày tháng)
var COT_CHU = {
  SKU_NHA: 6, COMBO: 8, COMBO_THANH_PHAN: 4, LICH_SU: 5
};
var NHA_SKU = ['HA', 'KV', 'ML', 'KHONG_NHAP'];
var NHA_TP = ['HA', 'KV', 'ML', 'KHAC'];
var NHA_CHINH = ['HA', 'KV', 'ML'];
var TACH_KHOA = ' ;; ';
var SO_BAN_SAO_LUU = 30;
var GIO_SAO_LUU = 23;
var SO_LICH_SU = 100;

/* ===================== Web App ===================== */

function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action;
    if (action === 'lichSu') return traVe_({ ok: true, lich_su: docLichSu_(SO_LICH_SU) });
    var cat = docCatalog_();
    return traVe_({ ok: true, skus: cat.skus, combos: cat.combos });
  } catch (err) {
    return traVe_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return traVe_({ ok: false, error: 'Đang có máy khác ghi danh mục, thử lại sau vài giây nha.' });
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return traVe_(xuLy_(String(body.action || ''), body.data || {}));
  } catch (err) {
    return traVe_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function traVe_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ===================== Xử lý ghi ===================== */

function xuLy_(action, data) {
  if (action === 'ping') return { ok: true };
  var cat = docCatalog_();
  var ctx = { action: action, now: bayGio_(), log: [], doiSku: false, doiCombo: false };
  var extra = {};

  switch (action) {
    case 'upsertSku':
      upsertSku_(cat, data, ctx, true);
      break;
    case 'upsertSkuBatch':
      // Tự học / ghi gom: dòng lỗi bỏ qua, không chặn cả lô; KHÔNG đè dữ liệu gán tay
      extra.soThayDoi = 0;
      (data.items || []).forEach(function (it) {
        try { if (upsertSku_(cat, it, ctx, false)) extra.soThayDoi++; } catch (e) { /* bỏ qua dòng lỗi */ }
      });
      break;
    case 'deleteSku':
      deleteSku_(cat, data, ctx);
      break;
    case 'upsertCombo':
      extra.combo_id = upsertCombo_(cat, data, ctx);
      break;
    case 'addComboKey':
      addComboKey_(cat, data, ctx);
      break;
    case 'doiKhoaCombo':
      doiKhoaCombo_(cat, data, ctx);
      break;
    case 'deleteCombo':
      deleteCombo_(cat, data, ctx);
      break;
    case 'importBatch':
      extra.loi = [];
      (data.skus || []).forEach(function (it, i) {
        try { upsertSku_(cat, it, ctx, true); } catch (e) { extra.loi.push('SKU #' + (i + 1) + ': ' + e.message); }
      });
      (data.combos || []).forEach(function (it, i) {
        try { upsertCombo_(cat, it, ctx); } catch (e) { extra.loi.push('Combo #' + (i + 1) + ': ' + e.message); }
      });
      break;
    default:
      throw new Error('Hành động không hợp lệ: ' + action);
  }

  if (ctx.doiSku) ghiBang_(SH.SKU, cat.skus);
  if (ctx.doiCombo) {
    ghiBang_(SH.COMBO, cat.combos.map(function (c) {
      return { combo_id: c.combo_id, ten_combo: c.ten_combo, khoa: c.khoa.join(TACH_KHOA), cap_nhat: c.cap_nhat,
               cach_xuat: c.cach_xuat, ma_he_thong: c.ma_he_thong, ten_xuat: c.ten_xuat, nha: c.nha };
    }));
    var tps = [];
    cat.combos.forEach(function (c) {
      c.thanh_phan.forEach(function (t) {
        tps.push({ combo_id: c.combo_id, sku: t.sku, ten: t.ten, nha: t.nha, gia_goc: t.gia_goc, so_luong: t.so_luong });
      });
    });
    ghiBang_(SH.TP, tps);
  }
  ghiLichSu_(ctx.log);

  var out = { ok: true, catalog: cat, soThayDoiLichSu: ctx.log.length };
  Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

function chuoi_(v) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim(); }

function upsertSku_(cat, d, ctx, choGhiDeTay) {
  var key = chuoi_(d.key);
  var nha = chuoi_(d.nha).toUpperCase();
  var nguon = chuoi_(d.nguon) === 'tu_hoc' ? 'tu_hoc' : 'tay';
  if (!key) throw new Error('Thiếu khóa (key).');
  if (!/^(sku|ten):/.test(key)) throw new Error('Khóa không hợp lệ: ' + key);
  if (NHA_SKU.indexOf(nha) < 0) throw new Error('Nhà không hợp lệ: ' + d.nha);
  var i = timViTri_(cat.skus, 'key', key);
  var cu = i >= 0 ? cat.skus[i] : null;
  // Nhãn "tay" luôn ưu tiên hơn "tu_hoc": tự học không bao giờ ghi đè gán tay
  if (cu && cu.nguon === 'tay' && nguon === 'tu_hoc') return false;
  if (!choGhiDeTay && cu && cu.nguon === 'tay') return false;
  var moi = { key: key, sku: chuoi_(d.sku), ten: chuoi_(d.ten) || (cu ? cu.ten : ''), nha: nha, nguon: nguon, cap_nhat: ctx.now };
  if (cu && cu.nha === moi.nha && cu.nguon === moi.nguon && cu.sku === moi.sku && cu.ten === moi.ten) return false;
  if (i >= 0) cat.skus[i] = moi; else cat.skus.push(moi);
  ctx.doiSku = true;
  ghiLog_(ctx, ctx.action, key, cu, moi);
  return true;
}

function deleteSku_(cat, d, ctx) {
  var key = chuoi_(d.key);
  var i = timViTri_(cat.skus, 'key', key);
  if (i < 0) throw new Error('Không tìm thấy SKU trong danh mục (có thể máy khác vừa xóa).');
  var cu = cat.skus.splice(i, 1)[0];
  ctx.doiSku = true;
  ghiLog_(ctx, 'deleteSku', key, cu, null);
}

function chuanCombo_(d) {
  var ten = chuoi_(d.ten_combo);
  if (!ten) throw new Error('Thiếu tên combo.');
  var khoa = [];
  [].concat(d.khoa || []).forEach(function (k) {
    k = chuoi_(k);
    if (k && khoa.indexOf(k) < 0) khoa.push(k);
  });
  if (!khoa.length) throw new Error('Combo "' + ten + '" chưa có khóa nhận diện.');
  var cachXuat = chuoi_(d.cach_xuat) === 'nguyen' ? 'nguyen' : 'tach';
  var nha = chuoi_(d.nha).toUpperCase();
  if (cachXuat === 'nguyen' && NHA_CHINH.indexOf(nha) < 0) throw new Error('Combo "' + ten + '" xuất nguyên combo cần chọn nhà HA / KV / ML.');
  if (nha && NHA_CHINH.indexOf(nha) < 0) nha = '';
  var tps = (d.thanh_phan || []).map(function (t) {
    var nha = chuoi_(t.nha).toUpperCase();
    if (NHA_TP.indexOf(nha) < 0) throw new Error('Nhà của thành phần không hợp lệ: ' + t.nha);
    var tenTp = chuoi_(t.ten);
    if (!tenTp) throw new Error('Thành phần thiếu tên sách.');
    return {
      sku: chuoi_(t.sku), ten: tenTp, nha: nha,
      gia_goc: Number(t.gia_goc) || 0, so_luong: Math.max(1, Math.round(Number(t.so_luong) || 1))
    };
  });
  // "Xuất nguyên combo" không bắt buộc thành phần; "Tách thành từng cuốn" thì bắt buộc
  if (!tps.length && cachXuat === 'tach') throw new Error('Combo "' + ten + '" chưa có thành phần.');
  return { ten_combo: ten, khoa: khoa, thanh_phan: tps, cach_xuat: cachXuat,
           ma_he_thong: chuoi_(d.ma_he_thong), ten_xuat: chuoi_(d.ten_xuat), nha: nha };
}

/* Mỗi khóa chỉ thuộc 1 combo: gắn khóa vào combo này thì gỡ khỏi combo khác (có ghi lịch sử) */
function goKhoaKhoiComboKhac_(cat, khoa, giuId, ctx) {
  cat.combos.forEach(function (c) {
    if (c.combo_id === giuId) return;
    var j = c.khoa.indexOf(khoa);
    if (j < 0) return;
    var cu = saoChep_(c);
    c.khoa.splice(j, 1);
    c.cap_nhat = ctx.now;
    ctx.doiCombo = true;
    ghiLog_(ctx, 'boKhoa', khoa, cu, c);
  });
}

function idMoi_(cat) {
  var max = 0;
  cat.combos.forEach(function (c) {
    var m = /^C(\d+)$/.exec(c.combo_id);
    if (m) max = Math.max(max, Number(m[1]));
  });
  var s = String(max + 1);
  while (s.length < 3) s = '0' + s;
  return 'C' + s;
}

function upsertCombo_(cat, d, ctx) {
  var c = chuanCombo_(d);
  var id = chuoi_(d.combo_id) || idMoi_(cat);
  var i = timViTri_(cat.combos, 'combo_id', id);
  var cu = i >= 0 ? saoChep_(cat.combos[i]) : null;
  var moi = { combo_id: id, ten_combo: c.ten_combo, khoa: c.khoa, thanh_phan: c.thanh_phan, cap_nhat: ctx.now,
             cach_xuat: c.cach_xuat, ma_he_thong: c.ma_he_thong, ten_xuat: c.ten_xuat, nha: c.nha };
  c.khoa.forEach(function (k) { goKhoaKhoiComboKhac_(cat, k, id, ctx); });
  if (i >= 0) cat.combos[i] = moi; else cat.combos.push(moi);
  ctx.doiCombo = true;
  ghiLog_(ctx, ctx.action === 'importBatch' ? 'importBatch' : 'upsertCombo', id, cu, moi);
  return id;
}

function addComboKey_(cat, d, ctx) {
  var id = chuoi_(d.combo_id), khoa = chuoi_(d.khoa);
  if (!khoa) throw new Error('Thiếu khóa nhận diện.');
  var i = timViTri_(cat.combos, 'combo_id', id);
  if (i < 0) throw new Error('Không tìm thấy combo ' + id + ' (có thể máy khác vừa xóa).');
  var c = cat.combos[i];
  if (c.khoa.indexOf(khoa) >= 0) return;
  goKhoaKhoiComboKhac_(cat, khoa, id, ctx);
  var cu = saoChep_(c);
  c.khoa.push(khoa);
  c.cap_nhat = ctx.now;
  ctx.doiCombo = true;
  ghiLog_(ctx, 'addComboKey', id, cu, c);
}

/* Đổi khóa cũ (vd "sku:<mã vạch>" trơn) sang khóa mới ("sku:<mã vạch>|<phân loại>") */
function doiKhoaCombo_(cat, d, ctx) {
  var id = chuoi_(d.combo_id), cu = chuoi_(d.khoa_cu);
  var moi = [].concat(d.khoa_moi || []).map(chuoi_).filter(function (k) { return k; });
  if (!moi.length) throw new Error('Thiếu khóa mới.');
  var i = timViTri_(cat.combos, 'combo_id', id);
  if (i < 0) throw new Error('Không tìm thấy combo ' + id + ' (có thể máy khác vừa xóa).');
  var c = cat.combos[i];
  var truoc = saoChep_(c);
  var j = c.khoa.indexOf(cu);
  if (j >= 0) c.khoa.splice(j, 1);
  var them = false;
  moi.forEach(function (k) {
    if (c.khoa.indexOf(k) >= 0) return;
    goKhoaKhoiComboKhac_(cat, k, id, ctx);
    c.khoa.push(k);
    them = true;
  });
  if (j < 0 && !them) return; // đã đổi rồi (máy khác làm trước)
  c.cap_nhat = ctx.now;
  ctx.doiCombo = true;
  ghiLog_(ctx, 'doiKhoaCombo', id, truoc, c);
}

function deleteCombo_(cat, d, ctx) {
  var id = chuoi_(d.combo_id);
  var i = timViTri_(cat.combos, 'combo_id', id);
  if (i < 0) throw new Error('Không tìm thấy combo ' + id + ' (có thể máy khác vừa xóa).');
  var cu = cat.combos.splice(i, 1)[0];
  ctx.doiCombo = true;
  ghiLog_(ctx, 'deleteCombo', id, cu, null);
}

/* ===================== Đọc / ghi sheet ===================== */

function bangTinh_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Script này phải được tạo từ trong file Google Sheets (Tiện ích mở rộng → Apps Script).');
  return ss;
}

function sheet_(ten) {
  var ss = bangTinh_();
  var s = ss.getSheetByName(ten);
  if (!s) {
    s = ss.insertSheet(ten);
    s.getRange(1, 1, 1, COT[ten].length).setValues([COT[ten]]).setFontWeight('bold');
    s.setFrozenRows(1);
  } else {
    // Bản cũ thiếu cột mới (vd COMBO thêm cach_xuat…) → bổ sung tiêu đề; cột mới luôn nằm sau cột cũ
    var dau = s.getRange(1, 1, 1, COT[ten].length).getValues()[0];
    if (dau.join('|') !== COT[ten].join('|')) s.getRange(1, 1, 1, COT[ten].length).setValues([COT[ten]]).setFontWeight('bold');
  }
  return s;
}

function docBang_(ten) {
  var s = sheet_(ten), cols = COT[ten], n = s.getLastRow();
  if (n < 2) return [];
  return s.getRange(2, 1, n - 1, cols.length).getValues()
    .filter(function (r) { return r.some(function (x) { return x !== '' && x !== null; }); })
    .map(function (r) {
      var o = {};
      cols.forEach(function (c, j) { o[c] = r[j] instanceof Date ? dinhDang_(r[j]) : chuoi_(r[j]); });
      return o;
    });
}

function ghiBang_(ten, ds) {
  var s = sheet_(ten), cols = COT[ten], n = s.getLastRow();
  if (n > 1) s.getRange(2, 1, n - 1, cols.length).clearContent();
  if (!ds.length) return;
  s.getRange(2, 1, ds.length, COT_CHU[ten]).setNumberFormat('@');
  s.getRange(2, 1, ds.length, cols.length).setValues(ds.map(function (o) {
    return cols.map(function (c) { return o[c] === undefined || o[c] === null ? '' : o[c]; });
  }));
}

function docCatalog_() {
  var skus = docBang_(SH.SKU);
  var tps = docBang_(SH.TP);
  var combos = docBang_(SH.COMBO).map(function (c) {
    return {
      combo_id: c.combo_id, ten_combo: c.ten_combo, cap_nhat: c.cap_nhat,
      khoa: c.khoa.split(/\s*;;\s*/).map(chuoi_).filter(function (k) { return k; }),
      cach_xuat: c.cach_xuat === 'nguyen' ? 'nguyen' : 'tach', // combo cũ chưa có giá trị → tach
      ma_he_thong: c.ma_he_thong || '', ten_xuat: c.ten_xuat || '', nha: c.nha || '',
      thanh_phan: []
    };
  });
  var theoId = {};
  combos.forEach(function (c) { theoId[c.combo_id] = c; });
  tps.forEach(function (t) {
    var c = theoId[t.combo_id];
    if (c) c.thanh_phan.push({ sku: t.sku, ten: t.ten, nha: t.nha, gia_goc: Number(t.gia_goc) || 0, so_luong: Number(t.so_luong) || 1 });
  });
  return { skus: skus, combos: combos };
}

/* ===================== Lịch sử (chỉ thêm dòng) ===================== */

function ghiLog_(ctx, hanhDong, khoa, cu, moi) {
  ctx.log.push([ctx.now, hanhDong, khoa, cu ? JSON.stringify(cu) : '', moi ? JSON.stringify(moi) : '']);
}

function ghiLichSu_(dong) {
  if (!dong.length) return;
  var s = sheet_(SH.LS), n = s.getLastRow();
  var r = s.getRange(n + 1, 1, dong.length, COT.LICH_SU.length);
  r.setNumberFormat('@');
  r.setValues(dong);
}

function docLichSu_(soDong) {
  var s = sheet_(SH.LS), n = s.getLastRow();
  if (n < 2) return [];
  var tu = Math.max(2, n - soDong + 1);
  return s.getRange(tu, 1, n - tu + 1, COT.LICH_SU.length).getValues().reverse().map(function (r) {
    var o = {};
    COT.LICH_SU.forEach(function (c, j) { o[c] = r[j] instanceof Date ? dinhDang_(r[j]) : String(r[j]); });
    return o;
  });
}

/* ===================== Tiện ích ===================== */

function timViTri_(ds, truong, gt) {
  for (var i = 0; i < ds.length; i++) if (ds[i][truong] === gt) return i;
  return -1;
}
function saoChep_(o) { return JSON.parse(JSON.stringify(o)); }
function muiGio_() { return bangTinh_().getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh'; }
function dinhDang_(d, mau) { return Utilities.formatDate(d, muiGio_(), mau || 'yyyy-MM-dd HH:mm:ss'); }
function bayGio_() { return dinhDang_(new Date()); }

/* ===================== Chạy tay trong trình soạn thảo ===================== */

/** Chạy 1 lần: tạo đủ 4 sheet có dòng tiêu đề. */
function khoiTao() {
  [SH.SKU, SH.COMBO, SH.TP, SH.LS].forEach(sheet_);
  var ss = bangTinh_();
  ss.getSheets().forEach(function (s) {
    if (/^(Sheet1|Trang tính1)$/.test(s.getName()) && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  Logger.log('Đã tạo xong các sheet: SKU_NHA, COMBO, COMBO_THANH_PHAN, LICH_SU.');
}

/** Sao lưu 3 sheet danh mục sang file "Sao lưu danh mục – Tách đơn nhập nhà", giữ 30 bản gần nhất. */
function saoLuuHangNgay() {
  var bk = fileSaoLuu_();
  var ngay = dinhDang_(new Date(), 'yyyy-MM-dd');
  [SH.SKU, SH.COMBO, SH.TP].forEach(function (ten) {
    var tenMoi = ngay + ' ' + ten;
    var cu = bk.getSheetByName(tenMoi);
    if (cu) bk.deleteSheet(cu); // chạy lại trong ngày → thay bản cũ của ngày đó
    sheet_(ten).copyTo(bk).setName(tenMoi);
  });
  // Bỏ sheet trống mặc định của file mới
  bk.getSheets().forEach(function (s) {
    if (!/^\d{4}-\d{2}-\d{2} /.test(s.getName()) && bk.getSheets().length > 1) bk.deleteSheet(s);
  });
  // Giữ 30 bản (ngày) gần nhất
  var ngays = [];
  bk.getSheets().forEach(function (s) {
    var d = s.getName().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && ngays.indexOf(d) < 0) ngays.push(d);
  });
  ngays.sort().reverse();
  var xoa = ngays.slice(SO_BAN_SAO_LUU);
  bk.getSheets().forEach(function (s) {
    if (xoa.indexOf(s.getName().slice(0, 10)) >= 0) bk.deleteSheet(s);
  });
  Logger.log('Đã sao lưu ngày ' + ngay + ' vào: ' + bk.getUrl());
  return bk.getUrl();
}

function fileSaoLuu_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SAO_LUU_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* file đã bị xóa → tạo lại */ }
  }
  var bk = SpreadsheetApp.create('Sao lưu danh mục – Tách đơn nhập nhà');
  props.setProperty('SAO_LUU_ID', bk.getId());
  return bk;
}

/** Chạy 1 lần: cài sao lưu tự động mỗi ngày khoảng 23h (và sao lưu ngay 1 bản để kiểm tra). */
function caiDatSaoLuuTuDong() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'saoLuuHangNgay') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('saoLuuHangNgay').timeBased().everyDays(1).atHour(GIO_SAO_LUU).create();
  var url = saoLuuHangNgay();
  Logger.log('Đã cài sao lưu tự động lúc khoảng ' + GIO_SAO_LUU + 'h mỗi ngày. File sao lưu: ' + url);
}

/**
 * Khôi phục danh mục từ 1 bản sao lưu.
 * Cách dùng: sửa NGAY_KHOI_PHUC bên dưới thành ngày cần lấy lại (dạng 2026-10-03), rồi chạy hàm khoiPhucSaoLuu.
 * Trước khi khôi phục, danh mục hiện tại được sao lưu thêm 1 bản (tên có chữ "truoc-khoi-phuc").
 */
var NGAY_KHOI_PHUC = '2026-10-03';
function khoiPhucSaoLuu() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var bk = fileSaoLuu_();
    var tenBang = [SH.SKU, SH.COMBO, SH.TP];
    tenBang.forEach(function (ten) {
      if (!bk.getSheetByName(NGAY_KHOI_PHUC + ' ' + ten)) throw new Error('Không có bản sao lưu ngày ' + NGAY_KHOI_PHUC + ' (' + ten + ').');
    });
    var gio = dinhDang_(new Date(), 'HHmmss');
    var ss = bangTinh_();
    var ctx = { now: bayGio_(), log: [] };
    tenBang.forEach(function (ten) {
      var hienTai = sheet_(ten);
      hienTai.copyTo(bk).setName('truoc-khoi-phuc ' + gio + ' ' + ten);
      var nguon = bk.getSheetByName(NGAY_KHOI_PHUC + ' ' + ten);
      var duLieu = nguon.getDataRange().getValues().slice(1).filter(function (r) { return r.some(function (x) { return x !== ''; }); });
      var cu = docBang_(ten).length;
      ghiBang_(ten, duLieu.map(function (r) {
        var o = {};
        COT[ten].forEach(function (c, j) { o[c] = r[j] instanceof Date ? dinhDang_(r[j]) : r[j]; });
        return o;
      }));
      ghiLog_(ctx, 'khoiPhuc', ten, { so_dong: cu }, { so_dong: duLieu.length, tu_ngay: NGAY_KHOI_PHUC });
    });
    ghiLichSu_(ctx.log);
    Logger.log('Đã khôi phục danh mục từ bản sao lưu ngày ' + NGAY_KHOI_PHUC + '.');
  } finally {
    lock.releaseLock();
  }
}
