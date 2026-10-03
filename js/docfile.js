/* Đọc file đơn hàng Shopee / TikTok (chạy trong trình duyệt, cũng chạy được bằng Node để kiểm thử).
 * Không gửi dữ liệu đi đâu cả. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DocFile = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clean(v) {
    if (v === null || v === undefined) return '';
    return String(v).normalize('NFC').replace(/\s+/g, ' ').trim();
  }

  /* "90000.00" -> 90000 ; "90.000" -> 90000 ; "1,234" -> 1234 */
  function toNum(v) {
    if (typeof v === 'number') return v;
    var s = clean(v).replace(/\s|đ|₫|VND/gi, '');
    if (!s) return 0;
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /* File TikTok ghi sai vùng dữ liệu (!ref) -> quét toàn bộ ô để tính lại. */
  function fixRef(ws, XLSX) {
    var minR = Infinity, minC = Infinity, maxR = -1, maxC = -1;
    Object.keys(ws).forEach(function (k) {
      if (k.charAt(0) === '!') return;
      var a = XLSX.utils.decode_cell(k);
      if (a.r < minR) minR = a.r;
      if (a.c < minC) minC = a.c;
      if (a.r > maxR) maxR = a.r;
      if (a.c > maxC) maxC = a.c;
    });
    if (maxR < 0) return false;
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    return true;
  }

  var FORMATS = {
    TikTok: {
      need: ['Order ID', 'Seller SKU', 'Product Name', 'Variation', 'Quantity'],
      read: function (get) {
        var id = clean(get('Order ID'));
        if (!/^\d+$/.test(id)) return null; // bỏ dòng mô tả cột / dòng trống
        return {
          orderId: id,
          sku: clean(get('Seller SKU')),
          ten: clean(get('Product Name')),
          phanLoai: clean(get('Variation')),
          gia: toNum(get('SKU Unit Original Price')),
          sl: toNum(get('Quantity'))
        };
      }
    },
    Shopee: {
      need: ['Mã đơn hàng', 'Tên sản phẩm', 'Số lượng'],
      read: function (get) {
        var id = clean(get('Mã đơn hàng'));
        var ten = clean(get('Tên sản phẩm'));
        if (!id && !ten) return null;
        return {
          orderId: id,
          sku: clean(get('SKU phân loại hàng')) || clean(get('SKU sản phẩm')),
          ten: ten,
          phanLoai: clean(get('Tên phân loại hàng')),
          gia: toNum(get('Giá gốc')),
          sl: toNum(get('Số lượng'))
        };
      }
    }
  };

  function detect(headers) {
    var set = {};
    headers.forEach(function (h) { set[h] = true; });
    for (var san in FORMATS) {
      if (FORMATS[san].need.every(function (h) { return set[h]; })) return san;
    }
    return null;
  }

  /* Trả về { san, sheetName, rows, error } */
  function parseWorkbook(wb, XLSX, fileName) {
    for (var i = 0; i < wb.SheetNames.length; i++) {
      var name = wb.SheetNames[i];
      var ws = wb.Sheets[name];
      if (!ws || !fixRef(ws, XLSX)) continue;
      var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
      if (!aoa.length) continue;
      var headers = aoa[0].map(clean);
      var san = detect(headers);
      if (!san) continue;
      var idx = {};
      headers.forEach(function (h, c) { if (h && !(h in idx)) idx[h] = c; });
      var rows = [];
      for (var r = 1; r < aoa.length; r++) {
        var line = aoa[r];
        var row = FORMATS[san].read(function (h) { return h in idx ? line[idx[h]] : ''; });
        if (!row) continue;
        row.san = san;
        row.file = fileName || '';
        rows.push(row);
      }
      return { san: san, sheetName: name, rows: rows, error: null };
    }
    return {
      san: null, sheetName: null, rows: [],
      error: 'File này không giống file đơn hàng Shopee hoặc TikTok (không tìm thấy các cột như "Mã đơn hàng" / "Order ID").'
    };
  }

  /* Gộp nhiều file (kể cả nhiều file cùng sàn – mỗi gian hàng 1 file).
   * Chống cộng trùng GIỮA CÁC FILE: đơn (cùng sàn + mã đơn) đã có ở file thả trước thì bỏ qua ở file sau.
   * Trong cùng 1 file, 1 đơn nhiều dòng sản phẩm là bình thường → giữ hết.
   * files: [{ san, rowsGoc: [...], error }] theo thứ tự thả. Ghi kết quả vào từng file:
   *   rows (dòng được dùng), soDon, soDonMoi, soDonTrung, soDongTrung. */
  function gopFile(files) {
    var daCo = {};
    files.forEach(function (f) {
      if (f.error) return;
      var trongFile = {}, trung = {}, moi = {};
      f.rows = [];
      f.soDongTrung = 0;
      (f.rowsGoc || []).forEach(function (r) {
        var id = r.orderId ? r.san + ':' + r.orderId : '';
        if (id && daCo[id]) { trung[id] = 1; f.soDongTrung++; return; }
        if (id) { trongFile[id] = 1; moi[id] = 1; }
        f.rows.push(r);
      });
      Object.keys(trongFile).forEach(function (id) { daCo[id] = 1; });
      f.soDonMoi = Object.keys(moi).length;
      f.soDonTrung = Object.keys(trung).length;
      f.soDon = f.soDonMoi + f.soDonTrung;
    });
    return files;
  }

  return { parseWorkbook: parseWorkbook, gopFile: gopFile, fixRef: fixRef, toNum: toNum, clean: clean };
});
