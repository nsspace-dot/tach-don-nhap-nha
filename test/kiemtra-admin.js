/* Kiểm thử vai trò Admin: mã Admin kiểm tra ở Apps Script, khóa sau 5 lần sai, thao tác chỉ Admin, thao tác thường không cần mã.
 * Chạy: node test/kiemtra-admin.js */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var GL = require('./gia-lap-apps-script.js');
var DG = require('../js/dot-gop.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet).slice(0, 300) : '')); }
}
function lichSu(m) { return m.get({ action: 'lichSu' }).lich_su; }

var m = GL.taoMoiTruong(); m.ctx.khoiTao();
var P = m.postTho; // gửi nguyên, KHÔNG tự kèm mã
delete m.props.ADMIN_MA;
var HOM_NAY = m.get({ action: 'dot' }).hom_nay;

console.log('\n1. Chưa đặt mã Admin');
var g = m.get();
check('GET báo chưa đặt mã, api ≥ 4', g.api >= 4 && g.admin_da_dat_ma === false);
var r = P('luuNguoiDung', { ds: [{ ten: 'Tú', vai_tro: 'admin' }], _maAdmin: 'gi-cung-duoc' }, 'Tú');
check('Thao tác Admin → báo hướng dẫn đặt mã (datMaAdmin)', !r.ok && /^CHUA_DAT_MA_ADMIN/.test(r.error) && /datMaAdmin/.test(r.error), r.error);
r = P('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách A', nha: 'HA', nguon: 'tay' }, 'Lan');
check('Thao tác thường vẫn chạy (gán nhà)', r.ok);
var dong = [['TikTok', '1001', '111', 'Sách A', '', 50000, 1, HOM_NAY, 'a.xlsx', '', '', '']];
r = P('baoXong', { dot_id: HOM_NAY, cot: DG.COT, dong: dong, nguon: ['TikTok'] }, 'Lan');
check('Báo xong vẫn chạy', r.ok);
r = P('chotDot', { dot_id: HOM_NAY }, 'Mai');
check('Chốt đợt (người đặt hàng) không cần mã', r.ok && r.dot.trang_thai === 'da_chot');

console.log('\n2. Đặt mã bằng datMaAdmin (sửa 1 dòng rồi chạy)');
var thu = false;
try { m.ctx.datMaAdmin(); } catch (e) { thu = /MA_ADMIN_MOI/.test(e.message); }
check('Chưa gõ mã (dòng MA_ADMIN_MOI rỗng) → báo cách làm', thu);
vm.runInContext("MA_ADMIN_MOI = 'Meo-2026!';", m.ctx);
m.ctx.datMaAdmin();
check('Mã lưu trong Script Properties (ADMIN_MA), không nằm trong code', m.props.ADMIN_MA === 'Meo-2026!' && fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8').indexOf("var MA_ADMIN_MOI = '';") >= 0);
check('GET báo đã đặt mã', m.get().admin_da_dat_ma === true);
var MA = 'Meo-2026!';

console.log('\n3. Không có mã → không sửa được người dùng / mở lại đợt');
r = P('luuNguoiDung', { ds: [{ ten: 'Tú', vai_tro: 'admin' }, { ten: 'Lan', vai_tro: 'san' }] }, 'Lan');
check('Sửa người dùng không mã → từ chối', !r.ok && /^CAN_MA_ADMIN/.test(r.error) && m.get().nguoi_dung.length === 0, r.error);
r = P('moLaiDot', { dot_id: HOM_NAY }, 'Mai');
check('Mở lại đợt không mã → từ chối, đợt vẫn chốt', !r.ok && /^CAN_MA_ADMIN/.test(r.error) && m.get({ action: 'dot', id: HOM_NAY }).dot.trang_thai === 'da_chot', r.error);
['xoaDot', 'xoaPhan', 'suaPhan', 'luuCaiDatChung', 'importBatch', 'upsertMaChuan', 'xoaHangLoat'].forEach(function (hd) {
  r = P(hd, { dot_id: HOM_NAY, nguoi: 'Lan', skus: ['sku:111'], items: [], bo_file: ['a.xlsx'] }, 'Lan');
  check(hd + ' không mã → từ chối', !r.ok && /^CAN_MA_ADMIN/.test(r.error), r.error);
});
check('Danh mục không bị xóa', !!m.get().skus.length && m.get({ action: 'dot', id: HOM_NAY }).phan.length === 1);

console.log('\n4. Có mã → được, Lịch sử ghi "(Admin)"');
r = P('luuNguoiDung', { ds: [{ ten: 'Tú', vai_tro: 'admin' }, { ten: 'Mai', vai_tro: 'dat_hang' }, { ten: 'Lan', vai_tro: 'san' }], _maAdmin: MA }, 'Tú');
check('Sửa người dùng có mã → được, vai trò admin giữ đúng', r.ok && r.nguoi_dung[0].vai_tro === 'admin' && r.nguoi_dung.length === 3, r);
check('Lịch sử: "Tú (Admin)" sửa người dùng', lichSu(m)[0].hanh_dong === 'luuNguoiDung' && lichSu(m)[0].nguoi === 'Tú (Admin)');
r = P('moLaiDot', { dot_id: HOM_NAY, _maAdmin: MA }, 'Tú');
check('Mở lại đợt có mã → được', r.ok && r.dot.trang_thai === 'dang_nhan' && r.dot.mo_lai_boi === 'Tú (Admin)');
r = P('kiemTraMaAdmin', { _maAdmin: MA }, 'Tú');
check('Đăng nhập Admin (kiểm tra mã) đúng → ok', r.ok);

console.log('\n5. Admin quản lý phần gửi của người khác');
P('baoXong', { dot_id: HOM_NAY, cot: DG.COT, dong: dong.concat([['Shopee', 'S9', '222', 'Sách B', '', 30000, 2, HOM_NAY, 'nham.xlsx', '', '', '']]), nguon: ['TikTok', 'Shopee'] }, 'Lan');
r = P('moLaiPhan', { dot_id: HOM_NAY, nguoi: 'Lan' }, 'Mai');
check('Người khác mở lại phần của Lan không mã → từ chối', !r.ok && /^CAN_MA_ADMIN/.test(r.error));
r = P('moLaiPhan', { dot_id: HOM_NAY, nguoi: 'Lan', _maAdmin: MA }, 'Tú');
check('Admin mở lại phần của Lan', r.ok && m.get({ action: 'dot', id: HOM_NAY }).phan[0].trang_thai === 'mo_lai');
r = P('moLaiPhan', { dot_id: HOM_NAY }, 'Lan');
check('Lan tự mở lại phần của mình không cần mã', r.ok);
r = P('suaPhan', { dot_id: HOM_NAY, nguoi: 'Lan', bo_file: ['nham.xlsx'], _maAdmin: MA }, 'Tú');
var ph = m.get({ action: 'dot', id: HOM_NAY, duLieu: '1' }).phan[0];
check('Admin bỏ file gửi nhầm khỏi phần của Lan', r.ok && r.so_bo === 1 && ph.dong.length === 1 && ph.so_dong === 1 && /nham\.xlsx/.test(ph.ghi_chu), ph);
r = P('xoaPhan', { dot_id: HOM_NAY, nguoi: 'Lan', _maAdmin: MA }, 'Tú');
check('Admin xóa cả phần của Lan (cả dữ liệu dòng)', r.ok && !m.get({ action: 'dot', id: HOM_NAY }).phan.length &&
  !m.ss.getSheetByName('DOT_DL_' + HOM_NAY).data.slice(1).some(function (x) { return x[0]; }));
r = P('xoaDot', { dot_id: HOM_NAY, _maAdmin: MA }, 'Tú');
check('Admin xóa đợt', r.ok && !m.get({ action: 'dsDot' }).dot.some(function (d) { return d.dot_id === HOM_NAY; }) && !m.ss.getSheetByName('DOT_DL_' + HOM_NAY));

console.log('\n6. Cài đặt chung, xóa hàng loạt, hoàn tác thao tác của người khác');
r = P('luuCaiDatChung', { maKhac: ['MEGA', 'STK'], trangThaiShopee: ['Chờ giao hàng'], plVoNghia: ['Lẻ'], _maAdmin: MA }, 'Tú');
check('Lưu cài đặt chung → mọi máy đọc được qua GET', r.ok && m.get().cai_dat_chung.maKhac.join(',') === 'MEGA,STK' && m.get().cai_dat_chung.trangThaiShopee[0] === 'Chờ giao hàng');
P('upsertSku', { key: 'sku:333', sku: '333', ten: 'Sách C', nha: 'KV', nguon: 'tay' }, 'Lan');
P('upsertSku', { key: 'sku:333', sku: '333', ten: 'Sách C', nha: 'ML', nguon: 'tay' }, 'Lan');
var lsLan = lichSu(m).filter(function (x) { return x.hanh_dong === 'upsertSku' && x.khoa === 'sku:333'; })[0];
r = P('hoanTacTaiBan', { dong: lsLan.dong }, 'Mai');
check('Hoàn tác thao tác của Lan bởi Mai (không mã) → từ chối', !r.ok && /^CAN_MA_ADMIN/.test(r.error));
r = P('hoanTacTaiBan', { dong: lsLan.dong, _maAdmin: MA }, 'Tú');
check('Admin hoàn tác thao tác của Lan → trở lại Khang Việt', r.ok && m.get().skus.filter(function (e) { return e.key === 'sku:333'; })[0].nha === 'KV', r.error);
P('upsertSku', { key: 'sku:444', sku: '444', ten: 'Sách D', nha: 'HA', nguon: 'tay' }, 'Lan');
var lsD = lichSu(m).filter(function (x) { return x.khoa === 'sku:444'; })[0];
r = P('hoanTacTaiBan', { dong: lsD.dong }, 'Lan');
check('Lan tự hoàn tác thao tác của mình (không mã) → được (dòng vừa tạo bị bỏ)', r.ok && !m.get().skus.some(function (e) { return e.key === 'sku:444'; }), r.error);
r = P('xoaHangLoat', { skus: ['sku:111', 'sku:333', 'sku:khong-co'], _maAdmin: MA }, 'Tú');
check('Admin xóa hàng loạt (bỏ qua dòng không có)', r.ok && r.soXoa === 2 && !m.get().skus.some(function (e) { return e.key === 'sku:111' || e.key === 'sku:333'; }));
var lsXoa = lichSu(m).filter(function (x) { return x.hanh_dong === 'deleteSku' && x.khoa === 'sku:111'; })[0];
check('Mỗi dòng xóa ghi Lịch sử "Tú (Admin)"', lsXoa && lsXoa.nguoi === 'Tú (Admin)');
r = P('hoanTacTaiBan', { dong: lsXoa.dong, _maAdmin: MA }, 'Tú');
check('Hoàn tác 1 dòng đã xóa → khôi phục', r.ok && m.get().skus.some(function (e) { return e.key === 'sku:111' && e.nha === 'HA'; }));

console.log('\n7. Sai mã 5 lần → khóa 10 phút');
for (var i = 1; i <= 4; i++) {
  r = P('luuNguoiDung', { ds: [], _maAdmin: 'sai' + i }, 'Kẻ lạ');
  check('Sai lần ' + i + ' → báo còn ' + (5 - i) + ' lần', /^SAI_MA_ADMIN/.test(r.error) && r.error.indexOf('còn ' + (5 - i) + ' lần') >= 0, r.error);
}
r = P('luuNguoiDung', { ds: [], _maAdmin: 'sai5' }, 'Kẻ lạ');
check('Sai lần 5 → khóa 10 phút', /^KHOA_ADMIN/.test(r.error) && /10 phút/.test(r.error), r.error);
r = P('luuNguoiDung', { ds: [{ ten: 'Tú', vai_tro: 'admin' }], _maAdmin: MA }, 'Tú');
check('Đang khóa: mã ĐÚNG cũng bị từ chối, danh sách không đổi', /^KHOA_ADMIN/.test(r.error) && m.get().nguoi_dung.length === 3, r.error);
check('GET trạng thái khóa còn ~10 phút', m.get({ action: 'admin' }).khoa_con_phut === 10);
r = P('upsertSku', { key: 'sku:555', sku: '555', ten: 'Sách E', nha: 'HA', nguon: 'tay' }, 'Lan');
check('Đang khóa: thao tác thường vẫn chạy', r.ok);
m.props.ADMIN_KHOA_DEN = String(Date.now() - 1000); // hết 10 phút
r = P('kiemTraMaAdmin', { _maAdmin: MA }, 'Tú');
check('Hết khóa → mã đúng dùng lại được', r.ok);
check('Lịch sử ghi lần bị khóa', lichSu(m).some(function (x) { return x.hanh_dong === 'khoaAdmin'; }));

/* ---------- App (danhmuc.js): nhớ mã, tự kèm mã, sai thì hỏi lại ---------- */
console.log('\n8. App: nhớ mã trên máy, sai mã thì hỏi lại, đăng xuất');
var store = {}, hoi = [];
var ctx = { console: console, JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Object: Object, Array: Array, Promise: Promise, Error: Error, RegExp: RegExp, Intl: Intl,
  setTimeout: setTimeout, setInterval: function () {},
  localStorage: { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
  document: { hidden: false, addEventListener: function () {} }, window: { addEventListener: function () {} },
  fetch: function (url, opt) {
    var body;
    if (opt && opt.method === 'POST') body = m.ctx.doPost({ postData: { contents: opt.body } }).body;
    else { var q = {}, j = url.indexOf('?'); if (j >= 0) url.slice(j + 1).split('&').forEach(function (p) { var kv = p.split('='); q[kv[0]] = decodeURIComponent(kv[1] || ''); }); body = m.ctx.doGet({ parameter: q }).body; }
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(body)); } });
  } };
ctx.self = ctx; vm.createContext(ctx);
['docfile.js', 'phanloai.js', 'danhmuc.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx); });
var traLoiMa = [];
ctx.App = { hoiMaAdmin: function (loiTruoc) { hoi.push(loiTruoc); return Promise.resolve(traLoiMa.shift() || null); } };
var DM = ctx.DanhMuc;
DM.luuCaiDat({ url: 'https://script.google.com/macros/s/x/exec', toiLa: 'Tú' });
DM.taiLai().then(function () {
  check('Nhận vai trò Admin + cài đặt chung từ Sheets', DM.coAdmin() && DM.vaiTro() === 'admin' && DM.caiDat.maKhac.join(',') === 'MEGA,STK');
  traLoiMa = [null];
  return DM.goi('moLaiDot', { dot_id: HOM_NAY }).then(function () { return 'ok'; }, function (e) { return e; });
}).then(function (kq) {
  check('Chưa có mã trên máy → hỏi mã; bấm Hủy → không gửi', hoi.length === 1 && kq.daHuy === true);
  return DM.dangNhapAdmin('sai-roi').then(function () { return 'ok'; }, function (e) { return e; });
}).then(function (kq) {
  check('Đăng nhập Admin mã sai → báo lỗi, không nhớ mã', kq.maLoi === 'SAI_MA_ADMIN' && !DM.coMaAdmin);
  return DM.dangNhapAdmin(MA);
}).then(function () {
  check('Đăng nhập đúng → máy nhớ mã', DM.coMaAdmin && JSON.parse(store['tdn.admin.v1']).ma === MA);
  hoi = [];
  return DM.goi('luuNguoiDung', { ds: [{ ten: 'Tú', vai_tro: 'admin' }, { ten: 'Lan', vai_tro: 'san' }] });
}).then(function (j) {
  check('Thao tác Admin tự kèm mã đã nhớ, không hỏi lại', j.ok && hoi.length === 0 && m.get().nguoi_dung.length === 2);
  store['tdn.admin.v1'] = JSON.stringify({ ma: 'ma-cu-da-doi' });
  vm.runInContext("MA_ADMIN_MOI = 'Ma-Moi-99';", m.ctx); m.ctx.datMaAdmin();
  DM.dangXuatAdmin(); vm.runInContext('0', ctx);
  return DM.dangNhapAdmin('Meo-2026!').then(function () { return 'ok'; }, function (e) { return e; });
}).then(function (kq) {
  check('Đổi mã ở Apps Script → mã cũ trên máy hết hiệu lực', kq.maLoi === 'SAI_MA_ADMIN');
  traLoiMa = ['Ma-Moi-99'];
  hoi = [];
  return DM.goi('luuCaiDatChung', { maKhac: ['MEGA'] });
}).then(function (j) {
  check('Thiếu mã → hỏi mã mới rồi gửi được', j.ok && hoi.length === 1 && DM.coMaAdmin);
  DM.dangXuatAdmin();
  check('Đăng xuất Admin → máy quên mã', !DM.coMaAdmin && JSON.parse(store['tdn.admin.v1']).ma === '');
}).catch(function (e) { loi++; console.log('  ❌ ' + (e.stack || e)); }).then(function () {
  console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
  process.exit(loi ? 1 : 0);
});
