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
    veNha();
    $('cd-makhac').value = (c.maKhac || []).join(', ');
    $('cd-tenshop').value = c.tenShop || '';
    $('cd-sdt').value = c.sdt || '';
    $('cd-diachi').value = c.diaChi || '';
    $('cd-ghichu').value = c.ghiChu || '';
    $('cd-plvn').value = (c.plVoNghia || PL.PL_VO_NGHIA_MAC_DINH).join('\n');
    $('cd-dp-bat').checked = c.duPhongBat !== false;
    $('cd-dp-ngay').value = c.soNgayDuPhong === undefined ? 2 : c.soNgayDuPhong;
    $('cd-trangthai').value = (c.trangThaiShopee || root.DocFile.TRANG_THAI_MAC_DINH).join('\n');
    $('cd-gian').value = (c.gian || []).join('\n');
    $('cd-gian-o').hidden = !DM.coThongKe();
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
      gian: $('cd-gian').value.split(/\n/).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean),
      duPhongBat: $('cd-dp-bat').checked,
      soNgayDuPhong: Math.max(0, Math.min(30, Math.round(Number($('cd-dp-ngay').value) || 0))),
      tenShop: $('cd-tenshop').value.trim(), sdt: $('cd-sdt').value.trim(), diaChi: $('cd-diachi').value.trim(), ghiChu: $('cd-ghichu').value.trim() };
  }

  /* ---------- 🏠 Sổ nhà (dùng chung; Admin sửa / xóa) ---------- */
  var nhaSua = null, nhaXoa = null; // bản đang sửa ; { i, ma } đang hỏi chuyển sách khi xóa
  function soSachCua(ma) {
    var n = DM.catalog.skus.filter(function (e) { return e.nha === ma; }).length;
    DM.catalog.combos.forEach(function (c) { c.thanh_phan.forEach(function (t) { if (t.nha === ma) n++; }); });
    return n;
  }
  function veNha() {
    var co = DM.coNha();
    $('cd-nha').hidden = !co;
    $('cd-makhac-o').hidden = co; // có sổ nhà: ô "Mã nhà khác" cũ thay bằng danh sách nhà
    if (!co) return;
    var sua = A.laAdmin();
    $('cd-nha-them').hidden = !sua; $('cd-nha-luu').hidden = !sua; $('cd-nha-chi-admin').hidden = sua;
    if (!nhaSua) nhaSua = DM.soNha.map(function (x) {
      return { ma: x.ma, ten: x.ten, loai: x.loai, mau: x.mau, ma_ten: x.ma_ten.filter(function (c) { return c !== x.ma; }).join(', '), ncc: x.ncc.join('; '), tien_to: x.tien_to.join(', '), daLuu: true };
    });
    var LOAI = { hang_ngay: 'Đặt hằng ngày', nhap_kho: 'Nhập kho' };
    $('cd-nha-ds').innerHTML = nhaSua.map(function (x, i) {
      if (!sua) return '<tr><td><b>' + A.esc(x.ma) + '</b></td><td>' + A.esc(x.ten) + '</td><td>' + LOAI[x.loai] + '</td><td>' + (x.mau ? '<span class="badge-nha" style="background:' + A.esc(x.mau) + '">&nbsp;&nbsp;</span>' : '') +
        '</td><td>' + A.esc(x.ma_ten) + '</td><td>' + A.esc(x.ncc) + '</td><td>' + A.esc(x.tien_to) + '</td><td></td></tr>';
      var o = function (f, ph) { return '<input class="input" data-nh-f="' + f + '" data-i="' + i + '" value="' + A.esc(x[f] || '') + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '>'; };
      var xoa = nhaXoa && nhaXoa.i === i;
      return '<tr><td>' + (x.daLuu ? '<b>' + A.esc(x.ma) + '</b>' : o('ma', 'DT')) + '</td><td>' + o('ten', 'Đinh Tị') + '</td>' +
        '<td><select class="input" data-nh-f="loai" data-i="' + i + '">' + Object.keys(LOAI).map(function (k) { return '<option value="' + k + '"' + (x.loai === k ? ' selected' : '') + '>' + LOAI[k] + '</option>'; }).join('') + '</select></td>' +
        '<td><input type="color" data-nh-f="mau" data-i="' + i + '" value="' + (/^#[0-9a-f]{6}$/i.test(x.mau) ? x.mau : '#dddddd') + '" aria-label="Màu"></td>' +
        '<td>' + o('ma_ten', 'mã khác trong tên') + '</td><td>' + o('ncc', 'vd mega book') + '</td><td>' + o('tien_to', 'vd 8936067') + '</td>' +
        '<td>' + (xoa ? '<div class="actions">Chuyển ' + nhaXoa.so + ' sách sang ' +
          '<select class="input" id="cd-nha-sang">' + A.nhaOptions('', { dau: 'Không nhập / Khác', khongNhap: false, moi: false }).replace('<option value="' + A.esc(x.ma) + '">', '<option value="' + A.esc(x.ma) + '" disabled>') + '</select>' +
          ' <button type="button" class="btn btn-sm btn-danger" data-nh-xoa-ok="' + i + '">Xóa</button> <button type="button" class="btn btn-sm" data-nh-xoa-huy="1">Thôi</button></div>'
          : '<button type="button" class="btn btn-icon btn-ghost" data-nh-xoa="' + i + '" aria-label="Xóa nhà ' + A.esc(x.ma) + '">🗑</button>') + '</td></tr>';
    }).join('');
  }
  function xoaNhaDaLuu(i, sang) {
    var x = nhaSua[i];
    DM.goi('xoaNha', { ma: x.ma, chuyen_sang: sang || '' })
      .then(function (j) { DM.nhanNha(j.nha); nhaSua = null; nhaXoa = null; veNha(); A.toast('🗑 Đã xóa nhà ' + x.ma + (j.soChuyen ? ' – chuyển ' + j.soChuyen + ' sách sang ' + (sang || 'Không nhập / Khác') : '') + '.', 'ok'); })
      .catch(function (e) { A.baoLoi('Không xóa được', e); });
  }
  function luuSoNha() {
    var ds = nhaSua.map(function (x) { return { ma: PL.clean(x.ma).toUpperCase(), ten: PL.clean(x.ten), loai: x.loai, mau: x.mau || '', ma_ten: x.ma_ten, ncc: x.ncc, tien_to: x.tien_to }; })
      .filter(function (x) { return x.ma; });
    var trung = ds.filter(function (x, i) { return ds.some(function (y, j) { return j < i && y.ma === x.ma; }); });
    if (trung.length) { A.toast('Mã nhà bị trùng: ' + trung[0].ma, 'loi'); return; }
    if (!ds.some(function (x) { return x.loai === 'hang_ngay'; })) { A.toast('Cần ít nhất 1 nhà "Đặt hằng ngày".', 'loi'); return; }
    $('cd-nha-luu').disabled = true;
    DM.goi('luuNha', { ds: ds })
      .then(function (j) { DM.nhanNha(j.nha); nhaSua = null; veNha(); A.toast('🏠 Đã lưu sổ nhà (' + ds.length + ' nhà) cho mọi máy.', 'ok'); })
      .catch(function (e) { A.baoLoi('Không lưu được', e); })
      .then(function () { $('cd-nha-luu').disabled = false; });
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
  /* Tên mẫu vai trò của 1 người (bảng quyền mới) hoặc vai trò cũ */
  function tenMau(n) {
    var q = DM.coBangQuyen() ? DM.bangQuyen.nguoi.filter(function (x) { return x.ten === n.ten; })[0] : null;
    if (!q) return TEN_VT[n.vai_tro] || '';
    var khop = root.Quyen.mauKhop(DM.bangQuyen.mau, q.quyen);
    return (khop || (q.mau ? q.mau + ' (đã chỉnh)' : 'Quyền riêng')) + (q.khoa ? ' · 🔒 tạm khóa' : '');
  }
  function veToiLa() {
    var ds = DM.nguoiDung, toi = DM.caiDat.toiLa || '', chon = $('cd-toila-chon');
    var coDs = DM.coDot() && ds.length > 0;
    chon.hidden = !coDs;
    $('cd-toila').hidden = coDs;
    if (!coDs) return;
    var co = ds.some(function (n) { return n.ten === toi; });
    chon.innerHTML = (co ? '' : '<option value="' + A.esc(toi) + '" selected>' + (toi ? A.esc(toi) + ' (không có trong danh sách)' : '— chọn tên của bạn —') + '</option>') +
      ds.map(function (n) { return '<option value="' + A.esc(n.ten) + '"' + (n.ten === toi ? ' selected' : '') + '>' + A.esc(n.ten) + ' · ' + A.esc(tenMau(n)) + '</option>'; }).join('');
  }
  function veAdmin() {
    var el = $('cd-admin');
    el.hidden = !(DM.coAdmin() && (['qt_caidat', 'qt_khoiphuc', 'qt_napbu', 'qt_nguoidung', 'dot_molai'].some(A.coQuyen) || DM.chuaCoAdmin()));
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
    ['cd-makhac', 'cd-trangthai', 'cd-plvn', 'cd-gian'].forEach(function (id) { $(id).disabled = khoa; });
    $('cd-chung-ghichu').hidden = !DM.coAdmin();
  }
  function veNguoiDung() {
    veAdmin();
    veCaiDatChung();
    veKhoiPhuc();
  }
  /* ♻️ Khôi phục sao lưu (quyền "Khôi phục sao lưu" + mã Admin) */
  function veKhoiPhuc() { $('cd-kp').hidden = !(DM.coBangQuyen() && A.coQuyen('qt_khoiphuc')); }
  function xemSaoLuu() {
    $('cd-kp-xem').disabled = true;
    DM.docGet('action=saoLuu').then(function (j) {
      var ds = j.ngay || [];
      $('cd-kp-ngay').innerHTML = ds.length ? ds.map(function (n) { return '<option value="' + n + '">' + n.split('-').reverse().join('/') + '</option>'; }).join('')
        : '<option value="">Chưa có bản sao lưu nào (xem HUONG-DAN.md, Phần C)</option>';
      $('cd-kp-lam').disabled = !ds.length;
    }).catch(function (e) { A.toast('Không xem được bản sao lưu: ' + e.message, 'loi'); })
      .then(function () { $('cd-kp-xem').disabled = false; });
  }
  function khoiPhuc() {
    var ngay = $('cd-kp-ngay').value;
    if (!ngay) return;
    A.hoi('Khôi phục danh mục (SKU → nhà, combo) về bản sao lưu ngày ' + ngay.split('-').reverse().join('/') + '?\n\nMọi thay đổi danh mục sau ngày đó sẽ mất (bản hiện tại được lưu thêm 1 bản “trước khôi phục” trong file sao lưu).',
      '♻️ Khôi phục', { tieuDe: 'Khôi phục sao lưu' }).then(function (ok) {
      if (!ok) return;
      $('cd-kp-lam').disabled = true;
      return DM.goi('khoiPhucSaoLuu', { ngay: ngay })
        .then(function () { A.toast('♻️ Đã khôi phục danh mục về ngày ' + ngay.split('-').reverse().join('/') + '.', 'ok'); DM.taiLai(); })
        .catch(function (e) { A.baoLoi('Không khôi phục được', e); })
        .then(function () { $('cd-kp-lam').disabled = false; });
    });
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
      // Admin: mã nhà khác / trạng thái Shopee / phân loại vô nghĩa là cài đặt chung → lưu lên Google Sheets cho mọi máy
      if (A.laAdmin()) {
        DM.goi('luuCaiDatChung', Object.assign({ maKhac: f.maKhac, trangThaiShopee: f.trangThaiShopee, plVoNghia: f.plVoNghia }, DM.coThongKe() ? { gian: f.gian } : {}))
          .then(function (j) { DM.nhanCaiDatChung(j.cai_dat_chung); A.toast('🔑 Đã lưu cài đặt chung cho mọi máy.', 'ok'); })
          .catch(function (e) { A.baoLoi('Chưa lưu được cài đặt chung', e); });
      }
    });
    $('cd-kiemtra').addEventListener('click', kiemTra);
    $('cd-nha').addEventListener('input', function (e) {
      var t = e.target.closest('[data-nh-f]');
      if (t && nhaSua) nhaSua[+t.dataset.i][t.dataset.nhF] = t.value;
    });
    $('cd-nha').addEventListener('change', function (e) {
      var t = e.target.closest('[data-nh-f]');
      if (t && nhaSua) nhaSua[+t.dataset.i][t.dataset.nhF] = t.value;
    });
    $('cd-nha').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'cd-nha-them') { nhaSua.push({ ma: '', ten: '', loai: 'nhap_kho', mau: '', ma_ten: '', ncc: '', tien_to: '' }); veNha(); return; }
      if (b.id === 'cd-nha-luu') { luuSoNha(); return; }
      if (b.dataset.nhXoaHuy) { nhaXoa = null; veNha(); return; }
      if (b.dataset.nhXoaOk) { xoaNhaDaLuu(+b.dataset.nhXoaOk, $('cd-nha-sang').value); return; }
      if (b.dataset.nhXoa) {
        var i = +b.dataset.nhXoa, x = nhaSua[i];
        if (!x.daLuu) { nhaSua.splice(i, 1); veNha(); return; } // dòng mới chưa lưu
        var so = soSachCua(x.ma);
        if (so) { nhaXoa = { i: i, so: so }; veNha(); return; } // hỏi chuyển sách sang nhà nào
        A.hoi('Xóa nhà ' + x.ma + ' (' + x.ten + ') khỏi sổ nhà?', 'Xóa', { tieuDe: 'Xóa nhà' }).then(function (ok) { if (ok) xoaNhaDaLuu(i, ''); });
      }
    });
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
    $('cd-kp-xem').addEventListener('click', xemSaoLuu);
    $('cd-kp-lam').addEventListener('click', khoiPhuc);
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
      if (loai === 'admin' && !$('man-caidat').hidden) { veAdmin(); veNha(); }
      if ((loai === 'nha' || loai === 'api' || loai === 'nguoidung') && !$('man-caidat').hidden && !$('cd-nha').contains(document.activeElement)) { nhaSua = null; veNha(); }
      if ((loai === 'nguoidung' || loai === 'api' || loai === 'quyen') && !$('man-caidat').hidden) { veToiLa(); veNguoiDung(); veNha(); }
    });
  });

  root.CaiDat = { ve: ve, tenMau: tenMau };
})(typeof self !== 'undefined' ? self : this);
