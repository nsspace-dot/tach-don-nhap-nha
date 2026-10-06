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

  /* Tìm không phân biệt dấu, hoa thường, ngoặc, dấu "+": "co tich vn tg" khớp "CỔ TÍCH VN+TG (ML)". Đủ mọi từ là khớp. */
  function chuanTim(s) { return A.boDau(s).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function khopTim(q, chu) {
    if (!q) return true;
    var h = ' ' + chuanTim(chu) + ' ';
    return q.split(' ').every(function (w) { return h.indexOf(w) >= 0; });
  }

  function khopCombo(q, c) {
    return khopTim(q, c.ten_combo + ' ' + c.ten_xuat + ' ' + c.ma_he_thong + ' ' + c.khoa.join(' ') + ' ' +
      c.thanh_phan.map(function (t) { return t.sku + ' ' + t.ten; }).join(' '));
  }

  function ve() {
    var c = DM.catalog, q = chuanTim($('dm-tim').value);
    $('dm-dem-sku').textContent = '(' + c.skus.length + ')';
    $('dm-dem-gantay').textContent = '(' + c.skus.filter(function (e) { return e.nguon_ma === 'gan_tay' && e.ma_moi; }).length + ')';
    $('dm-dem-combo').textContent = '(' + c.combos.length + ')';
    $('dm-dem-mc').textContent = '(' + (c.ma_chuan || []).length + ')';
    document.querySelectorAll('.seg-btn').forEach(function (b) {
      var on = b.dataset.dm === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on);
    });
    document.querySelectorAll('#man-danhmuc .can-write').forEach(function (b) {
      b.disabled = !DM.coTheGhi();
      b.title = DM.coTheGhi() ? '' : 'Dán URL Apps Script ở màn Cài đặt để dùng nút này';
    });
    $('dm-loc-ten-o').hidden = tab !== 'sku';
    if (tab === 'sku') veSku(c.skus, q);
    else if (tab === 'combo') veCombo(c.combos, q);
    else if (tab === 'gantay') veGanTay(c.skus, q);
    else veLichSu(q);
  }

  /* ---------- Lịch sử (100 thay đổi gần nhất, chỉ xem) ---------- */
  var lichSu = null, dangTaiLs = false, loiLs = '';
  var TEN_HD = {
    upsertSku: '✋ Gán / sửa nhà', upsertSkuBatch: '🤖 Tự học', deleteSku: '🗑 Xóa SKU',
    upsertCombo: '🎁 Lưu combo', addComboKey: '🔗 Gắn khóa combo', boKhoa: '✂️ Chuyển khóa sang combo khác',
    deleteCombo: '🗑 Xóa combo', importBatch: '📥 Nạp Excel', khoiPhuc: '♻️ Khôi phục sao lưu',
    doiKhoaCombo: '🔑 Đổi khóa combo (mã vạch)', capNhatGia: '💲 Cập nhật giá', capNhatGiaCombo: '💸 Cập nhật giá combo',
    thayMaTaiBan: '🔁 Thay mã tái bản', hoanTacTaiBan: '↩️ Hoàn tác thay mã', boQuaTaiBan: '🙅 Không phải tái bản',
    soMaChuan: '🌐 Sổ mã chuẩn', luuTenSach: '✏️ Khai báo tên sách', suaSku: '✏️ Sửa dòng danh mục', ganBarcode: '🏷️ Gán / sửa barcode', boGanBarcode: '🗑 Bỏ barcode gán tay', khongPhaiCombo: '📖 Không phải combo – sách lẻ', luuMaPhu: '🔗 Quy về mã web', boQuaCungCuon: '🙅 Không phải cùng cuốn'
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
          return x.dong ? (x.dong.sku || '(SKU trống) ' + String(x.dong.ten || '').slice(0, 40)) + (x.dong.ma_moi ? ' → ' + x.dong.ma_moi : '') + ' · ' + x.dong.nha + (x.dong.gia_gan_nhat ? ' · ' + A.so(x.dong.gia_gan_nhat) + 'đ' : '')
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
      return khopTim(q, [TEN_HD[r.hanh_dong] || r.hanh_dong, r.khoa, r.du_lieu_cu, r.du_lieu_moi].join(' '));
    });
    if (!ds.length) { $('dm-bang').innerHTML = rong(lichSu.length ? 'Không tìm thấy.' : 'Chưa có thay đổi nào.'); return; }
    var daHoanTac = {};
    lichSu.forEach(function (r) { if (r.hanh_dong === 'hoanTacTaiBan') daHoanTac[String(r.khoa).split(' ')[0]] = true; });
    $('dm-bang').innerHTML = '<div class="legend" style="padding:12px 16px">100 thay đổi gần nhất (mới nhất ở trên). Bản đầy đủ nằm ở sheet LICH_SU. ' +
      '<button class="linkish" id="ls-lai">Tải lại</button></div>' +
      '<table class="tbl tbl-ghim1"><thead><tr><th>Thời gian</th><th>Hành động</th><th>Khóa</th><th>Trước</th><th>Sau</th></tr></thead><tbody>' +
      ds.map(function (r) {
        var nutHt = ['thayMaTaiBan', 'ganBarcode', 'boGanBarcode', 'suaSku'].indexOf(r.hanh_dong) >= 0 && r.dong
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

  /* ---------- Tên sách khai báo ---------- */
  /* Sách cần tên: đang dùng (không phải mã phụ), thuộc 3 nhà */
  function canTen(e) { return !e.ma_moi && PL.NHA.indexOf(e.nha) >= 0; }
  /* Gợi ý tên khi chưa khai báo: tên sổ mã chuẩn web → tên sàn làm gọn – phân loại */
  function goiYTen(e, mc) {
    var c = PL.isBarcode(e.sku) && mc[e.sku.toUpperCase()];
    if (c && c.ten_gon) return { ten: c.ten_gon, nguon: '🌐 tên web' };
    var pl = e.phan_loai || (/^ten:/.test(e.key) ? e.key.split('|').slice(1).join('|') : '');
    return { ten: PL.tenTam(e.ten, pl, DM.caiDat.maKhac, DM.caiDat.plVoNghia), nguon: 'tên tạm' };
  }
  function bangMc() {
    var mc = {};
    (DM.catalog.ma_chuan || []).forEach(function (x) { mc[x.barcode] = x; });
    return mc;
  }
  var dsDangHien = [];
  function luuTen(items, nut) {
    if (!items.length) return;
    if (nut) nut.disabled = true;
    DM.goi('luuTenSach', { items: items })
      .then(function (r) { A.toast('✏️ Đã khai báo tên cho ' + (r.soTenSach || 0) + ' sách.', 'ok'); })
      .catch(function (err) { A.toast('Không lưu được tên: ' + err.message, 'loi'); ve(); })
      .then(function () { if (nut) nut.disabled = false; });
  }
  function itemTen(e, ten) { return { key: e.key, sku: e.sku, ten: e.ten, nha: e.nha, ten_sach: ten, phan_loai: e.phan_loai }; }

  function veSku(list, q) {
    var locTen = $('dm-loc-ten').checked, mc = bangMc();
    $('dm-dem-chuaten').textContent = '(' + list.filter(function (e) { return canTen(e) && !e.ten_sach; }).length + ')';
    var ds = list.filter(function (e) {
      if (locTen && !(canTen(e) && !e.ten_sach)) return false;
      return khopTim(q, [e.sku, e.ten_sach, e.ten, e.phan_loai, e.key, e.nha].join(' '));
    });
    ds.sort(function (a, b) { return (a.ten_sach || a.ten).localeCompare(b.ten_sach || b.ten, 'vi'); });
    if (!ds.length) {
      var soCb = q ? DM.catalog.combos.filter(function (c) { return khopCombo(q, c); }).length : 0;
      $('dm-bang').innerHTML = rong(locTen ? 'Sách nào cũng đã có tên khai báo rồi 🎉' : list.length ? 'Không tìm thấy trong SKU → nhà.' +
        (soCb ? ' <button class="linkish" type="button" data-sang-combo>Có ' + soCb + ' combo khớp – xem tab Combo</button>' : '') +
        '<br><small>Dòng chỉ nhận diện tại chỗ (chưa lưu) thì bấm “💾 Lưu vào danh mục” ở màn Tách đơn.</small>'
        : 'Danh mục SKU còn trống. Mèo sẽ tự học dần khi bạn tách đơn 🐾');
      return;
    }
    var ghi = DM.coTheGhi(), idxDm = PL.buildIndex(DM.catalog);
    dsDangHien = ds.slice(0, TOI_DA);
    var soGoiY = dsDangHien.filter(function (e) { return canTen(e) && !e.ten_sach; }).length;
    $('dm-bang').innerHTML = (locTen ? '<div class="legend" style="padding:12px 16px">Ô tên đang điền sẵn <b>gợi ý</b> (tên web, hoặc tên sàn – phân loại). Sửa ô nào thì lưu ô đó; ' +
        'hoặc bấm “✔ Dùng gợi ý” để lưu nguyên gợi ý. ' + (ghi && soGoiY ? A.nutGhi('✔ Dùng gợi ý cho ' + soGoiY + ' sách đang hiện', 'class="btn btn-sm btn-primary" id="dm-dung-het"') : '') + '</div>' : '') +
      '<table class="tbl tbl-ghim2 c1-sku"><thead><tr><th>SKU</th><th>Tên sách <small class="muted">(in ra file)</small></th><th>Tên trên sàn</th><th>Nhà</th><th>Nguồn</th><th class="so">Giá gần nhất (ngày)</th><th>Cập nhật</th><th><span class="sr">Thao tác</span></th></tr></thead><tbody>' +
      ds.slice(0, TOI_DA).map(function (e) {
        var i = list.indexOf(e);
        var nhanKhoa = /^ten:/.test(e.key) ? '<div class="pl">nhận diện theo tên: ' + A.esc(e.key.split('|')[1] || '') + '</div>' : '';
        var phu = e.ma_moi ? '<div><span class="nho nho-macu" title="Mã cũ – đơn dùng mã này được tính vào mã mới nhất">mã phụ → ' + A.esc(PL.maMoiNhat(idxDm, e.sku)) + '</span></div>' : '';
        var choThay = PL.isBarcode(e.sku);
        return '<tr><td class="sku">' + (e.sku ? A.esc(e.sku) : '<span class="sku-la sku-trong">(trống)</span>') + phu + '</td>' +
          oTenSach(e, i, ghi, mc) + '<td class="ten pl">' + A.esc(e.ten) + (e.phan_loai ? ' <span class="nho">' + A.esc(e.phan_loai) + '</span>' : '') + nhanKhoa + '</td><td>' +
          (ghi ? '<select class="select" data-sua-sku="' + i + '" aria-label="Nhà">' + (e.nha ? '' : '<option value="" selected disabled>— chọn nhà —</option>') + ['HA', 'KV', 'ML', PL.KHONG_NHAP].map(function (n) {
            return '<option value="' + n + '"' + (e.nha === n ? ' selected' : '') + '>' + (n === PL.KHONG_NHAP ? 'Không nhập' : n + ' · ' + PL.TEN_NHA[n]) + '</option>';
          }).join('') + '</select>' : A.badge(e.nha === PL.KHONG_NHAP ? 'Không nhập' : e.nha)) +
          '</td><td class="nguon-' + A.esc(e.nguon) + '">' + (e.nguon === 'tay' ? '✋ gán tay' : e.nguon === 'web' ? '🌐 web' : e.nguon === 'web_tu_khop' ? '🌐 web tự khớp' : '🤖 tự học') +
            (e.khong_combo ? '<div><span class="nho" title="Bạn đã bấm “Không phải combo” cho dòng này">🙅 không phải combo</span></div>' : '') + '</td>' +
          '<td class="so">' + (e.gia_gan_nhat ? A.so(e.gia_gan_nhat) + '<div class="pl">' + A.esc(e.ngay_gia) + '</div>' : '<span class="muted">—</span>') + '</td>' +
          '<td class="pl">' + ngay(e.cap_nhat) + '</td><td><div class="actions">' +
          A.nutGhi('✏️ Sửa', 'class="btn btn-sm" data-sua-dong="' + i + '"') +
          (choThay ? A.nutGhi('🔁 Thay mã tái bản', 'class="btn btn-sm" data-tai-ban="' + i + '"') : '') +
          A.nutGhi('🗑', 'class="btn btn-icon btn-ghost" data-xoa-sku="' + i + '" aria-label="Xóa ' + A.esc(e.sku || e.ten) + '"') + '</div></td></tr>';
      }).join('') + '</tbody></table>' +
      (ds.length > TOI_DA ? '<p class="trong-bang">Đang hiện ' + TOI_DA + '/' + ds.length + ' dòng – gõ vào ô tìm kiếm để lọc.</p>' : '');
  }

  function oTenSach(e, i, ghi, mc) {
    if (!canTen(e)) return '<td class="ten">' + (e.ten_sach ? A.esc(e.ten_sach) : '<span class="muted">—</span>') + '</td>';
    var gy = e.ten_sach ? null : goiYTen(e, mc), gt = e.ten_sach || gy.ten;
    if (!ghi) return '<td class="ten">' + A.esc(gt) + (gy ? ' <span class="nho nho-chuaten">chưa có tên khai báo</span>' : '') + '</td>';
    return '<td class="ten"><input class="input input-ten' + (gy ? ' la-goi-y' : '') + '" data-ten-sach="' + i + '" value="' + A.esc(gt) + '" aria-label="Tên sách">' +
      (gy ? '<div class="pl"><span class="nho nho-chuaten">chưa có tên khai báo</span> gợi ý theo ' + gy.nguon + ' ' +
        A.nutGhi('✔ Dùng', 'class="btn btn-sm" data-dung-goi-y="' + i + '"') + '</div>' : '') + '</td>';
  }

  /* ---------- Sửa tay mọi trường của 1 dòng danh mục (kể cả mã phụ, web, tự học) ---------- */
  function canhBaoMa(ma) {
    if (!ma) return '';
    if (!PL.isBarcode(ma)) return '⚠ "' + ma + '" không giống mã vạch (chỉ gồm chữ số, từ 7 ký tự).';
    if (/^\d{13}$/.test(ma) && !PL.ean13HopLe(ma)) return '⚠ Mã ' + ma + ' sai số kiểm tra (số cuối) – có thể gõ nhầm.';
    return '';
  }
  var dangSua = null;
  function moSuaDong(e) {
    dangSua = e;
    $('ss-goc').textContent = 'Nguồn hiện tại: ' + (e.nguon || '?') + (e.nguon_ma ? ' · mã phụ (' + e.nguon_ma + ')' : '');
    $('ss-key').value = e.key; $('ss-sku').value = e.sku; $('ss-ten').value = e.ten; $('ss-pl').value = e.phan_loai || '';
    $('ss-tensach').value = e.ten_sach || ''; $('ss-nha').value = e.nha || ''; $('ss-gia').value = e.gia_gan_nhat || '';
    $('ss-mamoi').value = e.ma_moi || ''; $('ss-ktb').value = e.khong_tai_ban || ''; $('ss-kcombo').checked = !!e.khong_combo;
    $('ss-loi').textContent = '';
    $('dlg-sua-sku').showModal();
  }
  /* Kiểm tra chỉ để CẢNH BÁO – không chặn */
  function canhBaoDong(d) {
    var cb = [];
    if (!/^(sku|ten):/.test(d.key)) cb.push('⚠ Khóa "' + d.key + '" không bắt đầu bằng sku: hoặc ten: – app sẽ không nhận ra dòng nào trên sàn.');
    var m1 = canhBaoMa(PL.isBarcode(d.sku) || /^\d+$/.test(d.sku) ? d.sku : '');
    if (m1) cb.push(m1.replace('Mã', 'SKU'));
    if (d.ma_moi) {
      var m2 = canhBaoMa(d.ma_moi);
      if (m2) cb.push(m2.replace('Mã', 'Mã chính'));
      if (d.ma_moi === PL.clean(d.sku).toUpperCase()) cb.push('⚠ Mã chính trùng SKU của chính dòng này.');
      // Vòng lặp: đi theo mã chính trong danh mục có quay về dòng này không
      var cur = d.ma_moi, da = {}, goc = d.key.indexOf('sku:') === 0 ? d.key.slice(4) : '';
      while (cur && !da[cur]) {
        if (goc && cur === goc) { cb.push('⚠ Mã chính tạo vòng lặp (' + d.ma_moi + ' lại trỏ về ' + goc + ').'); break; }
        da[cur] = 1;
        var x = DM.catalog.skus.filter(function (s) { return s.key === 'sku:' + cur; })[0];
        cur = x ? PL.clean(x.ma_moi).toUpperCase() : '';
      }
    }
    if (!d.nha && !d.ma_moi) cb.push('⚠ Chưa chọn nhà.');
    if (d.key !== dangSua.key && DM.catalog.skus.some(function (s) { return s.key === d.key; })) cb.push('⚠ Khóa mới trùng 1 dòng khác – dòng đó sẽ bị ghi đè.');
    return cb;
  }
  function luuSuaDong(ghiDe) {
    var key = PL.clean($('ss-key').value);
    if (key && !/^(sku|ten):/i.test(key)) key = PL.skuKey(key); // gõ trơn mã → sku:<mã>
    else if (/^sku:/i.test(key)) key = PL.skuKey(key.slice(4));
    var d = { key_cu: dangSua.key, key: key || dangSua.key, sku: PL.clean($('ss-sku').value), ten: PL.clean($('ss-ten').value),
      phan_loai: PL.clean($('ss-pl').value), ten_sach: PL.clean($('ss-tensach').value), nha: $('ss-nha').value,
      gia_gan_nhat: Number($('ss-gia').value) || '', ma_moi: PL.clean($('ss-mamoi').value).replace(/\s+/g, '').toUpperCase(),
      khong_tai_ban: PL.clean($('ss-ktb').value), khong_combo: $('ss-kcombo').checked, ghi_de: !!ghiDe };
    var cb = ghiDe ? [] : canhBaoDong(d);
    var tiep = cb.length ? A.hoi(cb.join('\n') + '\n\nVẫn lưu?', 'Vẫn lưu', { tieuDe: 'Kiểm tra dữ liệu', nhe: true }) : Promise.resolve(true);
    tiep.then(function (ok) {
      if (!ok) return;
      if (cb.length) d.ghi_de = true; // đã xác nhận cảnh báo (kể cả trùng khóa)
      var btn = $('ss-luu');
      btn.disabled = true;
      DM.goi('suaSku', d)
        .then(function () { $('dlg-sua-sku').close(); A.toast('✏️ Đã lưu dòng ' + d.key + '.', 'ok'); })
        .catch(function (err) {
          var m = /CAN_XAC_NHAN:\s*(.*)$/.exec(err.message);
          if (m) { A.hoi(m[1], 'Ghi đè', { tieuDe: 'Xác nhận' }).then(function (ok2) { if (ok2) luuSuaDong(true); }); return; }
          $('ss-loi').textContent = 'Không lưu được: ' + err.message;
        })
        .then(function () { btn.disabled = false; });
    });
  }

  /* ---------- Barcode gán tay (khóa dòng → barcode) ---------- */
  function veGanTay(list, q) {
    var ds = list.filter(function (e) {
      return e.nguon_ma === 'gan_tay' && e.ma_moi && khopTim(q, [e.key, e.sku, e.ten, e.phan_loai, e.ma_moi].join(' '));
    });
    if (!ds.length) {
      $('dm-bang').innerHTML = rong(q ? 'Không tìm thấy.' : 'Chưa có barcode gán tay. Bấm 🏷️ ở dòng sách trên màn Tách đơn để gán / sửa barcode.');
      return;
    }
    var ghi = DM.coTheGhi();
    var tenMa = function (ma) {
      var e = list.filter(function (x) { return x.key === PL.skuKey(ma); })[0];
      var w = (DM.catalog.ma_chuan || []).filter(function (x) { return x.barcode === ma; })[0];
      return e ? (e.ten_sach || PL.tenGon(e.ten, DM.caiDat.maKhac)) + ' · ' + (e.nha === PL.KHONG_NHAP ? 'Không nhập' : e.nha) : w ? w.ten_gon + ' · 🌐 web' : '(chưa có trong danh mục)';
    };
    $('dm-bang').innerHTML = '<div class="legend" style="padding:12px 16px">Dòng trên sàn có SKU trống / SKU chữ / barcode sai được quy về barcode đúng. Sửa ô barcode để đổi, 🗑 để bỏ. Mọi thay đổi hoàn tác được ở 🕘 Lịch sử.</div>' +
      '<table class="tbl tbl-ghim2 c1-trensan"><thead><tr><th>Trên sàn</th><th>Tên sản phẩm / phân loại</th><th>Barcode đúng</th><th>Sách của barcode đúng</th><th>Cập nhật</th><th><span class="sr">Thao tác</span></th></tr></thead><tbody>' +
      ds.slice(0, TOI_DA).map(function (e) {
        var i = list.indexOf(e), laTen = /^ten:/.test(e.key);
        var tren = laTen ? '<span class="sku-la sku-trong">SKU trống</span>' : PL.isBarcode(e.key.slice(4)) ? '<span class="sku">' + A.esc(e.key.slice(4)) + '</span> <span class="nho nho-warn">barcode sai</span>'
          : '<span class="sku-la">' + A.esc(e.key.slice(4)) + '</span> <span class="nho">SKU chữ</span>';
        var pl = e.phan_loai || (laTen ? e.key.split('|').slice(1).join('|') : '');
        return '<tr><td>' + tren + '</td><td class="ten">' + A.esc(e.ten) + (pl ? '<div class="pl">' + A.esc(pl) + '</div>' : '') + '</td>' +
          '<td>' + (ghi ? '<input class="input input-ma" data-sua-gantay="' + i + '" value="' + A.esc(e.ma_moi) + '" inputmode="numeric" aria-label="Barcode đúng">' : '<b class="sku">' + A.esc(e.ma_moi) + '</b>') + '</td>' +
          '<td class="pl">' + A.esc(tenMa(e.ma_moi)) + '</td><td class="pl">' + ngay(e.cap_nhat) + '</td>' +
          '<td><div class="actions">' + A.nutGhi('✏️ Sửa', 'class="btn btn-sm" data-sua-dong="' + i + '"') +
          A.nutGhi('🗑', 'class="btn btn-icon btn-ghost" data-bo-gantay="' + i + '" aria-label="Bỏ barcode gán tay"') + '</div></td></tr>';
      }).join('') + '</tbody></table>';
  }

  function veCombo(list, q) {
    var ds = list.filter(function (c) {
      return khopCombo(q, c);
    });
    ds.sort(function (a, b) { return a.ten_combo.localeCompare(b.ten_combo, 'vi'); });
    if (!ds.length) { $('dm-bang').innerHTML = rong(list.length ? 'Không tìm thấy.' : 'Chưa có combo nào. Khai báo ở tab Combo của màn Tách đơn nha.'); return; }
    var ghi = DM.coTheGhi();
    lechDm = PL.lechGiaCombo(DM.catalog, A.S.kq ? A.S.kq.giaFile : {});
    var lechTheoId = {};
    lechDm.forEach(function (l) { lechTheoId[l.combo_id] = l; });
    $('dm-bang').innerHTML = A.khungLechGia(lechDm, 'dm') + '<table class="tbl tbl-ghim1"><thead><tr><th>Tên combo</th><th>Cách xuất</th><th>Khóa nhận diện</th><th>Thành phần</th><th>Cập nhật</th><th><span class="sr">Thao tác</span></th></tr></thead><tbody>' +
      ds.slice(0, TOI_DA).map(function (c) {
        var i = list.indexOf(c), nguyen = c.cach_xuat === 'nguyen', tron = root.KhaiBao.comboTron(c);
        var oCach = ghi
          ? '<select class="select" data-cach="' + i + '" aria-label="Cách xuất">' +
            '<option value="tach"' + (nguyen ? '' : ' selected') + '>✂️ Tách</option>' +
            '<option value="nguyen"' + (nguyen ? ' selected' : '') + '>📦 Nguyên combo</option></select>'
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

  /* ---------- Nạp sổ mã chuẩn từ nhiều file web cũ ---------- */
  function napSoMaChuan(files) {
    Promise.all(files.map(function (f) {
      return f.arrayBuffer().then(function (buf) { return root.DocFile.parseWorkbook(root.XLSX.read(buf, { type: 'array' }), root.XLSX, f.name); })
        .catch(function () { return { error: 'hỏng', file: f.name }; });
    })).then(function (ds) {
      var web = ds.filter(function (p) { return p.san === 'Web'; });
      var boQua = ds.length - web.length;
      var theoMa = {};
      web.forEach(function (p) {
        p.rows.forEach(function (r) {
          if (!PL.isBarcode(r.sku)) return;
          var n = PL.nhaTheoNcc(r.ncc);
          var it = { barcode: r.sku.toUpperCase(), ten_gon: PL.tenGon(r.ten, DM.caiDat.maKhac), gia_bia: Number(r.gia) || 0, ncc: r.ncc,
                     nha: PL.NHA.indexOf(n) >= 0 ? n : '', ngay_thay: r.ngayXuat || PL.homNayISO() };
          var cu = theoMa[it.barcode];
          if (!cu || it.ngay_thay >= cu.ngay_thay) theoMa[it.barcode] = it; // giữ bản mới nhất
        });
      });
      var items = Object.keys(theoMa).map(function (k) { return theoMa[k]; });
      if (!items.length) { A.toast('Không tìm thấy dòng có barcode trong các file web đã chọn.', 'loi'); return; }
      return A.hoi('Nạp ' + items.length + ' barcode từ ' + web.length + ' file web vào sổ mã chuẩn?' +
        (boQua ? '\n\n(' + boQua + ' file không phải "Danh sách lấy hàng" của web – bỏ qua.)' : '') +
        '\n\nBản cũ hơn sẽ không đè bản mới hơn đã có trong sổ.', 'Nạp', { nhe: true }).then(function (ok) {
        if (!ok) return;
        return DM.goi('upsertMaChuan', { items: items }).then(function (r) {
          A.toast('🌐 Sổ mã chuẩn: thêm ' + r.soMaChuan.moi + ', cập nhật ' + r.soMaChuan.doi + ' barcode.', 'ok');
        });
      });
    }).catch(function (e) { A.toast('Không nạp được: ' + e.message, 'loi'); });
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
    A.hoi('Hoàn tác "' + khoa + '"?\n\nDanh mục SKU và các combo liên quan sẽ trở về đúng như trước thao tác đó. ' +
      'Những sửa đổi sau đó trên chính các dòng này (nếu có) cũng sẽ bị trả lại.', 'Hoàn tác').then(function (ok) {
      if (!ok) return;
      b.disabled = true;
      DM.goi('hoanTacTaiBan', { dong: dong })
        .then(function () { A.toast('↩️ Đã hoàn tác: ' + khoa, 'ok'); lichSu = null; ve(); })
        .catch(function (err) { b.disabled = false; A.toast('Không hoàn tác được: ' + err.message, 'loi'); });
    });
  }

  /* Đổi cách xuất của combo: đủ thông tin thì lưu luôn, thiếu thì mở form sửa */
  function doiCachXuat(i, cach) {
    var c = DM.catalog.combos[i];
    if (cach === c.cach_xuat) return;
    if (cach === 'nguyen') {
      if (root.KhaiBao.comboTron(c) && !doiCachXuat.daHoi) {
        A.hoi('⚠ Combo có sách nhà khác – xuất nguyên thì cả combo vào 1 nhà (phần nhà khác cũng bị đặt).\n\nVẫn đổi?', 'Vẫn đổi', { nhe: true, tieuDe: 'Kiểm tra dữ liệu' })
          .then(function (ok) { if (ok) { doiCachXuat.daHoi = true; doiCachXuat(i, cach); doiCachXuat.daHoi = false; } else ve(); });
        return;
      }
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
      if (!kq.skus.length && !kq.combos.length && !kq.ganBarcode.length) {
        A.toast('Không nạp được: ' + (kq.loi[0] || 'file không có dữ liệu.'), 'loi');
        return;
      }
      var msg = 'Nạp ' + kq.skus.length + ' SKU, ' + kq.combos.length + ' combo' + (kq.ganBarcode.length ? ' và ' + kq.ganBarcode.length + ' barcode gán tay (ghi đè ánh xạ cũ cùng khóa)' : '') + ' vào danh mục?' +
        (kq.loi.length ? '\n\n⚠ Có ' + kq.loi.length + ' dòng lỗi sẽ bị bỏ qua:\n- ' + kq.loi.slice(0, 6).join('\n- ') + (kq.loi.length > 6 ? '\n…' : '') : '');
      return A.hoi(msg, 'Nạp').then(function (ok) {
        if (!ok) return;
        return DM.goi('importBatch', { skus: kq.skus, combos: kq.combos })
          .then(function () { return kq.ganBarcode.length ? DM.goi('ganBarcode', { items: kq.ganBarcode, ghi_de: true }) : null; })
          .then(function () { A.toast('📥 Đã nạp ' + kq.skus.length + ' SKU, ' + kq.combos.length + ' combo' + (kq.ganBarcode.length ? ', ' + kq.ganBarcode.length + ' barcode gán tay' : '') + '.', 'ok'); });
      });
    }).catch(function (e) { A.toast('Lỗi đọc file: ' + e.message, 'loi'); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.seg-btn').forEach(function (b) {
      b.addEventListener('click', function () { tab = b.dataset.dm; ve(); });
    });
    $('dm-tim').addEventListener('input', ve);
    $('dm-loc-ten').addEventListener('change', ve);
    $('ss-luu').addEventListener('click', function () { luuSuaDong(false); });
    $('dm-bang').addEventListener('change', function (e) {
      var s = e.target.closest('[data-sua-sku]');
      if (s) suaSku(+s.dataset.suaSku, s.value);
      var sg = e.target.closest('[data-sua-gantay]');
      if (sg) {
        var eg = DM.catalog.skus[+sg.dataset.suaGantay], ma = PL.clean(sg.value).replace(/\s+/g, '').toUpperCase();
        if (ma === eg.ma_moi) return;
        if (!ma) { sg.value = eg.ma_moi; return; }
        var cb = canhBaoMa(ma);
        var tiep = cb ? A.hoi(cb + '\n\nVẫn lưu?', 'Vẫn lưu', { tieuDe: 'Barcode có thể sai', nhe: true }) : Promise.resolve(true);
        tiep.then(function (ok) {
          if (!ok) { sg.value = eg.ma_moi; return; }
          DM.goi('ganBarcode', { items: [{ key: eg.key, sku: eg.sku, ten: eg.ten, phan_loai: eg.phan_loai }], ma_moi: ma, ghi_de: true, ep: true })
            .then(function () { A.toast('🏷️ Đã đổi barcode → ' + ma, 'ok'); })
            .catch(function (err) { A.toast('Không lưu được: ' + err.message, 'loi'); ve(); });
        });
        return;
      }
      var tn = e.target.closest('[data-ten-sach]');
      if (tn) {
        var en = DM.catalog.skus[+tn.dataset.tenSach], moi = PL.clean(tn.value);
        if (moi !== (en.ten_sach || '') && (moi || en.ten_sach)) luuTen([itemTen(en, moi)]);
      }
      var cx = e.target.closest('[data-cach]');
      if (cx) doiCachXuat(+cx.dataset.cach, cx.value);
    });
    $('dm-bang').addEventListener('click', function (e) {
      if (e.target.id === 'ls-lai') { lichSu = null; loiLs = ''; ve(); return; }
      if (e.target.closest('[data-sang-combo]')) { tab = 'combo'; ve(); return; }
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.suaDong) { moSuaDong(DM.catalog.skus[+b.dataset.suaDong]); return; }
      if (b.dataset.boGantay) {
        var ex0 = DM.catalog.skus[+b.dataset.boGantay];
        A.hoi('Bỏ barcode gán tay cho "' + ex0.ten + (ex0.phan_loai ? ' – ' + ex0.phan_loai : '') + '" (→ ' + ex0.ma_moi + ')?\n\nLần sau dòng này lại dùng SKU trên sàn. Hoàn tác được ở Lịch sử.', 'Bỏ')
          .then(function (ok) {
            if (!ok) return;
            DM.goi('boGanBarcode', { key: ex0.key })
              .then(function () { A.toast('🗑 Đã bỏ barcode gán tay.', 'ok'); })
              .catch(function (err) { A.toast('Không xóa được: ' + err.message, 'loi'); });
          });
        return;
      }
      if (b.id === 'dm-dung-het') {
        luuTen(dsDangHien.filter(function (x) { return canTen(x) && !x.ten_sach; }).map(function (x) {
          var o = $('dm-bang').querySelector('[data-ten-sach="' + DM.catalog.skus.indexOf(x) + '"]');
          return itemTen(x, PL.clean(o ? o.value : '') || goiYTen(x, bangMc()).ten);
        }), b);
      } else if (b.dataset.dungGoiY) {
        var ex = DM.catalog.skus[+b.dataset.dungGoiY], oi = $('dm-bang').querySelector('[data-ten-sach="' + b.dataset.dungGoiY + '"]');
        luuTen([itemTen(ex, PL.clean(oi && oi.value) || goiYTen(ex, bangMc()).ten)], b);
      } else if (b.dataset.xoaSku) xoaSku(+b.dataset.xoaSku);
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
    $('dm-nap-web').addEventListener('click', function () { $('dm-nap-web-input').click(); });
    $('dm-nap-web-input').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files);
      e.target.value = '';
      if (files.length) napSoMaChuan(files);
    });
  });

  // Danh mục vừa thay đổi → lịch sử cũ không còn mới, tải lại khi mở tab
  DM.nghe(function (loai) { if (loai === 'catalog') { lichSu = null; loiLs = ''; } });

  root.ManDanhMuc = { ve: ve };
})(typeof self !== 'undefined' ? self : this);
