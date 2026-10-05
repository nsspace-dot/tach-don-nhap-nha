/* Kiểm thử lịch sử đặt hàng, thống kê, dự báo / gợi ý dự phòng.
 * Chạy: node test/kiemtra-thongke.js   (phần dùng file thật cần mau/tiktok.xlsx, mau/shopee-all.xlsx) */
'use strict';
var fs = require('fs');
var path = require('path');
var XLSX = require('../lib/xlsx-0.18.5.full.min.js');
var DocFile = require('../js/docfile.js');
var PL = require('../js/phanloai.js');
var TK = require('../js/thongke.js');
var XuatFile = require('../js/xuatfile.js');
var GL = require('./gia-lap-apps-script.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet) : '')); }
}
var MAU = path.join(__dirname, '..', 'mau');
var coMau = fs.existsSync(path.join(MAU, 'tiktok.xlsx')) && fs.existsSync(path.join(MAU, 'shopee-all.xlsx'));
function doc(f) { return DocFile.parseWorkbook(XLSX.read(fs.readFileSync(path.join(MAU, f))), XLSX, f); }
var docLs = function (m, tu) { return TK.chuanHoa(m.get({ action: 'lichSuDatHang', tu: tu || '2000-01-01' })); };
var tong = function (ds, c) { return ds.reduce(function (s, r) { return s + r[c]; }, 0); };

if (coMau) {
  console.log('\n1. Ghi lịch sử khi tải file nhà (ghi đè trong ngày)');
  var tt = doc('tiktok.xlsx');
  var kq = PL.classify(tt.rows, {});
  var bg = TK.banGhiNgay(kq, ['HA'], '2026-10-03');
  check('Bản ghi Hồng Ân: tổng số lượng = số cuốn Hồng Ân trên app', tong(bg.dong, 'sl') === PL.tong(kq.nha.HA).cuon, [tong(bg.dong, 'sl'), PL.tong(kq.nha.HA).cuon]);
  check('Tách số lượng theo nguồn (TikTok)', tong(bg.dong, 'sl_tiktok') === tong(bg.dong, 'sl') && tong(bg.dong, 'sl_shopee') === 0);
  var treoMongDoi = 0;
  kq.nha.HA.forEach(function (g) { g.nguon.forEach(function (s) { if (s.row.ngayDat < '2026-10-03') treoMongDoi += s.sl; }); });
  check('Đơn treo từ ngày trước (ngày đặt 02/10 < 03/10) = ' + treoMongDoi + ' cuốn', tong(bg.dong, 'sl_treo') === treoMongDoi && treoMongDoi > 0, tong(bg.dong, 'sl_treo'));
  check('Không lưu thông tin khách (chỉ ngày, nhà, barcode, tên sách, giá, số lượng)', bg.dong.every(function (r) {
    return Object.keys(r).join(',') === 'ngay,nha,barcode,ten,gia,sl,sl_shopee,sl_tiktok,sl_web,sl_treo';
  }));
  var m = GL.taoMoiTruong(); m.ctx.khoiTao();
  var r1 = m.post('ghiLichSuDatHang', bg);
  var lan1 = docLs(m);
  var r2 = m.post('ghiLichSuDatHang', bg);
  var lan2 = docLs(m);
  check('Tải file 2 lần trong ngày → ghi đè, không nhân đôi', r1.ok && r2.ok && lan1.length === lan2.length && tong(lan2, 'sl') === tong(bg.dong, 'sl'), [lan1.length, lan2.length, tong(lan2, 'sl')]);
  m.post('ghiLichSuDatHang', TK.banGhiNgay(kq, ['KV'], '2026-10-03'));
  var bg2 = TK.banGhiNgay({ nha: { HA: kq.nha.HA.slice(0, 2), KV: [], ML: [] } }, ['HA'], '2026-10-03');
  m.post('ghiLichSuDatHang', bg2);
  var lan3 = docLs(m);
  check('Tải lại riêng Hồng Ân → chỉ thay số Hồng Ân của ngày đó, Khang Việt giữ nguyên',
    lan3.filter(function (x) { return x.nha === 'HA'; }).length === 2 && lan3.filter(function (x) { return x.nha === 'KV'; }).length === TK.banGhiNgay(kq, ['KV'], '2026-10-03').dong.length);
  check('Mã đơn đã ghi được lưu (để không nạp trùng)', m.ss.getSheetByName('DON_DA_GHI').getLastRow() - 1 === bg.maDon.length + TK.banGhiNgay(kq, ['KV'], '2026-10-03').maDon.filter(function (x) { return bg.maDon.indexOf(x) < 0; }).length);

  console.log('\n2. Nạp lịch sử từ file đơn cũ');
  var all = doc('shopee-all.xlsx');
  var khongHuy = all.rows.filter(function (x) { return !x.daHuy; });
  check('Order_all: 20 dòng "Đã hủy" bị loại', all.rows.length - khongHuy.length === 20);
  var kqAll = PL.classify(khongHuy, {});
  var dongNap = TK.dongNapLichSu(kqAll);
  check('Mỗi dòng nạp theo NGÀY ĐẶT của đơn', dongNap.every(function (x) { return /^2026-10-0[123]$/.test(x.ngay) && x.ma_don.indexOf('Shopee:') === 0; }));
  var m2 = GL.taoMoiTruong(); m2.ctx.khoiTao();
  var n1 = m2.post('napLichSuDatHang', { dong: dongNap });
  var sau1 = docLs(m2);
  var n2 = m2.post('napLichSuDatHang', { dong: dongNap });
  var sau2 = docLs(m2);
  check('Nạp lần 1: ghi theo ngày đặt, cộng đủ', n1.ok && n1.soDonMoi > 0 && tong(sau1, 'sl') === tong(dongNap, 'sl'), n1);
  check('Nạp lại cùng file → đơn trùng mã bỏ qua, không cộng thêm', n2.soDonMoi === 0 && n2.soDonTrung === n1.soDonMoi && tong(sau2, 'sl') === tong(sau1, 'sl'), n2);
  var huy = all.rows.filter(function (x) { return x.daHuy; }).map(function (x) { return 'Shopee:' + x.orderId; });
  check('Đơn hủy không có trong lịch sử', !m2.ss.getSheetByName('DON_DA_GHI').data.some(function (r) { return huy.indexOf(r[0]) >= 0; }));
  var m3 = GL.taoMoiTruong(); m3.ctx.khoiTao();
  var kqHomNay = PL.classify(DocFile.locTrangThai(doc('shopee-all.xlsx')).rowsGoc, {});
  var ghiNay = TK.banGhiNgay(kqHomNay, ['HA', 'KV', 'ML'], '2026-10-03');
  m3.post('ghiLichSuDatHang', ghiNay);
  var n3 = m3.post('napLichSuDatHang', { dong: dongNap });
  check('Đơn đã ghi khi tải file hằng ngày → nạp lịch sử cũ bỏ qua đơn đó', n3.soDonTrung === ghiNay.maDon.length && n3.soDonTrung > 0, [n3.soDonTrung, ghiNay.maDon.length]);
}

console.log('\n3. Trung bình có trọng số & gợi ý dự phòng (dữ liệu giả)');
var NAY = '2026-10-05';
function ngayTruoc(n) { return TK.congNgay(NAY, -n); }
function dong(ngay, barcode, sl, treo, nha) { return { ngay: ngay, nha: nha || 'HA', barcode: barcode, ten: 'Sách ' + barcode, gia: 50000, sl: sl, sl_shopee: sl, sl_tiktok: 0, sl_web: 0, sl_treo: treo || 0 }; }
var rows = [];
for (var i = 1; i <= 40; i++) rows.push(dong(ngayTruoc(i), 'DEU2', 2));           // ngày nào cũng 2 cuốn
for (i = 1; i <= 9; i++) rows.push(dong(ngayTruoc(i * 3), 'THUA', 5));              // 9/28 ngày → không đều
rows.push(dong(ngayTruoc(1), 'MOT', 28));                                             // chỉ hôm qua
for (i = 1; i <= 10; i++) rows.push(dong(ngayTruoc(i), 'GAN', 1));                    // 10 ngày gần nhất, 1 cuốn/ngày
for (i = 19; i <= 28; i++) rows.push(dong(ngayTruoc(i), 'XA', 1));                    // 10 ngày xa nhất, 1 cuốn/ngày
var db = TK.duBao(rows, 2, NAY);
check('Đủ dữ liệu (≥ 14 ngày)', db.duDuLieu);
check('Bán đều 2 cuốn/ngày → trung bình 2, gợi ý ⌈2 × 2⌉ = 4', Math.abs(db.theoSach['HA|DEU2'].tb - 2) < 1e-9 && db.theoSach['HA|DEU2'].goiY === 4, db.theoSach['HA|DEU2']);
check('Có đơn 9/28 ngày → không gợi ý (chưa đều)', db.theoSach['HA|THUA'].goiY === 0 && db.theoSach['HA|THUA'].soNgayCo === 9);
check('Trọng số: 28 cuốn chỉ hôm qua → tb = 28×28/406', Math.abs(db.theoSach['HA|MOT'].tb - 28 * 28 / 406) < 1e-9);
check('Ngày gần nặng hơn: 10 ngày gần (tb ' + db.theoSach['HA|GAN'].tb.toFixed(2) + ') > 10 ngày xa (tb ' + db.theoSach['HA|XA'].tb.toFixed(2) + ')',
  db.theoSach['HA|GAN'].tb > db.theoSach['HA|XA'].tb && db.theoSach['HA|GAN'].goiY === Math.ceil(db.theoSach['HA|GAN'].tb * 2));
check('Đơn treo không tính 2 lần trong dự báo (số = đặt − treo)', TK.duBao([dong(ngayTruoc(1), 'T', 5, 5)].concat(rows), 2, NAY).theoSach['HA|T'] === undefined);
check('Số ngày dự phòng = 0 → không gợi ý', TK.duBao(rows, 0, NAY).theoSach['HA|DEU2'].goiY === 0);
check('Chưa đủ 14 ngày dữ liệu → "Chưa đủ dữ liệu"', !TK.duBao([dong(ngayTruoc(3), 'A', 1)], 2, NAY).duDuLieu && !TK.duBao([], 2, NAY).duDuLieu);

console.log('\n4. Gợi ý KHÔNG tự cộng vào file khi chưa bấm');
var kqGia = { nha: { HA: [{ sku: '8935092851334', ten: 'Sách - A - HA', tenGon: 'A', gia: 50000, sl: 3, nguon: [] }, { sku: '', ten: 'Sách - B - HA', tenGon: 'B', gia: 20000, sl: 1, nguon: [] }], KV: [], ML: [] } };
var truoc = XuatFile.dongCuaNha(kqGia, 'HA');
check('Chưa bấm "Thêm vào đơn" → file giữ nguyên', JSON.stringify(XuatFile.dongCuaNha(TK.apDungDuPhong(kqGia, {}), 'HA')) === JSON.stringify(truoc) &&
  JSON.stringify(XuatFile.dongCuaNha(TK.apDungDuPhong(kqGia, null), 'HA')) === JSON.stringify(truoc));
var sau = XuatFile.dongCuaNha(TK.apDungDuPhong(kqGia, { HA: { '8935092851334': 4 } }), 'HA');
check('Bấm "Thêm vào đơn" 4 cuốn → chỉ dòng đó tăng 3 → 7', sau.filter(function (d) { return d.ten === 'A'; })[0].sl === 7 && sau.filter(function (d) { return d.ten === 'B'; })[0].sl === 1);
check('Kết quả gốc không bị đổi', kqGia.nha.HA[0].sl === 3);

console.log('\n5. Thống kê');
var tk = TK.tinhThongKe(rows, { den: ngayTruoc(1), tu: ngayTruoc(30) });
check('Top sách: DEU2 đứng đầu (60 cuốn / 30 ngày)', tk.top[0].barcode === 'DEU2' && tk.top[0].sl === 60, tk.top.slice(0, 3));
check('Theo ngày: đủ 30 ngày, tổng khớp', tk.theoNgay.length === 30 && tk.theoNgay.reduce(function (s, x) { return s + x.sl; }, 0) === tk.tongCuon);
check('Theo tuần: chia theo nhà, tổng khớp', tk.theoTuan.reduce(function (s, x) { return s + x.HA + x.KV + x.ML; }, 0) === tk.tongCuon);
var tang = [];
for (i = 1; i <= 7; i++) tang.push(dong(ngayTruoc(i), 'TANG', 2));
for (i = 8; i <= 14; i++) tang.push(dong(ngayTruoc(i), 'TANG', 1));
for (i = 1; i <= 7; i++) tang.push(dong(ngayTruoc(i), 'IT', 1));
tang.push(dong(ngayTruoc(10), 'IT', 1));
tang.push(dong(ngayTruoc(45), 'NGU', 3));
for (i = 1; i <= 4; i++) tang.push(dong(ngayTruoc(i * 5), 'THIEU', 2, 1));
tk = TK.tinhThongKe(tang, { den: ngayTruoc(1) });
check('📈 Đang tăng: 14 vs 7 cuốn (+100%, +7) → có; 7 vs 1 (+6, nhưng chỉ cần ≥ 5) → có',
  tk.dangTang.some(function (x) { return x.barcode === 'TANG' && x.nay === 14 && x.truoc === 7; }) && tk.dangTang.some(function (x) { return x.barcode === 'IT'; }), tk.dangTang);
var tang2 = [dong(ngayTruoc(1), 'NHO', 4), dong(ngayTruoc(9), 'NHO', 1), dong(ngayTruoc(1), 'CHAM', 12), dong(ngayTruoc(9), 'CHAM', 10)];
var tk2 = TK.tinhThongKe(tang2, { den: ngayTruoc(1) });
check('…tăng < 5 cuốn hoặc < 50% → không', tk2.dangTang.length === 0, tk2.dangTang);
check('💤 Lâu không có đơn: đơn cuối cách ≥ 30 ngày', tk.lauKhong.length === 1 && tk.lauKhong[0].barcode === 'NGU' && tk.lauKhong[0].soNgay === 44);
check('⚠️ Hay bị thiếu: có đơn treo ≥ 3 ngày trong 30 ngày', tk.hayThieu.length === 1 && tk.hayThieu[0].barcode === 'THIEU' && tk.hayThieu[0].soLan === 4);
var tkKV = TK.tinhThongKe(rows.concat([dong(ngayTruoc(2), 'K1', 9, 0, 'KV')]), { den: ngayTruoc(1), nha: 'KV' });
check('Lọc theo nhà', tkKV.top.length === 1 && tkKV.top[0].barcode === 'K1');
var tkNg = TK.tinhThongKe([{ ngay: ngayTruoc(1), nha: 'HA', barcode: 'X', ten: 'X', gia: 1, sl: 5, sl_shopee: 2, sl_tiktok: 0, sl_web: 3, sl_treo: 0 }], { den: ngayTruoc(1), nguon: 'Web' });
check('Lọc theo nguồn (Web = 3)', tkNg.top[0].sl === 3);

console.log('\n6. Dữ liệu lớn → gom tháng cũ');
var m4 = GL.taoMoiTruong(); m4.ctx.khoiTao();
var sh = m4.ss.getSheetByName('LS_DAT_HANG');
sh.data = [['ngay', 'nha', 'barcode', 'ten', 'gia', 'sl', 'sl_shopee', 'sl_tiktok', 'sl_web', 'sl_treo', 'cap_nhat']];
m4.ctx.NGUONG_GOM_THANG = 50; m4.ctx.NGUONG_NHAC_LON = 40;
for (i = 0; i < 60; i++) sh.data.push(['2025-01-' + ('0' + (i % 28 + 1)).slice(-2), 'HA', 'B' + (i % 2), 'Sách', 1000, 1, 1, 0, 0, 0, '']);
var rg = m4.post('ghiLichSuDatHang', { ngay: '2026-10-05', nhas: ['HA'], dong: [{ nha: 'HA', barcode: 'B0', ten: 'Sách', gia: 1000, sl: 2 }], maDon: [] });
var conLai = m4.ss.getSheetByName('LS_DAT_HANG').data.slice(1).filter(function (x) { return x[0]; });
check('Quá ngưỡng → gom các ngày cũ thành 1 dòng / tháng, tổng số lượng giữ nguyên', rg.gomThang === 60 && conLai.length === 3 &&
  conLai.filter(function (x) { return x[0] === '2025-01'; }).reduce(function (s, x) { return s + x[5]; }, 0) === 60, [rg.gomThang, conLai.length]);

console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
process.exit(loi ? 1 : 0);
