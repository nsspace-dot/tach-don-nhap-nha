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
 *   SKU_NHA           key | sku | ten | nha | nguon | cap_nhat | gia_gan_nhat | ngay_gia | ma_moi | khong_tai_ban | nguon_ma | ten_sach | phan_loai | khong_combo
 *                     (ten: tên listing trên sàn ; ten_sach: TÊN SÁCH ĐÃ KHAI BÁO dùng để xuất file – chỉ bạn sửa, tự học không ghi đè ;
 *                      khong_combo = 1: bạn đã bấm "Không phải combo" cho dòng bị nghi combo)
 *                     (ma_moi: mã tái bản thay thế ; khong_tai_ban: các mã đã xác nhận "không phải tái bản", cách nhau " ;; ")
 *   COMBO             combo_id | ten_combo | khoa | cap_nhat | cach_xuat | ma_he_thong | ten_xuat | nha
 *                     (khoa cách nhau bằng " ;; " ; cach_xuat = tach | nguyen ; trống = tach)
 *   COMBO_THANH_PHAN  combo_id | sku | ten | nha | gia_goc | so_luong
 *   LICH_SU           thoi_gian | hanh_dong | khoa | du_lieu_cu | du_lieu_moi   (chỉ thêm dòng)
 *   MA_CHUAN          barcode | ten_gon | gia_bia | ncc | nha | ngay_thay | khong_phai   (sổ mã chuẩn = barcode đơn web)
 *   LS_DAT_HANG       ngay | nha | barcode | ten | gia | sl | sl_shopee | sl_tiktok | sl_web | sl_treo | cap_nhat
 *   DON_DA_GHI        ma_don | ngay   (chống nạp trùng đơn vào lịch sử)
 *   GET  <url>?action=lichSuDatHang&tu=yyyy-MM-dd → { ok, cot, dong }
 *   POST ghiLichSuDatHang (ghi đè theo ngày + nhà), napLichSuDatHang (cộng theo ngày đặt, bỏ đơn trùng)
 *
 * API:
 *   GET  <url>                  → { ok, skus, combos }
 *   GET  <url>?action=lichSu    → { ok, lich_su }   (100 thay đổi gần nhất, mới nhất trước)
 *   POST <url>  body {action, data}  (Content-Type: text/plain)
 *        action: ping, upsertSku, upsertSkuBatch (kèm cập nhật giá), deleteSku, upsertCombo, addComboKey, doiKhoaCombo,
 *                deleteCombo, importBatch, thayMaTaiBan, hoanTacTaiBan, boQuaTaiBan, capNhatGiaCombo,
 *                upsertMaChuan, luuMaPhu, boQuaCungCuon, luuTenSach, khongPhaiCombo, ganBarcode, boGanBarcode, suaSku   (upsertSkuBatch nhận thêm maChuan, maPhu)
 *        → { ok, catalog, ... }  hoặc  { ok: false, error }
 */

var SH = { SKU: 'SKU_NHA', COMBO: 'COMBO', TP: 'COMBO_THANH_PHAN', LS: 'LICH_SU', MC: 'MA_CHUAN', DH: 'LS_DAT_HANG', DON: 'DON_DA_GHI' };
var COT = {
  SKU_NHA: ['key', 'sku', 'ten', 'nha', 'nguon', 'cap_nhat', 'gia_gan_nhat', 'ngay_gia', 'ma_moi', 'khong_tai_ban', 'nguon_ma', 'ten_sach', 'phan_loai', 'khong_combo'],
  // Sổ mã chuẩn: barcode trên đơn web (chuẩn) – khong_phai: các listing đã xác nhận "không phải cùng cuốn"
  MA_CHUAN: ['barcode', 'ten_gon', 'gia_bia', 'ncc', 'nha', 'ngay_thay', 'khong_phai'],
  // Lịch sử đặt hàng (KHÔNG có thông tin khách): 1 dòng / (ngày, nhà, barcode chuẩn). ngay dạng yyyy-MM-dd, hoặc yyyy-MM khi đã gom tháng cũ
  LS_DAT_HANG: ['ngay', 'nha', 'barcode', 'ten', 'gia', 'sl', 'sl_shopee', 'sl_tiktok', 'sl_web', 'sl_treo', 'cap_nhat'],
  // Mã đơn đã tính vào lịch sử (chống nạp trùng). Web: "web:<ngày xuất>|<barcode>"
  DON_DA_GHI: ['ma_don', 'ngay'],
  COMBO: ['combo_id', 'ten_combo', 'khoa', 'cap_nhat', 'cach_xuat', 'ma_he_thong', 'ten_xuat', 'nha'],
  COMBO_THANH_PHAN: ['combo_id', 'sku', 'ten', 'nha', 'gia_goc', 'so_luong'],
  LICH_SU: ['thoi_gian', 'hanh_dong', 'khoa', 'du_lieu_cu', 'du_lieu_moi']
};
// Cột số; mọi cột khác lưu dạng chữ (tránh Google Sheets tự đổi mã vạch thành số / ngày tháng)
var COT_SO = { SKU_NHA: ['gia_gan_nhat'], COMBO_THANH_PHAN: ['gia_goc', 'so_luong'], MA_CHUAN: ['gia_bia'],
               LS_DAT_HANG: ['gia', 'sl', 'sl_shopee', 'sl_tiktok', 'sl_web', 'sl_treo'] };
var NGUONG_GOM_THANG = 40000;   // LS_DAT_HANG quá số dòng này → gom các ngày cũ hơn 180 ngày thành 1 dòng / tháng
var NGUONG_NHAC_LON = 30000;    // nhắc khi dữ liệu lớn
var GIU_DON_DA_GHI = 400;       // giữ mã đơn đã ghi trong 400 ngày
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
    if (action === 'lichSuDatHang') return traVe_(docLichSuDatHang_(e.parameter.tu));
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
  if (action === 'ghiLichSuDatHang') return ghiLichSuDatHang_(data);
  if (action === 'napLichSuDatHang') return napLichSuDatHang_(data);
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
    case 'luuTenSach':
      // Khai báo tên sách (1 dòng hoặc hàng loạt) – nguồn tay
      extra.soTenSach = 0;
      (data.items || [data]).forEach(function (it) { if (luuTenSach_(cat, it, ctx)) extra.soTenSach++; });
      break;
    case 'ganBarcode':
      extra.soKhoa = ganBarcode_(cat, data, ctx);
      break;
    case 'suaSku':
      suaSku_(cat, data, ctx);
      break;
    case 'boGanBarcode':
      boGanBarcode_(cat, data, ctx);
      break;
    case 'khongPhaiCombo':
      khongPhaiCombo_(cat, data, ctx);
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
  // Phân loại trên sàn (để gợi ý tên): chỉ điền khi đang trống
  if (!chuoi_(moi.phan_loai) && chuoi_(d.phan_loai)) moi.phan_loai = chuoi_(d.phan_loai);
  // Tên sách khai báo: chỉ thao tác của bạn (gán tay / nạp Excel có cột "Tên sách") mới được ghi – tự học KHÔNG đụng
  if (choGhiDeTay && d.ten_sach !== undefined) moi.ten_sach = chuoi_(d.ten_sach);
  if (!cu && soDuong_(d.gia_gan_nhat)) { moi.gia_gan_nhat = soDuong_(d.gia_gan_nhat); moi.ngay_gia = chuoi_(d.ngay_gia) || homNay_(); }
  if (ctx.action === 'importBatch') {
    // Nạp Excel: cho phép ghi kèm giá gần nhất / mã tái bản nếu file có
    if (soDuong_(d.gia_gan_nhat)) { moi.gia_gan_nhat = soDuong_(d.gia_gan_nhat); moi.ngay_gia = chuoi_(d.ngay_gia) || homNay_(); }
    if (chuoi_(d.ma_moi)) moi.ma_moi = chuoi_(d.ma_moi).toUpperCase();
    if (chuoi_(d.khong_tai_ban)) moi.khong_tai_ban = chuoi_(d.khong_tai_ban);
  }
  var giong = function (a, b) {
    return ['nha', 'nguon', 'sku', 'ten', 'gia_gan_nhat', 'ma_moi', 'khong_tai_ban', 'ten_sach', 'phan_loai', 'khong_combo'].every(function (f) { return chuoi_(a[f]) === chuoi_(b[f]); });
  };
  if (cu && giong(cu, moi)) return false;
  if (i >= 0) cat.skus[i] = moi; else cat.skus.push(moi);
  ctx.doiSku = true;
  ghiLog_(ctx, ctx.action, key, cu, moi);
  return true;
}

/* Khai báo tên sách cho 1 khóa (sku:<barcode> hoặc ten:…). Chưa có trong danh mục → tạo mới (cần nhà), nguồn tay.
 * Đã có → chỉ đổi tên sách, giữ nguyên nhà / nguồn. ten_sach rỗng = bỏ khai báo. */
function luuTenSach_(cat, d, ctx) {
  var key = chuoi_(d.key);
  if (!/^(sku|ten):/.test(key)) throw new Error('Khóa không hợp lệ: ' + key);
  var i = timViTri_(cat.skus, 'key', key), cu = i >= 0 ? cat.skus[i] : null, ten = chuoi_(d.ten_sach);
  var moi;
  if (cu) {
    if (chuoi_(cu.ten_sach) === ten) return false;
    moi = Object.assign({}, cu, { ten_sach: ten, cap_nhat: ctx.now });
    if (!chuoi_(moi.phan_loai) && chuoi_(d.phan_loai)) moi.phan_loai = chuoi_(d.phan_loai);
    cat.skus[i] = moi;
  } else {
    var nha = chuoi_(d.nha).toUpperCase();
    if (NHA_CHINH.indexOf(nha) < 0) throw new Error('Cần chọn nhà cho sách mới: ' + key);
    if (!ten) return false;
    moi = { key: key, sku: chuoi_(d.sku), ten: chuoi_(d.ten), nha: nha, nguon: 'tay', cap_nhat: ctx.now, ten_sach: ten, phan_loai: chuoi_(d.phan_loai) };
    cat.skus.push(moi);
  }
  ctx.doiSku = true;
  ghiLog_(ctx, 'luuTenSach', key, cu, Object.assign({ ghi_chu: 'Tên sách: ' + (chuoi_(cu && cu.ten_sach) || '(chưa có)') + ' → ' + (ten || '(bỏ khai báo)') }, moi));
  return true;
}

/* Dòng bị nghi combo (dạng "A+B" / theo giá) mà bạn bảo "Không phải combo" → ghi nhớ trên khóa sách lẻ của dòng.
 * Chưa có trong danh mục → tạo dòng nguồn tự học (để tự học vẫn điền được nhà). bo = true: bỏ ghi nhớ. */
function khongPhaiCombo_(cat, d, ctx) {
  var key = chuoi_(d.key);
  if (!/^(sku|ten):/.test(key)) throw new Error('Khóa không hợp lệ: ' + key);
  var i = timViTri_(cat.skus, 'key', key), cu = i >= 0 ? cat.skus[i] : null, gt = d.bo ? '' : '1';
  var nha = chuoi_(d.nha).toUpperCase();
  // "Là sách lẻ của nhà X" (chọn nhà) → gán tay luôn nhà đó
  var ganNha = !d.bo && NHA_SKU.indexOf(nha) >= 0;
  var moi = cu ? Object.assign({}, cu, { khong_combo: gt }, ganNha ? { nha: nha, nguon: 'tay' } : {})
    : { key: key, sku: chuoi_(d.sku), ten: chuoi_(d.ten), nha: ganNha ? nha : '', nguon: ganNha ? 'tay' : 'tu_hoc',
        phan_loai: chuoi_(d.phan_loai), khong_combo: gt };
  if (cu && ['khong_combo', 'nha', 'nguon'].every(function (f) { return chuoi_(cu[f]) === chuoi_(moi[f]); })) return false;
  moi.cap_nhat = ctx.now;
  if (i >= 0) cat.skus[i] = moi; else cat.skus.push(moi);
  ctx.doiSku = true;
  ghiLog_(ctx, 'khongPhaiCombo', key, cu, Object.assign({ ghi_chu: gt ? 'Không phải combo – là sách lẻ' + (ganNha ? ' ' + nha : '') + ': ' + chuoi_(d.ten || moi.ten) +
    (d.phan_loai ? ' – ' + chuoi_(d.phan_loai) : '') : 'Bỏ ghi nhớ "không phải combo"' }, moi));
  return true;
}

/* ===================== Gán / sửa barcode cho dòng sàn ===================== */
/* data: { items: [{ key, sku, ten, phan_loai, ma_moi? }], ma_moi, nha?, ten_sach?, ghi_de?, thanh_phan?: { combo_ids: [], ten } }
 * - key = sku:<SKU chữ / barcode sai> hoặc ten:<tên>|<phân loại>  → lưu mã phụ trỏ về barcode đúng (nguon_ma gan_tay, nguồn tay)
 * - barcode đúng chưa có trong danh mục + có nhà → tạo luôn (nguồn tay, kèm tên sách)
 * - thanh_phan: thành phần combo chưa có SKU → điền barcode vào thành phần (theo tên) trong các combo đó
 * - Khóa đã được gán TAY sang barcode khác → báo CAN_XAC_NHAN (trừ khi ghi_de)
 * Ghi 1 dòng LICH_SU có ảnh chụp trước/sau → hoàn tác được. */
function ganBarcode_(cat, d, ctx) {
  var Ychung = chuoi_(d.ma_moi).toUpperCase(), items = d.items || [], tp = d.thanh_phan;
  if (!items.length && !tp) throw new Error('Không có dòng nào để gán barcode.');
  var anh = {}, combosDung = {};
  function chup(key) { if (!(key in anh)) { var j = timViTri_(cat.skus, 'key', key); anh[key] = j >= 0 ? saoChep_(cat.skus[j]) : null; } }
  // Kiểm tra trước, chưa sửa gì
  var viec = items.map(function (it) {
    var key = chuoi_(it.key), Y = chuoi_(it.ma_moi || Ychung).toUpperCase();
    if (!/^(sku|ten):/.test(key)) throw new Error('Khóa không hợp lệ: ' + key);
    if (!Y) throw new Error('Thiếu barcode.');
    if (!/^\d{7,}$/.test(Y) && !d.ep) throw new Error('CAN_XAC_NHAN: "' + Y + '" không giống mã vạch (chỉ gồm chữ số, từ 7 ký tự). Vẫn lưu?');
    var X = key.indexOf('sku:') === 0 ? key.slice(4) : '';
    if (X === Y) throw new Error('Barcode mới trùng barcode đang có.');
    var i = timViTri_(cat.skus, 'key', key), cu = i >= 0 ? cat.skus[i] : null;
    var maCu = cu ? chuoi_(cu.ma_moi).toUpperCase() : '';
    if (maCu && maCu !== Y && cu.nguon === 'tay' && !d.ghi_de) {
      throw new Error('CAN_XAC_NHAN: Dòng "' + (cu.ten || key) + '" đã được gán tay sang barcode ' + maCu + '. Ghi đè thành ' + Y + '?');
    }
    var cur = Y, da = {};
    while (cur && !da[cur]) {
      if (X && cur === X && !d.ep) throw new Error('CAN_XAC_NHAN: Trỏ ' + X + ' về ' + Y + ' sẽ tạo vòng lặp (' + Y + ' đang trỏ về ' + X + '). Vẫn lưu?');
      da[cur] = 1;
      var j = timSku_(cat, cur);
      cur = j >= 0 ? chuoi_(cat.skus[j].ma_moi).toUpperCase() : '';
    }
    return { it: it, key: key, Y: Y, i: i, cu: cu };
  });
  var dsY = {};
  viec.forEach(function (v) { dsY[v.Y] = 1; });
  if (tp && Ychung) dsY[Ychung] = 1;
  var nha = chuoi_(d.nha).toUpperCase(), tenSach = chuoi_(d.ten_sach);
  viec.forEach(function (v) { chup(v.key); });
  Object.keys(dsY).forEach(function (Y) { chup('sku:' + Y); });
  var truocCombo = [];
  if (tp && Ychung) {
    cat.combos.forEach(function (c, k) {
      if ((tp.combo_ids || []).indexOf(c.combo_id) < 0) return;
      if (c.thanh_phan.some(function (t) { return !chuoi_(t.sku) && chuoi_(t.ten) === chuoi_(tp.ten); })) { combosDung[k] = 1; truocCombo.push(saoChep_(c)); }
    });
    if (!truocCombo.length) throw new Error('Không tìm thấy thành phần combo cần gán barcode.');
  }
  // Sửa
  viec.forEach(function (v) {
    var it = v.it, i = timViTri_(cat.skus, 'key', v.key), cu = i >= 0 ? cat.skus[i] : null;
    var goc = cu || { key: v.key, sku: chuoi_(it.sku), ten: chuoi_(it.ten), nha: '', phan_loai: chuoi_(it.phan_loai) };
    var moi = Object.assign({}, goc, { ma_moi: v.Y, nguon_ma: 'gan_tay', nguon: 'tay', cap_nhat: ctx.now });
    if (i >= 0) cat.skus[i] = moi; else cat.skus.push(moi);
  });
  Object.keys(dsY).forEach(function (Y) {
    var j = timSku_(cat, Y), ry = j >= 0 ? cat.skus[j] : null;
    if (ry) {
      if (tenSach && !chuoi_(ry.ten_sach)) cat.skus[j] = Object.assign({}, ry, { ten_sach: tenSach, cap_nhat: ctx.now });
      return;
    }
    if (NHA_SKU.indexOf(nha) < 0) return; // không có nhà → chưa tạo (app vẫn nhận nhà theo mã trong tên)
    var mau = viec.filter(function (v) { return v.Y === Y; })[0];
    cat.skus.push({ key: 'sku:' + Y, sku: Y, ten: mau ? chuoi_(mau.it.ten) : chuoi_(tp && tp.ten), nha: nha, nguon: 'tay', cap_nhat: ctx.now,
                    ten_sach: tenSach, phan_loai: '' });
  });
  Object.keys(combosDung).forEach(function (k) {
    var c = cat.combos[k];
    c.thanh_phan.forEach(function (t) { if (!chuoi_(t.sku) && chuoi_(t.ten) === chuoi_(tp.ten)) t.sku = Ychung; });
    c.cap_nhat = ctx.now;
  });
  var truoc = { skus: Object.keys(anh).map(function (k) { return { key: k, dong: anh[k] }; }), combos: truocCombo };
  var sau = {
    skus: Object.keys(anh).map(function (k) { var j = timViTri_(cat.skus, 'key', k); return { key: k, dong: j >= 0 ? saoChep_(cat.skus[j]) : null }; }),
    combos: Object.keys(combosDung).map(function (k) { return saoChep_(cat.combos[k]); })
  };
  ctx.doiSku = true;
  if (truocCombo.length) ctx.doiCombo = true;
  var moTa = viec.map(function (v) { return (v.key.indexOf('sku:') === 0 ? v.key.slice(4) : '(trống) ' + (v.cu ? v.cu.ten : v.it.ten)) + ' → ' + v.Y; });
  if (tp && Ychung) moTa.push('thành phần "' + tp.ten + '" → ' + Ychung);
  ghiLog_(ctx, 'ganBarcode', moTa.join('; ').slice(0, 300), truoc, sau);
  return viec.length;
}

/* Sửa tay MỌI trường của 1 dòng danh mục (kể cả khóa, mã chính của mã phụ). Nguồn → tay. Không chặn dữ liệu lạ
 * (app đã cảnh báo); chỉ hỏi lại (CAN_XAC_NHAN) khi đổi khóa trùng 1 dòng khác. Ảnh chụp trước/sau → hoàn tác được. */
function suaSku_(cat, d, ctx) {
  var keyCu = chuoi_(d.key_cu), key = chuoi_(d.key) || keyCu;
  if (!key) throw new Error('Thiếu khóa.');
  var iCu = keyCu ? timViTri_(cat.skus, 'key', keyCu) : -1, iMoi = timViTri_(cat.skus, 'key', key);
  if (key !== keyCu && iMoi >= 0 && !d.ghi_de) throw new Error('CAN_XAC_NHAN: Khóa ' + key + ' đã có dòng khác trong danh mục. Ghi đè dòng đó?');
  var truoc = [{ key: keyCu || key, dong: iCu >= 0 ? saoChep_(cat.skus[iCu]) : null }];
  if (key !== keyCu) truoc.push({ key: key, dong: iMoi >= 0 ? saoChep_(cat.skus[iMoi]) : null });
  var cu = iCu >= 0 ? cat.skus[iCu] : {};
  var maMoi = chuoi_(d.ma_moi).toUpperCase();
  var moi = Object.assign({}, cu, {
    key: key, sku: chuoi_(d.sku), ten: chuoi_(d.ten), ten_sach: chuoi_(d.ten_sach), phan_loai: chuoi_(d.phan_loai),
    nha: chuoi_(d.nha).toUpperCase(), nguon: 'tay', cap_nhat: ctx.now, ma_moi: maMoi,
    nguon_ma: maMoi ? (maMoi === chuoi_(cu.ma_moi).toUpperCase() && chuoi_(cu.nguon_ma) ? cu.nguon_ma : 'gan_tay') : '',
    khong_combo: d.khong_combo ? '1' : '', khong_tai_ban: chuoi_(d.khong_tai_ban)
  });
  var gia = soDuong_(d.gia_gan_nhat);
  if (gia !== soDuong_(cu.gia_gan_nhat)) { moi.gia_gan_nhat = gia || ''; moi.ngay_gia = gia ? homNay_() : ''; }
  // Bỏ dòng cũ (khi đổi khóa) và dòng trùng khóa mới (đã xác nhận ghi đè), rồi ghi dòng mới
  cat.skus = cat.skus.filter(function (e) { return e.key !== keyCu && e.key !== key; });
  cat.skus.push(moi);
  ctx.doiSku = true;
  var sau = truoc.map(function (x) { return { key: x.key, dong: x.key === key ? saoChep_(moi) : null }; });
  ghiLog_(ctx, 'suaSku', key === keyCu ? key : keyCu + ' → ' + key, { skus: truoc, combos: [] }, { skus: sau, combos: [] });
}

/* Xóa ánh xạ "Barcode gán tay" của 1 khóa (bỏ ma_moi / nguon_ma). Hoàn tác được. */
function boGanBarcode_(cat, d, ctx) {
  var key = chuoi_(d.key), i = timViTri_(cat.skus, 'key', key);
  if (i < 0 || !chuoi_(cat.skus[i].ma_moi)) throw new Error('Khóa này chưa được gán barcode.');
  var cu = saoChep_(cat.skus[i]);
  var moi = Object.assign({}, cat.skus[i], { ma_moi: '', nguon_ma: '', cap_nhat: ctx.now });
  // Dòng chỉ tạo ra để gán barcode (không nhà, không tên khai báo) → xóa hẳn
  if (!chuoi_(moi.nha) && !chuoi_(moi.ten_sach) && !chuoi_(moi.khong_combo)) { cat.skus.splice(i, 1); moi = null; }
  else cat.skus[i] = moi;
  ctx.doiSku = true;
  ghiLog_(ctx, 'boGanBarcode', key + ' (bỏ → ' + cu.ma_moi + ')', { skus: [{ key: key, dong: cu }], combos: [] }, { skus: [{ key: key, dong: moi }], combos: [] });
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

/* ===================== Lịch sử đặt hàng ===================== */

function docDH_() {
  return docBang_(SH.DH).map(function (r) {
    COT_SO.LS_DAT_HANG.forEach(function (c) { r[c] = Number(r[c]) || 0; });
    return r;
  });
}
function ghiDH_(ds) {
  ds.sort(function (a, b) { return a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : 0; });
  ghiBang_(SH.DH, ds);
}

/* Mỗi lần tải file nhà: GHI ĐÈ số của (ngày, nhà) – tải lại nhiều lần trong ngày không bị cộng dồn.
 * data: { ngay, nhas: [...], dong: [{nha, barcode, ten, gia, sl, sl_shopee, sl_tiktok, sl_web, sl_treo}], maDon: [...] } */
function ghiLichSuDatHang_(data) {
  var ngay = chuoi_(data.ngay), nhas = [].concat(data.nhas || []);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay) || !nhas.length) throw new Error('Thiếu ngày hoặc nhà.');
  var now = bayGio_();
  var ds = docDH_().filter(function (r) { return !(r.ngay === ngay && nhas.indexOf(r.nha) >= 0); });
  var soDong = 0;
  (data.dong || []).forEach(function (d) {
    if (nhas.indexOf(chuoi_(d.nha)) < 0 || !chuoi_(d.barcode)) return;
    var x = { ngay: ngay, nha: chuoi_(d.nha), barcode: chuoi_(d.barcode), ten: chuoi_(d.ten), cap_nhat: now };
    COT_SO.LS_DAT_HANG.forEach(function (c) { x[c] = Number(d[c]) || 0; });
    ds.push(x);
    soDong++;
  });
  var gom = gomThangCu_(ds);
  ghiDH_(ds);
  themDonDaGhi_((data.maDon || []).map(function (m) { return [m, ngay]; }));
  return { ok: true, soDong: soDong, tongDong: ds.length, gomThang: gom, canhBaoLon: ds.length > NGUONG_NHAC_LON };
}

/* Nạp lịch sử từ file đơn cũ: CỘNG vào ngày đặt của từng đơn; đơn đã có (trùng mã đơn) thì bỏ qua.
 * data: { dong: [{ngay, nha, barcode, ten, gia, sl, nguon, ma_don}] } */
function napLichSuDatHang_(data) {
  var daCo = {};
  docBang_(SH.DON).forEach(function (r) { daCo[r.ma_don] = 1; });
  var now = bayGio_(), ds = docDH_(), viTri = {};
  ds.forEach(function (r, i) { viTri[r.ngay + '|' + r.nha + '|' + r.barcode] = i; });
  var donMoi = {}, donBoQua = {}, soDong = 0;
  var COT_NGUON = { Shopee: 'sl_shopee', TikTok: 'sl_tiktok', Web: 'sl_web' };
  (data.dong || []).forEach(function (d) {
    var ma = chuoi_(d.ma_don), ngay = chuoi_(d.ngay), nha = chuoi_(d.nha), bc = chuoi_(d.barcode);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay) || NHA_CHINH.indexOf(nha) < 0 || !bc) return;
    if (ma && daCo[ma]) { donBoQua[ma] = 1; return; }
    if (ma) donMoi[ma] = ngay;
    var k = ngay + '|' + nha + '|' + bc;
    if (!(k in viTri)) {
      viTri[k] = ds.length;
      ds.push({ ngay: ngay, nha: nha, barcode: bc, ten: chuoi_(d.ten), gia: Number(d.gia) || 0, sl: 0, sl_shopee: 0, sl_tiktok: 0, sl_web: 0, sl_treo: 0, cap_nhat: now });
    }
    var x = ds[viTri[k]], sl = Number(d.sl) || 0;
    x.sl += sl;
    if (COT_NGUON[d.nguon]) x[COT_NGUON[d.nguon]] += sl;
    if (!x.ten) x.ten = chuoi_(d.ten);
    x.cap_nhat = now;
    soDong++;
  });
  var gom = gomThangCu_(ds);
  ghiDH_(ds);
  var dsMoi = Object.keys(donMoi);
  themDonDaGhi_(dsMoi.map(function (ma) { return [ma, donMoi[ma]]; }));
  return { ok: true, soDong: soDong, soDonMoi: dsMoi.length, soDonTrung: Object.keys(donBoQua).length, tongDong: ds.length,
           gomThang: gom, canhBaoLon: ds.length > NGUONG_NHAC_LON };
}

/* Ghi 1 lần cả lô mã đơn: cap = [[ma_don, ngay], …] */
function themDonDaGhi_(cap) {
  if (!cap.length) return;
  var s = sheet_(SH.DON), n = s.getLastRow();
  var co = {};
  if (n > 1) s.getRange(2, 1, n - 1, 1).getValues().forEach(function (r) { co[String(r[0])] = 1; });
  var moi = cap.filter(function (x) { var m = chuoi_(x[0]); if (!m || co[m]) return false; co[m] = 1; return true; });
  if (!moi.length) return;
  var r = s.getRange(n + 1, 1, moi.length, 2);
  r.setNumberFormat('@');
  r.setValues(moi.map(function (x) { return [chuoi_(x[0]), chuoi_(x[1])]; }));
  // Giữ gọn: bỏ mã đơn cũ hơn GIU_DON_DA_GHI ngày
  if (n + moi.length > 60000) {
    var moc = dinhDang_(new Date(Date.now() - GIU_DON_DA_GHI * 864e5), 'yyyy-MM-dd');
    ghiBang_(SH.DON, docBang_(SH.DON).filter(function (x) { return x.ngay >= moc; }));
  }
}

/* Dữ liệu lớn: gom các ngày cũ hơn 180 ngày thành 1 dòng / tháng / nhà / barcode (ngay = yyyy-MM) */
function gomThangCu_(ds) {
  if (ds.length <= NGUONG_GOM_THANG) return 0;
  var moc = dinhDang_(new Date(Date.now() - 180 * 864e5), 'yyyy-MM-dd');
  var giu = [], gom = {}, soGom = 0;
  ds.forEach(function (r) {
    if (r.ngay.length !== 10 || r.ngay >= moc) { giu.push(r); return; }
    var k = r.ngay.slice(0, 7) + '|' + r.nha + '|' + r.barcode;
    var g = gom[k] || (gom[k] = { ngay: r.ngay.slice(0, 7), nha: r.nha, barcode: r.barcode, ten: r.ten, gia: r.gia, sl: 0, sl_shopee: 0, sl_tiktok: 0, sl_web: 0, sl_treo: 0, cap_nhat: r.cap_nhat });
    ['sl', 'sl_shopee', 'sl_tiktok', 'sl_web', 'sl_treo'].forEach(function (c) { g[c] += r[c]; });
    soGom++;
  });
  ds.length = 0;
  Array.prototype.push.apply(ds, giu.concat(Object.keys(gom).map(function (k) { return gom[k]; })));
  return soGom;
}

/* Đọc lịch sử từ ngày tu (mặc định 150 ngày gần nhất) – dạng gọn { cot, dong } */
function docLichSuDatHang_(tu) {
  tu = /^\d{4}-\d{2}-\d{2}$/.test(chuoi_(tu)) ? chuoi_(tu) : dinhDang_(new Date(Date.now() - 150 * 864e5), 'yyyy-MM-dd');
  var cot = COT.LS_DAT_HANG.slice(0, 10);
  var ds = docDH_();
  return { ok: true, cot: cot, tongDong: ds.length, canhBaoLon: ds.length > NGUONG_NHAC_LON,
           ngayCuNhat: ds.reduce(function (m, r) { return r.ngay.length === 10 && (!m || r.ngay < m) ? r.ngay : m; }, ''),
           dong: ds.filter(function (r) { return r.ngay.length === 10 && r.ngay >= tu; }).map(function (r) { return cot.map(function (c) { return r[c]; }); }) };
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
  if (['thayMaTaiBan', 'ganBarcode', 'boGanBarcode', 'suaSku'].indexOf(String(r[1])) < 0) throw new Error('Bản ghi này không hoàn tác được.');
  var maLs = 'LS#' + dong;
  var n = s.getLastRow();
  var cot = s.getRange(2, 2, n - 1, 2).getValues();
  if (cot.some(function (x) { return String(x[0]) === 'hoanTacTaiBan' && String(x[1]).indexOf(maLs + ' ') === 0; })) {
    throw new Error('Thao tác này đã được hoàn tác rồi.');
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
  // Sửa tay luôn được lưu: thiếu dữ liệu thì điền mặc định (app đã cảnh báo trước khi gửi)
  var ten = chuoi_(d.ten_combo) || chuoi_(d.combo_id) || chuoi_([].concat(d.khoa || [])[0]) || '(combo chưa đặt tên)';
  var khoa = [];
  [].concat(d.khoa || []).forEach(function (k) {
    k = chuoi_(k);
    if (k && khoa.indexOf(k) < 0) khoa.push(k);
  });
  var cachXuat = chuoi_(d.cach_xuat) === 'nguyen' ? 'nguyen' : 'tach';
  var nha = chuoi_(d.nha).toUpperCase();
  if (nha && NHA_CHINH.indexOf(nha) < 0) nha = '';
  var tps = (d.thanh_phan || []).map(function (t) {
    var nha = chuoi_(t.nha).toUpperCase();
    if (NHA_TP.indexOf(nha) < 0) nha = 'KHAC';
    var tenTp = chuoi_(t.ten) || chuoi_(t.sku) || '(chưa có tên)';
    return {
      sku: chuoi_(t.sku), ten: tenTp, nha: nha,
      gia_goc: Number(t.gia_goc) || 0, so_luong: Math.max(1, Math.round(Number(t.so_luong) || 1))
    };
  });
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
  [SH.SKU, SH.COMBO, SH.TP, SH.LS, SH.MC, SH.DH, SH.DON].forEach(sheet_);
  var ss = bangTinh_();
  ss.getSheets().forEach(function (s) {
    if (/^(Sheet1|Trang tính1)$/.test(s.getName()) && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  Logger.log('Đã tạo xong các sheet: SKU_NHA, COMBO, COMBO_THANH_PHAN, LICH_SU, MA_CHUAN, LS_DAT_HANG, DON_DA_GHI.');
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
