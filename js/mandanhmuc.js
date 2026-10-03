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
    doiKhoaCombo: '🔑 Đổi khóa combo (mã vạch)', capNhatGia: '💲 Cập nhật giá', capNhatGiaCombo: '💸 Cập nhật giá combo',
    thayMaTaiBan: '🔁 Thay mã tái bản', hoanTacTaiBan: '↩️ Hoàn tác thay mã', boQuaTaiBan: '🙅 Không phải tái bản'
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
      if (o.ghi_chu) return o.ghi_chu;
      if (o.skus && o.combos) { // ảnh chụp trước/sau khi thay mã tái bản
        return o.skus.map(function (x) {
          return x.dong ? x.dong.sku + (x.dong.ma_moi ? ' → ' + x.dong.ma_moi : '') + ' · ' + x.dong.nha + (x.dong.gia_gan_nhat ? ' · ' + A.so(x.dong.gia_gan_nhat) + 'đ' : '')
            : x.key.slice(4) + ': (chưa có)';
        }).join('\n') + (o.combos.length ? '\n' + o.combos.length + ' combo: ' + o.combos.map(function (c) { return c ? c.combo_id : '?'; }).join(', ') : '');
      }
      if (o.thanh_phan) {
        return (o.ten_combo || '') + (o.cach_xuat === 'nguyen' ? '\n📦 xuất nguyên combo → ' + o.nha + (o.ma_he_thong ? ' · mã ' + o.ma_he_thong : '') : '') + '\n' + o.thanh_phan.map(function (t) { return '· ' + t.so_luong + '× ' + t.ten + ' (' + t.nha + ')'; }).join('\n') +
          (o.khoa ? '\nkhóa: ' + [].concat(o.khoa).join(', ') : '');
      }
      if (o.nha) return (o.sku ? o.sku + ' · ' : '') + o.ten + '\n→ ' + o.nha + ' (' + (o.nguon === 'tu_hoc' ? 'tự học' : o.nguon === 'web' ? 'web' : 'gán tay') + ')';
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
    var daHoanTac = {};
    lichSu.forEach(function (r) { if (r.hanh_dong === 'hoanTacTaiBan') daHoanTac[String(r.khoa).split(' ')[0]] = true; });
    $('dm-bang').innerHTML = '<div class="legend" style="padding:12px 16px">100 thay đổi gần nhất (mới nhất ở trên). Bản đầy đủ nằm ở sheet LICH_SU. ' +
      '<button class="linkish" id="ls-lai">Tải lại</button></div>' +
      '<table class="tbl"><thead><tr><th>Thời gian</th><th>Hành động</th><th>Khóa</th><th>Trước</th><th>Sau</th></tr></thead><tbody>' +
      ds.map(function (r) {
        var nutHt = r.hanh_dong === 'thayMaTaiBan' && r.dong
          ? (daHoanTac['LS#' + r.dong] ? '<div class="pl">(đã hoàn tác)</div>'
            : '<div>' + A.nutGhi('↩️ Hoàn tác', 'class="btn btn-sm" data-hoan-tac="' + r.dong + '" data-khoa-ls="' + A.esc(r.khoa) + '"') + '</div>')
          : '';
        return '<tr><td class="pl">' + ngay(r.thoi_gian) + '</td><td class="ls-hd">' + A.esc(TEN_HD[r.hanh_dong] || r.hanh_dong) + nutHt + '</td>' +
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
    var ghi = DM.coTheGhi(), idxDm = PL.buildIndex(DM.catalog);
    $('dm-bang').innerHTML = '<table class="tbl"><thead><tr><th>SKU</th><th>Tên sách</th><th>Nhà</th><th>Nguồn</th><th class="so">Giá gần nhất (ngày)</th><th>Cập nhật</th><th><span class="sr">Thao tác</span></th></tr></thead><tbody>' +
      ds.slice(0, TOI_DA).map(function (e) {
        var i = list.indexOf(e);
        var nhanKhoa = /^ten:/.test(e.key) ? '<div class="pl">nhận diện theo tên: ' + A.esc(e.key.split('|')[1] || '') + '</div>' : '';
        var phu = e.ma_moi ? '<div><span class="nho nho-macu" title="Mã cũ – đơn dùng mã này được tính vào mã mới nhất">mã phụ → ' + A.esc(PL.maMoiNhat(idxDm, e.sku)) + '</span></div>' : '';
        var choThay = PL.isBarcode(e.sku) && !e.ma_moi;
        return '<tr><td class="sku">' + (e.sku ? A.esc(e.sku) : '<span class="sku-la sku-trong">(trống)</span>') + phu + '</td>' +
          '<td class="ten">' + A.esc(e.ten) + nhanKhoa + '</td><td>' +
          (ghi ? '<select class="select" data-sua-sku="' + i + '" aria-label="Nhà">' + ['HA', 'KV', 'ML', PL.KHONG_NHAP].map(function (n) {
            return '<option value="' + n + '"' + (e.nha === n ? ' selected' : '') + '>' + (n === PL.KHONG_NHAP ? 'Không nhập' : n + ' · ' + PL.TEN_NHA[n]) + '</option>';
          }).join('') + '</select>' : A.badge(e.nha === PL.KHONG_NHAP ? 'Không nhập' : e.nha)) +
          '</td><td class="nguon-' + A.esc(e.nguon) + '">' + (e.nguon === 'tay' ? '✋ gán tay' : e.nguon === 'web' ? '🌐 web' : '🤖 tự học') + '</td>' +
          '<td class="so">' + (e.gia_gan_nhat ? A.so(e.gia_gan_nhat) + '<div class="pl">' + A.esc(e.ngay_gia) + '</div>' : '<span class="muted">—</span>') + '</td>' +
          '<td class="pl">' + ngay(e.cap_nhat) + '</td><td><div class="actions">' +
          (choThay ? A.nutGhi('🔁 Thay mã tái bản', 'class="btn btn-sm" data-tai-ban="' + i + '"') : '') +
          A.nutGhi('🗑', 'class="btn btn-icon btn-ghost" data-xoa-sku="' + i + '" aria-label="Xóa ' + A.esc(e.sku || e.ten) + '"') + '</div></td></tr>';
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
    lechDm = PL.lechGiaCombo(DM.catalog, A.S.kq ? A.S.kq.giaFile : {});
    var lechTheoId = {};
    lechDm.forEach(function (l) { lechTheoId[l.combo_id] = l; });
    $('dm-bang').innerHTML = A.khungLechGia(lechDm, 'dm') + '<table class="tbl"><thead><tr><th>Tên combo</th><th>Cách xuất</th><th>Khóa nhận diện</th><th>Thành phần</th><th>Cập nhật</th><th><span class="sr">Thao tác</span></th></tr></thead><tbody>' +
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
        var lech = lechTheoId[c.combo_id];
        return '<tr><td class="ten"><b>' + A.esc(c.ten_combo) + '</b><div class="pl">' + A.esc(c.combo_id) + '</div>' +
          (lech ? '<div>' + lech.ds.map(function (x) { return '<span class="nhan-lech" title="' + A.esc(x.ten) + '">💸 Giá đã đổi: ' + A.so(x.cu) + ' → ' + A.so(x.moi) + '</span>'; }).join('') +
            A.nutGhi('Cập nhật giá', 'class="btn btn-sm" data-gia-combo="' + lechDm.indexOf(lech) + '" data-gia-nguon="dm"') + '</div>' : '') + '</td>' +
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
  var lechDm = [];

  /* Thay mã tái bản bằng tay */
  var dangTaiBan = null;
  function moTaiBan(e) {
    dangTaiBan = e;
    $('tb-goc').innerHTML = 'Mã cũ <b>' + A.esc(e.sku) + '</b> – ' + A.esc(PL.tenGon(e.ten, DM.caiDat.maKhac)) + ' (' + A.esc(PL.TEN_NHA[e.nha] || e.nha) + ')' +
      (e.gia_gan_nhat ? ' · giá gần nhất ' + A.so(e.gia_gan_nhat) + 'đ' : '');
    $('tb-ma').value = ''; $('tb-gia').value = ''; $('tb-ten').value = '';
    $('tb-ten').placeholder = e.ten;
    $('tb-loi').textContent = '';
    $('dlg-taiban').showModal();
    $('tb-ma').focus();
  }
  function luuTaiBan() {
    var ma = PL.clean($('tb-ma').value).toUpperCase();
    if (!PL.isBarcode(ma)) { $('tb-loi').textContent = 'Mã mới phải là mã vạch (chỉ gồm chữ số, từ 7 ký tự).'; return; }
    if (ma === PL.clean(dangTaiBan.sku).toUpperCase()) { $('tb-loi').textContent = 'Mã mới phải khác mã cũ.'; return; }
    var btn = $('tb-luu');
    btn.disabled = true;
    A.thayMa({ maCu: dangTaiBan.sku, maMoi: ma, giaMoi: Number($('tb-gia').value) || '', tenMoi: PL.clean($('tb-ten').value) })
      .then(function () { $('dlg-taiban').close(); })
      .catch(function (err) { $('tb-loi').textContent = err.message; })
      .then(function () { btn.disabled = false; });
  }
  function hoanTac(dong, khoa, b) {
    A.hoi('Hoàn tác lần thay mã ' + khoa + '?\n\nDanh mục SKU và các combo liên quan sẽ trở về đúng như trước khi thay mã. ' +
      'Những sửa đổi sau đó trên chính các dòng này (nếu có) cũng sẽ bị trả lại.', 'Hoàn tác').then(function (ok) {
      if (!ok) return;
      b.disabled = true;
      DM.goi('hoanTacTaiBan', { dong: dong })
        .then(function () { A.toast('↩️ Đã hoàn tác thay mã ' + khoa + '.', 'ok'); lichSu = null; ve(); })
        .catch(function (err) { b.disabled = false; A.toast('Không hoàn tác được: ' + err.message, 'loi'); });
    });
  }

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
      else if (b.dataset.taiBan) moTaiBan(DM.catalog.skus[+b.dataset.taiBan]);
      else if (b.dataset.hoanTac) hoanTac(+b.dataset.hoanTac, b.dataset.khoaLs, b);
      else if (b.dataset.giaCombo && b.dataset.giaNguon === 'dm') { b.disabled = true; A.capNhatGiaCombo([lechDm[+b.dataset.giaCombo]]); }
      else if (b.dataset.giaTatca === 'dm') { b.disabled = true; A.capNhatGiaCombo(lechDm); }
    });
    $('dm-xuat').addEventListener('click', xuatExcel);
    $('tb-luu').addEventListener('click', luuTaiBan);
    $('tb-ma').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); luuTaiBan(); } });
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
