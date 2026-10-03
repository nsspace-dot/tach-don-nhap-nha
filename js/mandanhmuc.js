/* Màn Danh mục: SKU → nhà, Combo, Lịch sử. Tìm, sửa, xóa, xuất / nạp Excel. */
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
      b.title = DM.coTheGhi() ? '' : 'Dán URL Apps Script ở màn Cài đặt để dùng nút này';
    });
    if (tab === 'sku') veSku(c.skus, q);
    else if (tab === 'combo') veCombo(c.combos, q);
    else veLichSu(q);
  }

  /* ---------- Lịch sử (100 thay đổi gần nhất, chỉ xem) ---------- */
  var lichSu = null, dangTaiLs = false, loiLs = '';
  var TEN_HD = {
    upsertSku: '✋ Gán / sửa nhà', upsertSkuBatch: '🤖 Tự học', deleteSku: '🗑 Xóa SKU',
    upsertCombo: '🎁 Lưu combo', addComboKey: '🔗 Gắn khóa combo', boKhoa: '✂️ Chuyển khóa sang combo khác',
    deleteCombo: '🗑 Xóa combo', importBatch: '📥 Nạp Excel', khoiPhuc: '♻️ Khôi phục sao lưu',
    doiKhoaCombo: '🔑 Đổi khóa combo (mã vạch)'
  };
  function taiLichSu() {
    if (dangTaiLs) return;
    dangTaiLs = true; loiLs = '';
    DM.lichSu().then(function (ds) { lichSu = ds; }).catch(function (e) { loiLs = e.message; })
      .then(function () { dangTaiLs = false; if (tab === 'lichsu') ve(); });
  }
  function tomTat(json) {
    if (!json) return '—';
    try {
      var o = JSON.parse(json);
      if (o.thanh_phan) {
        return (o.ten_combo || '') + (o.cach_xuat === 'nguyen' ? '\n📦 xuất nguyên combo → ' + o.nha + (o.ma_he_thong ? ' · mã ' + o.ma_he_thong : '') : '') + '\n' + o.thanh_phan.map(function (t) { return '· ' + t.so_luong + '× ' + t.ten + ' (' + t.nha + ')'; }).join('\n') +
          (o.khoa ? '\nkhóa: ' + [].concat(o.khoa).join(', ') : '');
      }
      if (o.nha) return (o.sku ? o.sku + ' · ' : '') + o.ten + '\n→ ' + o.nha + ' (' + (o.nguon === 'tu_hoc' ? 'tự học' : 'gán tay') + ')';
      return json;
    } catch (e) { return json; }
  }
  function veLichSu(q) {
    if (!DM.caiDat.url) { $('dm-bang').innerHTML = rong('Chưa kết nối Google Sheets – dán URL ở màn Cài đặt nha.'); return; }
    if (!lichSu && !loiLs) { $('dm-bang').innerHTML = '<div class="trong-bang">Đang tải lịch sử…</div>'; taiLichSu(); return; }
    if (loiLs) { $('dm-bang').innerHTML = '<div class="trong-bang">😿 ' + A.esc(loiLs) + ' <button class="linkish" id="ls-lai">Thử lại</button></div>'; return; }
    var ds = lichSu.filter(function (r) {
      return !q || A.boDau([r.hanh_dong, r.khoa, r.du_lieu_cu, r.du_lieu_moi].join(' ')).indexOf(q) >= 0;
    });
    if (!ds.length) { $('dm-bang').innerHTML = rong(lichSu.length ? 'Không tìm thấy.' : 'Chưa có thay đổi nào.'); return; }
    $('dm-bang').innerHTML = '<div class="legend" style="padding:12px 16px">100 thay đổi gần nhất (mới nhất ở trên). Bản đầy đủ nằm ở sheet LICH_SU. ' +
      '<button class="linkish" id="ls-lai">Tải lại</button></div>' +
      '<table class="tbl"><thead><tr><th>Thời gian</th><th>Hành động</th><th>Khóa</th><th>Trước</th><th>Sau</th></tr></thead><tbody>' +
      ds.map(function (r) {
        return '<tr><td class="pl">' + ngay(r.thoi_gian) + '</td><td class="ls-hd">' + A.esc(TEN_HD[r.hanh_dong] || r.hanh_dong) + '</td>' +
          '<td><span class="khoa">' + A.esc(r.khoa) + '</span></td>' +
          '<td><pre class="ls-json">' + A.esc(tomTat(r.du_lieu_cu)) + '</pre></td>' +
          '<td><pre class="ls-json">' + A.esc(tomTat(r.du_lieu_moi)) + '</pre></td></tr>';
      }).join('') + '</tbody></table>';
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
    var ghi = DM.coTheGhi();
    $('dm-bang').innerHTML = '<table class="tbl"><thead><tr><th>Tên combo</th><th>Cách xuất</th><th>Khóa nhận diện</th><th>Thành phần</th><th>Cập nhật</th><th><span class="sr">Thao tác</span></th></tr></thead><tbody>' +
      ds.slice(0, TOI_DA).map(function (c) {
        var i = list.indexOf(c), nguyen = c.cach_xuat === 'nguyen', tron = root.KhaiBao.comboTron(c);
        var oCach = ghi
          ? '<select class="select" data-cach="' + i + '" aria-label="Cách xuất">' +
            '<option value="tach"' + (nguyen ? '' : ' selected') + '>✂️ Tách</option>' +
            '<option value="nguyen"' + (nguyen ? ' selected' : '') + (tron ? ' disabled' : '') + '>📦 Nguyên combo</option></select>'
          : '<span class="badge-cach badge-' + (nguyen ? 'nguyen' : 'tach') + '">' + (nguyen ? '📦 Nguyên combo' : '✂️ Tách') + '</span>';
        var chiTiet = nguyen
          ? '<div>' + A.badge(c.nha) + ' xuất 1 dòng: <b>' + A.esc(c.ten_xuat || PL.tenGon(c.ten_combo, DM.caiDat.maKhac)) + '</b></div>' +
            '<div class="pl">Mã trên hệ thống: ' + A.esc(c.ma_he_thong || '(dùng SKU của sàn)') + ' · giá theo giá combo trên sàn</div>'
          : '';
        return '<tr><td class="ten"><b>' + A.esc(c.ten_combo) + '</b><div class="pl">' + A.esc(c.combo_id) + '</div></td>' +
          '<td>' + oCach + (tron ? '<div class="pl">trộn nhà khác → chỉ tách</div>' : '') + '</td>' +
          '<td>' + c.khoa.map(function (k) { return '<span class="khoa">' + A.esc(k) + '</span>'; }).join('') + '</td>' +
          '<td>' + chiTiet + (c.thanh_phan.length ? '<ul class="tp-list">' + c.thanh_phan.map(function (t) {
            return '<li>' + A.badge(t.nha) + ' ' + t.so_luong + '× ' + A.esc(t.ten) + ' <span class="pl">' + A.esc(t.sku) + ' · ' + A.so(t.gia_goc) + 'đ</span></li>';
          }).join('') + '</ul>' : (nguyen ? '' : '<span class="muted">(chưa có thành phần)</span>')) + '</td><td class="pl">' + ngay(c.cap_nhat) + '</td>' +
          '<td><div class="actions">' + A.nutGhi('✏️ Sửa', 'class="btn btn-sm" data-sua-combo="' + i + '"') +
          A.nutGhi('🗑', 'class="btn btn-icon btn-ghost" data-xoa-combo="' + i + '" aria-label="Xóa combo"') + '</div></td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- Thao tác ---------- */
  /* Đổi cách xuất của combo: đủ thông tin thì lưu luôn, thiếu thì mở form sửa */
  function doiCachXuat(i, cach) {
    var c = DM.catalog.combos[i];
    if (cach === c.cach_xuat) return;
    if (cach === 'nguyen') {
      if (root.KhaiBao.comboTron(c)) { A.toast('Combo có sách nhà khác – không xuất nguyên được.', 'loi'); ve(); return; }
      var nha = PL.NHA.indexOf(c.nha) >= 0 ? c.nha
        : c.thanh_phan.map(function (t) { return t.nha; }).filter(function (n) { return PL.NHA.indexOf(n) >= 0; })[0];
      if (!nha) { ve(); root.KhaiBao.moSua(c, 'nguyen', 'Chọn nhà cho combo xuất nguyên rồi bấm Lưu.'); return; }
      luuCombo(Object.assign({}, c, { cach_xuat: 'nguyen', nha: nha }));
    } else {
      if (!c.thanh_phan.length) { ve(); root.KhaiBao.moSua(c, 'tach', 'Combo này chưa có thành phần – thêm từng cuốn rồi bấm Lưu để chuyển sang "Tách".'); return; }
      luuCombo(Object.assign({}, c, { cach_xuat: 'tach' }));
    }
  }
  function luuCombo(c) {
    DM.goi('upsertCombo', c)
      .then(function () { A.toast((c.cach_xuat === 'nguyen' ? '📦 Đã chuyển sang xuất nguyên combo: ' : '✂️ Đã chuyển sang tách từng cuốn: ') + c.ten_combo.slice(0, 50), 'ok'); })
      .catch(function (e) { A.toast('Không lưu được: ' + e.message, 'loi'); ve(); });
  }

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
    A.hoi('Xóa combo "' + c.ten_combo + '"?\n\nCombo này có ' + c.thanh_phan.length + ' thành phần:\n' +
      c.thanh_phan.map(function (t) { return '· ' + t.so_luong + '× ' + PL.tenGon(t.ten, DM.caiDat.maKhac) + ' (' + t.nha + ')'; }).join('\n') +
      (c.cach_xuat === 'nguyen' ? '\n📦 Đang xuất nguyên combo → ' + c.nha : '') +
      '\n\nSau khi xóa, các đơn của combo này sẽ quay lại tab Combo để khai báo lại.', 'Xóa combo').then(function (ok) {
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
      var cx = e.target.closest('[data-cach]');
      if (cx) doiCachXuat(+cx.dataset.cach, cx.value);
    });
    $('dm-bang').addEventListener('click', function (e) {
      if (e.target.id === 'ls-lai') { lichSu = null; loiLs = ''; ve(); return; }
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

  // Danh mục vừa thay đổi → lịch sử cũ không còn mới, tải lại khi mở tab
  DM.nghe(function (loai) { if (loai === 'catalog') { lichSu = null; loiLs = ''; } });

  root.ManDanhMuc = { ve: ve };
})(typeof self !== 'undefined' ? self : this);
