/* Màn Cài đặt: URL Apps Script, mã nhà khác, trạng thái Shopee, gợi ý dự phòng, kiểm tra kết nối.
 * URL chỉ lưu trong localStorage của máy này – không ghi vào code hay repo. */
(function (root) {
  'use strict';
  var DM = root.DanhMuc, PL = root.PhanLoai, A = root.App;
  var $ = function (id) { return document.getElementById(id); };

  function ve() {
    var c = DM.caiDat;
    $('cd-url').value = c.url || '';
    $('cd-toila').value = c.toiLa || '';
    veToiLa();
    veNguoiDung();
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
    var chon = $('cd-toila-chon');
    var toiLa = !chon.hidden ? chon.value : $('cd-toila').value.replace(/\s+/g, ' ').trim().slice(0, 40);
    return { url: $('cd-url').value.trim(), toiLa: toiLa, maKhac: maKhac,
      trangThaiShopee: (function () {
        var ds = $('cd-trangthai').value.split(/\n/).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
        return ds.length ? ds : root.DocFile.TRANG_THAI_MAC_DINH.slice();
      })(),
      plVoNghia: $('cd-plvn').value.split(/\n/).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean),
      duPhongBat: $('cd-dp-bat').checked,
      soNgayDuPhong: Math.max(0, Math.min(30, Math.round(Number($('cd-dp-ngay').value) || 0))),
      tenShop: $('cd-tenshop').value.trim(), sdt: $('cd-sdt').value.trim(), diaChi: $('cd-diachi').value.trim(), ghiChu: $('cd-ghichu').value.trim() };
  }

  /* ---------- Tôi là + danh sách người dùng (Apps Script có Đợt đặt hàng) ---------- */
  var TEN_VT = { san: 'Nhân viên sàn', dat_hang: 'Người đặt hàng' };
  function veToiLa() {
    var ds = DM.nguoiDung, toi = DM.caiDat.toiLa || '', chon = $('cd-toila-chon');
    var coDs = DM.coDot() && ds.length > 0;
    chon.hidden = !coDs;
    $('cd-toila').hidden = coDs;
    if (!coDs) return;
    var co = ds.some(function (n) { return n.ten === toi; });
    chon.innerHTML = (co ? '' : '<option value="' + A.esc(toi) + '" selected>' + (toi ? A.esc(toi) + ' (không có trong danh sách)' : '— chọn tên của bạn —') + '</option>') +
      ds.map(function (n) { return '<option value="' + A.esc(n.ten) + '"' + (n.ten === toi ? ' selected' : '') + '>' + A.esc(n.ten) + ' · ' + TEN_VT[n.vai_tro] + '</option>'; }).join('');
  }
  var dsSua = null; // danh sách đang sửa (chưa lưu)
  function veNguoiDung() {
    $('cd-nd').hidden = !DM.coDot();
    if (!DM.coDot()) return;
    if (!dsSua) dsSua = DM.nguoiDung.map(function (n) { return { ten: n.ten, vai_tro: n.vai_tro }; });
    $('cd-nd-ds').innerHTML = dsSua.map(function (n, i) {
      return '<tr><td><input class="input" data-nd-ten="' + i + '" value="' + A.esc(n.ten) + '" maxlength="40" aria-label="Tên"></td>' +
        '<td><select class="input" data-nd-vt="' + i + '" aria-label="Vai trò">' + ['san', 'dat_hang'].map(function (v) {
          return '<option value="' + v + '"' + (n.vai_tro === v ? ' selected' : '') + '>' + TEN_VT[v] + '</option>';
        }).join('') + '</select></td><td><button type="button" class="btn btn-icon btn-ghost" data-nd-xoa="' + i + '" aria-label="Xóa ' + A.esc(n.ten) + '">🗑</button></td></tr>';
    }).join('') || '<tr><td colspan="3" class="muted">Chưa có ai – bấm “＋ Thêm người”.</td></tr>';
  }
  function luuNguoiDung() {
    var ds = dsSua.map(function (n) { return { ten: n.ten.replace(/\s+/g, ' ').trim(), vai_tro: n.vai_tro }; }).filter(function (n) { return n.ten; });
    var trung = ds.filter(function (n, i) { return ds.some(function (m, j) { return j < i && m.ten.toLowerCase() === n.ten.toLowerCase(); }); });
    if (trung.length) { A.toast('Tên bị trùng: ' + trung[0].ten, 'loi'); return; }
    if (!ds.some(function (n) { return n.vai_tro === 'dat_hang'; }) && !confirmKhongNguoiDat()) return;
    $('cd-nd-luu').disabled = true;
    DM.goi('luuNguoiDung', { ds: ds })
      .then(function (j) { DM.nhanNguoiDung(j.nguoi_dung || ds); dsSua = null; veToiLa(); veNguoiDung(); A.toast('👥 Đã lưu danh sách ' + ds.length + ' người dùng (mọi máy dùng chung).', 'ok'); })
      .catch(function (e) { A.toast('Không lưu được: ' + e.message, 'loi'); })
      .then(function () { $('cd-nd-luu').disabled = false; });
  }
  function confirmKhongNguoiDat() { A.toast('Chưa có ai là “Người đặt hàng” – sẽ không ai thấy nút Tổng hợp đợt.', 'loi'); return true; }

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
    // Chọn "Tôi là" → lưu ngay trên máy này
    $('cd-toila-chon').addEventListener('change', function () {
      DM.luuCaiDat({ toiLa: $('cd-toila-chon').value });
      veToiLa();
      A.toast('👤 Máy này: ' + DM.caiDat.toiLa, 'ok');
    });
    $('cd-nd').addEventListener('input', function (e) {
      var t = e.target.closest('[data-nd-ten]');
      if (t) dsSua[+t.dataset.ndTen].ten = t.value;
    });
    $('cd-nd').addEventListener('change', function (e) {
      var v = e.target.closest('[data-nd-vt]');
      if (v) dsSua[+v.dataset.ndVt].vai_tro = v.value;
    });
    $('cd-nd').addEventListener('click', function (e) {
      var x = e.target.closest('[data-nd-xoa]');
      if (x) { dsSua.splice(+x.dataset.ndXoa, 1); veNguoiDung(); return; }
      if (e.target.id === 'cd-nd-them') {
        dsSua.push({ ten: '', vai_tro: 'san' });
        veNguoiDung();
        var o = $('cd-nd-ds').querySelector('[data-nd-ten="' + (dsSua.length - 1) + '"]');
        if (o) o.focus();
      } else if (e.target.id === 'cd-nd-luu') luuNguoiDung();
    });
    DM.nghe(function (loai) {
      if ((loai === 'nguoidung' || loai === 'api') && !$('man-caidat').hidden) { if (loai === 'api') dsSua = null; veToiLa(); if (!dsSua || !$('cd-nd').contains(document.activeElement)) { dsSua = null; veNguoiDung(); } }
    });
  });

  root.CaiDat = { ve: ve };
})(typeof self !== 'undefined' ? self : this);
