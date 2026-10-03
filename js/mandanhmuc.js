/* Màn Danh mục: SKU → nhà và Combo. Tìm, sửa, xóa, xuất / nạp Excel. */
(function (root) {
  'use strict';
  var PL = root.PhanLoai, DM = root.DanhMuc, A = root.App, DX = root.DanhMucExcel;
  var $ = function (id) { return document.getElementById(id); };
  var TOI_DA = 300;
  var tab = 'sku';

  function ngay(s) {
    if (!s) return '';
    var d = new Date(s);
    return isNaN(d) ? A.esc(s) : d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  function ve() {
    var c = DM.catalog, q = A.boDau($('dm-tim').value.trim());
    $('dm-dem-sku').textContent = '(' + c.skus.length + ')';
    $('dm-dem-combo').textContent = '(' + c.combos.length + ')';
    document.querySelectorAll('.seg-btn').forEach(function (b) {
      var on = b.dataset.dm === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on);
    });
    document.querySelectorAll('#man-danhmuc .can-write').forEach(function (b) {
      b.disabled = !DM.coTheGhi();
      b.title = DM.coTheGhi() ? '' : 'Nhập PIN ở màn Cài đặt để dùng nút này';
    });
    if (tab === 'sku') veSku(c.skus, q); else veCombo(c.combos, q);
  }

  function rong(msg) {
    return '<div class="trong-bang"><div class="mini-cat">' + root.LinhVat.meo('ngu') + '</div>' + msg + '</div>';
  }

  function veSku(list, q) {
    var ds = list.filter(function (e) { return !q || A.boDau(e.sku + ' ' + e.ten + ' ' + e.key + ' ' + e.nha).indexOf(q) >= 0; });
    ds.sort(function (a, b) { return a.ten.localeCompare(b.ten, 'vi'); });
    if (!ds.length) { $('dm-bang').innerHTML = rong(list.length ? 'Không tìm thấy.' : 'Danh mục SKU còn trống. Mèo sẽ tự học dần khi bạn tách đơn 🐾'); return; }
    var ghi = DM.coTheGhi();
    $('dm-bang').innerHTML = '<table class="tbl"><thead><tr><th>SKU</th><th>Tên sách</th><th>Nhà</th><th>Nguồn</th><th>Cập nhật</th><th><span class="sr">Xóa</span></th></tr></thead><tbody>' +
      ds.slice(0, TOI_DA).map(function (e) {
        var i = list.indexOf(e);
        var nhanKhoa = /^ten:/.test(e.key) ? '<div class="pl">nhận diện theo tên: ' + A.esc(e.key.split('|')[1] || '') + '</div>' : '';
        return '<tr><td class="sku">' + (e.sku ? A.esc(e.sku) : '<span class="sku-la sku-trong">(trống)</span>') + '</td>' +
          '<td class="ten">' + A.esc(e.ten) + nhanKhoa + '</td><td>' +
          (ghi ? '<select class="select" data-sua-sku="' + i + '" aria-label="Nhà">' + ['HA', 'KV', 'ML', PL.KHONG_NHAP].map(function (n) {
            return '<option value="' + n + '"' + (e.nha === n ? ' selected' : '') + '>' + (n === PL.KHONG_NHAP ? 'Không nhập' : n + ' · ' + PL.TEN_NHA[n]) + '</option>';
          }).join('') + '</select>' : A.badge(e.nha === PL.KHONG_NHAP ? 'Không nhập' : e.nha)) +
          '</td><td class="nguon-' + A.esc(e.nguon) + '">' + (e.nguon === 'tay' ? '✋ gán tay' : '🤖 tự học') + '</td>' +
          '<td class="pl">' + ngay(e.cap_nhat) + '</td><td>' +
          A.nutGhi('🗑', 'class="btn btn-icon btn-ghost" data-xoa-sku="' + i + '" aria-label="Xóa ' + A.esc(e.sku || e.ten) + '"') + '</td></tr>';
      }).join('') + '</tbody></table>' +
      (ds.length > TOI_DA ? '<p class="trong-bang">Đang hiện ' + TOI_DA + '/' + ds.length + ' dòng – gõ vào ô tìm kiếm để lọc.</p>' : '');
  }

  function veCombo(list, q) {
    var ds = list.filter(function (c) {
      return !q || A.boDau(c.ten_combo + ' ' + c.khoa.join(' ') + ' ' + c.thanh_phan.map(function (t) { return t.sku + ' ' + t.ten; }).join(' ')).indexOf(q) >= 0;
    });
    ds.sort(function (a, b) { return a.ten_combo.localeCompare(b.ten_combo, 'vi'); });
    if (!ds.length) { $('dm-bang').innerHTML = rong(list.length ? 'Không tìm thấy.' : 'Chưa có combo nào. Khai báo ở tab Combo của màn Tách đơn nha.'); return; }
    $('dm-bang').innerHTML = '<table class="tbl"><thead><tr><th>Tên combo</th><th>Khóa nhận diện</th><th>Thành phần</th><th>Cập nhật</th><th><span class="sr">Thao tác</span></th></tr></thead><tbody>' +
      ds.slice(0, TOI_DA).map(function (c) {
        var i = list.indexOf(c);
        return '<tr><td class="ten"><b>' + A.esc(c.ten_combo) + '</b><div class="pl">' + A.esc(c.combo_id) + '</div></td>' +
          '<td>' + c.khoa.map(function (k) { return '<span class="khoa">' + A.esc(k) + '</span>'; }).join('') + '</td>' +
          '<td><ul class="tp-list">' + c.thanh_phan.map(function (t) {
            return '<li>' + A.badge(t.nha) + ' ' + t.so_luong + '× ' + A.esc(t.ten) + ' <span class="pl">' + A.esc(t.sku) + ' · ' + A.so(t.gia_goc) + 'đ</span></li>';
          }).join('') + '</ul></td><td class="pl">' + ngay(c.cap_nhat) + '</td>' +
          '<td><div class="actions">' + A.nutGhi('✏️ Sửa', 'class="btn btn-sm" data-sua-combo="' + i + '"') +
          A.nutGhi('🗑', 'class="btn btn-icon btn-ghost" data-xoa-combo="' + i + '" aria-label="Xóa combo"') + '</div></td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- Thao tác ---------- */
  function suaSku(i, nha) {
    var e = DM.catalog.skus[i];
    DM.goi('upsertSku', { key: e.key, sku: e.sku, ten: e.ten, nha: nha, nguon: 'tay' })
      .then(function () { A.toast('✅ Đã đổi nhà: ' + (e.sku || e.ten), 'ok'); })
      .catch(function (err) { A.toast('Không lưu được: ' + err.message, 'loi'); ve(); });
  }
  function xoaSku(i) {
    var e = DM.catalog.skus[i];
    A.hoi('Xóa "' + (e.sku ? e.sku + ' – ' : '') + e.ten + '" khỏi danh mục?', 'Xóa').then(function (ok) {
      if (!ok) return;
      DM.goi('deleteSku', { key: e.key })
        .then(function () { A.toast('🗑 Đã xóa.', 'ok'); })
        .catch(function (err) { A.toast('Không xóa được: ' + err.message, 'loi'); });
    });
  }
  function xoaCombo(i) {
    var c = DM.catalog.combos[i];
    A.hoi('Xóa combo "' + c.ten_combo + '"? Lần sau combo này sẽ quay lại tab Combo để khai báo lại.', 'Xóa').then(function (ok) {
      if (!ok) return;
      DM.goi('deleteCombo', { combo_id: c.combo_id })
        .then(function () { A.toast('🗑 Đã xóa combo.', 'ok'); })
        .catch(function (err) { A.toast('Không xóa được: ' + err.message, 'loi'); });
    });
  }

  function xuatExcel() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    root.XLSX.writeFile(DX.xuat(DM.catalog, root.XLSX), 'Danh-muc_' + p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear() + '.xlsx');
  }

  function napExcel(file) {
    file.arrayBuffer().then(function (buf) {
      var kq = DX.nap(root.XLSX.read(buf, { type: 'array' }), root.XLSX);
      if (!kq.skus.length && !kq.combos.length) {
        A.toast('Không nạp được: ' + (kq.loi[0] || 'file không có dữ liệu.'), 'loi');
        return;
      }
      var msg = 'Nạp ' + kq.skus.length + ' SKU và ' + kq.combos.length + ' combo vào danh mục?' +
        (kq.loi.length ? '\n\n⚠ Có ' + kq.loi.length + ' dòng lỗi sẽ bị bỏ qua:\n- ' + kq.loi.slice(0, 6).join('\n- ') + (kq.loi.length > 6 ? '\n…' : '') : '');
      return A.hoi(msg, 'Nạp').then(function (ok) {
        if (!ok) return;
        return DM.goi('importBatch', { skus: kq.skus, combos: kq.combos })
          .then(function () { A.toast('📥 Đã nạp ' + kq.skus.length + ' SKU, ' + kq.combos.length + ' combo.', 'ok'); });
      });
    }).catch(function (e) { A.toast('Lỗi đọc file: ' + e.message, 'loi'); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.seg-btn').forEach(function (b) {
      b.addEventListener('click', function () { tab = b.dataset.dm; ve(); });
    });
    $('dm-tim').addEventListener('input', ve);
    $('dm-bang').addEventListener('change', function (e) {
      var s = e.target.closest('[data-sua-sku]');
      if (s) suaSku(+s.dataset.suaSku, s.value);
    });
    $('dm-bang').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.xoaSku) xoaSku(+b.dataset.xoaSku);
      else if (b.dataset.xoaCombo) xoaCombo(+b.dataset.xoaCombo);
      else if (b.dataset.suaCombo) root.KhaiBao.moSua(DM.catalog.combos[+b.dataset.suaCombo]);
    });
    $('dm-xuat').addEventListener('click', xuatExcel);
    $('dm-mau').addEventListener('click', function () { root.XLSX.writeFile(DX.mau(root.XLSX), 'Mau-nap-danh-muc.xlsx'); });
    $('dm-nap').addEventListener('click', function () { $('dm-nap-input').click(); });
    $('dm-nap-input').addEventListener('change', function (e) {
      if (e.target.files[0]) napExcel(e.target.files[0]);
      e.target.value = '';
    });
  });

  root.ManDanhMuc = { ve: ve };
})(typeof self !== 'undefined' ? self : this);
