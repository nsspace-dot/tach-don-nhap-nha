/* Kiểm thử đơn lặp qua các ngày: mỗi khóa (sàn + mã đơn + sản phẩm) chỉ đếm 1 lần, SL tăng thì cộng phần chênh. Chạy: node test/kiemtra-donlap.js */
'use strict';
var GL = require('./gia-lap-apps-script.js');
var BH = require('../js/banhang.js'), SB = require('../js/sanban.js'), PL = require('../js/phanloai.js'), DG = require('../js/dot-gop.js'), TK = require('../js/thongke.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet).slice(0, 400) : '')); }
}
function ngayTruoc(n) { return SB.congNgay(DG.homNayVN(), -n); }
function ean(b) { var t = 0; for (var i = 0; i < 12; i++) t += +b[i] * (i % 2 ? 3 : 1); return b + ((10 - t % 10) % 10); }
var BC = ean('893500000001'), BC2 = ean('893500000002'), TEN = 'Sách Luyện Đề Toán 5 - HA';
function dong(ma, sl, o) { return Object.assign({ san: 'TikTok', orderId: ma, sku: BC, ten: TEN, phanLoai: '', gia: 50000, sl: sl, ngayDat: ngayTruoc(10), doanhThu: sl * 40000 }, o || {}); }
function file(rows) { return { san: 'TikTok', rows: rows }; }
function chot(m, ngay, rows) {
  var kq = PL.classify(rows, m.get(), {});
  return m.post('chotDot', { dot_id: ngay, ban_hang: BH.maHoa([file(rows)], ngay), thong_ke: SB.maHoa(kq, { catalog: m.get() }) }, 'Tú');
}
function cuon(th, sku) { return (th.kq.nha.HA || []).filter(function (g) { return g.sku === sku; }).reduce(function (s, g) { return s + g.sl; }, 0); }
function tkSl(m, tu, den, khoa) {
  var t = m.get({ action: 'thongKe', tu: tu, den: den, combo: 'nguyen' }), i = -1;
  t.sp.forEach(function (p, k) { if (p[0] === khoa) i = k; });
  return t.d.filter(function (x) { return x[0] === i; }).reduce(function (s, x) { return s + x[3]; }, 0);
}

var m = GL.taoMoiTruong(); m.ctx.khoiTao();
var D1 = ngayTruoc(5), D2 = ngayTruoc(4), D3 = ngayTruoc(3);

console.log('\n1. BAN_HANG: đơn lặp chỉ đếm 1 lần, SL tăng thì cộng phần chênh');
var r = chot(m, D1, [dong('A1', 2), dong('A2', 1)]);
check('Đợt 1: 2 dòng mới', r.banHang.soDong === 2 && r.thongKe.soDong === 2, r.banHang);
r = chot(m, D2, [dong('A1', 2), dong('A2', 3), dong('A3', 1)]); // A1 lặp y nguyên, A2 tăng 1 → 3
check('Đợt 2: 1 mới, 1 lặp bỏ, 1 tăng', r.banHang.soDong === 1 && r.banHang.boTrung === 1 && r.banHang.soTang === 1, r.banHang);
check('THONG_KE đợt 2: cũng 1 mới, 1 lặp bỏ, 1 tăng', r.thongKe.soDong === 1 && r.thongKe.boTrung === 1 && r.thongKe.soTang === 1, r.thongKe);
var j = m.get({ action: 'banHang', tu: ngayTruoc(60) });
var th = BH.tongHop(j.khoi, m.get(), {}, [], j.truoc);
check('Dự báo: tổng = 2 + 3 + 1 = 6 (không phải 2+1+2+3+1)', cuon(th, BC) === 6, cuon(th, BC));
check('Đếm lặp: 1 dòng bỏ, 0 dòng tăng khi đọc (dòng tăng đã lưu SL thấy được)', th.soLap === 0 && th.soTang === 1, [th.soLap, th.soTang]);
check('THONG_KE: D1 = 3, D2 = 1 (A3) + 2 (A2 tăng) = 3', tkSl(m, D1, D1, 'bc:' + BC) === 3 && tkSl(m, D2, D2, 'bc:' + BC) === 3, [tkSl(m, D1, D1, 'bc:' + BC), tkSl(m, D2, D2, 'bc:' + BC)]);
var tk = m.get({ action: 'thongKe', tu: D2, den: D2, combo: 'nguyen' });
check('Số đơn đợt 2: chỉ đơn mới A3 (đơn lặp không đếm lại)', tk.don.some(function (x) { return x[0] === 'TikTok' && x[2] === 1; }), tk.don);
var dtD2 = tk.d.reduce(function (s, x) { return s + (x[5] || 0); }, 0);
check('Doanh thu đợt 2 = A3 40.000 + phần tăng A2 (2/3 × 120.000)', dtD2 === 120000, dtD2);

console.log('\n2. Lặp sau hơn 60 ngày vẫn chỉ đếm 1 lần (so toàn bộ lịch sử)');
var m2 = GL.taoMoiTruong(); m2.ctx.khoiTao();
chot(m2, ngayTruoc(100), [dong('B1', 4)]);
r = chot(m2, ngayTruoc(1), [dong('B1', 4), dong('B2', 1)]);
check('Đơn B1 xuất hiện lại sau 99 ngày → bỏ (BAN_HANG + THONG_KE)', r.banHang.boTrung === 1 && r.thongKe.boTrung === 1, [r.banHang, r.thongKe]);

console.log('\n3. Dữ liệu cũ đã bị lưu trùng (trước bản này) – đọc lại chỉ đếm 1 lần, không xóa gì');
var m3 = GL.taoMoiTruong(); m3.ctx.khoiTao();
var sh = m3.ss.getSheetByName('BAN_HANG'), ks = function (ngay, sl) {
  return [ngay, 'dot', '0', JSON.stringify({ sp: [['TikTok', BC, TEN, '', 50000, '']], d: [[0, 'C1', sl, ngayTruoc(80), '']] }), ''];
};
sh.data.push(ks(ngayTruoc(80), 2), ks(ngayTruoc(10), 2), ks(ngayTruoc(5), 3)); // cùng đơn C1 lưu 3 lần (2, 2, 3)
var truocGoc = JSON.stringify(sh.data);
j = m3.get({ action: 'banHang', tu: ngayTruoc(60) });
th = BH.tongHop(j.khoi, m3.get(), {}, [], j.truoc);
check('Tải 60 ngày: khối 80 ngày trước nằm ngoài kỳ nhưng vẫn biết (truoc) → chỉ cộng 1 cuốn tăng', cuon(th, BC) === 1 && j.truoc[Object.keys(j.truoc)[0]] === 2, [cuon(th, BC), j.truoc]);
j = m3.get({ action: 'banHang', tu: ngayTruoc(200) });
th = BH.tongHop(j.khoi, m3.get(), {}, [], j.truoc);
check('Tải toàn bộ: tổng 3 cuốn (không phải 7)', cuon(th, BC) === 3, cuon(th, BC));
check('Báo số dòng lặp trong sheet: 2 dòng, 4 cuốn không cộng lại', j.lap.soDong === 2 && j.lap.soCuon === 4 && j.lap.soTang === 1, j.lap);
check('Không xóa / sửa dữ liệu gốc', JSON.stringify(sh.data) === truocGoc);
var kt = m3.ctx.kiemTraDonLap();
check('Hàm kiemTraDonLap() đếm giống', kt.ban_hang.soDong === 2 && kt.thong_ke_dong_lap === 0, kt);

console.log('\n4. Tra đơn đã có ở đợt trước (nhãn 🔁 ở Tách đơn)');
j = m.post('donLap', { ngay: D3, don: ['TikTok:A1', 'TikTok:A2', 'TikTok:X9'] }, 'Lan');
var kA2 = BH.khoa(['TikTok', BC, TEN, ''], [0, 'A2']);
check('A1 có từ đợt 1 (lặp không tăng không lưu lại), A2 SL cao nhất 3, X9 không có', j.lap['TikTok:A1'].ngay.join() === D1 && j.lap['TikTok:A2'].dong[kA2] === 3 && !j.lap['TikTok:X9'], j.lap);
j = m.post('donLap', { ngay: D2, don: ['TikTok:A3'] }, 'Lan');
check('Chỉ tính đợt TRƯỚC ngày đang xét', !j.lap['TikTok:A3']);

console.log('\n5. Thống kê đặt hàng (LS_DAT_HANG): đơn lặp tính vào phần "đã tính", mỗi đơn 1 lần');
var rows = [dong('A1', 2), dong('A2', 4), dong('N1', 1, { ngayDat: ngayTruoc(9) })];
rows[0]._daDem = 2; rows[1]._daDem = 3; rows[2]._daDem = 0; // N1: đơn mới dù ngày đặt trước ngày đợt
var bg = TK.banGhiNgay(PL.classify(rows, m.get(), {}), ['HA'], D3)
var b = bg.dong[0];
check('sl 7, phần lặp 5 (A1 2 + A2 3), tách theo sàn', b.sl === 7 && b.sl_treo === 5 && b.sl_treo_tiktok === 5 && b.sl_treo_shopee === 0, b);
r = m.post('ghiLichSuDatHang', bg, 'Tú');
var ls = TK.chuanHoa(m.get({ action: 'lichSuDatHang', tu: ngayTruoc(30) }));
check('Lưu + đọc lại: tất cả nguồn = 2, lọc TikTok = 2', TK.soLuong(ls[0]) === 2 && TK.soLuong(ls[0], 'TikTok') === 2, ls[0]);
var cu = TK.chuanHoa({ cot: ['ngay', 'nha', 'barcode', 'sl', 'sl_shopee', 'sl_tiktok', 'sl_treo'], dong: [[D3, 'HA', BC, 10, 4, 6, 5]] })[0];
check('Dòng cũ (chưa có cột theo sàn): chia phần lặp theo tỷ lệ', TK.soLuong(cu) === 5 && TK.soLuong(cu, 'Shopee') === 2 && TK.soLuong(cu, 'TikTok') === 3, cu);
delete rows[2]._daDem; delete rows[0]._daDem; delete rows[1]._daDem;
check('Chưa tra được (Code.gs cũ) → như trước (ngày đặt trước ngày đợt)', TK.banGhiNgay(PL.classify(rows, {}, {}), ['HA'], D3).dong[0].sl_treo === 7);

console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
process.exit(loi ? 1 : 0);
