/* Màn Cài đặt: URL Apps Script, PIN, mã nhà khác, kiểm tra kết nối. */
(function (root) {
  'use strict';
  var DM = root.DanhMuc, PL = root.PhanLoai, A = root.App;
  var $ = function (id) { return document.getElementById(id); };

  function ve() {
    var c = DM.caiDat;
    $('cd-url').value = c.url || '';
    $('cd-pin').value = c.pin || '';
    $('cd-makhac').value = (c.maKhac || []).join(', ');
  }

  function docForm() {
    var maKhac = $('cd-makhac').value.split(/[,;\s]+/).map(function (s) { return s.trim().toUpperCase(); })
      .filter(function (s) { return s && PL.NHA.indexOf(s) < 0; });
    return { url: $('cd-url').value.trim(), pin: $('cd-pin').value.trim(), maKhac: maKhac };
  }

  function ketQua(msg, ok) {
    var el = $('cd-ketqua');
    el.textContent = msg;
    el.className = 'ketqua-kt ' + (ok ? 'ok' : 'loi');
  }

  function kiemTra() {
    var f = docForm();
    if (!f.url) { ketQua('Chưa dán URL Apps Script.', false); return; }
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(f.url)) {
      ketQua('URL có vẻ không đúng – link Apps Script thường bắt đầu bằng https://script.google.com/macros/s/… và kết thúc bằng /exec', false);
      return;
    }
    DM.luuCaiDat(f);
    ketQua('Đang kiểm tra…', true);
    DM.taiLai().then(function (ok) {
      if (!ok) { ketQua('😿 ' + DM.trangThai.loi, false); return; }
      var c = DM.catalog, doc = '✅ Đọc được danh mục: ' + c.skus.length + ' SKU, ' + c.combos.length + ' combo.';
      if (!f.pin) { ketQua(doc + ' Chưa có PIN → chế độ chỉ xem.', true); return; }
      DM.goi('ping', {})
        .then(function () { ketQua(doc + ' PIN đúng – có thể sửa danh mục 🎉', true); })
        .catch(function (e) { ketQua(doc + ' Nhưng ' + e.message, false); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    ve();
    $('form-caidat').addEventListener('submit', function (e) {
      e.preventDefault();
      DM.luuCaiDat(docForm());
      ve();
      A.toast('💾 Đã lưu cài đặt trên máy này.', 'ok');
    });
    $('cd-kiemtra').addEventListener('click', kiemTra);
    $('cd-pin-hien').addEventListener('click', function () {
      var inp = $('cd-pin'), hien = inp.type === 'password';
      inp.type = hien ? 'text' : 'password';
      this.textContent = hien ? '🙈 Ẩn' : '👁 Hiện';
      this.setAttribute('aria-pressed', hien);
    });
  });

  root.CaiDat = { ve: ve };
})(typeof self !== 'undefined' ? self : this);
