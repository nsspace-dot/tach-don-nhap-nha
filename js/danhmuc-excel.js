/* Xuất / nạp danh mục bằng file Excel (3 sheet giống Google Sheets) + tạo file mẫu. */
(function (root, factory) {
  var api = factory(root.PhanLoai || (typeof require === 'function' ? require('./phanloai.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DanhMucExcel = api;
})(typeof self !== 'undefined' ? self : this, function (PL) {
  'use strict';

  var COT_SKU = ['key', 'sku', 'ten', 'phan_loai', 'nha', 'nguon', 'cap_nhat'];
  var COT_COMBO = ['combo_id', 'ten_combo', 'khoa', 'cap_nhat', 'cach_xuat', 'ma_he_thong', 'ten_xuat', 'nha'];
  var COT_TP = ['combo_id', 'sku', 'ten', 'nha', 'gia_goc', 'so_luong'];
  var NHA_SKU = ['HA', 'KV', 'ML', PL.KHONG_NHAP];
  var NHA_TP = ['HA', 'KV', 'ML', 'KHAC'];

  function sheet(XLSX, cot, rows, rong) {
    var ws = XLSX.utils.aoa_to_sheet([cot].concat(rows.map(function (r) { return cot.map(function (c) { return r[c] === undefined ? '' : r[c]; }); })));
    ws['!cols'] = (rong || []).map(function (w) { return { wch: w }; });
    return ws;
  }

  function xuat(catalog, XLSX) {
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet(XLSX, COT_SKU, catalog.skus, [30, 16, 60, 16, 10, 8, 20]), 'SKU_NHA');
    XLSX.utils.book_append_sheet(wb, sheet(XLSX, COT_COMBO, catalog.combos.map(function (c) {
      return { combo_id: c.combo_id, ten_combo: c.ten_combo, khoa: c.khoa.join(' ;; '), cap_nhat: c.cap_nhat,
               cach_xuat: c.cach_xuat || 'tach', ma_he_thong: c.ma_he_thong || '', ten_xuat: c.ten_xuat || '', nha: c.nha || '' };
    }), [14, 60, 60, 20, 10, 16, 50, 6]), 'COMBO');
    var tp = [];
    catalog.combos.forEach(function (c) {
      c.thanh_phan.forEach(function (t) { tp.push(Object.assign({ combo_id: c.combo_id }, t)); });
    });
    XLSX.utils.book_append_sheet(wb, sheet(XLSX, COT_TP, tp, [14, 16, 60, 8, 10, 10]), 'COMBO_THANH_PHAN');
    return wb;
  }

  function mau(XLSX) {
    var wb = XLSX.utils.book_new();
    var hd = [
      ['HƯỚNG DẪN NẠP DANH MỤC TỪ EXCEL'],
      [''],
      ['1. Sheet SKU_NHA: mỗi dòng 1 cuốn sách lẻ. Cột nha = HA / KV / ML / KHONG_NHAP.'],
      ['   - Sách có mã vạch: chỉ cần điền sku + ten + nha (để trống cột key).'],
      ['   - Sách không có mã vạch: điền ten + phan_loai ĐÚNG như trên sàn, để trống sku.'],
      ['2. Sheet COMBO: mỗi dòng 1 combo. combo_id tự đặt (ví dụ C001), không trùng nhau.'],
      ['   - Cột khoa: SKU của combo trên các sàn, cách nhau bằng " ;; " (ví dụ: 55252 ;; 8935092825724|COMBO.HA).'],
      ['   - Combo có SKU là MÃ VẠCH (mã của 1 cuốn lẻ): ghi <mã vạch>|<phân loại> (ví dụ 8935092825724|COMBO.HA).'],
      ['   - Combo không có SKU: ghi ten:<tên sản phẩm>|<phân loại> (chữ thường).'],
      ['   - Cột cach_xuat: tach = tách thành từng cuốn (mặc định) ; nguyen = xuất nguyên combo thành 1 dòng.'],
      ['   - Combo "nguyen": cần cột nha (HA / KV / ML), không cần thành phần. ma_he_thong = mã combo trên website lên đơn'],
      ['     (để trống = dùng SKU của sàn). ten_xuat = tên in ra file (để trống = tên combo đã làm gọn).'],
      ['3. Sheet COMBO_THANH_PHAN: mỗi dòng 1 cuốn trong combo, combo_id phải khớp sheet COMBO.'],
      ['   - nha = HA / KV / ML / KHAC (KHAC = sách nhà khác, sẽ không nhập).'],
      ['   - so_luong = số cuốn đó trong 1 combo (thường là 1).'],
      ['4. Dòng mẫu bên dưới chỉ để tham khảo – xóa hoặc sửa trước khi nạp.'],
      ['5. Nạp trùng SKU / combo_id đã có thì sẽ GHI ĐÈ dòng cũ.']
    ];
    var wsHd = XLSX.utils.aoa_to_sheet(hd);
    wsHd['!cols'] = [{ wch: 110 }];
    XLSX.utils.book_append_sheet(wb, wsHd, 'HUONG_DAN');
    XLSX.utils.book_append_sheet(wb, sheet(XLSX, ['key', 'sku', 'ten', 'phan_loai', 'nha'], [
      { sku: '8935092845425', ten: 'Sách - Hướng Dẫn Giải VIOLYMPIC Toán 1', nha: 'HA' },
      { sku: '8935092543000', ten: 'Sách - Bồi Dưỡng Học Sinh Giỏi Lịch Sử 9', nha: 'KV' },
      { sku: '', ten: 'Sách - Ví Dụ Sách Không Có Mã Vạch - Newshop', phan_loai: 'Mặc định', nha: 'KHONG_NHAP' }
    ], [6, 16, 60, 16, 12]), 'SKU_NHA');
    XLSX.utils.book_append_sheet(wb, sheet(XLSX, ['combo_id', 'ten_combo', 'khoa', 'cach_xuat', 'ma_he_thong', 'ten_xuat', 'nha'], [
      { combo_id: 'C001', ten_combo: 'Combo Tập Viết Tiếng Nhật Katakana + Hiragana', khoa: '55252 ;; 8935092825724|COMBO.HA', cach_xuat: 'tach' },
      { combo_id: 'C002', ten_combo: 'Combo Giúp Em Học Tốt Tiếng Việt Lớp 3 - Tập 1 + 2', khoa: '55889', cach_xuat: 'nguyen',
        ma_he_thong: '', ten_xuat: '', nha: 'HA' }
    ], [12, 60, 50, 10, 16, 40, 6]), 'COMBO');
    XLSX.utils.book_append_sheet(wb, sheet(XLSX, COT_TP, [
      { combo_id: 'C001', sku: '', ten: 'Sách - Tập Viết Tiếng Nhật Katakana (ĐIỀN MÃ VẠCH THẬT VÀO CỘT sku)', nha: 'HA', gia_goc: 25000, so_luong: 1 },
      { combo_id: 'C001', sku: '8935092825724', ten: 'Sách - Tập Viết Tiếng Nhật Hiragana', nha: 'HA', gia_goc: 25000, so_luong: 1 }
    ], [12, 16, 60, 8, 10, 10]), 'COMBO_THANH_PHAN');
    return wb;
  }

  function timSheet(wb, ten) {
    var n = wb.SheetNames.filter(function (s) { return PL.clean(s).toUpperCase() === ten; })[0];
    return n ? wb.Sheets[n] : null;
  }
  function docSheet(wb, ten, XLSX) {
    var ws = timSheet(wb, ten);
    if (!ws) return null;
    return XLSX.utils.sheet_to_json(ws, { defval: '', raw: true }).map(function (r) {
      var o = {};
      Object.keys(r).forEach(function (k) { o[PL.clean(k).toLowerCase()] = r[k]; });
      return o;
    });
  }

  function chuanKhoa(k) {
    k = PL.clean(k);
    if (!k) return '';
    if (/^ten:/i.test(k)) return 'ten:' + k.slice(4).split('|').map(PL.norm).join('|');
    if (/^sku:/i.test(k)) k = k.slice(4);
    var i = k.indexOf('|'); // "<mã vạch>|<phân loại>"
    return i >= 0 ? PL.skuPlKey(k.slice(0, i), k.slice(i + 1)) : PL.skuKey(k);
  }

  /* Trả về { skus, combos, loi: [] } */
  function nap(wb, XLSX) {
    var loi = [], skus = [], combos = [];
    var dsSku = docSheet(wb, 'SKU_NHA', XLSX) || [];
    var dsCombo = docSheet(wb, 'COMBO', XLSX) || [];
    var dsTp = docSheet(wb, 'COMBO_THANH_PHAN', XLSX) || [];
    if (!timSheet(wb, 'SKU_NHA') && !timSheet(wb, 'COMBO')) {
      return { skus: [], combos: [], loi: ['Không thấy sheet SKU_NHA hoặc COMBO. Hãy dùng đúng file mẫu.'] };
    }
    dsSku.forEach(function (r, i) {
      var sku = PL.clean(r.sku), ten = PL.clean(r.ten), nha = PL.clean(r.nha).toUpperCase().replace(/\s+/g, '_');
      if (!sku && !ten && !nha) return;
      if (NHA_SKU.indexOf(nha) < 0) { loi.push('SKU_NHA dòng ' + (i + 2) + ': nhà "' + r.nha + '" không hợp lệ (HA/KV/ML/KHONG_NHAP).'); return; }
      var key = PL.clean(r.key);
      if (key) key = chuanKhoa(key);
      else if (PL.isBarcode(sku) || (sku && !ten)) key = PL.skuKey(sku);
      else if (ten) key = PL.tenKey(ten, r.phan_loai);
      else { loi.push('SKU_NHA dòng ' + (i + 2) + ': thiếu SKU và tên.'); return; }
      var nguon = PL.clean(r.nguon) === 'tu_hoc' ? 'tu_hoc' : 'tay';
      skus.push({ key: key, sku: sku, ten: ten, nha: nha, nguon: nguon });
    });
    var theoId = {};
    dsCombo.forEach(function (r, i) {
      var id = PL.clean(r.combo_id), ten = PL.clean(r.ten_combo);
      if (!id && !ten) return;
      if (!id) { loi.push('COMBO dòng ' + (i + 2) + ': thiếu combo_id.'); return; }
      var khoa = String(r.khoa || '').split(/\s*;;\s*|\n/).map(chuanKhoa).filter(Boolean);
      if (!khoa.length) { loi.push('COMBO dòng ' + (i + 2) + ' (' + id + '): chưa có khóa nhận diện.'); return; }
      var cachXuat = PL.norm(r.cach_xuat) === 'nguyen' ? 'nguyen' : 'tach';
      var nhaCb = PL.clean(r.nha).toUpperCase();
      if (cachXuat === 'nguyen' && PL.NHA.indexOf(nhaCb) < 0) {
        loi.push('COMBO dòng ' + (i + 2) + ' (' + id + '): xuất nguyên combo cần cột nha = HA / KV / ML.');
        return;
      }
      theoId[id] = { combo_id: id, ten_combo: ten || id, khoa: khoa, thanh_phan: [], cach_xuat: cachXuat,
                     ma_he_thong: PL.clean(r.ma_he_thong), ten_xuat: PL.clean(r.ten_xuat), nha: PL.NHA.indexOf(nhaCb) >= 0 ? nhaCb : '' };
      combos.push(theoId[id]);
    });
    dsTp.forEach(function (r, i) {
      var id = PL.clean(r.combo_id);
      if (!id && !PL.clean(r.ten)) return;
      var c = theoId[id];
      if (!c) { loi.push('COMBO_THANH_PHAN dòng ' + (i + 2) + ': combo_id "' + id + '" không có trong sheet COMBO.'); return; }
      var nha = PL.clean(r.nha).toUpperCase();
      if (NHA_TP.indexOf(nha) < 0) { loi.push('COMBO_THANH_PHAN dòng ' + (i + 2) + ': nhà "' + r.nha + '" không hợp lệ (HA/KV/ML/KHAC).'); return; }
      c.thanh_phan.push({
        sku: PL.clean(r.sku), ten: PL.clean(r.ten), nha: nha,
        gia_goc: Number(String(r.gia_goc).replace(/[^\d.]/g, '')) || 0, so_luong: Math.max(1, Number(r.so_luong) || 1)
      });
    });
    combos.forEach(function (c) {
      if (!c.thanh_phan.length && c.cach_xuat === 'tach') loi.push('Combo ' + c.combo_id + ' chưa có thành phần nào trong sheet COMBO_THANH_PHAN.');
    });
    return { skus: skus, combos: combos.filter(function (c) { return c.thanh_phan.length || c.cach_xuat === 'nguyen'; }), loi: loi };
  }

  return { xuat: xuat, mau: mau, nap: nap, chuanKhoa: chuanKhoa };
});
