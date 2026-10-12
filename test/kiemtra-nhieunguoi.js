/* Kiểm thử nhiều người dùng chung 1 danh mục: đồng bộ phần thay đổi, chống ghi đè, combo trùng, tương thích bản cũ.
 * Chạy: node test/kiemtra-nhieunguoi.js */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var cp = require('child_process');
var GL = require('./gia-lap-apps-script.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet).slice(0, 400) : '')); }
}
function sku(cat, key) { return cat.skus.filter(function (e) { return e.key === key; })[0]; }

/* ---------- 1 máy chạy app (danhmuc.js) nối vào Apps Script giả lập ---------- */
var URL = 'https://script.google.com/macros/s/gia-lap/exec';
function taoMay(server, ten, traLoi) {
  var store = {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Object: Object, Array: Array, Promise: Promise, Error: Error, RegExp: RegExp,
    setTimeout: setTimeout, setInterval: function () {},
    localStorage: { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } },
    document: { hidden: false, addEventListener: function () {} },
    window: { addEventListener: function () {} },
    fetch: function (url, opt) {
      var body;
      try {
        if (opt && opt.method === 'POST') body = server.ctx.doPost({ postData: { contents: opt.body } }).body;
        else {
          var q = {}, i = url.indexOf('?');
          if (i >= 0) url.slice(i + 1).split('&').forEach(function (p) { var kv = p.split('='); q[kv[0]] = decodeURIComponent(kv[1] || ''); });
          body = server.ctx.doGet({ parameter: q }).body;
        }
      } catch (e) { return Promise.reject(e); }
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(body)); } });
    }
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  ['docfile.js', 'phanloai.js', 'danhmuc.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  });
  ctx.hoiDaHoi = [];
  ctx.App = { hoi: function (cau, nutOk, opt) { ctx.hoiDaHoi.push({ cau: cau, ok: nutOk, huy: opt && opt.huy }); return Promise.resolve(traLoi ? traLoi(cau) : false); } };
  ctx.suKien = [];
  ctx.DanhMuc.nghe(function (loai, info) { ctx.suKien.push({ loai: loai, info: info }); });
  ctx.DanhMuc.luuCaiDat({ url: URL, toiLa: ten });
  return ctx;
}

function chay() {
  console.log('\n1. Dữ liệu Sheets cũ (chưa có cột phiên bản) vẫn đọc / ghi được');
  var m = GL.taoMoiTruong();
  // Sheet tạo bởi bản cũ: chỉ có cột cũ
  var sk = m.ss.insertSheet('SKU_NHA');
  sk.data = [['key', 'sku', 'ten', 'nha', 'nguon', 'cap_nhat', 'gia_gan_nhat', 'ngay_gia', 'ma_moi', 'khong_tai_ban', 'nguon_ma', 'ten_sach', 'phan_loai', 'khong_combo'],
             ['sku:111', '111', 'Sách A', 'HA', 'tay', '2026-10-01 08:00:00', 25000, '2026-10-01', '', '', '', 'Sách A', '', '']];
  var ls = m.ss.insertSheet('LICH_SU');
  ls.data = [['thoi_gian', 'hanh_dong', 'khoa', 'du_lieu_cu', 'du_lieu_moi'], ['2026-10-01 08:00:00', 'upsertSku', 'sku:111', '', '{}']];
  var g = m.get();
  check('GET đọc được dữ liệu cũ, có api + rev', g.ok && g.api >= 2 && g.rev === 0 && g.skus.length === 1 && g.skus[0].nha === 'HA', g);
  check('Dòng cũ: phiên bản trống (= 0)', !Number(g.skus[0].phien_ban));
  check('Cột cũ giữ nguyên thứ tự, cột mới nằm sau', sk.data[0].slice(0, 14).join(',') === 'key,sku,ten,nha,nguon,cap_nhat,gia_gan_nhat,ngay_gia,ma_moi,khong_tai_ban,nguon_ma,ten_sach,phan_loai,khong_combo' &&
    sk.data[0].slice(14).join(',') === 'phien_ban,dong_bo,nguoi_sua', sk.data[0]);
  var r = m.post('upsertSku', { key: 'sku:222', sku: '222', ten: 'Sách B', nha: 'KV', nguon: 'tay' }); // app cũ: không gửi tên, không gửi phiên bản
  check('App cũ (không gửi phiên bản / tên) vẫn ghi được', r.ok && sku(r.catalog, 'sku:222').nha === 'KV' && r.rev === 1, r);
  check('Dòng cũ không bị đổi khi ghi dòng khác', sku(r.catalog, 'sku:111').ten_sach === 'Sách A' && !Number(sku(r.catalog, 'sku:111').phien_ban));
  check('LICH_SU cũ thêm cột nguoi, phien_ban; dòng cũ vẫn đọc được', ls.data[0].join(',') === 'thoi_gian,hanh_dong,khoa,du_lieu_cu,du_lieu_moi,nguoi,phien_ban' &&
    m.get({ action: 'lichSu' }).lich_su.length === 2);

  console.log('\n2. Đồng bộ chỉ phần thay đổi');
  m = GL.taoMoiTruong(); m.ctx.khoiTao();
  m.post('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách A', nha: 'HA', nguon: 'tay' }, 'Lan');
  m.post('upsertSku', { key: 'sku:222', sku: '222', ten: 'Sách B', nha: 'KV', nguon: 'tay' }, 'Lan');
  var rev = m.get().rev;
  check('Không có gì mới → trả về "không đổi" (không đọc sheet)', m.get({ action: 'thayDoi', tu: String(rev) }).khongDoi === true);
  r = m.post('upsertCombo', { ten_combo: 'Combo AB', khoa: ['sku:999|combo'], thanh_phan: [{ sku: '111', ten: 'Sách A', nha: 'HA' }, { sku: '222', ten: 'Sách B', nha: 'KV' }] }, 'Hoa');
  var td = m.get({ action: 'thayDoi', tu: String(rev) });
  check('Chỉ trả combo vừa tạo, không trả lại SKU cũ', td.ok && td.combos.length === 1 && td.skus.length === 0 && td.rev === rev + 1, td);
  check('Kèm nhật ký: Hoa vừa upsertCombo', td.log.length === 1 && td.log[0].nguoi === 'Hoa' && td.log[0].hanh_dong === 'upsertCombo', td.log);
  check('Combo ghi người sửa + phiên bản', td.combos[0].nguoi_sua === 'Hoa' && Number(td.combos[0].phien_ban) === rev + 1);
  m.post('deleteSku', { key: 'sku:222' }, 'Lan');
  td = m.get({ action: 'thayDoi', tu: String(rev + 1) });
  check('Xóa → máy khác nhận danh sách xóa', td.xoa.length === 1 && td.xoa[0].loai === 'sku' && td.xoa[0].khoa === 'sku:222', td);
  check('Mốc quá cũ / sai → tải toàn bộ', m.get({ action: 'thayDoi', tu: '0' }).toanBo === true && m.get({ action: 'thayDoi', tu: '9999' }).toanBo === true);
  var ls2 = m.get({ action: 'lichSu' }).lich_su;
  check('Lịch sử ghi tên người sửa', ls2[0].nguoi === 'Lan' && ls2[1].nguoi === 'Hoa', ls2.slice(0, 2));

  console.log('\n3. Tự học không tăng phiên bản (không gây xung đột giả)');
  m.post('upsertSku', { key: 'sku:333', sku: '333', ten: 'Sách C', nha: 'ML', nguon: 'tay' }, 'Lan');
  var e3 = sku(m.get(), 'sku:333'), pb3 = Number(e3.phien_ban);
  r = m.post('upsertSkuBatch', { items: [], gia: [{ key: 'sku:333', gia: 99000 }] }, 'Hoa');
  e3 = sku(r.catalog, 'sku:333');
  check('Cập nhật giá tự động: phiên bản giữ nguyên, người sửa giữ nguyên, mốc đồng bộ tăng',
    Number(e3.phien_ban) === pb3 && e3.nguoi_sua === 'Lan' && Number(e3.dong_bo) > pb3, e3);
  r = m.post('upsertSku', { key: 'sku:333', sku: '333', ten: 'Sách C', nha: 'HA', nguon: 'tay', _pb: { 'sku|sku:333': pb3 } }, 'Hoa');
  check('Sửa tay sau đó với phiên bản cũ → KHÔNG báo xung đột (chỉ giá tự cập nhật)', r.ok && sku(r.catalog, 'sku:333').nha === 'HA', r.error);

  console.log('\n4. Hai người sửa cùng 1 bản ghi');
  m = GL.taoMoiTruong(); m.ctx.khoiTao();
  r = m.post('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách X', nha: 'HA', nguon: 'tay' }, 'Lan');
  var pbThay = Number(sku(r.catalog, 'sku:111').phien_ban); // cả Lan và Hoa đều đang thấy phiên bản này
  r = m.post('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách X', nha: 'ML', nguon: 'tay', _pb: { 'sku|sku:111': pbThay } }, 'Lan');
  check('Người trước (Lan) lưu bình thường', r.ok && sku(r.catalog, 'sku:111').nha === 'ML');
  r = m.post('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách X', nha: 'KV', nguon: 'tay', _pb: { 'sku|sku:111': pbThay } }, 'Hoa');
  check('Người sau (Hoa) gửi phiên bản cũ → xung đột, KHÔNG ghi', !r.ok && r.xungDot && r.xungDot[0].nguoi_sua === 'Lan' && r.xungDot[0].ban_ghi.nha === 'ML' &&
    sku(m.get(), 'sku:111').nha === 'ML', r);
  r = m.post('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách X', nha: 'KV', nguon: 'tay', _pb: { 'sku|sku:111': pbThay }, _ghiDe: true }, 'Hoa');
  check('Hoa chọn "Đổi" → ghi đè, người sửa = Hoa', r.ok && sku(r.catalog, 'sku:111').nha === 'KV' && sku(r.catalog, 'sku:111').nguoi_sua === 'Hoa');
  r = m.post('upsertSku', { key: 'sku:555', sku: '555', ten: 'Sách mới', nha: 'HA', nguon: 'tay', _pb: { 'sku|sku:555': 0 } }, 'Lan');
  check('Bản ghi mới (chưa ai có) → không xung đột', r.ok);
  r = m.post('upsertSku', { key: 'sku:555', sku: '555', ten: 'Sách mới', nha: 'KV', nguon: 'tay', _pb: { 'sku|sku:555': 0 } }, 'Hoa');
  check('Hoa chọn nhà cho dòng Lan vừa gán (máy Hoa chưa thấy) → xung đột', !r.ok && r.xungDot && r.xungDot[0].ban_ghi.nha === 'HA', r);
  var pbC = Number(sku(m.get(), 'sku:555').phien_ban);
  m.post('deleteSku', { key: 'sku:555' }, 'Lan');
  r = m.post('luuTenSach', { key: 'sku:555', ten_sach: 'Tên', nha: 'HA', _pb: { 'sku|sku:555': pbC } }, 'Hoa');
  check('Sửa bản ghi người khác vừa xóa → xung đột "đã xóa"', !r.ok && r.xungDot && r.xungDot[0].da_xoa === true && r.xungDot[0].nguoi_sua === 'Lan', r);
  r = m.post('upsertCombo', { ten_combo: 'C1', khoa: ['sku:1|a'], thanh_phan: [{ sku: '111', ten: 'X', nha: 'HA' }] }, 'Lan');
  var idC = r.combo_id, pbCo = Number(r.catalog.combos[0].phien_ban);
  m.post('upsertCombo', { combo_id: idC, ten_combo: 'C1 sửa bởi Lan', khoa: ['sku:1|a'], thanh_phan: [{ sku: '111', ten: 'X', nha: 'HA', so_luong: 2 }], _pb: { ['combo|' + idC]: pbCo } }, 'Lan');
  r = m.post('upsertCombo', { combo_id: idC, ten_combo: 'C1 sửa bởi Hoa', khoa: ['sku:1|a'], thanh_phan: [], _pb: { ['combo|' + idC]: pbCo } }, 'Hoa');
  check('Sửa combo cùng lúc → người sau được hỏi, combo giữ bản của Lan', !r.ok && r.xungDot && m.get().combos[0].ten_combo === 'C1 sửa bởi Lan', r);

  console.log('\n5. Combo trùng thành phần với combo người khác vừa tạo');
  var tp = [{ sku: '8935000000017', ten: 'Tập 1', nha: 'HA', so_luong: 1 }, { sku: '8935000000024', ten: 'Tập 2', nha: 'HA', so_luong: 1 }];
  r = m.post('upsertCombo', { ten_combo: 'Bộ 2 tập (Lan)', khoa: ['sku:8935000000017|bo 2 tap'], thanh_phan: tp }, 'Lan');
  var soCombo = r.catalog.combos.length;
  r = m.post('upsertCombo', { ten_combo: 'Bộ 2 tập (Hoa)', khoa: ['ten:bo hai tap|'], thanh_phan: tp.slice().reverse() }, 'Hoa');
  check('Server báo trùng, chưa tạo combo mới', !r.ok && r.comboTrung && r.comboTrung.ten_combo === 'Bộ 2 tập (Lan)' && r.comboTrung.nguoi_sua === 'Lan' && m.get().combos.length === soCombo, r);
  r = m.post('upsertCombo', { ten_combo: 'Bộ 2 tập (Hoa)', khoa: ['ten:bo hai tap|'], thanh_phan: tp, _boQuaTrung: true }, 'Hoa');
  check('Vẫn tạo riêng khi người dùng chọn không gắn', r.ok && r.catalog.combos.length === soCombo + 1);

  console.log('\n6. Máy A, B chạy app thật (danhmuc.js) dùng chung Sheets');
  var sv = GL.taoMoiTruong(); sv.ctx.khoiTao();
  sv.post('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách X', nha: 'HA', nguon: 'tay' }, 'Lan');
  var A = taoMay(sv, 'Lan', function () { return false; });
  var B = taoMay(sv, 'Hoa', function () { return true; });
  var C = taoMay(sv, 'Mai', function () { return false; });
  return Promise.all([A.DanhMuc.taiLai(), B.DanhMuc.taiLai(), C.DanhMuc.taiLai()]).then(function () {
    check('Apps Script mới → chế độ nhiều người', A.DanhMuc.nhieuNguoi() && !A.DanhMuc.canCapNhatAppsScript());
    var cuB = B.DanhMuc.timSku('sku:111'), cuC = C.DanhMuc.timSku('sku:111');
    return A.DanhMuc.goi('upsertCombo', { ten_combo: 'Combo Lan', khoa: ['sku:777|bo'], thanh_phan: [{ sku: '111', ten: 'Sách X', nha: 'HA' }] }).then(function () {
      B.suKien = [];
      return B.DanhMuc.dongBo();
    }).then(function () {
      var ev = B.suKien.filter(function (x) { return x.loai === 'catalog'; })[0];
      check('B tự nhận combo A vừa khai báo (đồng bộ)', B.DanhMuc.catalog.combos.length === 1 && B.DanhMuc.catalog.combos[0].ten_combo === 'Combo Lan');
      check('B nhận nhật ký "Lan – upsertCombo" để báo', ev && ev.info.nguon === 'dongBo' && ev.info.log.length === 1 && ev.info.log[0].nguoi === 'Lan', ev && ev.info);
      check('Danh mục cũ của B vẫn còn (chỉ ghép phần thay đổi)', !!B.DanhMuc.timSku('sku:111'));
      B.suKien = [];
      return B.DanhMuc.dongBo();
    }).then(function () {
      check('Đồng bộ lần nữa không có gì mới → không vẽ lại', !B.suKien.some(function (x) { return x.loai === 'catalog'; }));
      // A đổi nhà, rồi B (đang thấy bản cũ) đổi nhà khác
      return A.DanhMuc.goi('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách X', nha: 'ML', nguon: 'tay' }, { pb: A.DanhMuc.pbSku('sku:111') });
    }).then(function () {
      return C.DanhMuc.goi('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách X', nha: 'KV', nguon: 'tay' }, { pb: C.DanhMuc.pbSku('sku:111', cuC), cu: cuC, moTa: 'Khang Việt' })
        .then(function () { return 'ghi'; }, function (e) { return e; });
    }).then(function (kq) {
      var h = C.hoiDaHoi[0] || {};
      check('C (sau) được hỏi: "Lan vừa đổi … thành Minh Long lúc …"', /^Lan vừa đổi "Sách X" thành Minh Long lúc \d{1,2}:\d{2}/.test(h.cau || ''), h.cau);
      check('Nút: "Đổi thành Khang Việt" / "Giữ Minh Long"', h.ok === 'Đổi thành Khang Việt' && h.huy === 'Giữ Minh Long', h);
      check('C chọn Giữ → không ghi, máy C thấy Minh Long', kq && kq.daGiu && sku(sv.get(), 'sku:111').nha === 'ML' && C.DanhMuc.timSku('sku:111').nha === 'ML', kq && kq.message);
      return B.DanhMuc.goi('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách X', nha: 'KV', nguon: 'tay' }, { pb: B.DanhMuc.pbSku('sku:111', cuB), cu: cuB, moTa: 'Khang Việt' });
    }).then(function () {
      check('B chọn Đổi → ghi Khang Việt, người sửa Hoa', sku(sv.get(), 'sku:111').nha === 'KV' && sku(sv.get(), 'sku:111').nguoi_sua === 'Hoa' && B.hoiDaHoi.length === 1);
      return A.DanhMuc.dongBo();
    }).then(function () {
      check('A đồng bộ thấy Khang Việt', A.DanhMuc.timSku('sku:111').nha === 'KV');

      console.log('\n7. App mới + Code.gs cũ → chế độ 1 người, báo cần cập nhật');
      var maCu;
      try { maCu = cp.execSync('git show truoc-nhieu-nguoi-dung:apps-script/Code.gs', { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
      catch (e) { maCu = cp.execSync('git show 2ad0b54:apps-script/Code.gs', { cwd: path.join(__dirname, '..'), encoding: 'utf8' }); }
      var cu = GL.taoMoiTruong(maCu); cu.ctx.khoiTao();
      var D = taoMay(cu, 'Lan', function () { return true; });
      return D.DanhMuc.taiLai().then(function (ok) {
        check('Đọc danh mục bình thường', ok === true);
        check('Nhận ra Code.gs cũ → báo cần cập nhật, không bật nhiều người', D.DanhMuc.canCapNhatAppsScript() && !D.DanhMuc.nhieuNguoi());
        return D.DanhMuc.goi('upsertSku', { key: 'sku:1', sku: '1', ten: 'A', nha: 'HA', nguon: 'tay' }, { pb: D.DanhMuc.pbSku('sku:1') });
      }).then(function (j) {
        check('Vẫn ghi được như cũ (không gửi phiên bản)', j.ok && sku(D.DanhMuc.catalog, 'sku:1').nha === 'HA');
        return D.DanhMuc.dongBo();
      }).then(function (x) {
        check('Không gọi đồng bộ phần thay đổi (Code.gs cũ không có)', x === false);
      });
    });
  });
}

chay().catch(function (e) { loi++; console.log('  ❌ Lỗi chạy: ' + (e && e.stack || e)); }).then(function () {
  console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
  process.exit(loi ? 1 : 0);
});
