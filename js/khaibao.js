/* Hộp thoại khai báo combo: "Khai báo thành phần" và "Đây là combo đã có". Dùng chung cho màn Danh mục (sửa combo). */
(function (root) {
  'use strict';
  var PL = root.PhanLoai, DM = root.DanhMuc, A = root.App;
  var $ = function (id) { return document.getElementById(id); };
  var NHA_TP = ['HA', 'KV', 'ML', 'KHAC'];

  var dang = null; // { combo_id?, khoa: [], nhaGoiY, nhom? }

  /* Gợi ý thông tin 1 SKU: từ danh mục SKU và từ file hôm nay (ưu tiên tên TikTok) */
  function goiY(sku) {
    sku = PL.clean(sku);
    if (!sku) return null;
    var out = { ten: '', nha: '', gia: 0 };
    var k = PL.skuKey(sku);
    var e = DM.catalog.skus.filter(function (x) { return x.key === k; })[0];
    if (e) { out.ten = e.ten; if (PL.NHA.indexOf(e.nha) >= 0) out.nha = e.nha; }
    // Chỉ lấy dòng sách lẻ (giá dòng combo là giá cả bộ, không phải giá 1 cuốn)
    var rows = A.rows().filter(function (r) { return !PL.comboReason(r) && PL.clean(r.sku).toUpperCase() === sku.toUpperCase(); });
    rows.sort(function (a, b) { return (a.san === 'TikTok' ? 0 : 1) - (b.san === 'TikTok' ? 0 : 1); });
    if (rows[0]) {
      if (!out.ten || rows[0].san === 'TikTok') out.ten = rows[0].ten;
      out.gia = rows[0].gia;
      if (!out.nha) {
        var codes = PL.findCodes(rows[0].ten + ' ' + rows[0].phanLoai, PL.RE_NHA);
        if (codes.length === 1) out.nha = codes[0];
      }
    }
    // Thành phần của combo khác có cùng SKU
    if (!out.ten || !out.gia) DM.catalog.combos.some(function (c) {
      return c.thanh_phan.some(function (t) {
        if (PL.clean(t.sku).toUpperCase() !== sku.toUpperCase()) return false;
        out.ten = out.ten || t.ten; out.gia = out.gia || t.gia_goc; out.nha = out.nha || t.nha;
        return true;
      });
    });
    return out.ten || out.gia || out.nha ? out : null;
  }

  /* Gợi ý khi gõ: theo SKU (mã vạch) hoặc theo TÊN (tên khai báo / tên sàn + phân loại) */
  var skuTheoTen = {};
  function veDatalist() {
    var seen = {}, opts = [], optTen = [];
    skuTheoTen = {};
    function them(sku, ten) {
      sku = PL.clean(sku).toUpperCase();
      if (!PL.isBarcode(sku) || seen[sku]) return;
      seen[sku] = 1;
      opts.push('<option value="' + A.esc(sku) + '">' + A.esc(ten) + '</option>');
      if (ten && !skuTheoTen[ten]) { skuTheoTen[ten] = sku; optTen.push('<option value="' + A.esc(ten) + '">' + A.esc(sku) + '</option>'); }
    }
    DM.catalog.skus.forEach(function (e) { if (e.ten_sach) them(e.sku, e.ten_sach); });
    A.rows().forEach(function (r) { if (!PL.comboReason(r)) them(r.sku, PL.tenTam(r.ten, r.phanLoai, DM.caiDat.maKhac, DM.caiDat.plVoNghia)); });
    DM.catalog.skus.forEach(function (e) { them(e.sku, PL.tenTam(e.ten, e.phan_loai, DM.caiDat.maKhac, DM.caiDat.plVoNghia)); });
    $('ds-sku').innerHTML = opts.slice(0, 3000).join('');
    $('ds-ten').innerHTML = optTen.slice(0, 3000).join('');
  }

  function dongTp(tp) {
    tp = tp || {};
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="tp-chon-o"><input type="checkbox" class="tp-chon" aria-label="Lấy cuốn này"' + (tp.chon === false ? '' : ' checked') + '></td>' +
      '<td><input class="input tp-sku" list="ds-sku" placeholder="Mã vạch" aria-label="SKU" value="' + A.esc(tp.sku || '') + '"></td>' +
      '<td><input class="input tp-ten" list="ds-ten" placeholder="Gõ tên sách…" aria-label="Tên sách" value="' + A.esc(tp.ten || '') + '"></td>' +
      '<td><select class="input tp-nha" aria-label="Nhà">' + NHA_TP.map(function (n) {
        return '<option value="' + n + '"' + ((tp.nha || dang.nhaGoiY) === n ? ' selected' : '') + '>' + (n === 'KHAC' ? 'Khác' : n) + '</option>';
      }).join('') + '</select></td>' +
      '<td><input class="input tp-gia" type="number" min="0" step="1000" aria-label="Giá gốc" value="' + (tp.gia_goc || '') + '"></td>' +
      '<td><input class="input tp-sl" type="number" min="1" step="1" aria-label="Số lượng mỗi combo" value="' + (tp.so_luong || 1) + '"></td>' +
      '<td><button type="button" class="btn btn-icon btn-ghost tp-xoa" aria-label="Xóa cuốn này">🗑</button></td>';
    $('cb-tp').appendChild(tr);
    return tr;
  }

  function veKhoa() {
    $('cb-khoa').innerHTML = dang.khoa.map(function (k, i) {
      return '<span class="khoa-chip">' + A.esc(k) + (dang.khoa.length > 1
        ? ' <button type="button" data-xoa-khoa="' + i + '" aria-label="Bỏ khóa này">×</button>' : '') + '</span>';
    }).join('') || '<span class="muted">(chưa có)</span>';
  }

  function cachDangChon() { return document.querySelector('input[name="cb-cach"]:checked').value; }
  function doiCach() {
    var nguyen = cachDangChon() === 'nguyen';
    $('cb-khoi-nguyen').hidden = !nguyen;
    $('cb-khoi-tach').hidden = nguyen;
    if (!dang.combo_id) $('dlg-combo-title').textContent = nguyen ? '📦 Xuất nguyên combo' : 'Khai báo thành phần combo';
  }

  function moHop(opt) {
    dang = opt;
    $('dlg-combo-title').textContent = opt.combo_id ? 'Sửa combo' : 'Khai báo thành phần combo';
    var cach = opt.cach_xuat === 'nguyen' && !opt.tronNha ? 'nguyen' : 'tach';
    document.querySelector('input[name="cb-cach"][value="' + cach + '"]').checked = true;
    // Combo trộn nhà khác (MEGA, TN…) không được xuất nguyên
    $('cb-nguyen').disabled = !!opt.tronNha;
    $('cb-nguyen-nhan').classList.toggle('is-khoa', !!opt.tronNha);
    $('cb-cach-ghichu').textContent = opt.tronNha
      ? '⚠ Combo này có sách của nhà khác (' + (opt.maTron || 'MEGA, TN…') + ') nên không xuất nguyên được – hãy tách để chỉ lấy phần HA/KV/ML.'
      : 'Xuất nguyên: dùng cho sách mà hệ thống lên đơn chỉ có dạng combo, không có từng cuốn lẻ.';
    $('cb-nha').value = PL.NHA.indexOf(opt.nha) >= 0 ? opt.nha : (PL.NHA.indexOf(opt.nhaGoiY) >= 0 ? opt.nhaGoiY : 'HA');
    $('cb-maht').value = opt.ma_he_thong || '';
    $('cb-tenxuat').value = opt.ten_xuat || '';
    $('cb-tenxuat').placeholder = 'Để trống = ' + PL.tenGon(opt.tenGoc || opt.ten_combo || '', DM.caiDat.maKhac);
    doiCach();
    $('cb-goc').innerHTML = opt.mota || '';
    $('cb-goc').hidden = !opt.mota;
    $('cb-ten').value = opt.ten_combo || '';
    $('cb-loi').textContent = '';
    $('cb-tp').innerHTML = '';
    veKhoa();
    veDatalist();
    (opt.thanh_phan && opt.thanh_phan.length ? opt.thanh_phan : [{}]).forEach(dongTp);
    $('dlg-combo').showModal();
    var first = cach === 'nguyen' ? $('cb-maht') : $('cb-tp').querySelector('.tp-sku');
    if (first && !opt.combo_id) first.focus();
    if (opt.thongBao) $('cb-loi').textContent = opt.thongBao;
  }

  function maTron(g) {
    var ma = [];
    (g.lines || []).forEach(function (ln) {
      PL.findCodes(ln.row.ten + ' ' + ln.row.phanLoai, PL.codeRegex(DM.caiDat.maKhac || PL.MA_KHAC_MAC_DINH))
        .forEach(function (m) { if (ma.indexOf(m) < 0) ma.push(m); });
    });
    return ma.join(', ');
  }

  function moTaNhom(g) {
    return '<b>' + A.esc(g.ten) + '</b><br>Phân loại: ' + A.esc(g.phanLoai || '—') + ' · SKU: ' + A.esc(g.sku || '(trống)') +
      ' · Giá gốc: ' + A.so(g.gia) + ' · ' + A.so(g.sl) + ' combo hôm nay';
  }

  /* Mở form khai báo từ 1 dòng combo chưa khai báo */
  function moKhaiBao(g, cach) {
    var nha = PL.NHA.indexOf(g.nha) >= 0 ? g.nha : 'HA';
    // Gợi ý thành phần: các phân loại khác cùng sản phẩm có barcode (nghi combo theo giá: đúng các phân loại cộng ra giá)
    var tp = (g.goiYTp || []).map(function (x) {
      var gy = goiY(x.sku) || {}, e = DM.catalog.skus.filter(function (s) { return s.key === PL.skuKey(x.sku); })[0];
      return { sku: x.sku, ten: (e && e.ten_sach) || x.ten || gy.ten, nha: gy.nha || nha, gia_goc: x.gia || gy.gia, so_luong: 1 };
    });
    moHop({ khoa: g.khoaCombo || [g.key], ten_combo: g.ten + ((g.khoaCombo || g.nghiCombo) && g.phanLoai ? ' – ' + g.phanLoai : ''), tenGoc: g.ten, nhaGoiY: nha, mota: moTaNhom(g), nhom: g,
            cach_xuat: cach || 'tach', tronNha: !!g.tronNha, maTron: maTron(g), thanh_phan: tp });
  }

  /* Combo đã lưu có thành phần nhà khác → coi là trộn nhà */
  function comboTron(c) { return c.thanh_phan.some(function (t) { return t.nha === 'KHAC'; }); }

  /* Mở form sửa combo đã có (màn Danh mục). cachMoi: ép chọn sẵn cách xuất (khi đổi qua lại) */
  function moSua(c, cachMoi, thongBao) {
    var nhaTp = c.thanh_phan.map(function (t) { return t.nha; }).filter(function (n) { return PL.NHA.indexOf(n) >= 0; })[0];
    moHop({ combo_id: c.combo_id, khoa: c.khoa.slice(), ten_combo: c.ten_combo, thanh_phan: c.thanh_phan,
            nhaGoiY: nhaTp || 'HA', nha: c.nha, ma_he_thong: c.ma_he_thong, ten_xuat: c.ten_xuat,
            cach_xuat: cachMoi || c.cach_xuat, tronNha: comboTron(c), thongBao: thongBao });
  }

  function docForm() {
    var tps = [], loi = '';
    Array.prototype.forEach.call($('cb-tp').children, function (tr, i) {
      var tp = {
        sku: PL.clean(tr.querySelector('.tp-sku').value),
        ten: PL.clean(tr.querySelector('.tp-ten').value),
        nha: tr.querySelector('.tp-nha').value,
        gia_goc: Number(tr.querySelector('.tp-gia').value) || 0,
        so_luong: Math.max(1, Math.round(Number(tr.querySelector('.tp-sl').value) || 1))
      };
      if (!tr.querySelector('.tp-chon').checked) return; // bỏ tick = không lấy
      if (!tp.sku && !tp.ten) return; // dòng trống
      if (!tp.ten) loi = loi || 'Cuốn thứ ' + (i + 1) + ' chưa có tên sách.';
      tps.push(tp);
    });
    var cach = cachDangChon();
    if (cach === 'tach') {
      if (!tps.length) loi = loi || 'Thêm ít nhất 1 cuốn nha.';
    } else {
      loi = ''; // xuất nguyên: thành phần không bắt buộc (dòng thiếu tên bỏ qua)
      tps = tps.filter(function (t) { return t.ten; });
    }
    var ten = PL.clean($('cb-ten').value);
    if (!ten) loi = loi || 'Chưa có tên combo.';
    return { loi: loi, data: { combo_id: dang.combo_id || '', ten_combo: ten, khoa: dang.khoa, thanh_phan: tps, cach_xuat: cach,
      nha: cach === 'nguyen' ? $('cb-nha').value : '', ma_he_thong: PL.clean($('cb-maht').value), ten_xuat: PL.clean($('cb-tenxuat').value) } };
  }

  /* Combo đã có cùng thành phần (cùng SKU + số lượng) → trả về combo đó */
  function comboTrung(data) {
    if (data.cach_xuat !== 'tach' || !data.thanh_phan.length || data.thanh_phan.some(function (t) { return !PL.clean(t.sku); })) return null;
    var dau = function (tps) { return tps.map(function (t) { return PL.clean(t.sku).toUpperCase() + '×' + (Number(t.so_luong) || 1); }).sort().join(','); };
    var d = dau(data.thanh_phan);
    return DM.catalog.combos.filter(function (c) { return c.combo_id !== data.combo_id && c.cach_xuat !== 'nguyen' && dau(c.thanh_phan) === d; })[0] || null;
  }

  function luu() {
    var f = docForm();
    if (f.loi) { $('cb-loi').textContent = f.loi; return; }
    var trung = !f.data.combo_id && !dang.boQuaTrung && comboTrung(f.data);
    if (trung) {
      A.hoi('Đã có combo cùng thành phần: "' + trung.ten_combo + '".\n\nGắn dòng này vào combo đó (khuyên dùng – tránh 2 combo trùng nhau)?',
        '🔗 Gắn vào combo cũ', { huy: 'Không, để tôi xem lại', nhe: true, tieuDe: 'Combo trùng' }).then(function (ok) {
        if (!ok) {
          dang.boQuaTrung = true;
          $('cb-loi').textContent = 'Muốn tạo combo mới riêng thì bấm “Lưu combo” lần nữa.';
          return;
        }
        f.data.khoa.reduce(function (p, k) { return p.then(function () { return DM.goi('addComboKey', { combo_id: trung.combo_id, khoa: k }); }); }, Promise.resolve())
          .then(function () { $('dlg-combo').close(); A.toast('🔗 Đã gắn vào combo "' + trung.ten_combo.slice(0, 50) + '"', 'ok'); })
          .catch(function (e) { $('cb-loi').textContent = 'Không lưu được: ' + e.message; });
      });
      return;
    }
    var btn = $('cb-luu');
    btn.disabled = true;
    $('cb-loi').textContent = '';
    DM.goi('upsertCombo', f.data)
      .then(function () {
        $('dlg-combo').close();
        A.toast((f.data.cach_xuat === 'nguyen' ? '📦 Đã lưu (xuất nguyên combo): "' : '🎁 Đã lưu combo "') + f.data.ten_combo.slice(0, 50) + '"', 'ok');
      })
      .catch(function (e) { $('cb-loi').textContent = 'Không lưu được: ' + e.message; })
      .then(function () { btn.disabled = false; });
  }

  /* ---------- "Đây là combo đã có" ---------- */
  var nhomCoSan = null;
  function moCoSan(g) {
    nhomCoSan = g;
    $('cs-goc').innerHTML = 'Gắn dòng <b>' + A.esc(g.ten) + '</b> (' + A.esc(g.phanLoai || '—') + ') vào combo đã khai báo.';
    $('cs-tim').value = '';
    veCoSan();
    $('dlg-coSan').showModal();
    $('cs-tim').focus();
  }
  function veCoSan() {
    var q = A.boDau($('cs-tim').value);
    var ds = DM.catalog.combos.filter(function (c) {
      return !q || A.boDau(c.ten_combo + ' ' + c.khoa.join(' ') + ' ' + c.thanh_phan.map(function (t) { return t.ten + ' ' + t.sku; }).join(' ')).indexOf(q) >= 0;
    });
    var tron = nhomCoSan && nhomCoSan.tronNha;
    $('cs-list').innerHTML = ds.length ? ds.slice(0, 200).map(function (c) {
      var nguyen = c.cach_xuat === 'nguyen', khoa = tron && nguyen;
      return '<li><button type="button" class="cs-item" data-cid="' + A.esc(c.combo_id) + '"' +
        (khoa ? ' disabled title="Dòng này trộn nhà khác nên không gắn vào combo xuất nguyên được"' : '') + '>' +
        (nguyen ? '📦 ' : '🎁 ') + A.esc(c.ten_combo) +
        ' <span class="badge-cach badge-' + (nguyen ? 'nguyen' : 'tach') + '">' + (nguyen ? 'Nguyên combo · ' + A.esc(c.nha) : 'Tách') + '</span>' +
        '<small>' + (c.thanh_phan.length ? c.thanh_phan.map(function (t) { return t.so_luong + '× ' + A.esc(t.ten) + ' (' + t.nha + ')'; }).join(' · ')
          : 'Không khai báo thành phần') + '</small></button></li>';
    }).join('') : '<li class="muted">Chưa có combo nào' + (q ? ' khớp' : '') + '. Hãy dùng “Khai báo thành phần”.</li>';
  }
  function ganCoSan(cid) {
    var c = DM.catalog.combos.filter(function (x) { return x.combo_id === cid; })[0];
    if (!c || !nhomCoSan) return;
    DM.goi('addComboKey', { combo_id: cid, khoa: nhomCoSan.key })
      .then(function () {
        $('dlg-coSan').close();
        A.toast('🔗 Đã gắn vào combo "' + c.ten_combo.slice(0, 50) + '"', 'ok');
      })
      .catch(function (e) { A.toast('Không lưu được: ' + e.message, 'loi'); });
  }

  /* ---------- Sự kiện ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('input[name="cb-cach"]').forEach(function (r) { r.addEventListener('change', doiCach); });
    $('cb-them').addEventListener('click', function () { dongTp({}).querySelector('.tp-sku').focus(); });
    $('cb-luu').addEventListener('click', luu);
    $('cb-tp').addEventListener('click', function (e) {
      var b = e.target.closest('.tp-xoa');
      if (b) b.closest('tr').remove();
    });
    $('cb-khoa').addEventListener('click', function (e) {
      var b = e.target.closest('[data-xoa-khoa]');
      if (!b) return;
      dang.khoa.splice(+b.dataset.xoaKhoa, 1);
      veKhoa();
    });
    // Gõ SKU → tự điền tên / nhà / giá nếu biết
    $('cb-tp').addEventListener('change', function (e) {
      // Gõ / chọn TÊN có trong gợi ý → điền SKU rồi điền tiếp nhà / giá
      if (e.target.classList.contains('tp-ten')) {
        var trT = e.target.closest('tr'), ma = skuTheoTen[PL.clean(e.target.value)], oSku = trT.querySelector('.tp-sku');
        if (!ma || oSku.value) return;
        oSku.value = ma;
        oSku.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      if (!e.target.classList.contains('tp-sku')) return;
      var tr = e.target.closest('tr'), g = goiY(e.target.value);
      if (!g) return;
      var ten = tr.querySelector('.tp-ten'), gia = tr.querySelector('.tp-gia');
      if (!ten.value && g.ten) ten.value = g.ten;
      if (!gia.value && g.gia) gia.value = g.gia;
      if (g.nha) tr.querySelector('.tp-nha').value = g.nha;
    });
    $('cs-tim').addEventListener('input', veCoSan);
    $('cs-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cid]');
      if (b) ganCoSan(b.dataset.cid);
    });
  });

  root.KhaiBao = { moKhaiBao: moKhaiBao, moCoSan: moCoSan, moSua: moSua, goiY: goiY, comboTron: comboTron };
})(typeof self !== 'undefined' ? self : this);
