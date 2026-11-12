/* Kiểm thử thống kê bán theo ngày (sheet THONG_KE, tab "Sàn bán gì"). Chạy: node test/kiemtra-sanban.js */
'use strict';
var GL = require('./gia-lap-apps-script.js');
var SB = require('../js/sanban.js');
var PL = require('../js/phanloai.js');
var DG = require('../js/dot-gop.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet).slice(0, 400) : '')); }
}
function ngayTruoc(n) { return SB.congNgay(DG.homNayVN(), -n); }
function dong(ma, sku, ten, sl, o) { return Object.assign({ san: 'TikTok', orderId: ma, sku: sku, ten: ten, phanLoai: '', gia: 50000, sl: sl || 1 }, o || {}); }
function maHoa(rows, cat) { return SB.maHoa(PL.classify(rows, cat || {}, {}), { catalog: cat || {} }); }
function bang(m) { return m.ss.getSheetByName('THONG_KE').data.slice(1).filter(function (r) { return r[0]; }); }
function tong(m, tu, den, extra) { return m.get(Object.assign({ action: 'thongKe', tu: tu, den: den, combo: 'nguyen' }, extra || {})); }
function sl(kq, khoa, san) {
  var i = -1;
  kq.sp.forEach(function (p, k) { if (p[0] === khoa) i = k; });
  return kq.d.filter(function (x) { return x[0] === i && (!san || x[1] === san); }).reduce(function (s, x) { return s + x[3]; }, 0);
}

var m = GL.taoMoiTruong(); m.ctx.khoiTao();
var D1 = ngayTruoc(3), D2 = ngayTruoc(2), D3 = ngayTruoc(1);
var HA = 'Sách Luyện Đề Toán 5 - HA', BC_HA = '8935000000014', MEGA = 'Sách Bí Quyết Học Giỏi Văn (MEGA)', BC_MEGA = '8935000000021';

console.log('\n1. Khóa gộp sản phẩm + ngành + gian');
check('Ngành: lịch / tranh / decal / trà / sách', SB.nganh('Lịch Treo Tường 2027') === 'Lịch' && SB.nganh('Tranh Treo Phòng Khách') === 'Tranh' && SB.nganh('Decal Dán Tường') === 'Decal' &&
  SB.nganh('Trà Hoa Cúc 100g') === 'Trà' && SB.nganh('Sách Lịch Sử 9') === 'Sách' && SB.nganh('Bài Vị Gỗ') === 'Khác');
check('Khóa tên: bỏ hoa/thường, khoảng trắng, mã nhà đầu/cuối, "(1 cuốn)", "Mặc định", "Not Specified"',
  SB.khoaTen('HA - Sách  Luyện Đề TOÁN 5 (1 cuốn)', 'Mặc định') === SB.khoaTen('sách luyện đề toán 5 - HA - Newshop', 'Not Specified'),
  [SB.khoaTen('HA - Sách  Luyện Đề TOÁN 5 (1 cuốn)', 'Mặc định'), SB.khoaTen('sách luyện đề toán 5 - HA - Newshop', 'Not Specified')]);
check('Khóa tên: phân loại có nghĩa thì khác khóa', SB.khoaTen('Vở Bài Tập Các Lớp', 'Lớp 3') !== SB.khoaTen('Vở Bài Tập Các Lớp', 'Lớp 4'));
var ds = ['Gian A = gian-a, shop a', 'Tường Đẹp'];
check('Gian: nhận từ tên file, không nhận được thì trống', SB.doanGian('Order.all.GIAN-A.20261101.xlsx', ds) === 'Gian A' && SB.doanGian('to ship tuong dep.xlsx', ds) === 'Tường Đẹp' && SB.doanGian('Order.all.xlsx', ds) === '');

console.log('\n2. Chốt đợt ghi MỌI dòng (sách mọi nhà + lịch, tranh…), trước bước lọc nhà');
var ngay1 = [dong('1001', BC_HA, HA, 2, { doanhThu: 90000, gian: 'Gian A' }), dong('1001', BC_MEGA, MEGA, 1, { doanhThu: 60000, gian: 'Gian A' }),
             dong('1002', '', 'Lịch Treo Tường 2027 Con Mèo', 3, { doanhThu: 150000, gian: 'Gian A' }),
             dong('S1', BC_HA, HA, 1, { san: 'Shopee', doanhThu: 45000 }), dong('', BC_HA, 'Luyện Đề Toán 5', 4, { san: 'Web', ncc: 'Nhà Sách Hồng Ân', webKey: 'aaaaaaaaaaaaaaaa' })];
var r = m.post('chotDot', { dot_id: D1, thong_ke: maHoa(ngay1) }, 'Tú');
check('Chốt: ghi 5 dòng', r.ok && r.thongKe && r.thongKe.soDong === 5, r);
var b = bang(m);
check('Sheet THONG_KE đủ cột theo thứ tự', m.ss.getSheetByName('THONG_KE').data[0].slice(0, 12).join('|') === 'ngay|san|gian|khoa_sp|ten_sp|phan_loai|barcode|nganh|nha|so_luong|so_don|doanh_thu');
var lich = b.filter(function (x) { return x[7] === 'Lịch'; })[0], mega = b.filter(function (x) { return x[6] === BC_MEGA; })[0], web = b.filter(function (x) { return x[1] === 'Web'; })[0];
check('Có dòng Lịch (không phải sách) với SL 3, doanh thu 150.000', lich && lich[9] === 3 && lich[11] === 150000 && /^ten:/.test(lich[3]), lich);
check('Sách nhà khác (MEGA) cũng được ghi, đúng nhà', mega && mega[8] === 'MEGA' && mega[7] === 'Sách', mega);
check('Có mã vạch → gộp theo mã vạch (bc:…), nhà HA, gian đúng', b.some(function (x) { return x[3] === 'bc:' + BC_HA && x[1] === 'TikTok' && x[8] === 'HA' && x[2] === 'Gian A' && x[9] === 2; }));
check('File không có cột giá bán → doanh_thu để trống (web)', web && web[11] === '' && web[9] === 4, web);
check('Dòng phụ số đơn: TikTok Gian A = 2 đơn', b.some(function (x) { return x[3] === '#don' && x[1] === 'TikTok' && x[2] === 'Gian A' && x[10] === 2; }), b.filter(function (x) { return x[3] === '#don'; }));
check('Không lưu thông tin khách / mã đơn gốc', !/1001|1002/.test(JSON.stringify(m.ss.getSheetByName('THONG_KE').data)));

console.log('\n3. Chống trùng (sàn + mã đơn + dòng): đơn treo nhiều ngày chỉ tính 1 lần; chốt lại thì ghi đè');
var ngay2 = [dong('1001', BC_HA, HA, 2, { doanhThu: 90000, gian: 'Gian A' }), dong('2001', BC_HA, HA, 5, { doanhThu: 200000, gian: 'Gian A' })];
r = m.post('chotDot', { dot_id: D2, thong_ke: maHoa(ngay2) }, 'Tú');
check('Đơn treo 1001 bỏ qua, chỉ thêm 1 dòng', r.thongKe.soDong === 1 && r.thongKe.boTrung === 1, r.thongKe);
m.post('moLaiDot', { dot_id: D2 }, 'Tú');
r = m.post('chotDot', { dot_id: D2, thong_ke: maHoa(ngay2.concat([dong('2002', BC_HA, HA, 1, { doanhThu: 40000, gian: 'Gian A' })])) }, 'Tú');
var t = tong(m, D1, D2);
check('Mở lại rồi chốt lại → ghi đè, không cộng dồn (TikTok HA = 2 + 5 + 1)', sl(t, 'bc:' + BC_HA, 'TikTok') === 8, sl(t, 'bc:' + BC_HA, 'TikTok'));
check('Chốt lại ngày cũ không làm mất số ngày khác', sl(tong(m, D1, D1), 'bc:' + BC_HA) === 7, sl(tong(m, D1, D1), 'bc:' + BC_HA));

console.log('\n4. Tổng hợp theo khoảng ngày ở server + so kỳ trước');
t = tong(m, D2, D2, { truoc: '1' });
var x = t.d.filter(function (y) { return t.sp[y[0]][0] === 'bc:' + BC_HA && y[1] === 'TikTok'; })[0];
check('Kỳ D2: 6 cuốn, doanh thu 240.000; kỳ trước (D1): 2 cuốn', x && x[3] === 6 && x[5] === 240000 && x[6] === 2 && x[7] === 90000, x);
check('Số đơn theo sàn (dòng phụ)', t.don.some(function (y) { return y[0] === 'TikTok' && y[2] === 2 && y[3] === 2; }), t.don);
check('Trả về gọn (không trả từng ngày)', t.ok && t.tu === D2 && t.den === D2 && !t.dong);

console.log('\n5. Combo đã khai báo: lưu nguyên combo + thành phần → xem tách hoặc nguyên');
var cat = { skus: [], combos: [{ combo_id: 'C1', ten_combo: 'Combo Toán + Văn', khoa: ['sku:CB-TV'], cach_xuat: 'tach',
  thanh_phan: [{ sku: BC_HA, ten: 'Luyện Đề Toán 5', nha: 'HA', gia_goc: 60000, so_luong: 1 }, { sku: '8935000000038', ten: 'Luyện Đề Văn 5', nha: 'KV', gia_goc: 40000, so_luong: 2 }] }] };
r = m.post('chotDot', { dot_id: D3, thong_ke: maHoa([dong('3001', 'CB-TV', 'Combo Toán + Văn lớp 5', 2, { doanhThu: 200000 })], cat) }, 'Tú');
var ng = tong(m, D3, D3), ta = tong(m, D3, D3, { combo: 'tach' });
check('Xem nguyên: 1 dòng combo, SL 2', sl(ng, 'cb:C1') === 2 && ng.sp.filter(function (p) { return p[0] === 'cb:C1'; })[0][7] === 1, ng.sp);
check('Xem tách: Toán 2 cuốn, Văn 4 cuốn', sl(ta, 'bc:' + BC_HA) === 2 && sl(ta, 'bc:8935000000038') === 4 && sl(ta, 'cb:C1') === 0, ta.sp);
var dtT = ta.d.filter(function (y) { return ta.sp[y[0]][0] === 'bc:' + BC_HA; })[0][5], dtV = ta.d.filter(function (y) { return ta.sp[y[0]][0] === 'bc:8935000000038'; })[0][5];
check('Doanh thu combo chia theo giá gốc × SL (60k : 80k)', dtT + dtV === 200000 && Math.abs(dtT - 85714) <= 1, [dtT, dtV]);

console.log('\n6. Nạp bù số liệu cũ: quyền Admin, chỉ ghi THONG_KE, trùng thì bỏ qua');
var cu = [dong('9001', BC_HA, HA, 3, { doanhThu: 120000 }), dong('1001', BC_HA, HA, 2, { doanhThu: 90000 })]; // 1001 đã có từ đợt D1
var soDot = m.ss.getSheetByName('DOT').data.length, soSku = m.ss.getSheetByName('SKU_NHA').data.length;
r = m.postTho('napThongKe', { ngay: ngayTruoc(10), dl: maHoa(cu) }, 'Lan');
check('Không có mã Admin → từ chối', !r.ok && /CAN_MA_ADMIN/.test(r.error), r);
r = m.post('napThongKe', { ngay: ngayTruoc(10), dl: maHoa(cu) }, 'Tú');
check('Nạp: 1 dòng mới, bỏ 1 dòng đã có', r.ok && r.soDongMoi === 1 && r.soDongTrung === 1, r);
check('Không tạo đợt, không đụng danh mục', m.ss.getSheetByName('DOT').data.length === soDot && m.ss.getSheetByName('SKU_NHA').data.length === soSku);
r = m.post('napThongKe', { ngay: ngayTruoc(10), dl: maHoa(cu) }, 'Tú');
check('Nạp lại cùng file → bỏ qua hết', r.soDongMoi === 0 && r.soDongTrung === 2, r);
check('Số của ngày nạp bù đúng 3 cuốn', sl(tong(m, ngayTruoc(10), ngayTruoc(10)), 'bc:' + BC_HA) === 3);
var nhieu = maHoa([dong('9101', BC_HA, HA, 1, { ngayTk: ngayTruoc(20) }), dong('9102', BC_HA, HA, 2, { ngayTk: ngayTruoc(21) }), dong('9103', BC_HA, HA, 9, { ngayTk: ngayTruoc(400) })]);
r = m.post('napThongKe', { theo_dong: 1, dl: nhieu }, 'Tú');
check('Chia theo ngày đặt từng đơn: 2 ngày, bỏ dòng quá 183 ngày', r.soDongMoi === 2 && r.soNgay === 2 && r.soDongCu === 1, r);
check('Chốt đợt sau nạp bù: đơn đã nạp không cộng lần nữa', m.post('chotDot', { dot_id: DG.homNayVN(), thong_ke: maHoa([dong('9001', BC_HA, HA, 3)]) }, 'Tú').thongKe.soDong === 0);

console.log('\n7. Đợt đang mở: tính thử (không ghi)');
var truoc = bang(m).length;
r = m.post('thongKeTam', { ngay: DG.homNayVN(), dl: maHoa([dong('9001', BC_HA, HA, 3), dong('7001', BC_HA, HA, 4, { doanhThu: 160000 })]) }, 'Lan');
check('Tạm: chỉ tính dòng mới (4 cuốn), không ghi sheet', r.ok && r.soDong === 1 && sl(r.nguyen, 'bc:' + BC_HA) === 4 && bang(m).length === truoc, r);

console.log('\n8. Tự xóa dòng cũ hơn 183 ngày (chạy chung trigger sao lưu)');
var s = m.ss.getSheetByName('THONG_KE'), k = m.ss.getSheetByName('THONG_KE_KHOA');
s.data.splice(1, 0, [ngayTruoc(200), 'TikTok', '', 'bc:1', 'Cũ', '', '1', 'Sách', 'HA', 1, 1, '', 'nap', '', '', ''], [ngayTruoc(184), 'TikTok', '', 'bc:1', 'Cũ', '', '1', 'Sách', 'HA', 1, 1, '', 'nap', '', '', '']);
s.data.push([ngayTruoc(183), 'TikTok', '', 'bc:2', 'Vừa đủ', '', '2', 'Sách', 'HA', 1, 1, '', 'nap', '', '', '']);
k.data.push([ngayTruoc(300), 'nap', '0', 'abc', '']);
var soTruoc = bang(m).length;
m.ctx.saoLuuHangNgay();
check('Xóa 2 dòng cũ, giữ dòng đúng 183 ngày', bang(m).length === soTruoc - 2 && bang(m).some(function (y) { return y[3] === 'bc:2'; }) && !bang(m).some(function (y) { return y[4] === 'Cũ'; }));
check('Dấu dòng cũ cũng được dọn', !k.data.some(function (y) { return y[3] === 'abc'; }));
check('Sao lưu vẫn chạy bình thường', Object.keys(m.files).length === 2);
m.ctx.tkDonCu();
check('Chạy lại không xóa thêm', bang(m).length === soTruoc - 2);

console.log('\n9. Xoay bảng theo sàn + cơ hội (phía máy)');
t = tong(m, ngayTruoc(30), DG.homNayVN(), { truoc: '1' });
var xo = SB.xoay(t, {});
var hHA = xo.hang.filter(function (h) { return h.khoa === 'bc:' + BC_HA; })[0];
check('Bảng: 1 dòng / sản phẩm, có cột Shopee / TikTok / Web / Tổng', hHA && hHA.Shopee === 1 && hHA.Web === 4 && hHA.tong === hHA.Shopee + hHA.TikTok + hHA.Web, hHA);
check('Lọc ngành Lịch chỉ còn lịch', SB.xoay(t, { nganh: 'Lịch' }).hang.length === 1 && SB.xoay(t, { nha: 'MEGA' }).hang.length === 1);
check('Tìm tên không dấu', SB.xoay(t, { tim: 'bi quyet' }).hang.length === 1);
check('Thẻ tóm tắt: tổng cuốn = tổng bảng, chia theo nhà', xo.the.Tong.sl === xo.hang.reduce(function (a, h) { return a + h.tong; }, 0) && xo.the.TikTok.nha.HA.sl > 0, xo.the.Tong);
var ch = SB.coHoi(xo.hang, 3);
check('Cơ hội: lịch bán 3 ở TikTok mà Shopee / Web = 0', ch.lech.some(function (c) { return c.h.nganh === 'Lịch' && c.san === 'TikTok' && c.thieu.length === 2; }), ch.lech.length);
check('Khoảng ngày: hôm qua / 7 ngày', SB.khoang('homqua', '2026-11-12').tu === '2026-11-11' && SB.khoang('7', '2026-11-12').tu === '2026-11-06');

console.log('\n10. Báo xong mang theo doanh thu + gian (cột thêm ở cuối, bản cũ không có vẫn đọc được)');
var g = DG.dongGui([{ san: 'TikTok', gian: 'Gian A', rows: [dong('1', BC_HA, HA, 1, { doanhThu: 45000 }), dong('2', BC_HA, HA, 1)] }]);
var r1 = DG.rowTuDong(g.cot, g.dong[0]), r2 = DG.rowTuDong(g.cot, g.dong[1]), r3 = DG.rowTuDong(g.cot.slice(0, 12), g.dong[0].slice(0, 12));
check('12 cột cũ giữ nguyên thứ tự', g.cot.slice(0, 12).join() === 'san,ma_don,sku,ten,phan_loai,gia,sl,ngay_dat,file,ncc,ngay_xuat,web_key');
check('Doanh thu + gian đi kèm; không có giá → không đoán', r1.doanhThu === 45000 && r1.gian === 'Gian A' && r2.doanhThu === undefined && r3.doanhThu === undefined && !r3.gian, [r1, r2]);

console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
process.exit(loi ? 1 : 0);
