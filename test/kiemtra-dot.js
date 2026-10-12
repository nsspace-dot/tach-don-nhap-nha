/* Kiểm thử Người dùng + Đợt đặt hàng: báo xong, trùng đơn giữa người, gộp tính lại theo danh mục mới, mở lại, chốt, đợt sau.
 * Chạy: node test/kiemtra-dot.js   (có mau/tiktok.xlsx, mau/web.xlsx thì thử thêm bằng file thật) */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var cp = require('child_process');
var GL = require('./gia-lap-apps-script.js');
var DG = require('../js/dot-gop.js');
var DocFile = require('../js/docfile.js');
var PL = require('../js/phanloai.js');
var TK = require('../js/thongke.js');
var XLSX = require('../lib/xlsx-0.18.5.full.min.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet).slice(0, 400) : '')); }
}
var HOM_NAY = DG.homNayVN();
// Simulator định dạng ngày theo giờ máy; đợt theo giờ VN – dùng ngày server trả về cho chắc
function ngayServer(m) { return m.get({ action: 'dot' }).hom_nay; }

/* Dòng TikTok giả: đơn từ..đến (mỗi đơn 1 dòng sách lẻ HA) + vài đơn combo */
function dongTikTok(tu, den, combo) {
  var rows = [];
  for (var i = tu; i <= den; i++) {
    rows.push({ san: 'TikTok', orderId: String(580000000000 + i), sku: '89350000' + String(10000 + (i % 30)), ten: 'Sách Luyện Đề Toán ' + (i % 30) + ' - HA',
                phanLoai: '', gia: 50000, sl: 1, ngayDat: HOM_NAY, file: 'tiktok-' + tu + '.xlsx' });
  }
  (combo || []).forEach(function (i) {
    rows.push({ san: 'TikTok', orderId: String(590000000000 + i), sku: 'CB-ABC', ten: 'Combo 2 Cuốn Truyện Cổ Tích', phanLoai: '', gia: 90000, sl: 1, ngayDat: HOM_NAY, file: 'tiktok-' + tu + '.xlsx' });
  });
  return rows;
}
/* Mô phỏng 1 nhân viên: thả file → gộp file → dòng gửi đi */
function phanCua(dsFile) {
  var files = dsFile.map(function (rows, i) { return { id: i + 1, san: rows[0].san, file: rows[0].file, rows: rows, error: null }; });
  files.forEach(function (p) { DocFile.locTrangThai(p); });
  DocFile.gopFile(files);
  return { files: files, gui: DG.dongGui(files) };
}
function baoXong(m, nguoi, phan, them) {
  var g = phan.gui;
  return m.post('baoXong', Object.assign({ dot_id: HOM_NAY, cot: g.cot, dong: g.dong, nguon: g.nguon, so_don: g.soDon, con_combo: 0, con_chua_ro: 0 }, them || {}), nguoi);
}
/* Người đặt hàng: lấy các phần → gộp → phân loại theo danh mục MỚI NHẤT */
function gopDot(m, dotId) {
  var j = m.get({ action: 'dot', id: dotId, duLieu: '1' });
  var g = DG.gopPhan(j.phan);
  g.files.forEach(function (p) { DocFile.locTrangThai(p); });
  DocFile.gopFile(g.files);
  var rows = g.files.reduce(function (a, p) { return a.concat(p.rows); }, []);
  var cat = m.get();
  return { j: j, g: g, rows: rows, kq: PL.classify(rows, cat, {}) };
}
function tongCuon(list) { return list.reduce(function (s, g) { return s + g.sl; }, 0); }

console.log('\n1. Người dùng');
var m = GL.taoMoiTruong(); m.ctx.khoiTao();
var r = m.post('luuNguoiDung', { ds: [{ ten: 'Lan', vai_tro: 'san' }, { ten: 'Hoa', vai_tro: 'san' }, { ten: 'Mai', vai_tro: 'san' }, { ten: 'Tú', vai_tro: 'dat_hang' }, { ten: 'lan', vai_tro: 'san' }] }, 'Tú');
check('Lưu danh sách (bỏ tên trùng), vai trò đúng', r.ok && r.nguoi_dung.length === 4 && r.nguoi_dung[3].vai_tro === 'dat_hang', r);
var g0 = m.get();
check('GET danh mục kèm danh sách người dùng + api ≥ 3', g0.api >= 3 && g0.nguoi_dung.length === 4);
check('Báo xong khi chưa chọn "Tôi là" → báo lỗi rõ', /Tôi là/.test(m.post('baoXong', { cot: DG.COT, dong: [] }, '').error || ''));
HOM_NAY = ngayServer(m);

console.log('\n2. A, B gửi cùng đợt, có 15 đơn trùng → gộp chỉ tính 1 lần');
var A = phanCua([dongTikTok(1, 40, [1, 2])]);         // 40 đơn lẻ + 2 đơn combo
var B = phanCua([dongTikTok(26, 60)]);                 // trùng đơn 26..40 = 15 đơn
r = baoXong(m, 'Lan', A, { con_combo: 1 });
check('A báo xong: server xác nhận', r.ok && r.dot_id === HOM_NAY && r.phan.so_dong === 42 && !r.trung.length, r);
r = baoXong(m, 'Hoa', B);
check('B báo xong: "15 đơn trùng với phần của Lan"', r.ok && r.trung.length === 1 && r.trung[0].nguoi === 'Lan' && r.trung[0].so_don === 15, r.trung);
var sh = m.ss.getSheetByName('DOT_DL_' + HOM_NAY);
var dlChu = JSON.stringify(sh.data);
check('Dữ liệu đợt nằm trong sheet riêng (ẩn), chỉ có cột đã chuẩn hóa', sh.an === true && JSON.parse(sh.data[1][2]).cot.join(',') === DG.COT.join(','));
check('Không lưu thông tin khách / file gốc', !/Recipient|Người nhận|Số điện thoại|Địa chỉ|Phone|Address/i.test(dlChu));
var gd = gopDot(m, HOM_NAY);
check('Gộp: báo bỏ 15 đơn trùng (Hoa trùng Lan)', gd.g.tongTrung === 15 && gd.g.trung[0].nguoi === 'Hoa' && gd.g.trung[0].voi === 'Lan', gd.g.trung);
check('Gộp: 60 đơn lẻ + 2 combo, mỗi đơn 1 lần', gd.rows.length === 62, gd.rows.length);
check('Bảng HA = 60 cuốn (không cộng trùng)', tongCuon(gd.kq.nha.HA) === 60, tongCuon(gd.kq.nha.HA));
var choKb = gd.kq.combo.concat(gd.kq.chuaRo).filter(function (g) { return g.isCombo || g.lines.some(function (l) { return l.row.sku === 'CB-ABC'; }); });
check('Combo chưa khai báo còn chờ khai báo (2 đơn)', choKb.length === 1 && tongCuon(choKb) === 2, choKb.length);

console.log('\n3. B khai báo combo SAU khi A đã báo xong → gộp vẫn tách đúng phần của A');
m.post('upsertCombo', { ten_combo: 'Combo 2 Cuốn Truyện Cổ Tích', khoa: ['sku:CB-ABC'], thanh_phan: [
  { sku: '8935000099991', ten: 'Cổ Tích Việt Nam', nha: 'KV', gia_goc: 45000, so_luong: 1 },
  { sku: '8935000099992', ten: 'Cổ Tích Thế Giới', nha: 'KV', gia_goc: 45000, so_luong: 1 }] }, 'Hoa');
gd = gopDot(m, HOM_NAY);
check('Không còn combo chờ khai báo', !gd.kq.combo.concat(gd.kq.chuaRo).some(function (g) { return g.lines.some(function (l) { return l.row.sku === 'CB-ABC'; }); }));
check('KV có 2 cuốn × 2 đơn của A', gd.kq.nha.KV.length === 2 && tongCuon(gd.kq.nha.KV) === 4, gd.kq.nha.KV.map(function (g) { return [g.sku, g.sl]; }));

console.log('\n4. Mở lại rồi gửi lại → thay bản cũ, không cộng dồn');
r = m.post('moLaiPhan', { dot_id: HOM_NAY }, 'Lan');
var ph = m.get({ action: 'dot', id: HOM_NAY }).phan.filter(function (p) { return p.nguoi === 'Lan'; })[0];
check('Mở lại → trạng thái "đang sửa lại"', r.ok && ph.trang_thai === 'mo_lai');
var A2 = phanCua([dongTikTok(1, 45, [1, 2])]);         // thêm 5 đơn
r = baoXong(m, 'Lan', A2);
ph = m.get({ action: 'dot', id: HOM_NAY }).phan.filter(function (p) { return p.nguoi === 'Lan'; });
check('Gửi lại: vẫn 1 phần của Lan, lần gửi 2, 47 dòng', r.ok && r.thay_ban_cu && ph.length === 1 && ph[0].phien === 2 && ph[0].so_dong === 47 && ph[0].trang_thai === 'da_gui', ph);
gd = gopDot(m, HOM_NAY);
check('Gộp sau gửi lại: 60 đơn lẻ (1..60) – không cộng dồn bản cũ', tongCuon(gd.kq.nha.HA) === 60 && gd.rows.length === 62, [tongCuon(gd.kq.nha.HA), gd.rows.length]);
var demManh = sh.data.slice(1).filter(function (x) { return x[0] === HOM_NAY + '|Lan'; }).length;
check('Sheet dữ liệu không còn bản cũ của Lan', demManh === 1, demManh);

console.log('\n5. Web: 2 người thả cùng 1 file web → tính 1 lần');
var web = [{ san: 'Web', orderId: '', sku: '8935000077777', ten: 'Sách Web', phanLoai: '', gia: 30000, sl: 3, ncc: 'Nhà Sách Hồng Ân', ngayXuat: HOM_NAY, file: 'web.xlsx' }];
var W = { files: [{ id: 1, san: 'Web', file: 'web.xlsx', rows: web, webKey: '05/10/2026 08:09#abc', error: null }] };
W.files.forEach(function (p) { DocFile.locTrangThai(p); }); DocFile.gopFile(W.files); W.gui = DG.dongGui(W.files);
check('Dòng web gửi kèm dấu nhận dạng file', W.gui.dong[0][DG.COT.indexOf('web_key')].length === 16);
m.post('baoXong', { dot_id: HOM_NAY, cot: W.gui.cot, dong: W.gui.dong, nguon: ['Web'] }, 'Mai');
r = m.post('baoXong', { dot_id: HOM_NAY, cot: W.gui.cot, dong: W.gui.dong.concat(B.gui.dong), nguon: ['Web', 'TikTok'] }, 'Hoa');
check('Server báo trùng file web với Mai', r.trung.some(function (t) { return t.nguoi === 'Mai' && t.so_don === 1; }), r.trung);
gd = gopDot(m, HOM_NAY);
var webHa = gd.kq.nha.HA.filter(function (g) { return g.sku === '8935000077777'; });
check('Gộp: sách web chỉ 3 cuốn (không phải 6)', webHa.length === 1 && webHa[0].sl === 3, webHa.map(function (g) { return g.sl; }));

console.log('\n6. Chốt đợt: ghi lịch sử ĐÚNG 1 LẦN; chốt rồi mà báo xong → vào đợt mai');
var bg = TK.banGhiNgay(gd.kq, PL.NHA.slice(), HOM_NAY);
r = m.post('chotDot', { dot_id: HOM_NAY, lich_su: bg }, 'Tú');
var lsDh = m.get({ action: 'lichSuDatHang', tu: '2000-01-01' });
var tongLs = lsDh.dong.filter(function (x) { return x[0] === HOM_NAY; }).reduce(function (s, x) { return s + x[5]; }, 0);
check('Chốt: đợt khóa, ghi lịch sử', r.ok && r.dot.trang_thai === 'da_chot' && r.dot.chot_boi === 'Tú' && r.lichSu.soDong > 0, r);
check('Lịch sử ngày đợt = đúng số cuốn đã gộp', tongLs === tongCuon(gd.kq.nha.HA) + tongCuon(gd.kq.nha.KV) + tongCuon(gd.kq.nha.ML), [tongLs]);
r = m.post('chotDot', { dot_id: HOM_NAY, lich_su: bg }, 'Tú');
check('Chốt lần nữa → báo đã chốt, không ghi thêm', r.da_chot_truoc === true);
r = baoXong(m, 'Mai', phanCua([dongTikTok(100, 105)]));
check('Báo xong sau khi chốt → vào đợt ngày mai', r.ok && r.chuyen_dot === true && r.dot_id === DG.homNayVN(new Date(Date.parse(HOM_NAY + 'T12:00:00+07:00') + 864e5)) && r.dot_goc === HOM_NAY, r);
check('Đợt hôm nay không bị đổi', m.get({ action: 'dot', id: HOM_NAY }).phan.filter(function (p) { return p.nguoi === 'Mai'; })[0].so_dong === 1);
r = m.post('moLaiDot', { dot_id: HOM_NAY }, 'Tú');
check('Mở lại đợt', r.ok && r.dot.trang_thai === 'dang_nhan');
m.post('chotDot', { dot_id: HOM_NAY, lich_su: bg }, 'Tú');
lsDh = m.get({ action: 'lichSuDatHang', tu: '2000-01-01' });
var tongLs2 = lsDh.dong.filter(function (x) { return x[0] === HOM_NAY; }).reduce(function (s, x) { return s + x[5]; }, 0);
check('Chốt lại sau khi mở → lịch sử ghi đè, không cộng 2 lần', tongLs2 === tongLs, [tongLs, tongLs2]);
var ds = m.get({ action: 'dsDot' }).dot;
check('Danh sách đợt (mới nhất trước) để xem lại', ds.length === 2 && ds[0].dot_id > ds[1].dot_id && ds[1].so_phan === 3, ds);

console.log('\n7. Dọn đợt cũ hơn 30 ngày');
var cu = DG.homNayVN(new Date(Date.now() - 40 * 864e5));
m.ss.getSheetByName('DOT').data.push([cu, 'da_chot', '', '', '', '', '', '']);
m.ss.getSheetByName('DOT_PHAN').data.push([cu + '|Lan', cu, 'Lan', 'TikTok', 'da_gui', '', 1, 1, 0, 0, 1, '']);
m.ss.insertSheet('DOT_DL_' + cu).data = [['phan_id', 'thu_tu', 'du_lieu'], [cu + '|Lan', 0, '{}']];
baoXong(m, 'Lan', A2);
check('Đợt 40 ngày trước đã bị dọn (đợt, phần, dữ liệu)', !m.get({ action: 'dsDot' }).dot.some(function (d) { return d.dot_id === cu; }) &&
  !m.ss.getSheetByName('DOT_DL_' + cu) && !m.ss.getSheetByName('DOT_PHAN').data.some(function (x) { return x[1] === cu; }));

/* ---------- File thật (nếu có) ---------- */
var MAU = path.join(__dirname, '..', 'mau');
if (fs.existsSync(path.join(MAU, 'tiktok.xlsx'))) {
  console.log('\n8. File thật: 1 người gửi → gộp ra đúng như tách đơn tại máy');
  var doc = function (f) { var p = DocFile.parseWorkbook(XLSX.read(fs.readFileSync(path.join(MAU, f)), { type: 'buffer' }), XLSX, f); p.file = f; p.id = f; return p; };
  var thuc = ['tiktok.xlsx', 'shopee.xlsx', 'web.xlsx'].filter(function (f) { return fs.existsSync(path.join(MAU, f)); }).map(doc);
  thuc.forEach(function (p) { DocFile.locTrangThai(p); }); DocFile.gopFile(thuc);
  var tai = PL.classify(thuc.reduce(function (a, p) { return a.concat(p.rows); }, []), {}, {});
  var m3 = GL.taoMoiTruong(); m3.ctx.khoiTao();
  HOM_NAY = ngayServer(m3);
  var g3 = DG.dongGui(thuc);
  r = m3.post('baoXong', { dot_id: HOM_NAY, cot: g3.cot, dong: g3.dong, nguon: g3.nguon }, 'Lan');
  check('Gửi ' + g3.dong.length + ' dòng (' + g3.nguon.join(', ') + ')', r.ok && r.phan.so_dong === g3.dong.length, r.error);
  var gt = gopDot(m3, HOM_NAY);
  var tom = function (kq) { return JSON.stringify(['HA', 'KV', 'ML'].map(function (n) { return kq.nha[n].map(function (g) { return [g.sku, g.tenGon, g.gia, g.sl]; }); }).concat([kq.combo.length, kq.chuaRo.length, kq.boQua.length])); };
  check('3 bảng nhà + combo + chưa rõ + bỏ qua giống hệt tách tại máy', tom(gt.kq) === tom(tai));
  r = m3.post('baoXong', { dot_id: HOM_NAY, cot: g3.cot, dong: g3.dong, nguon: g3.nguon }, 'Hoa');
  gt = gopDot(m3, HOM_NAY);
  check('Người thứ 2 gửi đúng các file đó → toàn bộ bị bỏ trùng, kết quả không đổi', tom(gt.kq) === tom(tai) && r.trung[0].nguoi === 'Lan', r.trung);
}

/* ---------- App mới + Code.gs cũ ---------- */
console.log('\n9. App mới + Code.gs cũ (bước 1 / trước đó) → không bật Đợt, báo cần cập nhật');
function mayVoi(server) {
  var store = {};
  var ctx = { console: console, JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Object: Object, Array: Array, Promise: Promise, Error: Error, RegExp: RegExp, Intl: Intl,
    setTimeout: setTimeout, setInterval: function () {},
    localStorage: { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    document: { hidden: false, addEventListener: function () {} }, window: { addEventListener: function () {} },
    fetch: function (url, opt) {
      var body;
      if (opt && opt.method === 'POST') body = server.ctx.doPost({ postData: { contents: opt.body } }).body;
      else { var q = {}, i = url.indexOf('?'); if (i >= 0) url.slice(i + 1).split('&').forEach(function (p) { var kv = p.split('='); q[kv[0]] = decodeURIComponent(kv[1] || ''); }); body = server.ctx.doGet({ parameter: q }).body; }
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(body)); } });
    } };
  ctx.self = ctx; vm.createContext(ctx);
  ['docfile.js', 'phanloai.js', 'danhmuc.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx); });
  ctx.DanhMuc.luuCaiDat({ url: 'https://script.google.com/macros/s/x/exec', toiLa: 'Lan' });
  return ctx;
}
function maCodeGs(rev) { try { return cp.execSync('git show ' + rev + ':apps-script/Code.gs', { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; } }
var kiem = [['2ad0b54', 'Code.gs trước khi có nhiều người'], ['aba42c6', 'Code.gs bước 1']];
var chay = Promise.resolve();
kiem.forEach(function (k) {
  chay = chay.then(function () {
    var ma = maCodeGs(k[0]);
    if (!ma) { console.log('  (bỏ qua ' + k[1] + ' – không có lịch sử git)'); return; }
    var sv = GL.taoMoiTruong(ma); sv.ctx.khoiTao();
    var may = mayVoi(sv);
    return may.DanhMuc.taiLai().then(function (ok) {
      check(k[1] + ': đọc danh mục bình thường, KHÔNG bật Đợt, báo cần cập nhật', ok && !may.DanhMuc.coDot() && may.DanhMuc.canCapNhatAppsScript());
    });
  });
});
chay.then(function () {
  var sv = GL.taoMoiTruong(); sv.ctx.khoiTao();
  sv.post('luuNguoiDung', { ds: [{ ten: 'Tú', vai_tro: 'dat_hang' }, { ten: 'Lan', vai_tro: 'san' }] });
  var may = mayVoi(sv);
  return may.DanhMuc.taiLai().then(function () {
    check('Code.gs mới: bật Đợt, không báo cập nhật, vai trò Lan = nhân viên sàn', may.DanhMuc.coDot() && !may.DanhMuc.canCapNhatAppsScript() && may.DanhMuc.vaiTro() === 'san');
  });
}).catch(function (e) { loi++; console.log('  ❌ ' + (e.stack || e)); }).then(function () {
  console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
  process.exit(loi ? 1 : 0);
});
