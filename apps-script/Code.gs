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
 *   SKU_NHA           key | sku | ten | nha | nguon | cap_nhat | gia_gan_nhat | ngay_gia | ma_moi | khong_tai_ban
 *                     (ma_moi: mã tái bản thay thế ; khong_tai_ban: các mã đã xác nhận "không phải tái bản", cách nhau " ;; ")
 *   COMBO             combo_id | ten_combo | khoa | cap_nhat | cach_xuat | ma_he_thong | ten_xuat | nha
 *                     (khoa cách nhau bằng " ;; " ; cach_xuat = tach | nguyen ; trống = tach)
 *   COMBO_THANH_PHAN  combo_id | sku | ten | nha | gia_goc | so_luong
 *   LICH_SU           thoi_gian | hanh_dong | khoa | du_lieu_cu | du_lieu_moi   (chỉ thêm dòng)
 *   MA_CHUAN          barcode | ten_gon | gia_bia | ncc | nha | ngay_thay | khong_phai   (sổ mã chuẩn = barcode đơn web)
 *
 * API:
 *   GET  <url>                  → { ok, skus, combos }
 *   GET  <url>?action=lichSu    → { ok, lich_su }   (100 thay đổi gần nhất, mới nhất trước)
 *   POST <url>  body {action, data}  (Content-Type: text/plain)
 *        action: ping, upsertSku, upsertSkuBatch (kèm cập nhật giá), deleteSku, upsertCombo, addComboKey, doiKhoaCombo,
 *                deleteCombo, importBatch, thayMaTaiBan, hoanTacTaiBan, boQuaTaiBan, capNhatGiaCombo,
 *                upsertMaChuan, luuMaPhu, boQuaCungCuon   (upsertSkuBatch nhận thêm maChuan, maPhu)
 *        → { ok, catalog, ... }  hoặc  { ok: false, error }
 */

var SH = { SKU: 'SKU_NHA', COMBO: 'COMBO', TP: 'COMBO_THANH_PHAN', LS: 'LICH_SU', MC: 'MA_CHUAN' };
var COT = {
  SKU_NHA: ['key', 'sku', 'ten', 'nha', 'nguon', 'cap_nhat', 'gia_gan_nhat', 'ngay_gia', 'ma_moi', 'khong_tai_ban', 'nguon_ma'],
  // Sổ mã chuẩn: barcode trên đơn web (chuẩn) – khong_phai: các listing đã xác nhận "không phải cùng cuốn"
  MA_CHUAN: ['barcode', 'ten_gon', 'gia_bia', 'ncc', 'nha', 'ngay_thay', 'khong_phai'],
  COMBO: ['combo_id', 'ten_combo', 'khoa', 'cap_nhat', 'cach_xuat', 'ma_he_thong', 'ten_xuat', 'nha'],
  COMBO_THANH_PHAN: ['combo_id', 'sku', 'ten', 'nha', 'gia_goc', 'so_luong'],
  LICH_SU: ['thoi_gian', 'hanh_dong', 'khoa', 'du_lieu_cu', 'du_lieu_moi']
};
// Cột số; mọi cột khác lưu dạng chữ (tránh Google Sheets tự đổi mã vạch thành số / ngày tháng)
var COT_SO = { SKU_NHA: ['gia_gan_nhat'], COMBO_THANH_PHAN: ['gia_goc', 'so_luong'], MA_CHUAN: ['gia_bia'] };
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
    return traVe_({ ok: true, skus: cat.skus, combos: cat.combos, ma_chuan: cat.ma_chuan });
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
      // Giá gần nhất của sách lẻ trong file hôm nay (chỉ ghi khi giá đổi; không đụng nha/nguon)
      extra.soCapNhatGia = 0;
      (data.gia || []).forEach(function (g) { if (capNhatGia_(cat, g, ctx)) extra.soCapNhatGia++; });
      // Sổ mã chuẩn từ đơn web + mã phụ tự khớp (tên trùng hẳn + cùng giá) – gom chung 1 lần ghi
      if (data.maChuan && data.maChuan.length) extra.soMaChuan = ghiSoMaChuan_(cat, data.maChuan, ctx);
      extra.soMaPhu = 0;
      (data.maPhu || []).forEach(function (it) { try { if (luuMaPhu_(cat, it, ctx, true)) extra.soMaPhu++; } catch (e) { /* bỏ qua */ } });
      break;
    case 'upsertMaChuan':
      extra.soMaChuan = ghiSoMaChuan_(cat, data.items || [], ctx);
      break;
    case 'luuMaPhu':
      luuMaPhu_(cat, data, ctx, false);
      break;
    case 'boQuaCungCuon':
      boQuaCungCuon_(cat, data, ctx);
      break;
    case 'thayMaTaiBan':
      thayMaTaiBan_(cat, data, ctx);
      break;
    case 'hoanTacTaiBan':
      hoanTacTaiBan_(cat, data, ctx);
      break;
    case 'boQuaTaiBan':
      boQuaTaiBan_(cat, data, ctx);
      break;
    case 'capNhatGiaCombo':
      extra.soCombo = 0;
      (data.items || []).forEach(function (it) { if (capNhatGiaCombo_(cat, it, ctx)) extra.soCombo++; });
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
  if (ctx.doiMc) ghiBang_(SH.MC, cat.ma_chuan);
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
  // Nguồn: tay (gán tay) > web (nhà cung cấp trên đơn web) > tu_hoc (đoán từ mã trong tên)
  var nguon = ['tu_hoc', 'web'].indexOf(chuoi_(d.nguon)) >= 0 ? chuoi_(d.nguon) : 'tay';
  if (!key) throw new Error('Thiếu khóa (key).');
  if (!/^(sku|ten):/.test(key)) throw new Error('Khóa không hợp lệ: ' + key);
  if (NHA_SKU.indexOf(nha) < 0) throw new Error('Nhà không hợp lệ: ' + d.nha);
  var i = timViTri_(cat.skus, 'key', key);
  var cu = i >= 0 ? cat.skus[i] : null;
  // Nhãn "tay" luôn ưu tiên hơn "tu_hoc": tự học không bao giờ ghi đè gán tay
  if (cu && cu.nguon === 'tay' && nguon !== 'tay') return false;
  if (cu && cu.nguon === 'web' && nguon === 'tu_hoc') return false;
  if (cu && chuoi_(cu.ma_moi) && nguon !== 'tay') return false; // mã phụ > web > tự học
  if (!choGhiDeTay && cu && cu.nguon === 'tay') return false;
  // Giữ các cột khác (giá gần nhất, mã tái bản…) của dòng cũ
  var moi = Object.assign({}, cu || {}, { key: key, sku: chuoi_(d.sku), ten: chuoi_(d.ten) || (cu ? cu.ten : ''), nha: nha, nguon: nguon, cap_nhat: ctx.now });
  if (!cu && soDuong_(d.gia_gan_nhat)) { moi.gia_gan_nhat = soDuong_(d.gia_gan_nhat); moi.ngay_gia = chuoi_(d.ngay_gia) || homNay_(); }
  if (ctx.action === 'importBatch') {
    // Nạp Excel: cho phép ghi kèm giá gần nhất / mã tái bản nếu file có
    if (soDuong_(d.gia_gan_nhat)) { moi.gia_gan_nhat = soDuong_(d.gia_gan_nhat); moi.ngay_gia = chuoi_(d.ngay_gia) || homNay_(); }
    if (chuoi_(d.ma_moi)) moi.ma_moi = chuoi_(d.ma_moi).toUpperCase();
    if (chuoi_(d.khong_tai_ban)) moi.khong_tai_ban = chuoi_(d.khong_tai_ban);
  }
  var giong = function (a, b) {
    return ['nha', 'nguon', 'sku', 'ten', 'gia_gan_nhat', 'ma_moi', 'khong_tai_ban'].every(function (f) { return chuoi_(a[f]) === chuoi_(b[f]); });
  };
  if (cu && giong(cu, moi)) return false;
  if (i >= 0) cat.skus[i] = moi; else cat.skus.push(moi);
  ctx.doiSku = true;
  ghiLog_(ctx, ctx.action, key, cu, moi);
  return true;
}

function soDuong_(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }
function homNay_() { return dinhDang_(new Date(), 'yyyy-MM-dd'); }
function dinhSo_(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function timSku_(cat, ma) { return timViTri_(cat.skus, 'key', 'sku:' + chuoi_(ma).toUpperCase()); }

/* ===================== Giá gần nhất ===================== */

function capNhatGia_(cat, g, ctx) {
  var i = timViTri_(cat.skus, 'key', chuoi_(g.key));
  var gia = soDuong_(g.gia);
  if (i < 0 || !gia) return false;
  var cu = cat.skus[i];
  if (soDuong_(cu.gia_gan_nhat) === gia) return false;
  var moi = Object.assign({}, cu, { gia_gan_nhat: gia, ngay_gia: homNay_() }); // KHÔNG đổi nha / nguon
  cat.skus[i] = moi;
  ctx.doiSku = true;
  ghiLog_(ctx, 'capNhatGia', moi.key, cu, Object.assign({ ghi_chu: 'Cập nhật giá: ' + dinhSo_(cu.gia_gan_nhat) + ' → ' + dinhSo_(gia) }, moi));
  return true;
}

/* items: { combo_id, gia: { "<sku>": giá mới } } → sửa giá khai báo của thành phần */
function capNhatGiaCombo_(cat, d, ctx) {
  var i = timViTri_(cat.combos, 'combo_id', chuoi_(d.combo_id));
  if (i < 0) return false;
  var c = cat.combos[i], cu = saoChep_(c), doi = [];
  c.thanh_phan.forEach(function (t) {
    var g = soDuong_((d.gia || {})[t.sku]);
    if (g && g !== (Number(t.gia_goc) || 0)) { doi.push(t.ten + ': ' + dinhSo_(t.gia_goc) + ' → ' + dinhSo_(g)); t.gia_goc = g; }
  });
  if (!doi.length) return false;
  c.cap_nhat = ctx.now;
  ctx.doiCombo = true;
  ghiLog_(ctx, 'capNhatGiaCombo', c.combo_id, cu, Object.assign({ ghi_chu: 'Cập nhật giá: ' + doi.join('; ') }, c));
  return true;
}

/* ===================== Sổ mã chuẩn (barcode web) & mã phụ ===================== */

/* Ghi / cập nhật sổ mã chuẩn. Bản cũ hơn (ngay_thay nhỏ hơn) không đè bản mới. Ghi 1 dòng tóm tắt vào LICH_SU. */
function ghiSoMaChuan_(cat, items, ctx) {
  var theoMa = {}, moi = 0, doi = 0;
  cat.ma_chuan.forEach(function (e, i) { theoMa[e.barcode] = i; });
  items.forEach(function (it) {
    var bc = chuoi_(it.barcode).toUpperCase();
    if (!/^\d{7,}$/.test(bc)) return;
    var x = { barcode: bc, ten_gon: chuoi_(it.ten_gon), gia_bia: soDuong_(it.gia_bia) || '', ncc: chuoi_(it.ncc),
              nha: NHA_CHINH.indexOf(chuoi_(it.nha)) >= 0 ? chuoi_(it.nha) : '', ngay_thay: chuoi_(it.ngay_thay) || homNay_() };
    if (!(bc in theoMa)) { x.khong_phai = ''; theoMa[bc] = cat.ma_chuan.length; cat.ma_chuan.push(x); moi++; return; }
    var cu = cat.ma_chuan[theoMa[bc]];
    if (x.ngay_thay < chuoi_(cu.ngay_thay)) return;
    var khac = ['ten_gon', 'gia_bia', 'ncc', 'nha', 'ngay_thay'].some(function (f) { return chuoi_(cu[f]) !== chuoi_(x[f]); });
    if (!khac) return;
    cat.ma_chuan[theoMa[bc]] = Object.assign({}, cu, x);
    doi++;
  });
  if (moi || doi) {
    ctx.doiMc = true;
    ghiLog_(ctx, 'soMaChuan', moi + ' mới, ' + doi + ' cập nhật', null, { ghi_chu: 'Sổ mã chuẩn: thêm ' + moi + ' barcode, cập nhật ' + doi + ' barcode' });
  }
  return { moi: moi, doi: doi };
}

/* Lưu mã phụ: listing trên sàn (key = sku:X hoặc ten:…) trỏ về barcode web Y.
 * tuDong = true: khớp chắc (nguon_ma web_tu_khop) – KHÔNG bao giờ đè dòng gán tay.
 * tuDong = false: bạn bấm "Đúng, cùng cuốn" (nguon_ma xac_nhan, nguồn tay). */
function luuMaPhu_(cat, d, ctx, tuDong) {
  var key = chuoi_(d.key), Y = chuoi_(d.ma_moi).toUpperCase();
  if (!/^(sku|ten):/.test(key)) throw new Error('Khóa không hợp lệ: ' + key);
  if (!/^\d{7,}$/.test(Y)) throw new Error('Mã chuẩn phải là mã vạch.');
  var X = key.indexOf('sku:') === 0 ? key.slice(4) : '';
  if (X === Y) return false;
  var i = timViTri_(cat.skus, 'key', key), cu = i >= 0 ? cat.skus[i] : null;
  if (tuDong && cu && cu.nguon === 'tay') return false;
  if (cu && chuoi_(cu.ma_moi).toUpperCase() === Y) return false;
  var cur = Y, da = {};
  while (cur && !da[cur]) {
    if (X && cur === X) throw new Error('Không thể trỏ ' + X + ' về ' + Y + ' vì sẽ tạo vòng lặp.');
    da[cur] = 1;
    var j = timSku_(cat, cur);
    cur = j >= 0 ? chuoi_(cat.skus[j].ma_moi).toUpperCase() : '';
  }
  var goc = cu || { key: key, sku: chuoi_(d.sku), ten: chuoi_(d.ten), nha: NHA_CHINH.indexOf(chuoi_(d.nha)) >= 0 ? chuoi_(d.nha) : '' };
  var moi = Object.assign({}, goc, { ma_moi: Y, nguon_ma: tuDong ? 'web_tu_khop' : 'xac_nhan', cap_nhat: ctx.now });
  moi.nguon = tuDong ? (cu ? cu.nguon : 'web_tu_khop') : 'tay';
  if (i >= 0) cat.skus[i] = moi; else cat.skus.push(moi);
  ctx.doiSku = true;
  ghiLog_(ctx, 'luuMaPhu', key + ' → ' + Y, cu, Object.assign({ ghi_chu: (tuDong ? 'Tự khớp (tên trùng + cùng giá): ' : 'Xác nhận cùng cuốn: ') +
    (X || moi.ten) + ' → mã web ' + Y }, moi));
  return true;
}

/* "Không phải cùng cuốn": ghi nhớ listing (khoa) vào dòng sổ mã chuẩn để không hỏi lại */
function boQuaCungCuon_(cat, d, ctx) {
  var bc = chuoi_(d.barcode).toUpperCase(), khoa = chuoi_(d.khoa);
  if (!/^\d{7,}$/.test(bc) || !khoa) throw new Error('Thiếu barcode hoặc khóa listing.');
  var i = timViTri_(cat.ma_chuan, 'barcode', bc);
  if (i < 0) { // barcode mới thấy trong file web hôm nay, chưa kịp ghi sổ
    cat.ma_chuan.push({ barcode: bc, ten_gon: chuoi_(d.ten_gon), gia_bia: soDuong_(d.gia_bia) || '', ncc: chuoi_(d.ncc),
                        nha: NHA_CHINH.indexOf(chuoi_(d.nha)) >= 0 ? chuoi_(d.nha) : '', ngay_thay: homNay_(), khong_phai: '' });
    i = cat.ma_chuan.length - 1;
  }
  var cu = cat.ma_chuan[i];
  var ds = chuoi_(cu.khong_phai) ? chuoi_(cu.khong_phai).split(/\s*;;\s*/) : [];
  if (ds.indexOf(khoa) >= 0) return;
  ds.push(khoa);
  cat.ma_chuan[i] = Object.assign({}, cu, { khong_phai: ds.join(TACH_KHOA) });
  ctx.doiMc = true;
  ghiLog_(ctx, 'boQuaCungCuon', khoa + ' ≠ ' + bc, cu, cat.ma_chuan[i]);
}

/* ===================== Tái bản (đổi mã vạch) ===================== */

/* Thay mã X → Y: tạo/cập nhật Y (nhà theo X, nguồn tay), X.ma_moi = Y, thành phần combo X → Y, thêm khóa combo theo Y */
function thayMaTaiBan_(cat, d, ctx) {
  var X = chuoi_(d.ma_cu).toUpperCase(), Y = chuoi_(d.ma_moi).toUpperCase();
  var gia = soDuong_(d.gia), ten = chuoi_(d.ten);
  if (!X || !Y) throw new Error('Thiếu mã cũ hoặc mã mới.');
  if (!/^\d{7,}$/.test(Y)) throw new Error('Mã mới phải là mã vạch (chỉ gồm chữ số, từ 7 ký tự).');
  if (X === Y) throw new Error('Mã mới phải khác mã cũ.');
  var iX = timSku_(cat, X);
  if (iX < 0) throw new Error('Mã cũ ' + X + ' chưa có trong danh mục.');
  var rx = cat.skus[iX];
  if (chuoi_(rx.ma_moi)) throw new Error('Mã ' + X + ' đã được thay bằng ' + rx.ma_moi + ' – hãy thay mã trên mã mới nhất.');
  // Chặn vòng lặp: đi theo chuỗi từ Y không được quay về X
  var cur = Y, da = {};
  while (cur && !da[cur]) {
    if (cur === X) throw new Error('Không thể thay ' + X + ' → ' + Y + ' vì ' + Y + ' đang trỏ ngược về ' + X + ' (vòng lặp).');
    da[cur] = 1;
    var j = timSku_(cat, cur);
    cur = j >= 0 ? chuoi_(cat.skus[j].ma_moi).toUpperCase() : '';
  }
  var iY = timSku_(cat, Y);
  var dongCombo = [];
  cat.combos.forEach(function (c, k) {
    var dung = c.thanh_phan.some(function (t) { return chuoi_(t.sku).toUpperCase() === X; }) ||
      c.khoa.some(function (kh) { return kh === 'sku:' + X || kh.indexOf('sku:' + X + '|') === 0; });
    if (dung) dongCombo.push(k);
  });
  var truoc = {
    skus: [{ key: 'sku:' + X, dong: saoChep_(rx) }, { key: 'sku:' + Y, dong: iY >= 0 ? saoChep_(cat.skus[iY]) : null }],
    combos: dongCombo.map(function (k) { return saoChep_(cat.combos[k]); })
  };

  var ry = iY >= 0 ? cat.skus[iY] : null;
  var moiY = Object.assign({}, ry || {}, {
    key: 'sku:' + Y, sku: Y, ten: ten || (ry && ry.ten) || rx.ten, nha: rx.nha, nguon: 'tay', cap_nhat: ctx.now,
    ma_moi: ry ? chuoi_(ry.ma_moi) : '', khong_tai_ban: ry ? chuoi_(ry.khong_tai_ban) : ''
  });
  if (gia) { moiY.gia_gan_nhat = gia; moiY.ngay_gia = homNay_(); }
  else if (!soDuong_(moiY.gia_gan_nhat) && soDuong_(rx.gia_gan_nhat)) { moiY.gia_gan_nhat = rx.gia_gan_nhat; moiY.ngay_gia = rx.ngay_gia; }
  if (iY >= 0) cat.skus[iY] = moiY; else cat.skus.push(moiY);
  cat.skus[iX] = Object.assign({}, rx, { ma_moi: Y, cap_nhat: ctx.now });

  var khoaDaCo = {};
  cat.combos.forEach(function (c) { c.khoa.forEach(function (kh) { khoaDaCo[kh] = c.combo_id; }); });
  dongCombo.forEach(function (k) {
    var c = cat.combos[k];
    c.thanh_phan.forEach(function (t) {
      if (chuoi_(t.sku).toUpperCase() !== X) return;
      t.sku = Y;
      if (ten) t.ten = ten;
      if (gia) t.gia_goc = gia;
    });
    c.khoa.slice().forEach(function (kh) {
      var moi = kh === 'sku:' + X ? 'sku:' + Y : kh.indexOf('sku:' + X + '|') === 0 ? 'sku:' + Y + kh.slice(4 + X.length) : '';
      if (moi && !khoaDaCo[moi]) { c.khoa.push(moi); khoaDaCo[moi] = c.combo_id; }
    });
    c.cap_nhat = ctx.now;
  });
  var sau = {
    skus: [{ key: 'sku:' + X, dong: saoChep_(cat.skus[iX]) }, { key: 'sku:' + Y, dong: saoChep_(moiY) }],
    combos: dongCombo.map(function (k) { return saoChep_(cat.combos[k]); })
  };
  ctx.doiSku = true;
  if (dongCombo.length) ctx.doiCombo = true;
  ghiLog_(ctx, 'thayMaTaiBan', X + ' → ' + Y, truoc, sau);
}

/* Hoàn tác 1 lần thay mã: d.dong = số dòng của bản ghi thayMaTaiBan trong sheet LICH_SU */
function hoanTacTaiBan_(cat, d, ctx) {
  var dong = Math.round(Number(d.dong));
  var s = sheet_(SH.LS);
  if (!(dong >= 2 && dong <= s.getLastRow())) throw new Error('Không tìm thấy bản ghi lịch sử cần hoàn tác.');
  var r = s.getRange(dong, 1, 1, COT.LICH_SU.length).getValues()[0];
  if (String(r[1]) !== 'thayMaTaiBan') throw new Error('Bản ghi này không phải "Thay mã tái bản".');
  var maLs = 'LS#' + dong;
  var n = s.getLastRow();
  var cot = s.getRange(2, 2, n - 1, 2).getValues();
  if (cot.some(function (x) { return String(x[0]) === 'hoanTacTaiBan' && String(x[1]).indexOf(maLs + ' ') === 0; })) {
    throw new Error('Lần thay mã này đã được hoàn tác rồi.');
  }
  var truoc = JSON.parse(String(r[3]));
  var hienTai = { skus: [], combos: [] };
  truoc.skus.forEach(function (x) {
    var i = timViTri_(cat.skus, 'key', x.key);
    hienTai.skus.push({ key: x.key, dong: i >= 0 ? saoChep_(cat.skus[i]) : null });
    if (x.dong) { if (i >= 0) cat.skus[i] = x.dong; else cat.skus.push(x.dong); }
    else if (i >= 0) cat.skus.splice(i, 1);
  });
  truoc.combos.forEach(function (c) {
    var i = timViTri_(cat.combos, 'combo_id', c.combo_id);
    hienTai.combos.push(i >= 0 ? saoChep_(cat.combos[i]) : null);
    if (i >= 0) cat.combos[i] = c; else cat.combos.push(c);
  });
  ctx.doiSku = true;
  if (truoc.combos.length) ctx.doiCombo = true;
  ghiLog_(ctx, 'hoanTacTaiBan', maLs + ' (' + String(r[2]) + ')', hienTai, truoc);
}

/* "Không phải tái bản": ghi nhớ cặp X–Y để không hỏi lại */
function boQuaTaiBan_(cat, d, ctx) {
  var X = chuoi_(d.ma_cu).toUpperCase(), Y = chuoi_(d.ma_moi).toUpperCase();
  var i = timSku_(cat, X);
  if (i < 0 || !Y) throw new Error('Không tìm thấy mã ' + X + ' trong danh mục.');
  var cu = cat.skus[i];
  var ds = chuoi_(cu.khong_tai_ban) ? chuoi_(cu.khong_tai_ban).split(/\s*;;\s*/) : [];
  if (ds.indexOf(Y) >= 0) return;
  ds.push(Y);
  var moi = Object.assign({}, cu, { khong_tai_ban: ds.join(TACH_KHOA), cap_nhat: ctx.now });
  cat.skus[i] = moi;
  ctx.doiSku = true;
  ghiLog_(ctx, 'boQuaTaiBan', X + ' ≠ ' + Y, cu, moi);
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
  var so = COT_SO[ten] || [];
  cols.forEach(function (c, j) { if (so.indexOf(c) < 0) s.getRange(2, j + 1, ds.length, 1).setNumberFormat('@'); });
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
  return { skus: skus, combos: combos, ma_chuan: docBang_(SH.MC) };
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
  return s.getRange(tu, 1, n - tu + 1, COT.LICH_SU.length).getValues().map(function (r, i) {
    var o = { dong: tu + i }; // số dòng trong sheet – dùng cho "Hoàn tác"
    COT.LICH_SU.forEach(function (c, j) { o[c] = r[j] instanceof Date ? dinhDang_(r[j]) : String(r[j]); });
    return o;
  }).reverse();
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
  [SH.SKU, SH.COMBO, SH.TP, SH.LS, SH.MC].forEach(sheet_);
  var ss = bangTinh_();
  ss.getSheets().forEach(function (s) {
    if (/^(Sheet1|Trang tính1)$/.test(s.getName()) && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  Logger.log('Đã tạo xong các sheet: SKU_NHA, COMBO, COMBO_THANH_PHAN, LICH_SU, MA_CHUAN.');
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
