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

  /* Đơn web (file "Danh sách lấy hàng" của website): đã cộng gộp theo sách, không có mã đơn */
  FORMATS.Web = {
    need: ['Barcode', 'Tên sản phẩm', 'SL'],
    read: function (get) {
      if (!/^\d+$/.test(clean(get('STT')))) return null;
      return {
        orderId: '',
        sku: clean(get('Barcode')),
        ten: clean(get('Tên sản phẩm')),
        phanLoai: '',
        gia: toNum(get('Giá bìa')),
        sl: toNum(get('SL')),
        ncc: clean(get('Nhà cung cấp'))   // "Nhà Sách Hồng Ân", "Minh Long Book"… (cột "Trong kho" bỏ qua)
      };
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

  var TRANG_THAI_SHOPEE = 'Trạng Thái Đơn Hàng';

  /* Trả về { san, sheetName, rows, error, ... }
   * Tự tìm dòng tiêu đề trong 30 dòng đầu (file web có 11 dòng thông tin công ty phía trên). */
  function parseWorkbook(wb, XLSX, fileName) {
    for (var i = 0; i < wb.SheetNames.length; i++) {
      var name = wb.SheetNames[i];
      var ws = wb.Sheets[name];
      if (!ws || !fixRef(ws, XLSX)) continue;
      var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: true });
      var hRow = -1, san = null, headers = null;
      for (var h = 0; h < Math.min(aoa.length, 30) && !san; h++) {
        headers = (aoa[h] || []).map(clean);
        san = detect(headers);
        if (san) hRow = h;
      }
      if (!san) continue;
      var idx = {};
      headers.forEach(function (x, c) { if (x && !(x in idx)) idx[x] = c; });
      var rows = [];
      for (var r = hRow + 1; r < aoa.length; r++) {
        var line = aoa[r] || [];
        if (san === 'Web') {
          // Dừng khi gặp dòng trống hoặc dòng "Nhân viên lấy hàng"
          if (!line.some(function (x) { return clean(x); })) break;
          if (/^nhân viên lấy hàng/i.test(clean(line[0]))) break;
        }
        var get = function (k) { return k in idx ? line[idx[k]] : ''; };
        var row = FORMATS[san].read(get);
        if (!row) continue;
        if (san === 'Shopee' && TRANG_THAI_SHOPEE in idx) row.trangThai = clean(get(TRANG_THAI_SHOPEE));
        row.san = san;
        row.file = fileName || '';
        rows.push(row);
      }
      var out = { san: san, sheetName: name, rows: rows, error: null };
      if (san === 'Web') {
        // "Thời gian xuất: 03/10/2026 17:12" ở phần đầu file → dùng để nhận ra file thả lại
        for (var t = 0; t < hRow; t++) {
          var m = /Thời gian xuất\s*:\s*(.+)$/i.exec(clean((aoa[t] || []).join(' ')));
          if (m) { out.thoiGianXuat = clean(m[1]); break; }
        }
        out.webKey = (out.thoiGianXuat || '') + '#' + rows.map(function (x) { return [x.sku, x.ten, x.sl, x.gia, x.ncc].join('|'); }).join('¦');
      }
      return out;
    }
    return {
      san: null, sheetName: null, rows: [],
      error: 'File này không giống file đơn hàng Shopee, TikTok hoặc "Danh sách lấy hàng" của web (không tìm thấy các cột như "Mã đơn hàng" / "Order ID" / "Barcode").'
    };
  }

  var TRANG_THAI_MAC_DINH = ['Chờ giao hàng', 'Chờ xác nhận'];

  /* Shopee: chỉ lấy các trạng thái trong danh sách (so khớp đúng sau khi bỏ khoảng trắng thừa).
   * File không có cột trạng thái → lấy hết. Ghi vào p: rowsGoc, soDongLay, soDongBoQuaTrangThai. */
  function locTrangThai(p, dsTrangThai) {
    var tatCa = p.rowsTatCa || p.rows;
    p.rowsTatCa = tatCa;
    var ds = (dsTrangThai && dsTrangThai.length ? dsTrangThai : TRANG_THAI_MAC_DINH).map(function (x) { return clean(x).toLowerCase(); });
    var coCot = tatCa.some(function (r) { return r.trangThai !== undefined; });
    p.rowsGoc = p.san !== 'Shopee' || !coCot ? tatCa
      : tatCa.filter(function (r) { return ds.indexOf(clean(r.trangThai).toLowerCase()) >= 0; });
    p.coCotTrangThai = p.san === 'Shopee' && coCot;
    p.soDongLay = p.rowsGoc.length;
    p.soDongBoQuaTrangThai = tatCa.length - p.rowsGoc.length;
    return p;
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

  return { parseWorkbook: parseWorkbook, gopFile: gopFile, locTrangThai: locTrangThai, TRANG_THAI_MAC_DINH: TRANG_THAI_MAC_DINH, fixRef: fixRef, toNum: toNum, clean: clean };
});
