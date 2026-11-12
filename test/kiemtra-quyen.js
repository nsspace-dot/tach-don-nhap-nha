/* Kiểm thử phân quyền theo từng người (sheet QUYEN, Code.gs api 9). Chạy: node test/kiemtra-quyen.js */
'use strict';
var GL = require('./gia-lap-apps-script.js');
var Q = require('../js/quyen.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet).slice(0, 400) : '')); }
}
function nguoi(q, ten) { return q.nguoi.filter(function (n) { return n.ten === ten; })[0]; }

var m = GL.taoMoiTruong(); m.ctx.khoiTao();
console.log('\n1. Danh sách quyền / mẫu gốc khớp giữa app và Apps Script');
check('Mã quyền giống nhau', JSON.stringify(m.ctx.DS_QUYEN) === JSON.stringify(Q.DS));
check('Mẫu gốc giống nhau', JSON.stringify(m.ctx.MAU_GOC.map(function (x) { return [x.ten, m.ctx.chuanQuyen_(x.quyen)]; })) === JSON.stringify(Q.MAU_GOC.map(function (x) { return [x.ten, Q.chuan(x.quyen)]; })));
check('Đủ 4 mẫu: Nhân viên sàn, Người đặt hàng, Chỉ xem, Admin', Q.MAU_GOC.map(function (x) { return x.ten; }).join() === 'Nhân viên sàn,Người đặt hàng,Chỉ xem,Admin');
var sp = Q.chuan(Q.timMau(null, 'Nhân viên sàn').quyen), dh = Q.chuan(Q.timMau(null, 'Người đặt hàng').quyen), cx = Q.chuan(Q.timMau(null, 'Chỉ xem').quyen);
check('Sàn bán gì bật cho Admin, Người đặt hàng, Chỉ xem; tắt cho Nhân viên sàn', dh.indexOf('tab_sanban') >= 0 && cx.indexOf('tab_sanban') >= 0 && sp.indexOf('tab_sanban') < 0);
check('Người đặt hàng ⊇ Nhân viên sàn (không mất quyền)', sp.every(function (k) { return dh.indexOf(k) >= 0; }));
check('Chỉ xem: không có quyền ghi nào', cx.every(function (k) { return /^tab_/.test(k); }));

console.log('\n2. CHUYỂN ĐỔI TỰ ĐỘNG từ 3 vai trò cũ');
m.post('luuNguoiDung', { ds: [{ ten: 'Tú', vai_tro: 'admin' }, { ten: 'Lan', vai_tro: 'san' }, { ten: 'Hoa', vai_tro: 'dat_hang' }] }, 'Tú');
var g = m.get(), q = g.quyen;
check('GET trả bảng quyền, api 9', g.api === 9 && q && q.nguoi.length === 3);
check('Lan (nhân viên sàn) → mẫu Nhân viên sàn', nguoi(q, 'Lan').mau === 'Nhân viên sàn' && nguoi(q, 'Lan').quyen.join() === sp.join());
check('Hoa (người đặt hàng) → mẫu Người đặt hàng', nguoi(q, 'Hoa').mau === 'Người đặt hàng' && nguoi(q, 'Hoa').quyen.join() === dh.join());
check('Tú (admin) → đủ mọi quyền', nguoi(q, 'Tú').quyen.length === Q.DS.length);
check('Không cần ghi gì vào sheet QUYEN để chuyển đổi', m.ss.getSheetByName('QUYEN').getLastRow() <= 1);

console.log('\n3. Lưu bảng quyền (cần mã Admin), ghi LICH_SU, luôn còn ≥ 1 Admin');
var ds = q.nguoi.map(function (n) { return { ten: n.ten, mau: n.mau, quyen: n.quyen.slice(), khoa: false }; });
var r = m.postTho('luuQuyen', { nguoi: ds, mau: [] }, 'Tú');
check('Không có mã Admin → từ chối', !r.ok && /CAN_MA_ADMIN/.test(r.error), r);
var lan = ds.filter(function (n) { return n.ten === 'Lan'; })[0];
lan.quyen = lan.quyen.filter(function (k) { return k !== 'dm_xoa'; }).concat(['tab_sanban']);
var soLs = m.ss.getSheetByName('LICH_SU').getLastRow(), rev = m.get({ action: 'thayDoi', tu: 0 }).rev;
r = m.post('luuQuyen', { nguoi: ds.concat([{ ten: 'Mai', mau: 'Chỉ xem', quyen: cx, khoa: false }]), mau: [{ ten: 'Kho', quyen: ['tab_dubao', 'tab_sanban'] }] }, 'Tú');
check('Lưu được', r.ok && r.soDoi === 2, r);
var lsMoi = m.ss.getSheetByName('LICH_SU').data.slice(soLs).map(function (x) { return x[1] + ':' + x[2]; });
check('LICH_SU: 1 dòng đổi quyền Lan + 1 dòng thêm Mai, ghi người sửa (Admin)', lsMoi.indexOf('doiQuyen:Lan') >= 0 && lsMoi.indexOf('themNguoiDung:Mai') >= 0 &&
  /Admin/.test(m.ss.getSheetByName('LICH_SU').data[soLs][5]) && /bớt: dm_xoa/.test(m.ss.getSheetByName('LICH_SU').data.slice(soLs).join()), lsMoi);
var td = m.get({ action: 'thayDoi', tu: rev });
check('Máy khác nhận quyền mới ở lần đồng bộ (thayDoi)', td.rev > rev && nguoi(td.quyen, 'Lan').quyen.indexOf('tab_sanban') >= 0 && nguoi(td.quyen, 'Lan').quyen.indexOf('dm_xoa') < 0);
check('Mẫu tự tạo "Kho" được lưu', m.get().quyen.mau.some(function (x) { return x.ten === 'Kho' && !x.goc && x.quyen.join() === 'tab_dubao,tab_sanban'; }));
check('NGUOI_DUNG vẫn ghi cho máy bản cũ (vai trò suy từ quyền)', JSON.stringify(m.get().nguoi_dung) === JSON.stringify([{ ten: 'Tú', vai_tro: 'admin' }, { ten: 'Lan', vai_tro: 'san' }, { ten: 'Hoa', vai_tro: 'dat_hang' }, { ten: 'Mai', vai_tro: 'san' }]), m.get().nguoi_dung);
var khongAdmin = ds.map(function (n) { return Object.assign({}, n, { quyen: n.quyen.filter(function (k) { return k !== 'qt_nguoidung'; }) }); });
r = m.post('luuQuyen', { nguoi: khongAdmin, mau: [] }, 'Tú');
check('Bỏ hết Admin → từ chối', !r.ok && /ít nhất 1 Admin/.test(r.error), r);
r = m.post('luuQuyen', { nguoi: ds.map(function (n) { return Object.assign({}, n, { khoa: n.ten === 'Tú' }); }), mau: [] }, 'Tú');
check('Khóa Admin duy nhất → từ chối', !r.ok && /ít nhất 1 Admin/.test(r.error), r);
check('Mẫu Admin không sửa được (luôn đủ quyền)', m.get().quyen.mau.filter(function (x) { return x.ten === 'Admin'; })[0].quyen.length === Q.DS.length);

console.log('\n4. Tạm khóa');
var cur = m.get().quyen.nguoi.map(function (n) { return { ten: n.ten, mau: n.mau, quyen: n.quyen, khoa: n.ten === 'Lan' }; });
r = m.post('luuQuyen', { nguoi: cur, mau: m.get().quyen.mau.filter(function (x) { return !x.goc; }) }, 'Tú');
check('Khóa Lan', r.ok && nguoi(r.quyen, 'Lan').khoa === true, r);
r = m.post('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách A', nha: 'HA' }, 'Lan');
check('Lan bị khóa → không ghi được', !r.ok && /TAM_KHOA/.test(r.error), r);
r = m.post('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách A', nha: 'HA' }, 'Hoa');
check('Người khác vẫn ghi bình thường', r.ok);
check('Mẫu tự tạo vẫn giữ sau lần lưu sau', m.get().quyen.mau.some(function (x) { return x.ten === 'Kho'; }));

console.log('\n5. Máy chạy app bản cũ đổi vai trò → bảng quyền đi theo');
m.post('luuNguoiDung', { ds: [{ ten: 'Tú', vai_tro: 'admin' }, { ten: 'Lan', vai_tro: 'san' }, { ten: 'Hoa', vai_tro: 'san' }] }, 'Tú');
q = m.get().quyen;
check('Hoa đổi sang nhân viên sàn → quyền mẫu Nhân viên sàn; Mai bị xóa', nguoi(q, 'Hoa').quyen.join() === sp.join() && !nguoi(q, 'Mai'), q.nguoi);
check('Lan giữ nguyên quyền đã chỉnh (vẫn bị khóa)', nguoi(q, 'Lan').khoa && nguoi(q, 'Lan').quyen.indexOf('tab_sanban') >= 0);

console.log('\n6. Khôi phục sao lưu từ app (quyền Khôi phục + mã Admin)');
m.ctx.caiDatSaoLuuTuDong();
var ngay = m.get({ action: 'saoLuu' }).ngay;
check('Liệt kê ngày có bản sao lưu', ngay.length === 1, ngay);
m.post('deleteSku', { key: 'sku:111' }, 'Hoa');
check('Đã xóa sách', !m.get().skus.some(function (x) { return x.key === 'sku:111'; }));
r = m.postTho('khoiPhucSaoLuu', { ngay: ngay[0] }, 'Tú');
check('Không có mã Admin → từ chối', !r.ok && /CAN_MA_ADMIN/.test(r.error));
r = m.post('khoiPhucSaoLuu', { ngay: ngay[0] }, 'Tú');
check('Khôi phục xong: sách quay lại, có LICH_SU', r.ok && m.get().skus.some(function (x) { return x.key === 'sku:111'; }) &&
  m.ss.getSheetByName('LICH_SU').data.some(function (x) { return x[1] === 'khoiPhuc' && /Admin/.test(x[5]); }), r);

console.log('\n7. App: thao tác cần quyền');
check('Mỗi thao tác cần quyền có tên quyền hợp lệ', Object.keys(Q.HD).every(function (a) { return Q.HD[a].every(function (k) { return Q.DS.indexOf(k) >= 0; }); }));
check('Mọi thao tác Admin của Apps Script đều có quyền nhóm Quản trị / đợt', m.ctx.HD_ADMIN.filter(function (a) { return a !== 'kiemTraMaAdmin'; }).every(function (a) { return Q.HD[a] && Q.HD[a].every(function (k) { return /^(qt_|dot_molai)/.test(k); }); }));
check('mauKhop: nhận đúng mẫu, chỉnh riêng → trống', Q.mauKhop(null, dh) === 'Người đặt hàng' && Q.mauKhop(null, dh.concat(['qt_napbu'])) === '');

console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
process.exit(loi ? 1 : 0);
