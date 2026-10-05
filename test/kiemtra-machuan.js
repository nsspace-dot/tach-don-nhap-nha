/* Kiểm thử "Sổ mã chuẩn" (barcode web làm gốc), khớp sách lẻ trùng, listing cần sửa barcode.
 * Chạy: node test/kiemtra-machuan.js  (dữ liệu giả lập; phần cuối dùng mau/web.xlsx nếu có) */
'use strict';
var fs = require('fs');
var path = require('path');
var XLSX = require('../lib/xlsx-0.18.5.full.min.js');
var ExcelJS = require('../lib/exceljs-4.4.0.min.js');
var DocFile = require('../js/docfile.js');
var PL = require('../js/phanloai.js');
var XuatFile = require('../js/xuatfile.js');
var GL = require('./gia-lap-apps-script.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet) : '')); }
}
// Barcode hợp lệ EAN-13
var W1 = '8935092851334', S1 = '8935092845425', W2 = '8935092834108', SAI = '8935092845426';
function web(sku, ten, gia, sl, ncc) { return { san: 'Web', orderId: '', sku: sku, ten: ten, phanLoai: '', gia: gia, sl: sl, ncc: ncc || 'Nhà Sách Hồng Ân', ngayXuat: '2026-10-04' }; }
function sp(id, sku, ten, gia, sl, san) { return { san: san || 'Shopee', orderId: id, sku: sku, ten: ten, phanLoai: '', gia: gia, sl: sl || 1 }; }
var catRong = { skus: [], combos: [], ma_chuan: [] };
var tong = function (kq, n, sku) { return kq.nha[n].filter(function (g) { return g.sku === sku; }).reduce(function (s, g) { return s + g.sl; }, 0); };

console.log('\n1. Khớp chắc: tên làm gọn trùng hẳn + cùng giá → tự quy về barcode web');
check('Số kiểm tra EAN-13', PL.ean13HopLe(W1) && PL.ean13HopLe(S1) && !PL.ean13HopLe(SAI));
var rows = [
  web(W1, 'Bồi Dưỡng Học Sinh Giỏi Sinh Học 8 (Dùng Chung Cho Các Bộ SGK Hiện Hành)', 108000, 2),
  sp('A1', S1, 'Sách Tham Khảo - Bồi Dưỡng Học Sinh Giỏi Sinh Học 8 (Dùng Chung Cho Các Bộ SGK Hiện Hành) - HA - Newshop', 108000, 3),
  sp('A2', '', 'Sách - Bồi dưỡng học sinh giỏi Sinh học 8 (Dùng chung cho các bộ SGK hiện hành) - HA', 108000, 1, 'TikTok')
];
var kq = PL.classify(rows, catRong);
check('Gộp 1 dòng Hồng Ân mã web ' + W1 + ': 2 (web) + 3 (Shopee) + 1 (TikTok SKU trống) = 6', kq.nha.HA.length === 1 && tong(kq, 'HA', W1) === 6,
  kq.nha.HA.map(function (g) { return [g.sku, g.sl, g.tenGon]; }));
check('Dùng tên đã làm gọn của bản web', kq.nha.HA[0].tenGon === 'Bồi Dưỡng Học Sinh Giỏi Sinh Học 8 (Dùng Chung Cho Các Bộ SGK Hiện Hành)');
check('Ghi chú "đã quy về mã web"', kq.nha.HA[0].quyVeWeb === true);
check('Lưu mã phụ → mã chính, nguồn "web tự khớp" (cả listing có SKU và listing SKU trống)', kq.maPhu.length === 2 &&
  kq.maPhu.every(function (x) { return x.ma_moi === W1 && x.nguon_ma === 'web_tu_khop'; }) &&
  kq.maPhu.some(function (x) { return x.key === 'sku:' + S1; }) && kq.maPhu.some(function (x) { return /^ten:/.test(x.key); }), kq.maPhu);
check('Listing cần sửa barcode: 2 dòng, lý do "khớp chắc"', kq.listingCanSua.length === 2 && kq.listingCanSua.every(function (l) { return l.lyDo === 'khớp chắc' && l.maMoi === W1; }) &&
  kq.listingCanSua.some(function (l) { return l.maCu === S1 && l.san === 'Shopee'; }) && kq.listingCanSua.some(function (l) { return l.maCu === '(trống)'; }), kq.listingCanSua);
check('Sổ mã chuẩn: ghi barcode web hôm nay', kq.maChuan.length === 1 && kq.maChuan[0].barcode === W1 && kq.maChuan[0].gia_bia === 108000 &&
  kq.maChuan[0].nha === 'HA' && kq.maChuan[0].ngay_thay === '2026-10-04', kq.maChuan);
var file = XuatFile.dongCuaNha(kq, 'HA');
check('File Hồng Ân: 1 dòng, SL 6', file.length === 1 && file[0].sl === 6, file);

console.log('\n2. Khớp vừa → hỏi, không tự gộp');
kq = PL.classify([web(W1, 'Bồi Dưỡng Học Sinh Giỏi Sinh Học 8', 108000, 1), sp('B1', S1, 'Sách - Bồi Dưỡng Học Sinh Giỏi Sinh Học 8 - HA', 98000, 2)], catRong);
check('Tên trùng hẳn, khác giá → hiện "Có thể cùng 1 cuốn", KHÔNG gộp', kq.cungCuon.length === 1 && kq.cungCuon[0].maChuan === W1 &&
  /khác giá/.test(kq.cungCuon[0].lyDo) && tong(kq, 'HA', S1) === 2 && tong(kq, 'HA', W1) === 1 && !kq.maPhu.length, kq.cungCuon);
kq = PL.classify([web(W1, 'Bồi Dưỡng Học Sinh Giỏi Sinh Học Lớp 8', 108000, 1), sp('B2', S1, 'Sách - Bồi Dưỡng Học Sinh Giỏi Sinh Học Lớp 08 - HA', 100000, 1)], catRong);
check('Tên giống ≥ 90%, cùng nhà, giá chênh ≤ 15% → hỏi', kq.cungCuon.length === 1 && /Tên giống 9\d%/.test(kq.cungCuon[0].lyDo), kq.cungCuon);
kq = PL.classify([web(W1, 'Bồi Dưỡng Học Sinh Giỏi Sinh Học Lớp 8', 108000, 1), sp('B3', S1, 'Sách - Bồi Dưỡng Học Sinh Giỏi Sinh Học Lớp 08 - KV', 100000, 1)], catRong);
check('…khác nhà → không hỏi', kq.cungCuon.length === 0);
kq = PL.classify([web(W1, 'Bồi Dưỡng Học Sinh Giỏi Sinh Học Lớp 8', 108000, 1), sp('B4', S1, 'Sách - Bồi Dưỡng Học Sinh Giỏi Sinh Học Lớp 08 - HA', 80000, 1)], catRong);
check('…giá chênh > 15% → không hỏi', kq.cungCuon.length === 0);
kq = PL.classify([web(W1, 'Bồi Dưỡng Học Sinh Giỏi Sinh Học Lớp 8', 108000, 1), sp('B5', S1, 'Sách - Bồi Dưỡng Học Sinh Giỏi Hóa Học Lớp 9 - HA', 108000, 1)], catRong);
check('…tên giống < 90% → không hỏi', kq.cungCuon.length === 0);
check('Độ giống tên', PL.giongTen('abc', 'abc') === 1 && PL.giongTen('boi duong sinh hoc lop 8', 'boi duong sinh hoc lop 8.') > 0.9);

console.log('\n3. Lưu lên Google Sheets (Code.gs giả lập)');
var m = GL.taoMoiTruong();
m.ctx.khoiTao();
kq = PL.classify(rows, catRong);
var r = m.post('upsertSkuBatch', { items: kq.hoc, gia: [], maChuan: kq.maChuan, maPhu: kq.maPhu });
check('Ghi gom 1 lần: sổ mã chuẩn + 2 mã phụ', r.ok && r.soMaChuan.moi === 1 && r.soMaPhu === 2, r);
var cat = function () { var g = m.get(); return { skus: g.skus, combos: g.combos, ma_chuan: g.ma_chuan }; };
var c = cat();
check('GET trả về sổ mã chuẩn', c.ma_chuan.length === 1 && c.ma_chuan[0].barcode === W1 && Number(c.ma_chuan[0].gia_bia) === 108000);
var mpS1 = c.skus.filter(function (e) { return e.key === 'sku:' + S1; })[0];
check('Mã phụ S1 → W1, nguon_ma "web_tu_khop"', mpS1 && mpS1.ma_moi === W1 && mpS1.nguon_ma === 'web_tu_khop', mpS1);
var lsTom = m.get({ action: 'lichSu' }).lich_su.filter(function (x) { return x.hanh_dong === 'soMaChuan'; });
check('LICH_SU ghi 1 dòng tóm tắt sổ mã chuẩn', lsTom.length === 1 && /thêm 1 barcode/.test(JSON.parse(lsTom[0].du_lieu_moi).ghi_chu));
// Ngày hôm sau, KHÔNG có file web: listing sàn vẫn quy về mã web nhờ mã phụ đã lưu
kq = PL.classify([sp('C1', S1, 'Sách - Bồi Dưỡng Học Sinh Giỏi Sinh Học 8 - HA', 108000, 4)], cat());
check('Hôm sau không có file web: listing S1 vẫn ra mã web W1, tên bản web, lý do "khớp chắc"', tong(kq, 'HA', W1) === 4 &&
  kq.nha.HA[0].tenGon === 'Bồi Dưỡng Học Sinh Giỏi Sinh Học 8 (Dùng Chung Cho Các Bộ SGK Hiện Hành)' && kq.listingCanSua[0].lyDo === 'khớp chắc', kq.listingCanSua);
r = m.post('upsertMaChuan', { items: [{ barcode: W1, ten_gon: 'Tên cũ', gia_bia: 90000, ncc: 'Nhà Sách Hồng Ân', nha: 'HA', ngay_thay: '2026-01-01' }] });
check('Nạp file web cũ hơn KHÔNG đè bản mới trong sổ', r.soMaChuan.doi === 0 && Number(cat().ma_chuan[0].gia_bia) === 108000);
r = m.post('upsertMaChuan', { items: [{ barcode: W1, ten_gon: 'Bồi Dưỡng Học Sinh Giỏi Sinh Học 8 (Dùng Chung Cho Các Bộ SGK Hiện Hành)', gia_bia: 115000, ncc: 'Nhà Sách Hồng Ân', nha: 'HA', ngay_thay: '2026-10-05' },
  { barcode: W2, ten_gon: 'Phân Loại Và Giải Chi Tiết Toán 9 - Tập 1', gia_bia: 105000, ncc: 'Nhà Sách Hồng Ân', nha: 'HA', ngay_thay: '2026-09-01' }] });
check('Nạp nhiều file web: thêm mới + cập nhật bản mới hơn', r.soMaChuan.moi === 1 && r.soMaChuan.doi === 1 && cat().ma_chuan.length === 2);

console.log('\n4. "Không phải" / "Đúng, cùng cuốn"');
var hoi = PL.classify([sp('D1', '8935092838052', 'Sách - Phân Loại Và Giải Chi Tiết Toán 9 - Tập 1 - HA', 99000, 1)], cat());
check('Tên trùng sổ nhưng khác giá → hỏi', hoi.cungCuon.length === 1 && hoi.cungCuon[0].maChuan === W2, hoi.cungCuon);
r = m.post('boQuaCungCuon', { barcode: W2, khoa: hoi.cungCuon[0].khoa });
check('"Không phải" → ghi nhớ + LICH_SU', r.ok && cat().ma_chuan.filter(function (e) { return e.barcode === W2; })[0].khong_phai === 'sku:8935092838052');
check('…lần sau không hỏi lại', PL.classify([sp('D2', '8935092838052', 'Sách - Phân Loại Và Giải Chi Tiết Toán 9 - Tập 1 - HA', 99000, 1)], cat()).cungCuon.length === 0);
hoi = PL.classify([sp('E1', '8935092817248', 'Sách - Phân Loại Và Giải Chi Tiết Toán 9 - Tập 1 (HA)', 100000, 2)], cat());
check('Listing khác cũng tên đó → vẫn hỏi (ghi nhớ theo từng listing)', hoi.cungCuon.length === 1);
r = m.post('luuMaPhu', { key: hoi.cungCuon[0].khoa, sku: '8935092817248', ten: hoi.cungCuon[0].ten, ma_moi: W2, nha: 'HA' });
var eXn = cat().skus.filter(function (e) { return e.key === 'sku:8935092817248'; })[0];
check('"Đúng, cùng cuốn" → lưu mã phụ, nguồn "tay"', r.ok && eXn.ma_moi === W2 && eXn.nguon === 'tay' && eXn.nguon_ma === 'xac_nhan', eXn);
kq = PL.classify([sp('E2', '8935092817248', 'Sách - Phân Loại Và Giải Chi Tiết Toán 9 - Tập 1 (HA)', 100000, 2)], cat());
check('…lần sau tự tính vào mã web, lý do "tôi xác nhận"', tong(kq, 'HA', W2) === 2 && kq.listingCanSua[0].lyDo === 'tôi xác nhận', kq.listingCanSua);

console.log('\n5. Không bao giờ ghi đè dữ liệu gán tay');
var catTay = { skus: [{ key: 'sku:' + S1, sku: S1, ten: 'X', nha: 'KV', nguon: 'tay' }], combos: [], ma_chuan: [] };
kq = PL.classify(rows, catTay);
check('Listing đang "gán tay" → KHÔNG tự quy về mã web', kq.nha.KV.some(function (g) { return g.sku === S1; }) && !kq.maPhu.some(function (x) { return x.key === 'sku:' + S1; }));
var m3 = GL.taoMoiTruong(); m3.ctx.khoiTao();
m3.post('upsertSku', { key: 'sku:' + S1, sku: S1, ten: 'X', nha: 'KV', nguon: 'tay' });
r = m3.post('upsertSkuBatch', { items: [], maPhu: [{ key: 'sku:' + S1, sku: S1, ma_moi: W1, nguon_ma: 'web_tu_khop' }] });
var eTay = m3.get().skus[0];
check('Code.gs: tự khớp gửi lên cũng không đè dòng gán tay', r.soMaPhu === 0 && !eTay.ma_moi && eTay.nha === 'KV' && eTay.nguon === 'tay', eTay);
r = m3.post('upsertSkuBatch', { items: [{ key: 'sku:' + S1, sku: S1, ten: 'Y', nha: 'HA', nguon: 'web' }] });
check('Web không đè gán tay', m3.get().skus[0].nha === 'KV');
var m4 = GL.taoMoiTruong(); m4.ctx.khoiTao();
m4.post('upsertSkuBatch', { items: [], maPhu: [{ key: 'sku:' + S1, sku: S1, ten: 'S', ma_moi: W1, nha: 'HA', nguon_ma: 'web_tu_khop' }] });
r = m4.post('upsertSkuBatch', { items: [{ key: 'sku:' + S1, sku: S1, ten: 'S', nha: 'KV', nguon: 'tu_hoc' }, { key: 'sku:' + S1, sku: S1, ten: 'S', nha: 'ML', nguon: 'web' }] });
check('Mã phụ > web > tự học: tự học / web không đè dòng mã phụ', m4.get().skus[0].ma_moi === W1 && m4.get().skus[0].nha === 'HA', m4.get().skus[0]);

console.log('\n6. Mã sai số kiểm tra');
kq = PL.classify([sp('F1', SAI, 'Sách - Một Cuốn Bất Kỳ - HA', 50000, 1)], catRong);
check('Barcode sàn sai số kiểm tra → vào "Listing cần sửa barcode"', kq.listingCanSua.length === 1 && kq.listingCanSua[0].lyDo === 'mã sai số kiểm tra' && kq.listingCanSua[0].maCu === SAI);

console.log('\n7. File web thật (mau/web.xlsx)');
if (fs.existsSync(path.join(__dirname, '..', 'mau', 'web.xlsx'))) {
  var w = DocFile.parseWorkbook(XLSX.read(fs.readFileSync(path.join(__dirname, '..', 'mau', 'web.xlsx'))), XLSX, 'web.xlsx');
  check('Ngày xuất 2026-10-03 gắn vào từng dòng', w.ngayXuat === '2026-10-03' && w.rows.every(function (x) { return x.ngayXuat === '2026-10-03'; }));
  var kw = PL.classify(w.rows, catRong);
  check('26 barcode web vào sổ mã chuẩn (gồm cả nhà khác)', kw.maChuan.length === 26 && kw.maChuan.some(function (x) { return /MegaBook/.test(x.ncc) && x.nha === ''; }), kw.maChuan.length);
  var m5 = GL.taoMoiTruong(); m5.ctx.khoiTao();
  r = m5.post('upsertSkuBatch', { items: kw.hoc, maChuan: kw.maChuan });
  var kw2 = PL.classify(w.rows, { skus: m5.get().skus, combos: [], ma_chuan: m5.get().ma_chuan });
  check('Thả lại cùng file web sau khi đã ghi sổ → không ghi lại', r.soMaChuan.moi === 26 && kw2.maChuan.length === 0, kw2.maChuan.length);
} else console.log('  (bỏ qua – không có mau/web.xlsx)');

console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
process.exit(loi ? 1 : 0);
