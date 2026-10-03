/* Kiểm thử ĐƠN WEB ("Danh sách lấy hàng") và SHOPEE "tất cả trạng thái".
 * Chạy: node test/kiemtra-web.js   (cần mau/web.xlsx, mau/shopee-all.xlsx, mau/shopee.xlsx, mau/tiktok.xlsx – không có trên repo) */
'use strict';
var fs = require('fs');
var path = require('path');
var XLSX = require('../lib/xlsx-0.18.5.full.min.js');
var ExcelJS = require('../lib/exceljs-4.4.0.min.js');
var DocFile = require('../js/docfile.js');
var PL = require('../js/phanloai.js');
var XuatFile = require('../js/xuatfile.js');
var GL = require('./gia-lap-apps-script.js');

var MAU = path.join(__dirname, '..', 'mau');
if (['web.xlsx', 'shopee-all.xlsx', 'shopee.xlsx', 'tiktok.xlsx'].some(function (f) { return !fs.existsSync(path.join(MAU, f)); })) {
  console.log('Thiếu file mẫu trong mau/ → bỏ qua.');
  process.exit(0);
}
var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet) : '')); }
}
function doc(f) { return DocFile.parseWorkbook(XLSX.read(fs.readFileSync(path.join(MAU, f)), { type: 'buffer' }), XLSX, f); }
function dem(list) { return list.reduce(function (s, g) { return s + g.lines.length; }, 0); }

console.log('\n1. Đọc file web "Danh sách lấy hàng"');
var web = doc('web.xlsx');
check('Tự nhận là file Web (tiêu đề ở dòng 12, tên cột có khoảng trắng cuối)', web.san === 'Web' && !web.error, web.error);
check('34 dòng dữ liệu (dừng trước dòng "Nhân viên lấy hàng")', web.rows.length === 34, web.rows.length);
check('Đọc "Thời gian xuất: 03/10/2026 17:12"', web.thoiGianXuat === '03/10/2026 17:12', web.thoiGianXuat);
check('Barcode có dấu cách đầu đã trim', web.rows[0].sku === '8935092851334' && web.rows.every(function (r) { return r.sku === r.sku.trim(); }));
check('SL, Giá bìa, Nhà cung cấp đọc đúng', web.rows[1].sl === 3 && web.rows[1].gia === 130000 && web.rows[1].ncc === 'Minh Long Book', web.rows[1]);
check('Dòng barcode trống vẫn đọc (8 dòng)', web.rows.filter(function (r) { return !r.sku; }).length === 8);
// Tìm dòng tiêu đề không cố định: thêm 3 dòng trống phía trên vẫn đọc được
var wbDich = XLSX.read(fs.readFileSync(path.join(MAU, 'web.xlsx')));
var aoa = XLSX.utils.sheet_to_json(wbDich.Sheets.Danh_Sach_Lay_Hang, { header: 1, defval: '' });
var w2 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(w2, XLSX.utils.aoa_to_sheet([['Thông tin thêm'], ['x'], ['y']].concat(aoa)), 'Danh_Sach_Lay_Hang');
check('Dòng tiêu đề nằm chỗ khác vẫn tự tìm ra', DocFile.parseWorkbook(w2, XLSX).rows.length === 34);

console.log('\n2. Phân loại đơn web theo "Nhà cung cấp"');
var kqW = PL.classify(web.rows, { skus: [], combos: [] });
var t = function (n) { return PL.tong(kqW.nha[n]); };
check('Hồng Ân: 8 dòng (15 cuốn)', t('HA').dong === 8 && t('HA').cuon === 15, t('HA'));
check('Khang Việt: 1 dòng (1 cuốn)', t('KV').dong === 1 && t('KV').cuon === 1, t('KV'));
check('Minh Long: 1 dòng (3 cuốn)', t('ML').dong === 1 && t('ML').cuon === 3, t('ML'));
var lyDo = {};
kqW.boQua.forEach(function (g) { lyDo[g.lyDo] = (lyDo[g.lyDo] || 0) + g.lines.length; });
check('Nhà khác: MegaBook 14, Việt Thư 1, Newshop.vn 1 → Đã bỏ qua', lyDo['Nhà khác (Nhà Sách MegaBook)'] === 14 &&
  lyDo['Nhà khác (Việt Thư Books)'] === 1 && lyDo['Nhà khác (Newshop.vn)'] === 1, lyDo);
check('8 dòng "Truyện cổ tích…" (không barcode, không NCC) → Chưa rõ nhà', dem(kqW.chuaRo) === 8 &&
  kqW.chuaRo.every(function (g) { return /^Truyện cổ tích Việt Nam/.test(g.ten); }), dem(kqW.chuaRo));
check('"Toán 9 - Tập 1/Tập 2" là sách lẻ, không phải combo', kqW.combo.length === 0);
check('"Bóc Dán Decal…" của Nhà Sách Hồng Ân vẫn vào Hồng Ân (NCC ưu tiên hơn mọi quy tắc)',
  kqW.nha.HA.some(function (g) { return /Decal/.test(g.ten); }));
check('Cột "Trong kho" bỏ qua: đặt đủ SL (vd Toán 9 Tập 1: kho 0, SL 1)', kqW.nha.HA.some(function (g) { return g.sku === '8935092834108' && g.sl === 1; }));
check('Nhận biến thể tên NCC', PL.nhaTheoNcc('  nhà sách HỒNG ÂN ') === 'HA' && PL.nhaTheoNcc('Cty Khang Viet') === 'KV' &&
  PL.nhaTheoNcc('MINH LONG') === 'ML' && PL.nhaTheoNcc('Nhà Sách MegaBook') === 'KHAC' && PL.nhaTheoNcc('') === '');
var rowNccTrong = { san: 'Web', orderId: '', sku: '8935092845425', ten: 'Hướng Dẫn Giải VIOLYMPIC Toán 1 - HA', phanLoai: '', gia: 48000, sl: 1, ncc: '' };
check('NCC trống → theo quy tắc cũ (mã HA trong tên)', PL.classify([rowNccTrong], {}).nha.HA.length === 1);
check('NCC trống → theo danh mục', PL.classify([Object.assign({}, rowNccTrong, { ten: 'Sách X' })],
  { skus: [{ key: 'sku:8935092845425', sku: '8935092845425', nha: 'KV', nguon: 'tu_hoc' }] }).nha.KV.length === 1);

console.log('\n3. Tự học từ web (nguồn "web")');
var hocW = kqW.hoc;
check('10 barcode HA/KV/ML được học với nguồn "web"', hocW.length === 10 && hocW.every(function (h) { return h.nguon === 'web'; }), hocW.length);
var m = GL.taoMoiTruong();
m.ctx.khoiTao();
m.post('upsertSku', { key: 'sku:8935092851334', sku: '8935092851334', ten: 'Gán tay', nha: 'KV', nguon: 'tay' });
m.post('upsertSkuBatch', { items: [{ key: 'sku:8935092817248', sku: '8935092817248', ten: 'Tự học cũ', nha: 'KV', nguon: 'tu_hoc' }] });
var r = m.post('upsertSkuBatch', { items: hocW });
var e = function (k) { return m.get().skus.filter(function (x) { return x.key === k; })[0]; };
check('Web KHÔNG ghi đè nguồn "tay"', e('sku:8935092851334').nha === 'KV' && e('sku:8935092851334').nguon === 'tay');
check('Web ghi đè "tự học" (ưu tiên hơn)', e('sku:8935092817248').nha === 'HA' && e('sku:8935092817248').nguon === 'web');
r = m.post('upsertSkuBatch', { items: [{ key: 'sku:8935092817248', sku: '8935092817248', ten: 'x', nha: 'ML', nguon: 'tu_hoc' }] });
check('Tự học KHÔNG ghi đè nguồn "web"', e('sku:8935092817248').nha === 'HA' && e('sku:8935092817248').nguon === 'web');
var catW = m.get();
var dongShopee = { san: 'Shopee', orderId: 'S1', sku: '8935092838052', ten: 'Sách - Đề Kiểm Tra, Đánh Giá Lịch Sử 9', phanLoai: '', gia: 72000, sl: 1 };
check('Lần sau barcode đó ở Shopee (tên thiếu mã nhà) vẫn nhận đúng Hồng Ân', PL.classify([dongShopee], catW).nha.HA.length === 1);
var kqLai = PL.classify(web.rows, catW);
check('Thả lại web khi đã học → không học lại', kqLai.hoc.length === 0, kqLai.hoc.map(function (h) { return h.sku; }));
var tuHocShopee = PL.classify([{ san: 'Shopee', orderId: 'S2', sku: '8935092817248', ten: 'Sách X - KV', phanLoai: '', gia: 1, sl: 1 }], catW).hoc;
check('Shopee có mã KV nhưng web đã nói HA → không tự học đè', tuHocShopee.length === 0);

console.log('\n4. Chống trùng file web');
var web2 = doc('web.xlsx');
check('Cùng file (cùng thời gian xuất + nội dung) → cùng dấu nhận diện', web2.webKey === web.webKey);
var w3 = XLSX.utils.book_new();
var aoa3 = aoa.map(function (r) { return r.slice(); });
aoa3[12][3] = 5; // đổi SL dòng 1
XLSX.utils.book_append_sheet(w3, XLSX.utils.aoa_to_sheet(aoa3), 'Danh_Sach_Lay_Hang');
var web3 = DocFile.parseWorkbook(w3, XLSX, 'web-khac.xlsx');
check('File web khác nội dung → khác dấu nhận diện (được cộng dồn)', web3.webKey !== web.webKey);
var dsGop = DocFile.gopFile([{ san: 'Web', rowsGoc: web.rows }, { san: 'Web', rowsGoc: web3.rows }]);
check('2 file web khác nhau → cộng dồn đủ 68 dòng (không chống trùng theo đơn)', dsGop[0].rows.length + dsGop[1].rows.length === 68);

console.log('\n5. Shopee "tất cả trạng thái"');
var all = DocFile.locTrangThai(doc('shopee-all.xlsx'));
check('159 dòng → còn 12 dòng cần lấy, 147 bỏ qua', all.rowsTatCa.length === 159 && all.soDongLay === 12 && all.soDongBoQuaTrangThai === 147,
  [all.rowsTatCa.length, all.soDongLay, all.soDongBoQuaTrangThai]);
var don = {};
all.rowsGoc.forEach(function (x) { don[x.orderId] = 1; });
check('12 dòng = 11 đơn: 11 "Chờ giao hàng" + 1 "Chờ xác nhận"', Object.keys(don).length === 11 &&
  all.rowsGoc.filter(function (x) { return x.trangThai === 'Chờ giao hàng'; }).length === 11 &&
  all.rowsGoc.filter(function (x) { return x.trangThai === 'Chờ xác nhận'; }).length === 1);
var allLai = DocFile.locTrangThai(doc('shopee-all.xlsx'), ['Chờ giao hàng']);
check('Danh sách trạng thái sửa được (chỉ "Chờ giao hàng" → 11 dòng)', allLai.soDongLay === 11);
var toship = DocFile.locTrangThai(doc('shopee.xlsx'));
check('File toship kiểu cũ vẫn chạy (38 dòng, đều "Chờ giao hàng")', toship.soDongLay === 38 && toship.soDongBoQuaTrangThai === 0);
var kqA = PL.classify(all.rowsGoc, { skus: [], combos: [] });
var bl = kqA.nha.HA.filter(function (g) { return /Bộ Lịch Kiến Thức Cần Nhớ/.test(g.ten); })[0];
check('"Chờ xác nhận" – "Sách - Bộ Lịch Kiến Thức…" là sách lẻ Hồng Ân (có "Lịch" nhưng bắt đầu bằng "Sách"; "Bộ" không kèm số → không combo)',
  bl && !kqA.combo.some(function (g) { return /Bộ Lịch/.test(g.ten); }) && !kqA.boQua.some(function (g) { return /Bộ Lịch/.test(g.ten); }), bl && [bl.sku, bl.skuLa]);
check('…SKU của dòng này là mã vạch 8935092831817 (file ghi ở cả 2 cột SKU) → không tô cam', bl && bl.sku === '8935092831817' && !bl.skuLa);
var mc = kqA.combo.filter(function (g) { return /Monte/.test(g.ten); })[0];
check('"Bá tước Monte-Cristo (HA)" phân loại "COMBO 2 QUYỂN" → tab Combo (HA)', mc && mc.nha === 'HA');
var lyA = {};
kqA.boQua.forEach(function (g) { lyA[g.lyDo] = (lyA[g.lyDo] || 0) + g.lines.length; });
check('Lịch, tranh, decal → Đã bỏ qua (7 dòng "Không phải sách")', lyA['Không phải sách'] === 7 &&
  kqA.boQua.filter(function (g) { return /Decal/.test(g.ten); }).length === 2, lyA);
check('Sách mã QB → nhà khác', lyA['Nhà khác (QB)'] === 2);
check('Sách "(STK)" (chưa có trong mã nhà khác) → Chưa rõ nhà', kqA.chuaRo.length === 1 && /\(STK\)/.test(kqA.chuaRo[0].ten));
check('Thêm STK vào mã nhà khác ở Cài đặt → thành "nhà khác"',
  PL.classify(all.rowsGoc, {}, { maKhac: PL.MA_KHAC_MAC_DINH.concat(['STK']) }).chuaRo.length === 0);
var gopSp = DocFile.gopFile([{ san: 'Shopee', rowsGoc: toship.rowsGoc }, { san: 'Shopee', rowsGoc: all.rowsGoc }, { san: 'Shopee', rowsGoc: all.rowsGoc }]);
check('Thả toship + Order_all (+ thả lại Order_all): không cộng 2 lần (chống trùng theo mã đơn)', gopSp[2].soDonMoi === 0 && gopSp[2].soDonTrung === 11);

console.log('\n6. Thả cả 3 loại file + xuất file Hồng Ân');
var tt = doc('tiktok.xlsx');
var ds = DocFile.gopFile([{ san: 'TikTok', rowsGoc: tt.rows }, all, { san: 'Web', rowsGoc: web.rows }]);
var tatCa = ds.reduce(function (a, f) { return a.concat(f.rows); }, []);
var kq3 = PL.classify(tatCa, { skus: [], combos: [] });
check('Tổng dòng = 103 TikTok + 12 Shopee + 34 web = 149', kq3.tongDong === 149, kq3.tongDong);
check('Hồng Ân gồm cả TikTok, Shopee và web', ['TikTok', 'Shopee', 'Web'].every(function (s) {
  return kq3.nha.HA.some(function (g) { return g.nguon.some(function (n) { return n.san === s; }); });
}));
var wb = XuatFile.buildDonDatHang(kq3, 'HA', {}, ExcelJS, new Date(2026, 9, 3));
wb.xlsx.writeBuffer().then(function (buf) {
  var out = path.join(MAU, 'Don-dat-hang_Hong-An_3-nguon.xlsx');
  fs.writeFileSync(out, Buffer.from(buf));
  var ws = wb.worksheets[0];
  var tong = 0;
  for (var j = 2; j <= ws.rowCount; j++) tong += ws.getRow(j).getCell(4).value;
  check('File Hồng Ân: 4 cột, tổng số lượng khớp app (' + PL.tong(kq3.nha.HA).cuon + ' cuốn)', ws.columnCount === 4 && tong === PL.tong(kq3.nha.HA).cuon, tong);
  console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.  File xuất thử: mau/Don-dat-hang_Hong-An_3-nguon.xlsx');
  process.exit(loi ? 1 : 0);
});
