/* Hộp "🏷️ Sửa / bổ sung barcode" cho 1 dòng (bảng nhà, Chưa rõ nhà, Đã bỏ qua, thành phần combo).
 * - SKU trống / SKU chữ → lưu ánh xạ khóa dòng → barcode (nguồn tay)
 * - Barcode sai → lưu mã phụ barcode sai → barcode đúng
 * - Thành phần combo chưa có SKU → điền barcode vào thành phần
 * Lưu bằng action ganBarcode (Code.gs) – ghi LICH_SU, hoàn tác được. */
(function (root) {
  'use strict';
  var PL = root.PhanLoai, DM = root.DanhMuc, A = root.App;
  var $ = function (id) { return document.getElementById(id); };
  var dang = null; // { items, thanhPhan, maHienTai, nhaGoiY, tenGoiY }

  function chuanTim(s) { return A.boDau(s).replace(/[^a-z0-9]+/g, ' ').trim(); }

  /* Nguồn gợi ý: sổ mã chuẩn web + sách có barcode trong danh mục (không tính mã phụ) */
  function nguonGoiY() {
    var ds = [], co = {};
    (DM.catalog.ma_chuan || []).forEach(function (x) {
      co[x.barcode] = ds.length;
      ds.push({ ma: x.barcode, ten: x.ten_gon, nha: x.nha, nguon: '🌐 web', gia: x.gia_bia });
    });
    DM.catalog.skus.forEach(function (e) {
      var ma = PL.clean(e.sku).toUpperCase();
      if (!PL.isBarcode(ma) || e.ma_moi) return;
      var ten = e.ten_sach || PL.tenTam(e.ten, e.phan_loai, DM.caiDat.maKhac, DM.caiDat.plVoNghia);
      if (ma in co) { var x = ds[co[ma]]; x.nha = x.nha || e.nha; if (e.ten_sach) x.ten = e.ten_sach; return; }
      co[ma] = ds.length;
      ds.push({ ma: ma, ten: ten, nha: e.nha, nguon: '📚 danh mục', gia: e.gia_gan_nhat });
    });
    return ds;
  }
  function veGoiY() {
    var q = chuanTim($('bc-tim').value), ul = $('bc-goi-y');
    if (!q) { ul.innerHTML = ''; return; }
    var tu = q.split(' ');
    var ds = nguonGoiY().filter(function (x) {
      var h = ' ' + chuanTim(x.ma + ' ' + x.ten) + ' ';
      return tu.every(function (w) { return h.indexOf(w) >= 0; });
    }).slice(0, 8);
    ul.innerHTML = ds.length ? ds.map(function (x) {
      return '<li><button type="button" data-ma="' + A.esc(x.ma) + '"><b>' + A.esc(x.ma) + '</b> ' + A.esc(x.ten) +
        ' <small>' + (x.nha ? A.esc(x.nha) + ' · ' : '') + x.nguon + (x.gia ? ' · ' + A.so(x.gia) + 'đ' : '') + '</small></button></li>';
    }).join('') : '<li class="muted">Không thấy cuốn nào khớp – gõ thẳng barcode vào ô bên dưới.</li>';
  }

  function trongDanhMuc(ma) { return DM.catalog.skus.filter(function (e) { return e.key === PL.skuKey(ma); })[0] || null; }
  function trongSoWeb(ma) { return (DM.catalog.ma_chuan || []).filter(function (x) { return x.barcode === ma; })[0] || null; }

  /* Kiểm tra ô barcode: dạng mã vạch, số kiểm tra EAN-13, đã có trong danh mục chưa */
  function kiemTra() {
    var ma = PL.clean($('bc-ma').value).replace(/\s+/g, '').toUpperCase();
    var cb = $('bc-canh-bao'), info = $('bc-info');
    cb.hidden = true; $('bc-van-luu-o').hidden = true; $('bc-moi').hidden = true; info.textContent = '';
    if (!ma) return { ma: '' };
    if (!PL.isBarcode(ma)) { cb.textContent = '⚠ Barcode phải gồm toàn chữ số, ít nhất 7 số.'; cb.hidden = false; return { ma: ma, loi: true }; }
    var saiSo = /^\d{13}$/.test(ma) && !PL.ean13HopLe(ma);
    if (saiSo) {
      cb.textContent = '⚠ Mã 13 số này SAI số kiểm tra (số cuối) – có thể gõ nhầm. Kiểm tra lại trên bìa sách.';
      cb.hidden = false; $('bc-van-luu-o').hidden = false;
    }
    if (ma === dang.maHienTai) { info.textContent = 'Đây đúng là barcode hiện tại.'; return { ma: ma, loi: true }; }
    var e = trongDanhMuc(ma), w = trongSoWeb(ma);
    if (e && !e.ma_moi) {
      info.innerHTML = '✅ Đã có trong danh mục: <b>' + A.esc(PL.TEN_NHA[e.nha] || (e.nha === PL.KHONG_NHAP ? 'Không nhập' : e.nha || '?')) + '</b> · ' +
        A.esc(e.ten_sach || PL.tenGon(e.ten, DM.caiDat.maKhac)) + ' – dùng luôn nhà và tên đã khai báo.';
    } else {
      info.textContent = e && e.ma_moi ? 'Barcode này đang là mã phụ của ' + e.ma_moi + ' – sẽ tính theo ' + e.ma_moi + '.'
        : 'Barcode mới chưa có trong danh mục' + (w ? ' (có trong sổ mã chuẩn web)' : '') + ' – chọn nhà và tên sách:';
      if (!(e && e.ma_moi)) {
        $('bc-moi').hidden = false;
        var nha = w && w.nha ? w.nha : dang.nhaGoiY;
        $('bc-nha').value = ['HA', 'KV', 'ML', PL.KHONG_NHAP].indexOf(nha) >= 0 ? nha : 'HA';
        if (!$('bc-ten').dataset.daSua) $('bc-ten').value = (w && w.ten_gon) || dang.tenGoiY || '';
      }
    }
    return { ma: ma, saiSo: saiSo, moi: !e, e: e };
  }

  /* opt: { moTa, maHienTai, maQuyVe?, items: [{key, sku, ten, phan_loai}], thanhPhan?: {combo_ids, ten}, nhaGoiY, tenGoiY } */
  function mo(opt) {
    if (!DM.coTheGhi()) { A.toast('Dán URL Apps Script ở màn Cài đặt trước nha.', 'loi'); return; }
    dang = opt;
    $('bc-goc').innerHTML = opt.moTa;
    $('bc-hien').innerHTML = 'Barcode hiện tại: ' + (opt.maHienTai ? '<b class="sku">' + A.esc(opt.maHienTai) + '</b>' : '<span class="sku-la sku-trong">trống</span>') +
      (opt.maQuyVe ? ' → đang quy về <b>' + A.esc(opt.maQuyVe) + '</b>' : '') +
      (opt.maHienTai && /^\d{13}$/.test(opt.maHienTai) && !PL.ean13HopLe(opt.maHienTai) ? ' <span class="nho nho-warn">sai số kiểm tra</span>' : '');
    $('bc-tim').value = opt.tenGoiY || '';
    $('bc-ma').value = '';
    $('bc-ten').value = ''; delete $('bc-ten').dataset.daSua;
    $('bc-van-luu').checked = false;
    $('bc-loi').textContent = '';
    kiemTra();
    veGoiY();
    $('dlg-barcode').showModal();
    $('bc-ma').focus();
  }

  function luu(ghiDe) {
    var k = kiemTra();
    $('bc-loi').textContent = '';
    if (!k.ma) { $('bc-loi').textContent = 'Nhập barcode đúng (hoặc chọn từ gợi ý).'; return; }
    if (k.loi) { $('bc-loi').textContent = $('bc-canh-bao').hidden ? 'Barcode chưa đổi.' : $('bc-canh-bao').textContent; return; }
    if (k.saiSo && !$('bc-van-luu').checked) { $('bc-loi').textContent = 'Mã sai số kiểm tra – tick “Tôi đã kiểm tra, vẫn lưu mã này” nếu chắc chắn.'; return; }
    var data = { items: dang.items, ma_moi: k.ma, ghi_de: !!ghiDe };
    if (dang.thanhPhan) data.thanh_phan = dang.thanhPhan;
    if (!$('bc-moi').hidden) {
      data.nha = $('bc-nha').value;
      data.ten_sach = PL.clean($('bc-ten').value);
      if (!data.ten_sach) { $('bc-loi').textContent = 'Nhập tên sách cho barcode mới.'; return; }
    }
    var btn = $('bc-luu');
    btn.disabled = true;
    DM.goi('ganBarcode', data)
      .then(function () {
        $('dlg-barcode').close();
        A.toast('🏷️ Đã lưu barcode ' + k.ma + ' – các dòng giống vậy sẽ tự quy về mã này. Dòng đã vào “Listing cần sửa barcode”.', 'ok');
      })
      .catch(function (e) {
        var m = /CAN_XAC_NHAN:\s*(.*)$/.exec(e.message);
        if (m && !ghiDe) {
          A.hoi(m[1], 'Ghi đè', { tieuDe: 'Dòng này đã gán barcode bằng tay' }).then(function (ok) { if (ok) luu(true); });
          return;
        }
        $('bc-loi').textContent = 'Không lưu được: ' + e.message;
      })
      .then(function () { btn.disabled = false; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('bc-tim').addEventListener('input', veGoiY);
    $('bc-ma').addEventListener('input', kiemTra);
    $('bc-ten').addEventListener('input', function () { $('bc-ten').dataset.daSua = '1'; });
    $('bc-goi-y').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ma]');
      if (!b) return;
      $('bc-ma').value = b.dataset.ma;
      kiemTra();
      $('bc-ma').focus();
    });
    $('bc-luu').addEventListener('click', function () { luu(false); });
    $('bc-ma').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); luu(false); } });
  });

  root.SuaBarcode = { mo: mo, chuanTim: chuanTim };
})(typeof self !== 'undefined' ? self : this);
