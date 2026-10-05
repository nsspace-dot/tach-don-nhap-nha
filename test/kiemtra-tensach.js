/* Kiểm thử "Tên sách khai báo" + bỏ quy tắc gộp theo tên + khớp mã web theo tên sàn + phân loại.
 * Chạy: node test/kiemtra-tensach.js  (dữ liệu giả lập; phần cuối xuất thử Hồng Ân từ 3 file mẫu trong mau/ nếu có) */
'use strict';
var fs = require('fs');
var path = require('path');
var XLSX = require('../lib/xlsx-0.18.5.full.min.js');
var ExcelJS = require('../lib/exceljs-4.4.0.min.js');
var DocFile = require('../js/docfile.js');
var PL = require('../js/phanloai.js');
var XuatFile = require('../js/xuatfile.js');
var DX = require('../js/danhmuc-excel.js');
var GL = require('./gia-lap-apps-script.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet) : '')); }
}
var L1 = '8935092815947', L2 = '8935092826363', L3 = '8935092821085';
var TEN_SAN = 'Sách Bổ Trợ - Vở Bài Tập Thực Hành Mĩ Thuật Các Lớp (HA)';
function sp(id, sku, ten, pl, gia, sl, san) { return { san: san || 'Shopee', orderId: id, sku: sku, ten: ten, phanLoai: pl, gia: gia, sl: sl || 1 }; }
var rong = function () { return { skus: [], combos: [], ma_chuan: [] }; };
var dong = function (kq) { return XuatFile.dongCuaNha(kq, 'HA'); };

console.log('\n1. 3 lớp cùng listing, khác barcode, cùng giá 45.000 – chưa khai báo tên');
var rows = [sp('1', L1, TEN_SAN, 'LỚP 1', 45000, 2), sp('2', L2, TEN_SAN, 'LỚP 2', 45000, 1), sp('3', L3, TEN_SAN, 'LỚP 3', 45000, 3)];
var kq = PL.classify(rows, rong());
var d = dong(kq);
check('File xuất 3 dòng riêng (không gộp theo tên)', d.length === 3, d);
check('Tên tạm có "– LỚP 1/2/3"', d.map(function (x) { return x.ten; }).join(' | ') ===
  'Vở Bài Tập Thực Hành Mĩ Thuật Các Lớp – LỚP 1 | Vở Bài Tập Thực Hành Mĩ Thuật Các Lớp – LỚP 2 | Vở Bài Tập Thực Hành Mĩ Thuật Các Lớp – LỚP 3', d);
check('Số lượng đúng từng lớp (2 / 1 / 3)', d.map(function (x) { return x.sl; }).join(',') === '2,1,3');
check('Có nhãn "chưa có tên khai báo"', kq.nha.HA.every(function (g) { return g.chuaCoTen && g.nguonTen === 'tam'; }));
check('Có khóa để khai báo tên (theo barcode)', kq.nha.HA.every(function (g) { return /^sku:\d+$/.test(g.khoaTen); }));

console.log('\n2. Khai báo tên cho barcode Lớp 3');
var cat = rong();
cat.skus.push({ key: 'sku:' + L3, sku: L3, ten: TEN_SAN, nha: 'HA', nguon: 'tu_hoc', ten_sach: 'Vở BT Thực Hành Mĩ Thuật 3' });
kq = PL.classify(rows, cat);
d = dong(kq);
check('File xuất dùng đúng tên "Vở BT Thực Hành Mĩ Thuật 3"', d.some(function (x) { return x.ten === 'Vở BT Thực Hành Mĩ Thuật 3' && x.sl === 3; }), d);
check('Lớp 1, 2 vẫn tên tạm riêng; tổng 3 dòng', d.length === 3 && d.filter(function (x) { return /– LỚP [12]$/.test(x.ten); }).length === 2);
check('Dòng đã khai báo không còn nhãn "chưa có tên"', kq.nha.HA.filter(function (g) { return g.sku === L3; })[0].chuaCoTen === false);
check('Sắp theo tên đã khai báo A→Z', d.map(function (x) { return x.ten; }).join('|') ===
  d.map(function (x) { return x.ten; }).sort(function (a, b) { return a.localeCompare(b, 'vi', { sensitivity: 'base' }); }).join('|'));

console.log('\n3. Barcode có trong sổ mã chuẩn web → dùng tên web (khi chưa khai báo tay)');
cat = rong();
cat.ma_chuan.push({ barcode: L2, ten_gon: 'Vở Bài Tập Thực Hành Mĩ Thuật 2', gia_bia: 45000, nha: 'HA' });
kq = PL.classify(rows, cat);
var g2 = kq.nha.HA.filter(function (g) { return g.sku === L2; })[0];
check('Lớp 2 ra tên web, nguồn "web", không nhãn tên tạm', g2.tenGon === 'Vở Bài Tập Thực Hành Mĩ Thuật 2' && g2.nguonTen === 'web' && !g2.chuaCoTen, g2);
cat.skus.push({ key: 'sku:' + L2, sku: L2, ten: TEN_SAN, nha: 'HA', nguon: 'tay', ten_sach: 'Mĩ Thuật 2 (khai báo tay)' });
kq = PL.classify(rows, cat);
check('Khai báo tay thắng tên web', kq.nha.HA.filter(function (g) { return g.sku === L2; })[0].tenGon === 'Mĩ Thuật 2 (khai báo tay)');
// Đơn web: tên của chính file web
kq = PL.classify([{ san: 'Web', orderId: '', sku: L1, ten: 'Vở Bài Tập Thực Hành Mĩ Thuật 1', phanLoai: '', gia: 45000, sl: 4, ncc: 'Nhà Sách Hồng Ân', ngayXuat: '2026-10-04' },
  sp('9', L1, TEN_SAN, 'LỚP 1', 45000, 1)], rong());
check('Đơn web hôm nay cùng barcode với Shopee: gộp 1 dòng, tên web (5 cuốn)', kq.nha.HA.length === 1 && kq.nha.HA[0].sl === 5 &&
  kq.nha.HA[0].tenGon === 'Vở Bài Tập Thực Hành Mĩ Thuật 1', kq.nha.HA.map(function (g) { return [g.sku, g.tenGon, g.sl]; }));

console.log('\n4. Gộp dòng');
kq = PL.classify([sp('1', L1, TEN_SAN, 'LỚP 1', 45000, 2), sp('T1', L1, 'Vở Bài Tập Thực Hành Mĩ Thuật Lớp 1 - HA', 'Lẻ', 45000, 3, 'TikTok')], rong());
check('Cùng barcode ở Shopee + TikTok → 1 dòng (5 cuốn)', kq.nha.HA.length === 1 && kq.nha.HA[0].sl === 5, kq.nha.HA);
kq = PL.classify([sp('1', '1111111', 'Toán 9 Tập 1 - HA', '', 50000, 2), sp('2', '2222222', 'Toán 9 Tập 1 (HA)', '', 50000, 3)], rong());
check('2 barcode khác nhau, cùng tên + cùng giá → 2 dòng', dong(kq).length === 2, dong(kq));
kq = PL.classify([sp('1', '', 'Truyện Cổ Tích - HA', 'Tập 1', 30000, 1), sp('2', 'ABC', 'Truyện Cổ Tích - HA', 'Tập 1', 30000, 2, 'TikTok'),
  sp('3', '', 'Truyện Cổ Tích - HA', 'Tập 2', 30000, 1), sp('4', '', 'Truyện Cổ Tích - HA', 'Tập 1', 35000, 1)], rong());
d = dong(kq);
check('SKU trống / dạng chữ: cùng tên + phân loại + giá → gộp; khác phân loại hoặc khác giá → tách', d.length === 3 &&
  d.some(function (x) { return x.ten === 'Truyện Cổ Tích – Tập 1' && x.gia === 30000 && x.sl === 3; }) &&
  d.some(function (x) { return x.ten === 'Truyện Cổ Tích – Tập 2'; }) && d.some(function (x) { return x.gia === 35000; }), d);

console.log('\n5. Phân loại vô nghĩa');
check('"LẺ", "Not Specified", "Default", "Mặc định", trống → không ghép', ['LẺ', 'Not Specified', 'default', 'Mặc định', ''].every(function (p) { return !PL.plCoNghia(p, 'Sách A'); }));
check('Phân loại đã có trong tên → không ghép', PL.tenTam('Toán Lớp 3 - HA', 'lớp 3') === 'Toán Lớp 3');
check('Danh sách trong Cài đặt dùng được ("Bìa mềm")', PL.tenTam('Toán Vui - HA', 'Bìa mềm', null, ['Bìa mềm']) === 'Toán Vui' &&
  PL.tenTam('Toán Vui - HA', 'Bìa mềm') === 'Toán Vui – Bìa mềm', [PL.tenTam('Toán Vui - HA', 'Bìa mềm', null, ['Bìa mềm']), PL.tenTam('Toán Vui - HA', 'Bìa mềm')]);

console.log('\n6. Khớp với mã web theo TÊN SÀN + PHÂN LOẠI');
cat = rong();
cat.ma_chuan.push({ barcode: L3, ten_gon: 'Vở Bài Tập Thực Hành Mĩ Thuật Các Lớp Lớp 3', gia_bia: 45000, nha: 'HA' });
kq = PL.classify([sp('1', '', TEN_SAN, 'LỚP 3', 45000, 1), sp('2', '', TEN_SAN, 'LỚP 1', 45000, 2)], cat);
var g3 = kq.nha.HA.filter(function (g) { return g.sku === L3; })[0];
check('Listing "… Các Lớp" phân loại LỚP 3 (SKU trống) → khớp chắc cuốn web Lớp 3', g3 && g3.sl === 1 && g3.quyVeWeb, kq.nha.HA.map(function (g) { return [g.sku, g.sl, g.tenGon]; }));
check('Phân loại LỚP 1 KHÔNG bị quy về cuốn web Lớp 3', kq.nha.HA.filter(function (g) { return g.sku === L3; }).every(function (g) { return g.sl === 1; }) &&
  kq.maPhu.every(function (x) { return x.key.indexOf('lớp 1') < 0; }), kq.maPhu);
check('Không hỏi "có thể cùng cuốn" giữa Lớp 1 và cuốn web Lớp 3 (số lớp khác nhau)', !kq.cungCuon.some(function (c) { return c.maChuan === L3 && /lớp 1/i.test(c.phanLoai); }), kq.cungCuon);
// Tái bản: barcode mới cùng listing khác lớp không bị coi là tái bản
cat = rong();
cat.skus.push({ key: 'sku:' + L1, sku: L1, ten: TEN_SAN, nha: 'HA', nguon: 'tu_hoc', phan_loai: 'LỚP 1' });
kq = PL.classify([sp('1', L2, TEN_SAN, 'LỚP 2', 45000, 1)], cat);
check('Barcode Lớp 2 không bị nhắc "tái bản" của Lớp 1', kq.taiBan.length === 0, kq.taiBan);
kq = PL.classify([sp('1', '8935092999995', TEN_SAN, 'LỚP 1', 50000, 1)], cat);
check('Barcode mới cùng tên + cùng phân loại Lớp 1 → vẫn nhắc tái bản', kq.taiBan.length === 1 && kq.taiBan[0].maCu === L1, kq.taiBan);
check('Tự học ghi kèm phân loại (để gợi ý tên)', PL.classify([sp('1', L2, TEN_SAN, 'LỚP 2', 45000, 1)], rong()).hoc[0].phan_loai === 'LỚP 2');

console.log('\n7. Thành phần combo');
cat = rong();
cat.combos.push({ combo_id: 'C1', ten_combo: 'Combo Mĩ Thuật 1 + 3', khoa: ['sku:CB1'], cach_xuat: 'tach', thanh_phan: [
  { sku: L1, ten: 'Mĩ thuật lớp 1 (tên trong combo)', nha: 'HA', gia_goc: 45000, so_luong: 1 },
  { sku: L3, ten: 'Mĩ thuật lớp 3 (tên trong combo)', nha: 'HA', gia_goc: 45000, so_luong: 1 },
  { sku: L2, ten: 'Mĩ thuật lớp 2 (tên trong combo)', nha: 'HA', gia_goc: 45000, so_luong: 1 }] });
cat.skus.push({ key: 'sku:' + L3, sku: L3, ten: TEN_SAN, nha: 'HA', nguon: 'tay', ten_sach: 'Vở BT Thực Hành Mĩ Thuật 3' });
cat.ma_chuan.push({ barcode: L2, ten_gon: 'Vở Bài Tập Thực Hành Mĩ Thuật 2', gia_bia: 45000, nha: 'HA' });
kq = PL.classify([sp('1', 'CB1', 'Combo Mĩ Thuật 1 + 3 - HA', '', 135000, 1)], cat);
var ten = function (s) { return kq.nha.HA.filter(function (g) { return g.sku === s; })[0].tenGon; };
check('Ưu tiên: danh mục (tay) → tên web → tên khai báo trong combo', ten(L3) === 'Vở BT Thực Hành Mĩ Thuật 3' && ten(L2) === 'Vở Bài Tập Thực Hành Mĩ Thuật 2' &&
  ten(L1) === 'Mĩ thuật lớp 1 (tên trong combo)', [ten(L1), ten(L2), ten(L3)]);
check('Thành phần combo không có nhãn "chưa có tên"', kq.nha.HA.every(function (g) { return !g.chuaCoTen; }));

console.log('\n8. Apps Script: khai báo tên, tự học không ghi đè');
var m = GL.taoMoiTruong();
m.ctx.khoiTao();
var r = m.post('upsertSkuBatch', { items: [{ key: 'sku:' + L3, sku: L3, ten: TEN_SAN, nha: 'HA', nguon: 'tu_hoc', phan_loai: 'LỚP 3' }] });
check('Tự học lưu phân loại', r.catalog.skus[0].phan_loai === 'LỚP 3' && !r.catalog.skus[0].ten_sach, r.catalog.skus[0]);
r = m.post('luuTenSach', { key: 'sku:' + L3, ten_sach: 'Vở BT Thực Hành Mĩ Thuật 3' });
check('luuTenSach: lưu tên, giữ nguyên nhà + nguồn', r.catalog.skus[0].ten_sach === 'Vở BT Thực Hành Mĩ Thuật 3' && r.catalog.skus[0].nguon === 'tu_hoc' && r.catalog.skus[0].nha === 'HA', r.catalog.skus[0]);
r = m.post('upsertSkuBatch', { items: [{ key: 'sku:' + L3, sku: L3, ten: 'Tên sàn khác', nha: 'KV', nguon: 'web', ten_sach: 'TỰ HỌC ĐÈ' }] });
check('Tự học / web KHÔNG ghi đè tên đã khai báo', r.catalog.skus[0].ten_sach === 'Vở BT Thực Hành Mĩ Thuật 3', r.catalog.skus[0]);
r = m.post('upsertSku', { key: 'sku:' + L3, sku: L3, ten: TEN_SAN, nha: 'HA', nguon: 'tay' });
check('Đổi nhà bằng tay vẫn giữ tên đã khai báo', r.catalog.skus[0].ten_sach === 'Vở BT Thực Hành Mĩ Thuật 3' && r.catalog.skus[0].nguon === 'tay');
r = m.post('luuTenSach', { items: [{ key: 'sku:' + L1, sku: L1, ten: TEN_SAN, nha: 'HA', ten_sach: 'Vở BT Thực Hành Mĩ Thuật 1', phan_loai: 'LỚP 1' }] });
check('Khai báo hàng loạt: sách chưa có trong danh mục → tạo mới nguồn tay', r.soTenSach === 1 &&
  r.catalog.skus.some(function (e) { return e.key === 'sku:' + L1 && e.nguon === 'tay' && e.ten_sach === 'Vở BT Thực Hành Mĩ Thuật 1'; }));
var ls = m.get({ action: 'lichSu' }).lich_su;
check('Ghi Lịch sử "luuTenSach"', ls.some(function (x) { return x.hanh_dong === 'luuTenSach'; }));
var sh = m.ss.getSheetByName('SKU_NHA').data[0];
check('Sheet SKU_NHA có cột ten_sach, phan_loai', sh.indexOf('ten_sach') === 11 && sh.indexOf('phan_loai') === 12, sh);
// Sheet cũ thiếu cột → tự thêm tiêu đề, không mất dữ liệu
var m2 = GL.taoMoiTruong();
m2.ctx.khoiTao();
var s2 = m2.ss.getSheetByName('SKU_NHA');
var cu = ['key', 'sku', 'ten', 'nha', 'nguon', 'cap_nhat', 'gia_gan_nhat', 'ngay_gia', 'ma_moi', 'khong_tai_ban', 'nguon_ma'];
s2.data = [cu.slice(), ['sku:' + L3, L3, TEN_SAN, 'HA', 'tay', '', '', '', '', '', '']];
r = m2.get();
check('Sheet cũ (11 cột): đọc được, dữ liệu còn nguyên', r.skus.length === 1 && r.skus[0].nha === 'HA' && r.skus[0].ten === TEN_SAN, r.skus);
m2.post('luuTenSach', { key: 'sku:' + L3, ten_sach: 'Mĩ Thuật 3' });
check('Sau khi ghi: tiêu đề có thêm ten_sach, phan_loai; tên được lưu', s2.data[0].indexOf('ten_sach') === 11 && m2.get().skus[0].ten_sach === 'Mĩ Thuật 3', s2.data[0]);

console.log('\n9. Excel danh mục có cột Tên sách');
var wb = DX.xuat({ skus: [{ key: 'sku:' + L3, sku: L3, ten: TEN_SAN, nha: 'HA', nguon: 'tay', ten_sach: 'Mĩ Thuật 3', phan_loai: 'LỚP 3' }], combos: [] }, XLSX);
var hang = XLSX.utils.sheet_to_json(wb.Sheets.SKU_NHA, { header: 1 });
check('Xuất: có cột ten_sach', hang[0].indexOf('ten_sach') >= 0 && hang[1][hang[0].indexOf('ten_sach')] === 'Mĩ Thuật 3', hang);
var nap = DX.nap(XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })), XLSX);
check('Nạp lại: giữ tên sách + phân loại', nap.skus[0].ten_sach === 'Mĩ Thuật 3' && nap.skus[0].phan_loai === 'LỚP 3', nap.skus);
var wsTv = XLSX.utils.aoa_to_sheet([['sku', 'Tên sách', 'ten', 'nha'], [L1, 'Mĩ Thuật 1', TEN_SAN, 'HA']]);
var wbTv = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wbTv, wsTv, 'SKU_NHA');
check('Nạp file có cột tiêu đề "Tên sách" (tiếng Việt)', DX.nap(wbTv, XLSX).skus[0].ten_sach === 'Mĩ Thuật 1');
var wsKo = XLSX.utils.aoa_to_sheet([['sku', 'ten', 'nha'], [L1, TEN_SAN, 'HA']]);
var wbKo = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wbKo, wsKo, 'SKU_NHA');
check('File không có cột Tên sách → không đụng tên đã khai báo', !('ten_sach' in DX.nap(wbKo, XLSX).skus[0]));
r = m.post('importBatch', { skus: [{ key: 'sku:' + L3, sku: L3, ten: TEN_SAN, nha: 'HA', nguon: 'tay' }] });
check('importBatch không có ten_sach → giữ tên cũ', r.catalog.skus.filter(function (e) { return e.key === 'sku:' + L3; })[0].ten_sach === 'Vở BT Thực Hành Mĩ Thuật 3');

// ---------- Xuất thử Hồng Ân từ 3 file mẫu ----------
var MAU = path.join(__dirname, '..', 'mau');
var can = ['tiktok.xlsx', 'shopee.xlsx', 'web.xlsx'];
if (can.every(function (f) { return fs.existsSync(path.join(MAU, f)); })) {
  console.log('\n10. Xuất thử Hồng Ân từ 3 file mẫu (TikTok + Shopee + web, danh mục rỗng)');
  var files = can.map(function (f) { var p = DocFile.parseWorkbook(XLSX.read(fs.readFileSync(path.join(MAU, f))), XLSX, f); return DocFile.locTrangThai(p); });
  DocFile.gopFile(files);
  var tatCa = files.reduce(function (a, p) { return a.concat(p.rows); }, []);
  var kqM = PL.classify(tatCa, rong());
  var dm = XuatFile.dongCuaNha(kqM, 'HA');
  var theoMa = {};
  kqM.nha.HA.forEach(function (g) { if (PL.isBarcode(g.sku)) theoMa[g.sku + '|' + g.gia] = (theoMa[g.sku + '|' + g.gia] || 0) + 1; });
  check('Mỗi barcode + giá chỉ 1 dòng', Object.keys(theoMa).every(function (k) { return theoMa[k] === 1; }));
  check('Số dòng file = số nhóm (không gộp theo tên)', dm.length === kqM.nha.HA.length, [dm.length, kqM.nha.HA.length]);
  check('Tổng cuốn khớp', dm.reduce(function (s, x) { return s + x.sl; }, 0) === PL.tong(kqM.nha.HA).cuon);
  var mt = dm.filter(function (x) { return /Mĩ Thuật Các Lớp/.test(x.ten); });
  check('"Vở Bài Tập Thực Hành Mĩ Thuật Các Lớp" có ghi lớp trong tên', mt.length > 0 && mt.every(function (x) { return /– LỚP \d/.test(x.ten); }), mt);
  var out = path.join(MAU, 'Don-dat-hang_Hong-An_3-nguon_ten-sach.xlsx');
  XuatFile.buildDonDatHang(kqM, 'HA', {}, ExcelJS, new Date(2026, 9, 5)).xlsx.writeBuffer().then(function (buf) {
    fs.writeFileSync(out, Buffer.from(buf));
    console.log('  📄 ' + path.relative(path.join(__dirname, '..'), out) + ' – ' + dm.length + ' dòng, ' + PL.tong(kqM.nha.HA).cuon + ' cuốn');
    ketThuc();
  });
} else ketThuc();

function ketThuc() {
  console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
  if (loi) process.exitCode = 1;
}
