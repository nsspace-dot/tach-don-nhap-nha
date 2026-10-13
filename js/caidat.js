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
    veChuDe();
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

  /* ---------- 🎨 Chủ đề (mỗi máy) ---------- */
  function veChuDe() {
    var CD = root.ChuDe, cur = CD.hienTai();
    $('cd-chude').innerHTML = CD.DS.map(function (x) {
      var on = x.id === cur;
      return '<button type="button" class="cd-chude-o' + (on ? ' is-on' : '') + '" role="radio" aria-checked="' + on + '" data-chude="' + x.id + '">' +
        '<b>' + A.esc(x.ten) + '</b><small>' + A.esc(x.mota) + '</small></button>';
    }).join('');
  }

  /* ---------- Tôi là + danh sách người dùng (Apps Script có Đợt đặt hàng) ---------- */
  var TEN_VT = { san: 'Nhân viên sàn', dat_hang: 'Người đặt hàng', admin: 'Admin' };
  var DS_VT = ['san', 'dat_hang', 'admin'];
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
  /* Danh sách người dùng: Apps Script có Admin → chỉ Admin sửa (chưa ai là Admin thì hiện cho mọi người để tạo Admin đầu tiên – vẫn cần mã) */
  function suaDuocNguoiDung() {
    if (!DM.coAdmin()) return true;
    return A.laAdmin() || !DM.nguoiDung.some(function (n) { return n.vai_tro === 'admin'; });
  }
  function veAdmin() {
    var el = $('cd-admin');
    el.hidden = !(DM.coAdmin() && (A.laAdmin() || !DM.nguoiDung.some(function (n) { return n.vai_tro === 'admin'; })));
    if (el.hidden) return;
    var tt = DM.adminDaDatMa === false
      ? '⚠️ <b>Chưa đặt mã Admin.</b> Mở Google Sheets → Tiện ích mở rộng → Apps Script → sửa dòng <code>var MA_ADMIN_MOI = \'\';</code> (gõ mã giữa 2 dấu nháy) → 💾 Lưu → chọn hàm <code>datMaAdmin</code> → ▶ Chạy → rồi xóa mã khỏi dòng đó và Lưu lại. Các chức năng thường vẫn chạy bình thường.'
      : DM.coMaAdmin ? '✅ Máy này đã đăng nhập Admin.' : 'Máy này chưa đăng nhập Admin – nhập mã 1 lần (máy sẽ nhớ). Sai 5 lần sẽ bị khóa 10 phút.';
    $('cd-admin-tt').innerHTML = tt;
    $('cd-admin-ma').hidden = DM.coMaAdmin; $('cd-admin-vao').hidden = DM.coMaAdmin; $('cd-admin-ra').hidden = !DM.coMaAdmin;
  }
  /* Cài đặt chung: chỉ Admin sửa (Apps Script cũ: mỗi máy tự đặt như trước) */
  function veCaiDatChung() {
    var khoa = DM.coAdmin() && !A.laAdmin();
    ['cd-makhac', 'cd-trangthai', 'cd-plvn'].forEach(function (id) { $(id).disabled = khoa; });
    $('cd-chung-ghichu').hidden = !DM.coAdmin();
  }
  function veNguoiDung() {
    veAdmin();
    veCaiDatChung();
    $('cd-nd').hidden = !DM.coDot();
    if (!DM.coDot()) return;
    var sua = suaDuocNguoiDung();
    $('cd-nd-them').hidden = !sua; $('cd-nd-luu').hidden = !sua;
    $('cd-nd-chi-admin').hidden = !DM.coAdmin();
    if (!sua) {
      dsSua = null;
      $('cd-nd-ds').innerHTML = DM.nguoiDung.map(function (n) { return '<tr><td>' + A.esc(n.ten) + '</td><td>' + TEN_VT[n.vai_tro] + '</td><td></td></tr>'; }).join('');
      return;
    }
    if (!dsSua) dsSua = DM.nguoiDung.map(function (n) { return { ten: n.ten, vai_tro: n.vai_tro }; });
    $('cd-nd-ds').innerHTML = dsSua.map(function (n, i) {
      return '<tr><td><input class="input" data-nd-ten="' + i + '" value="' + A.esc(n.ten) + '" maxlength="40" aria-label="Tên"></td>' +
        '<td><select class="input" data-nd-vt="' + i + '" aria-label="Vai trò">' + (DM.coAdmin() ? DS_VT : ['san', 'dat_hang']).map(function (v) {
          return '<option value="' + v + '"' + (n.vai_tro === v ? ' selected' : '') + '>' + TEN_VT[v] + '</option>';
        }).join('') + '</select></td><td><button type="button" class="btn btn-icon btn-ghost" data-nd-xoa="' + i + '" aria-label="Xóa ' + A.esc(n.ten) + '">🗑</button></td></tr>';
    }).join('') || '<tr><td colspan="3" class="muted">Chưa có ai – bấm “＋ Thêm người”.</td></tr>';
  }
  function luuNguoiDung() {
    var ds = dsSua.map(function (n) { return { ten: n.ten.replace(/\s+/g, ' ').trim(), vai_tro: n.vai_tro }; }).filter(function (n) { return n.ten; });
    var trung = ds.filter(function (n, i) { return ds.some(function (m, j) { return j < i && m.ten.toLowerCase() === n.ten.toLowerCase(); }); });
    if (trung.length) { A.toast('Tên bị trùng: ' + trung[0].ten, 'loi'); return; }
    if (!ds.some(function (n) { return n.vai_tro === 'dat_hang' || n.vai_tro === 'admin'; }) && !confirmKhongNguoiDat()) return;
    if (DM.coAdmin() && !ds.some(function (n) { return n.vai_tro === 'admin'; })) { A.toast('Cần ít nhất 1 người là Admin.', 'loi'); return; }
    $('cd-nd-luu').disabled = true;
    DM.goi('luuNguoiDung', { ds: ds })
      .then(function (j) { DM.nhanNguoiDung(j.nguoi_dung || ds); dsSua = null; veToiLa(); veNguoiDung(); A.toast('👥 Đã lưu danh sách ' + ds.length + ' người dùng (mọi máy dùng chung).', 'ok'); })
      .catch(function (e) { A.baoLoi('Không lưu được', e); })
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
      // Admin: mã nhà khác / trạng thái Shopee / phân loại vô nghĩa là cài đặt chung → lưu lên Google Sheets cho mọi máy
      if (A.laAdmin()) {
        DM.goi('luuCaiDatChung', { maKhac: f.maKhac, trangThaiShopee: f.trangThaiShopee, plVoNghia: f.plVoNghia })
          .then(function (j) { DM.nhanCaiDatChung(j.cai_dat_chung); A.toast('🔑 Đã lưu cài đặt chung cho mọi máy.', 'ok'); })
          .catch(function (e) { A.baoLoi('Chưa lưu được cài đặt chung', e); });
      }
    });
    $('cd-kiemtra').addEventListener('click', kiemTra);
    $('cd-chude').addEventListener('click', function (e) {
      var b = e.target.closest('[data-chude]');
      if (!b) return;
      root.ChuDe.doi(b.dataset.chude);
      veChuDe();
    });
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
    $('cd-admin-vao').addEventListener('click', function () {
      var ma = $('cd-admin-ma').value.trim();
      if (!ma) { A.toast('Nhập mã Admin.', 'loi'); return; }
      $('cd-admin-vao').disabled = true;
      DM.dangNhapAdmin(ma)
        .then(function () { $('cd-admin-ma').value = ''; A.toast('🔑 Đã đăng nhập Admin trên máy này.', 'ok'); ve(); })
        .catch(function (e) { A.toast(e.message, 'loi'); veAdmin(); })
        .then(function () { $('cd-admin-vao').disabled = false; });
    });
    $('cd-admin-ma').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('cd-admin-vao').click(); } });
    $('cd-admin-ra').addEventListener('click', function () { DM.dangXuatAdmin(); A.toast('🚪 Đã đăng xuất Admin trên máy này.', 'ok'); veAdmin(); });
    DM.nghe(function (loai) {
      if (loai === 'admin' && !$('man-caidat').hidden) veAdmin();
      if ((loai === 'nguoidung' || loai === 'api') && !$('man-caidat').hidden) { if (loai === 'api') dsSua = null; veToiLa(); if (!dsSua || !$('cd-nd').contains(document.activeElement)) { dsSua = null; veNguoiDung(); } }
    });
  });

  root.CaiDat = { ve: ve };
})(typeof self !== 'undefined' ? self : this);
