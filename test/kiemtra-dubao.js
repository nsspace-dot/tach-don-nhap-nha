/* Kiểm thử lịch sử bán + Dự báo nhập kho + Chờ khai báo. Chạy: node test/kiemtra-dubao.js */
'use strict';
var GL = require('./gia-lap-apps-script.js');
var BH = require('../js/banhang.js');
var PL = require('../js/phanloai.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet).slice(0, 300) : '')); }
}
function dong(ma, sku, ten, sl, ngay, san, pl) { return { san: san || 'TikTok', orderId: ma, sku: sku, ten: ten, phanLoai: pl || '', gia: 50000, sl: sl || 1, ngayDat: ngay }; }
function file(rows, extra) { return Object.assign({ san: rows[0].san, rows: rows }, extra || {}); }
function lay(m, tu) { return m.get({ action: 'banHang', tu: tu || '2026-01-01' }).khoi; }
function th(m, cat) { return BH.tongHop(lay(m), cat || m.get(), {}); }
function cuon(t, nha, sku) {
  var list = (t.kq.nha[nha] || (t.kq.nhaKhac || {})[nha] || []);
  return list.filter(function (g) { return g.sku === sku; }).reduce(function (s, g) { return s + g.sl; }, 0);
}

var m = GL.taoMoiTruong(); m.ctx.khoiTao();
var SACH_HA = 'Sách Luyện Đề Toán 5 - HA', SACH_MEGA = 'Sách Bí Quyết Học Giỏi Văn (MEGA)';

console.log('\n1. Chốt đợt lưu dòng bán của MỌI sách (kể cả nhà khác), không có hàng không phải sách');
var ngay1 = [dong('1001', '8935000000011', SACH_HA, 2, '2026-10-01'), dong('1002', '8935000000028', SACH_MEGA, 3, '2026-10-01'),
             dong('1003', '', 'Lịch Treo Tường 2027 Con Mèo', 1, '2026-10-01'), dong('1004', '8935000000028', SACH_MEGA, 1, '2026-09-30')];
var r = m.post('chotDot', { dot_id: '2026-10-01', ban_hang: BH.maHoa([file(ngay1)], '2026-10-01') }, 'Tú');
check('Chốt: lưu 3 dòng (bỏ lịch treo tường)', r.ok && r.banHang.soDong === 3, r.banHang);
var t = th(m);
check('HA 2 cuốn, MEGA 4 cuốn (nhà khác cũng có)', cuon(t, 'HA', '8935000000011') === 2 && cuon(t, 'MEGA', '8935000000028') === 4, Object.keys(t.kq.nhaKhac || {}));
check('Không lưu thông tin khách (chỉ cột đã chuẩn hóa)', !/Recipient|Phone|Địa chỉ|Người nhận/i.test(JSON.stringify(m.ss.getSheetByName('BAN_HANG').data)));

console.log('\n2. Đơn treo nhiều ngày chỉ đếm 1 lần; chốt lại cùng ngày thay, không cộng');
var ngay2 = [dong('1004', '8935000000028', SACH_MEGA, 1, '2026-09-30'), dong('2001', '8935000000011', SACH_HA, 1, '2026-10-02')]; // 1004 vẫn treo
r = m.post('chotDot', { dot_id: '2026-10-02', ban_hang: BH.maHoa([file(ngay2)], '2026-10-02') }, 'Tú');
check('Đơn treo 1004 bỏ qua, chỉ thêm 1 dòng mới', r.banHang.soDong === 1 && r.banHang.boTrung === 1, r.banHang);
m.post('moLaiDot', { dot_id: '2026-10-02' }, 'Tú');
r = m.post('chotDot', { dot_id: '2026-10-02', ban_hang: BH.maHoa([file(ngay2)], '2026-10-02') }, 'Tú');
t = th(m);
check('Chốt lại ngày 02/10 → thay khối cũ, tổng HA vẫn 3', cuon(t, 'HA', '8935000000011') === 3 && cuon(t, 'MEGA', '8935000000028') === 4, [cuon(t, 'HA', '8935000000011'), cuon(t, 'MEGA', '8935000000028')]);
check('Bán theo NGÀY ĐẶT (đơn 1004 tính vào 30/09)', BH.duBao(t, '2026-10-02').nha.MEGA.ds[0].b30 === 4);

console.log('\n3. Web: cùng 1 file thả 2 lần tính 1 lần; 2 file khác nhau cộng thẳng');
var w = [{ san: 'Web', orderId: '', sku: '8935000000035', ten: 'Sách Web A', phanLoai: '', gia: 30000, sl: 2, ncc: 'Nhà Sách Hồng Ân', ngayXuat: '2026-10-03' }];
m.post('chotDot', { dot_id: '2026-10-03', ban_hang: BH.maHoa([file(w, { webKey: 'file-1' }), file(w, { webKey: 'file-1' })], '2026-10-03') }, 'Tú');
m.post('chotDot', { dot_id: '2026-10-04', ban_hang: BH.maHoa([file(w, { webKey: 'file-2' })], '2026-10-04') }, 'Tú');
t = th(m);
check('Web: 2 + 2 = 4 cuốn (file-1 chỉ 1 lần)', cuon(t, 'HA', '8935000000035') === 4, cuon(t, 'HA', '8935000000035'));

console.log('\n4. Khai báo muộn → số liệu quá khứ tự đúng (tính lại theo danh mục mới nhất)');
m.post('chotDot', { dot_id: '2026-10-05', ban_hang: BH.maHoa([file([dong('5001', 'CB-X', 'Combo 2 Cuốn Văn Mẫu (MEGA)', 2, '2026-10-05')])], '2026-10-05') }, 'Tú');
t = th(m);
var ck = BH.choKhaiBao(t, {});
check('Combo nhà khác chưa khai báo → vào Chờ khai báo', ck.some(function (x) { return x.loai === 'combo_khac' && x.soLan === 1 && x.lanCuoi === '2026-10-05'; }), ck.map(function (x) { return x.loai; }));
m.post('upsertCombo', { ten_combo: 'Combo Văn Mẫu', khoa: ['sku:CB-X'], thanh_phan: [{ sku: '8935000000042', ten: 'Văn Mẫu 1 (MEGA)', nha: 'KHAC', so_luong: 1 }, { sku: '8935000000059', ten: 'Văn Mẫu 2 (MEGA)', nha: 'KHAC', so_luong: 1 }] }, 'Lan');
t = th(m);
check('Khai báo xong: combo biến khỏi Chờ khai báo', !BH.choKhaiBao(t, {}).some(function (x) { return x.loai === 'combo_khac'; }));
check('… và dự báo MEGA có 2 cuốn thành phần × 2', cuon(t, 'MEGA', '8935000000042') === 2 && cuon(t, 'MEGA', '8935000000059') === 2);

console.log('\n5. Combo trộn nhà còn thiếu phần nhà khác; dòng "để sau"');
m.post('chotDot', { dot_id: '2026-10-06', ban_hang: BH.maHoa([file([dong('6001', 'CB-T', 'COMBO HA + Sổ Tay (MEGA)', 1, '2026-10-06'), dong('6002', '', 'Sách Lạ Không Mã', 1, '2026-10-06')])], '2026-10-06') }, 'Tú');
m.post('upsertCombo', { ten_combo: 'Combo trộn', khoa: ['sku:CB-T'], thanh_phan: [{ sku: '8935000000066', ten: 'Phần HA', nha: 'HA', so_luong: 1 }] }, 'Lan');
t = th(m);
ck = BH.choKhaiBao(t, {});
check('Combo trộn chỉ khai phần HA → "còn thiếu phần nhà khác"', ck.some(function (x) { return x.loai === 'combo_thieu' && x.ghiChu === 'còn thiếu phần nhà khác'; }));
check('Phần HA vẫn vào dự báo HA', cuon(t, 'HA', '8935000000066') === 1);
var cr = t.kq.chuaRo.filter(function (g) { return g.ten === 'Sách Lạ Không Mã'; })[0];
r = m.post('deSau', { khoa: cr.key, ten: cr.ten }, 'Lan');
check('Để sau: lưu chung (không cần mã Admin)', r.ok && r.de_sau.indexOf(cr.key) >= 0 && m.get().de_sau.indexOf(cr.key) >= 0);
var ds = {}; r.de_sau.forEach(function (k) { ds[k] = 1; });
check('Dòng để sau có trong Chờ khai báo', BH.choKhaiBao(t, ds).some(function (x) { return x.loai === 'de_sau'; }));
r = m.post('deSau', { khoa: cr.key, bo: true }, 'Lan');
check('Bỏ để sau', r.ok && r.de_sau.indexOf(cr.key) < 0);
check('Sách nhà khác chưa có tên khai báo → Chờ khai báo', ck.some(function (x) { return x.loai === 'ten' && x.nha === 'MEGA'; }));

console.log('\n6. Nạp từ file đơn cũ: theo ngày đặt, đơn đã có bỏ qua');
var cu = [dong('1001', '8935000000011', SACH_HA, 2, '2026-10-01'), dong('9001', '8935000000011', SACH_HA, 5, '2026-09-10'), dong('9002', '8935000000028', SACH_MEGA, 1, '2026-09-11', 'Shopee')];
r = m.post('napBanHang', BH.maHoa([file(cu)], ''), 'Tú');
check('Nạp: 2 dòng mới, 1 trùng bỏ qua, chia 2 ngày', r.ok && r.soDongMoi === 2 && r.soDongTrung === 1 && r.soNgay === 2, r);
r = m.post('napBanHang', BH.maHoa([file(cu)], ''), 'Tú');
check('Nạp lại cùng file → không thêm gì', r.soDongMoi === 0 && r.soDongTrung === 3);
t = th(m);
check('HA = 3 (đợt) + 5 (nạp) = 8', cuon(t, 'HA', '8935000000011') === 8, cuon(t, 'HA', '8935000000011'));

console.log('\n7. Dự báo: bán 7 / 30 ngày, TB có trọng số, xu hướng, gợi ý');
var m2 = GL.taoMoiTruong(); m2.ctx.khoiTao();
var hom = '2026-10-12', rows = [], id = 0;
for (var i = 0; i < 28; i++) {
  var ngay = BH.congNgay(hom, -i), sl = i < 7 ? 3 : 1; // 7 ngày gần: 3 cuốn/ngày, trước đó 1 cuốn/ngày
  rows.push(dong('A' + (++id), '8935000001110', 'Sách Bán Đều (MEGA)', sl, ngay));
}
rows.push(dong('B1', '8935000001127', 'Sách Giảm (MEGA)', 1, BH.congNgay(hom, -1)), dong('B2', '8935000001127', 'Sách Giảm (MEGA)', 6, BH.congNgay(hom, -10)));
m2.post('napBanHang', BH.maHoa([file(rows)], ''), 'Tú');
var db = BH.duBao(th(m2), hom, { MEGA: 7 });
var a = db.nha.MEGA.ds.filter(function (c) { return c.sku === '8935000001110'; })[0], b = db.nha.MEGA.ds.filter(function (c) { return c.sku === '8935000001127'; })[0];
var tbMong = (function () { var s = 0; for (var k = 0; k < 28; k++) s += (28 - k) * (k < 7 ? 3 : 1); return s / 406; })();
check('Bán 7 ngày = 21, 30 ngày = 42', a.b7 === 21 && a.b30 === 42, a);
check('TB/ngày có trọng số (ngày gần nặng hơn) = ' + tbMong.toFixed(2), Math.abs(a.tb - tbMong) < 1e-9, a.tb);
check('Gợi ý = làm tròn lên (TB × 7 ngày)', a.goiY === Math.ceil(tbMong * 7), a.goiY);
check('Xu hướng: 📈 tăng / 📉 giảm', a.xuHuong === 'tang' && b.xuHuong === 'giam', [a.xuHuong, b.xuHuong]);
check('28 ngày dữ liệu → đủ dữ liệu', db.duDuLieu && db.soNgayDuLieu === 28, db.soNgayDuLieu);
var m3 = GL.taoMoiTruong(); m3.ctx.khoiTao();
m3.post('napBanHang', BH.maHoa([file([dong('C1', '8935000001134', 'Sách Mới (MEGA)', 2, BH.congNgay(hom, -2))])], ''), 'Tú');
db = BH.duBao(th(m3), hom, {});
check('Chưa đủ 14 ngày → đánh dấu nhưng vẫn có số', !db.duDuLieu && db.nha.MEGA.ds[0].b7 === 2 && db.nha.MEGA.soNgay === 7);
r = m.post('luuDuBaoNgay', { nha: 'MEGA', so_ngay: 10 }, 'Mai');
check('Số ngày đủ bán riêng từng nhà, lưu chung (không cần mã Admin)', r.ok && r.cai_dat_chung.duBaoNgay.MEGA === 10 && m.get().cai_dat_chung.duBaoNgay.MEGA === 10);
m.post('luuCaiDatChung', { maKhac: ['MEGA', 'VT'] }, 'Tú');
check('Admin lưu cài đặt chung không làm mất số ngày dự báo', m.get().cai_dat_chung.duBaoNgay.MEGA === 10);

console.log('\n8. Sheet lớn → gom tháng, tổng không đổi');
var m4 = GL.taoMoiTruong(); m4.ctx.khoiTao();
vm4();
function vm4() {
  require('vm').runInContext('BH_NGUONG_GOM = 20; BH_GOM_SAU_NGAY = 30;', m4.ctx);
  var rr = [];
  for (var k = 0; k < 90; k++) rr.push(dong('G' + k, '8935000001141', 'Sách Gom (MEGA)', 1, BH.congNgay(hom, -k - 1)));
  m4.post('napBanHang', BH.maHoa([file(rr)], ''), 'Tú');
}
var khoi = lay(m4);
var thang = khoi.filter(function (b) { return b.nguon === 'thang'; });
var tong = BH.tongHop(khoi, m4.get(), {}).rows.reduce(function (s, x) { return s + x.sl; }, 0);
check('Gom các ngày cũ thành khối tháng, vẫn đủ 90 cuốn', thang.length >= 1 && tong === 90 && m4.ss.getSheetByName('BAN_HANG').getLastRow() - 1 < 90, [thang.length, tong]);

console.log('\n9. Màn sáng không đổi khi không bật nhà khác');
var kqSang = PL.classify([dong('X1', '8935000000028', SACH_MEGA, 1, hom)], {}, {});
check('Phân loại thường: không có nhaKhac, sách MEGA vẫn ở "Đã bỏ qua"', !kqSang.nhaKhac && kqSang.boQua.length === 1);

console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
process.exit(loi ? 1 : 0);
