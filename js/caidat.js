/* Màn Cài đặt: URL Apps Script, mã nhà khác, trạng thái Shopee, gợi ý dự phòng, kiểm tra kết nối.
 * URL chỉ lưu trong localStorage của máy này – không ghi vào code hay repo. */
(function (root) {
  'use strict';
  var DM = root.DanhMuc, PL = root.PhanLoai, A = root.App;
  var $ = function (id) { return document.getElementById(id); };

  function ve() {
    var c = DM.caiDat;
    $('cd-url').value = c.url || '';
    $('cd-makhac').value = (c.maKhac || []).join(', ');
    $('cd-tenshop').value = c.tenShop || '';
    $('cd-sdt').value = c.sdt || '';
    $('cd-diachi').value = c.diaChi || '';
    $('cd-ghichu').value = c.ghiChu || '';
    $('cd-plvn').value = (c.plVoNghia || PL.PL_VO_NGHIA_MAC_DINH).join('\n');
    $('cd-dp-bat').checked = c.duPhongBat !== false;
    $('cd-dp-ngay').value = c.soNgayDuPhong === undefined ? 2 : c.soNgayDuPhong;
    $('cd-trangthai').value = (c.trangThaiShopee || root.DocFile.TRANG_THAI_MAC_DINH).join('\n');
  }

  function docForm() {
    var maKhac = $('cd-makhac').value.split(/[,;\s]+/).map(function (s) { return s.trim().toUpperCase(); })
      .filter(function (s) { return s && PL.NHA.indexOf(s) < 0; });
    return { url: $('cd-url').value.trim(), maKhac: maKhac,
      trangThaiShopee: (function () {
        var ds = $('cd-trangthai').value.split(/\n/).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
        return ds.length ? ds : root.DocFile.TRANG_THAI_MAC_DINH.slice();
      })(),
      plVoNghia: $('cd-plvn').value.split(/\n/).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean),
      duPhongBat: $('cd-dp-bat').checked,
      soNgayDuPhong: Math.max(0, Math.min(30, Math.round(Number($('cd-dp-ngay').value) || 0))),
      tenShop: $('cd-tenshop').value.trim(), sdt: $('cd-sdt').value.trim(), diaChi: $('cd-diachi').value.trim(), ghiChu: $('cd-ghichu').value.trim() };
  }

  function ketQua(msg, ok) {
    var el = $('cd-ketqua');
    el.textContent = msg;
    el.className = 'ketqua-kt ' + (ok ? 'ok' : 'loi');
  }

  function urlHopLe(u) { return /^https:\/\/script\.google(usercontent)?\.com\//.test(u); }

  function kiemTra() {
    var f = docForm();
    if (!f.url) { ketQua('Chưa dán URL Apps Script.', false); return; }
    if (!urlHopLe(f.url)) {
      ketQua('URL có vẻ không đúng – link Apps Script thường bắt đầu bằng https://script.google.com/macros/s/… và kết thúc bằng /exec', false);
      return;
    }
    DM.luuCaiDat(f);
    ketQua('Đang kiểm tra…', true);
    DM.taiLai().then(function (ok) {
      if (!ok) { ketQua('😿 ' + DM.trangThai.loi, false); return; }
      var c = DM.catalog, doc = '✅ Đọc được danh mục: ' + c.skus.length + ' SKU, ' + c.combos.length + ' combo.';
      DM.goi('ping', {})
        .then(function () { ketQua(doc + ' Ghi được – sẵn sàng dùng 🎉', true); })
        .catch(function (e) { ketQua(doc + ' Nhưng chưa ghi được: ' + e.message, false); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    ve();
    $('form-caidat').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = docForm();
      if (f.url && !urlHopLe(f.url)) { ketQua('URL có vẻ không đúng – kiểm tra lại link /exec nha.', false); return; }
      DM.luuCaiDat(f);
      ve();
      A.toast('💾 Đã lưu cài đặt trên máy này.', 'ok');
    });
    $('cd-kiemtra').addEventListener('click', kiemTra);
  });

  root.CaiDat = { ve: ve };
})(typeof self !== 'undefined' ? self : this);
