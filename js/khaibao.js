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

  function veDatalist() {
    var seen = {}, opts = [];
    function them(sku, ten) {
      sku = PL.clean(sku);
      if (!PL.isBarcode(sku) || seen[sku]) return;
      seen[sku] = 1;
      opts.push('<option value="' + A.esc(sku) + '">' + A.esc(ten) + '</option>');
    }
    A.rows().forEach(function (r) { if (!PL.comboReason(r)) them(r.sku, r.ten); });
    DM.catalog.skus.forEach(function (e) { them(e.sku, e.ten); });
    $('ds-sku').innerHTML = opts.slice(0, 3000).join('');
  }

  function dongTp(tp) {
    tp = tp || {};
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input class="input tp-sku" list="ds-sku" placeholder="Mã vạch" aria-label="SKU" value="' + A.esc(tp.sku || '') + '"></td>' +
      '<td><input class="input tp-ten" placeholder="Tên sách" aria-label="Tên sách" value="' + A.esc(tp.ten || '') + '"></td>' +
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

  function moHop(opt) {
    dang = opt;
    $('dlg-combo-title').textContent = opt.combo_id ? 'Sửa combo' : 'Khai báo thành phần combo';
    $('cb-goc').innerHTML = opt.mota || '';
    $('cb-goc').hidden = !opt.mota;
    $('cb-ten').value = opt.ten_combo || '';
    $('cb-loi').textContent = '';
    $('cb-tp').innerHTML = '';
    veKhoa();
    veDatalist();
    (opt.thanh_phan && opt.thanh_phan.length ? opt.thanh_phan : [{}]).forEach(dongTp);
    $('dlg-combo').showModal();
    var first = $('cb-tp').querySelector('.tp-sku');
    if (first && !opt.combo_id) first.focus();
  }

  function moTaNhom(g) {
    return '<b>' + A.esc(g.ten) + '</b><br>Phân loại: ' + A.esc(g.phanLoai || '—') + ' · SKU: ' + A.esc(g.sku || '(trống)') +
      ' · Giá gốc: ' + A.so(g.gia) + ' · ' + A.so(g.sl) + ' combo hôm nay';
  }

  /* Mở form khai báo từ 1 dòng combo chưa khai báo */
  function moKhaiBao(g) {
    var nha = PL.NHA.indexOf(g.nha) >= 0 ? g.nha : 'HA';
    moHop({ khoa: [g.key], ten_combo: g.ten, nhaGoiY: nha, mota: moTaNhom(g), nhom: g });
  }

  /* Mở form sửa combo đã có (màn Danh mục) */
  function moSua(c) {
    moHop({ combo_id: c.combo_id, khoa: c.khoa.slice(), ten_combo: c.ten_combo, thanh_phan: c.thanh_phan, nhaGoiY: 'HA' });
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
      if (!tp.sku && !tp.ten) return; // dòng trống
      if (!tp.ten) loi = loi || 'Cuốn thứ ' + (i + 1) + ' chưa có tên sách.';
      tps.push(tp);
    });
    if (!tps.length) loi = loi || 'Thêm ít nhất 1 cuốn nha.';
    var ten = PL.clean($('cb-ten').value);
    if (!ten) loi = loi || 'Chưa có tên combo.';
    return { loi: loi, data: { combo_id: dang.combo_id || '', ten_combo: ten, khoa: dang.khoa, thanh_phan: tps } };
  }

  function luu() {
    var f = docForm();
    if (f.loi) { $('cb-loi').textContent = f.loi; return; }
    var btn = $('cb-luu');
    btn.disabled = true;
    $('cb-loi').textContent = '';
    DM.goi('upsertCombo', f.data)
      .then(function () {
        $('dlg-combo').close();
        A.toast('🎁 Đã lưu combo "' + f.data.ten_combo.slice(0, 50) + '"', 'ok');
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
    $('cs-list').innerHTML = ds.length ? ds.slice(0, 200).map(function (c) {
      return '<li><button type="button" class="cs-item" data-cid="' + A.esc(c.combo_id) + '">🎁 ' + A.esc(c.ten_combo) +
        '<small>' + c.thanh_phan.map(function (t) { return t.so_luong + '× ' + A.esc(t.ten) + ' (' + t.nha + ')'; }).join(' · ') + '</small></button></li>';
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

  root.KhaiBao = { moKhaiBao: moKhaiBao, moCoSan: moCoSan, moSua: moSua, goiY: goiY };
})(typeof self !== 'undefined' ? self : this);
