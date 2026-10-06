/* Kiểm thử "🏷️ Sửa / bổ sung barcode": gán barcode cho SKU trống / SKU chữ, sửa barcode sai (mã phụ),
 * thành phần combo chưa có SKU, ghi đè có hỏi, hoàn tác, Excel, listing cần sửa, lịch sử đặt hàng.
 * Chạy: node test/kiemtra-barcode.js  (dữ liệu giả lập) */
'use strict';
var XLSX = require('../lib/xlsx-0.18.5.full.min.js');
var PL = require('../js/phanloai.js');
var XuatFile = require('../js/xuatfile.js');
var DX = require('../js/danhmuc-excel.js');
var TK = require('../js/thongke.js');
var GL = require('./gia-lap-apps-script.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet) : '')); }
}
function sp(id, sku, ten, pl, gia, sl, san) { return { san: san || 'Shopee', orderId: id, sku: sku, ten: ten, phanLoai: pl, gia: gia, sl: sl || 1 }; }
function lichSu(m) { return m.get({ action: 'lichSu' }).lich_su; }
var X = '8935092843094', SAI = '8925092840048', DUNG = '8935092840048';
var TEN = 'Sách - Bồi Dưỡng HSG Sinh Học Cấp 2 - HA - Newshop';
var nhom = function (kq, n, sku) { return kq.nha[n].filter(function (g) { return g.sku === sku; }); };

console.log('\n1. SKU trống "Bồi Dưỡng HSG Sinh Học Cấp 2 – Lớp 7" → gán barcode X');
var rows = [sp('1', '', TEN, 'Lớp 7', 95000, 2), sp('T1', X, 'Bồi Dưỡng HSG Sinh Học 7 (HA)', 'Lẻ', 95000, 3, 'TikTok')];
var m = GL.taoMoiTruong();
m.ctx.khoiTao();
var kq = PL.classify(rows, m.get());
check('Trước: 2 dòng riêng (SKU trống / barcode X)', kq.nha.HA.length === 2);
var khoa = PL.khoaBarcode(rows[0]);
check('Khóa dòng SKU trống = tên sàn|phân loại', khoa === PL.tenKey(TEN, 'Lớp 7'), khoa);
var catTruoc = JSON.stringify(m.get());
var r = m.post('ganBarcode', { items: [{ key: khoa, sku: '', ten: TEN, phan_loai: 'Lớp 7' }], ma_moi: X, nha: 'HA', ten_sach: 'Bồi Dưỡng HSG Sinh Học 7' });
check('Lưu được, ghi LICH_SU "ganBarcode"', r.ok && lichSu(m)[0].hanh_dong === 'ganBarcode', r.error);
var lsGan = lichSu(m)[0].dong;
var e = m.get().skus.filter(function (x) { return x.key === khoa; })[0];
check('Ánh xạ khóa → barcode, nguồn tay, nguon_ma gan_tay', e && e.ma_moi === X && e.nguon === 'tay' && e.nguon_ma === 'gan_tay', e);
var eX = m.get().skus.filter(function (x) { return x.key === 'sku:' + X; })[0];
check('Barcode mới chưa có → tạo luôn với nhà + tên sách', eX && eX.nha === 'HA' && eX.ten_sach === 'Bồi Dưỡng HSG Sinh Học 7' && eX.nguon === 'tay', eX);
kq = PL.classify(rows, m.get());
check('Lần sau: tự nhận X, gộp chung với đơn TikTok cùng barcode (5 cuốn, 1 dòng)', kq.nha.HA.length === 1 && nhom(kq, 'HA', X)[0].sl === 5,
  kq.nha.HA.map(function (g) { return [g.sku, g.sl]; }));
check('Dùng tên sách đã khai báo của X', kq.nha.HA[0].tenGon === 'Bồi Dưỡng HSG Sinh Học 7');
check('Nhãn "barcode gán tay"', kq.nha.HA[0].ganTay === true);
var ls = kq.listingCanSua.filter(function (l) { return l.lyDo === 'gán barcode tay'; });
check('Có trong "Listing cần sửa barcode": Shopee | tên | Lớp 7 | (trống) → X', ls.length === 1 && ls[0].san === 'Shopee' && ls[0].phanLoai === 'Lớp 7' && ls[0].maCu === '(trống)' && ls[0].maMoi === X, ls);
var bg = TK.banGhiNgay(kq, ['HA'], '2026-10-06');
check('Lịch sử đặt hàng / thống kê ghi theo barcode X', bg.dong.length === 1 && bg.dong[0].barcode === X && bg.dong[0].sl === 5, bg.dong);

console.log('\n2. Barcode sai ' + SAI + ' → ' + DUNG);
check('Mã sai không đúng số kiểm tra (app cảnh báo)', !PL.ean13HopLe(SAI) && PL.ean13HopLe(DUNG));
var rows2 = [sp('5', SAI, 'Đề Kiểm Tra Toán 8 - HA', '', 60000, 1), sp('6', DUNG, 'Đề Kiểm Tra Toán 8 (HA)', '', 60000, 2, 'TikTok')];
r = m.post('ganBarcode', { items: [{ key: PL.khoaBarcode(rows2[0]), sku: SAI, ten: rows2[0].ten, phan_loai: '' }], ma_moi: DUNG, nha: 'HA', ten_sach: 'Đề Kiểm Tra Toán 8' });
check('Lưu mã phụ sku:' + SAI + ' → ' + DUNG, r.ok && m.get().skus.some(function (x) { return x.key === 'sku:' + SAI && x.ma_moi === DUNG; }), r.error);
kq = PL.classify(rows2.concat([sp('7', SAI, 'Đề Kiểm Tra Toán 8 - HA', '', 60000, 4)]), m.get());
check('Đơn sau mang mã sai vẫn quy về mã đúng (1 + 2 + 4 = 7)', kq.nha.HA.length === 1 && nhom(kq, 'HA', DUNG)[0].sl === 7, kq.nha.HA.map(function (g) { return [g.sku, g.sl]; }));
check('Có trong listing cần sửa: ' + SAI + ' → ' + DUNG, kq.listingCanSua.some(function (l) { return l.maCu === SAI && l.maMoi === DUNG && l.lyDo === 'gán barcode tay'; }), kq.listingCanSua);

console.log('\n3. SKU dạng chữ');
var rows3 = [sp('8', 'BDSH-07', 'Bồi Dưỡng Sinh 7 - HA', '', 95000, 1), sp('9', 'BDSH-07', 'Bồi Dưỡng Sinh 7 - HA', '', 95000, 1, 'TikTok')];
check('Khóa = SKU chữ', PL.khoaBarcode(rows3[0]) === 'sku:BDSH-07');
m.post('ganBarcode', { items: [{ key: 'sku:BDSH-07', sku: 'BDSH-07', ten: rows3[0].ten, phan_loai: '' }], ma_moi: X });
kq = PL.classify(rows3.concat(rows), m.get());
check('Mọi dòng SKU chữ BDSH-07 (cả 2 sàn) quy về X, gộp chung (2 + 5 = 7)', kq.nha.HA.length === 1 && nhom(kq, 'HA', X)[0].sl === 7, kq.nha.HA.map(function (g) { return [g.sku, g.sl]; }));
check('Barcode đã có trong danh mục → giữ nhà + tên đã khai báo (không tạo trùng)', m.get().skus.filter(function (x) { return x.key === 'sku:' + X; }).length === 1 &&
  kq.nha.HA[0].tenGon === 'Bồi Dưỡng HSG Sinh Học 7');

console.log('\n4. Không ghi đè dữ liệu tay mà không hỏi');
r = m.post('ganBarcode', { items: [{ key: 'sku:BDSH-07', sku: 'BDSH-07', ten: rows3[0].ten, phan_loai: '' }], ma_moi: DUNG });
check('Khóa đã gán tay sang mã khác → báo CAN_XAC_NHAN, không sửa gì', !r.ok && /^CAN_XAC_NHAN/.test(r.error) &&
  m.get().skus.filter(function (x) { return x.key === 'sku:BDSH-07'; })[0].ma_moi === X, r.error);
r = m.post('ganBarcode', { items: [{ key: 'sku:BDSH-07', sku: 'BDSH-07', ten: rows3[0].ten, phan_loai: '' }], ma_moi: DUNG, ghi_de: true });
check('Xác nhận ghi đè → đổi được', r.ok && m.get().skus.filter(function (x) { return x.key === 'sku:BDSH-07'; })[0].ma_moi === DUNG);
r = m.post('ganBarcode', { items: [{ key: 'sku:' + DUNG, sku: DUNG, ten: 'x', phan_loai: '' }], ma_moi: SAI });
check('Chặn vòng lặp (đúng → sai trong khi sai → đúng)', !r.ok && /vòng lặp/.test(r.error), r.error);
r = m.post('ganBarcode', { items: [{ key: khoa, sku: '', ten: TEN, phan_loai: 'Lớp 7' }], ma_moi: 'ABC' });
check('Barcode không phải chữ số → từ chối', !r.ok);

console.log('\n5. Hoàn tác');
var lsLan1 = lichSu(m).filter(function (x) { return x.hanh_dong === 'ganBarcode'; });
r = m.post('hoanTacTaiBan', { dong: lsLan1[0].dong }); // lần gần nhất: ghi đè BDSH-07 → DUNG
check('Hoàn tác lần ghi đè → BDSH-07 trở lại X', r.ok && m.get().skus.filter(function (x) { return x.key === 'sku:BDSH-07'; })[0].ma_moi === X, r.error);
check('Hoàn tác lần 2 → báo đã hoàn tác', /đã được hoàn tác/.test(m.post('hoanTacTaiBan', { dong: lsLan1[0].dong }).error || ''));
var m2 = GL.taoMoiTruong(); m2.ctx.khoiTao();
var truoc2 = JSON.stringify(m2.get());
m2.post('ganBarcode', { items: [{ key: khoa, sku: '', ten: TEN, phan_loai: 'Lớp 7' }], ma_moi: X, nha: 'HA', ten_sach: 'Bồi Dưỡng HSG Sinh Học 7' });
m2.post('hoanTacTaiBan', { dong: lichSu(m2)[0].dong });
check('Hoàn tác lần gán đầu tiên → danh mục y như trước (xóa cả dòng barcode vừa tạo)', JSON.stringify(m2.get()) === truoc2);
kq = PL.classify(rows, m2.get());
check('Sau hoàn tác: dòng SKU trống lại tách riêng', kq.nha.HA.length === 2);

console.log('\n6. Bỏ barcode gán tay (Danh mục) + hoàn tác');
r = m.post('boGanBarcode', { key: 'sku:BDSH-07' });
check('Bỏ → dòng chỉ để gán barcode bị xóa hẳn', r.ok && !m.get().skus.some(function (x) { return x.key === 'sku:BDSH-07'; }), r.error);
m.post('hoanTacTaiBan', { dong: lichSu(m)[0].dong });
check('Hoàn tác "bỏ" → ánh xạ trở lại', m.get().skus.some(function (x) { return x.key === 'sku:BDSH-07' && x.ma_moi === X; }));

console.log('\n7. Thành phần combo chưa có SKU');
var m3 = GL.taoMoiTruong(); m3.ctx.khoiTao();
m3.post('upsertCombo', { ten_combo: 'Combo Sinh 7 + 8', khoa: ['sku:CB78'], cach_xuat: 'tach', thanh_phan: [
  { sku: '', ten: 'Bồi Dưỡng Sinh 7', nha: 'HA', gia_goc: 95000, so_luong: 1 }, { sku: '8935092851334', ten: 'Bồi Dưỡng Sinh 8', nha: 'HA', gia_goc: 108000, so_luong: 1 }] });
var cid = m3.get().combos[0].combo_id;
r = m3.post('ganBarcode', { items: [], ma_moi: X, thanh_phan: { combo_ids: [cid], ten: 'Bồi Dưỡng Sinh 7' }, nha: 'HA', ten_sach: 'Bồi Dưỡng HSG Sinh Học 7' });
check('Điền barcode vào thành phần chưa có SKU', r.ok && m3.get().combos[0].thanh_phan.some(function (t) { return t.ten === 'Bồi Dưỡng Sinh 7' && t.sku === X; }), r.error);
kq = PL.classify([sp('c1', 'CB78', 'Combo Sinh 7 + 8 - HA', '', 200000, 1)].concat(rows.slice(1)), m3.get());
check('Combo tách ra gộp chung với đơn lẻ cùng barcode X (1 + 3 = 4)', nhom(kq, 'HA', X).length === 1 && nhom(kq, 'HA', X)[0].sl === 4, kq.nha.HA.map(function (g) { return [g.sku, g.sl]; }));
m3.post('hoanTacTaiBan', { dong: lichSu(m3)[0].dong });
check('Hoàn tác → thành phần lại trống SKU', m3.get().combos[0].thanh_phan.some(function (t) { return t.ten === 'Bồi Dưỡng Sinh 7' && !t.sku; }));

console.log('\n8. Excel');
var wb = DX.xuat(m.get(), XLSX);
var aoa = XLSX.utils.sheet_to_json(wb.Sheets.BARCODE_GAN_TAY, { header: 1 });
check('Xuất: sheet BARCODE_GAN_TAY có các ánh xạ', aoa.length >= 3 && aoa[0].indexOf('barcode_dung') >= 0, aoa);
var nap = DX.nap(XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })), XLSX);
check('Nạp lại: đọc đủ ánh xạ, không báo lỗi', nap.ganBarcode.length === aoa.length - 1 && !nap.loi.length, nap.loi);
var m4 = GL.taoMoiTruong(); m4.ctx.khoiTao();
r = m4.post('ganBarcode', { items: nap.ganBarcode, ghi_de: true });
check('Nạp vào danh mục mới → ánh xạ hoạt động', r.ok && PL.classify(rows3, m4.get()).nha.HA.every(function (g) { return g.sku === X; }), r.error);

console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
if (loi) process.exitCode = 1;
