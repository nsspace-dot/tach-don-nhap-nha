/* Xuất file Excel 5 sheet bằng ExcelJS (hỗ trợ in đậm, tô màu, cố định tiêu đề, AutoFilter). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.XuatFile = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAU = { HA: 'FFF9D5CC', KV: 'FFCDEFE0', ML: 'FFFBEBB5', combo: 'FFE3D9F5', chuaRo: 'FFFFD8C2' };
  var CANH_BAO = 'FFFFF2A8';      // cùng SKU nhưng giá gốc khác nhau
  var SKU_LA = 'FFFFB580';        // SKU trống / dạng chữ (không phải mã vạch)
  var MA_CU = 'FFCFE5FF';         // có đơn còn dùng mã cũ (sách tái bản) → nên sửa listing
  var SO = '#,##0';

  function fileName(date) {
    date = date || new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'Don-nhap-nha_' + p(date.getDate()) + '-' + p(date.getMonth() + 1) + '-' + date.getFullYear() + '.xlsx';
  }

  function addSheet(wb, name, color, cols, rows, rowFill) {
    var ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = cols.map(function (c) { return { header: c.h, key: c.k, width: c.w }; });
    var head = ws.getRow(1);
    head.font = { bold: true };
    head.alignment = { vertical: 'middle' };
    head.height = 20;
    head.eachCell(function (cell) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFB9A9A0' } } };
    });
    rows.forEach(function (r) {
      var row = ws.addRow(r);
      cols.forEach(function (c, i) {
        if (c.so) row.getCell(i + 1).numFmt = SO;
      });
      var fill = rowFill && rowFill(r);
      if (fill) row.eachCell({ includeEmpty: true }, function (cell) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      });
      if (r._skuLa) {
        var c = row.getCell(cols.findIndex(function (x) { return x.k === 'sku'; }) + 1);
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SKU_LA } };
        c.note = 'SKU trống hoặc không phải mã vạch – nhận diện bằng tên + phân loại';
      }
      if (r._maCu) {
        var cm = row.getCell(cols.findIndex(function (x) { return x.k === 'sku'; }) + 1);
        cm.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MA_CU } };
        cm.note = 'Có đơn còn dùng mã cũ ' + r._maCu + ' (sách tái bản) – đã tính vào mã mới. Nên sửa listing trên sàn.';
      }
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    return ws;
  }

  var COT_NHA = [
    { h: 'SKU', k: 'sku', w: 18 }, { h: 'Tên sản phẩm', k: 'ten', w: 70 },
    { h: 'Giá gốc', k: 'gia', w: 12, so: true }, { h: 'Số lượng', k: 'sl', w: 10, so: true }
  ];
  var COT_COMBO = [
    { h: 'Nhà', k: 'nha', w: 8 }, { h: 'SKU', k: 'sku', w: 18 }, { h: 'Tên sản phẩm', k: 'ten', w: 60 },
    { h: 'Phân loại', k: 'phanLoai', w: 32 }, { h: 'Giá gốc', k: 'gia', w: 12, so: true },
    { h: 'Số lượng', k: 'sl', w: 10, so: true }, { h: 'Ghi chú', k: 'ghiChu', w: 40 }
  ];
  var COT_CHUA_RO = [
    { h: 'SKU', k: 'sku', w: 18 }, { h: 'Tên sản phẩm', k: 'ten', w: 60 }, { h: 'Phân loại', k: 'phanLoai', w: 32 },
    { h: 'Giá gốc', k: 'gia', w: 12, so: true }, { h: 'Số lượng', k: 'sl', w: 10, so: true }
  ];

  function pick(list, cols, skuLa) {
    return list.map(function (g) {
      var o = { _canhBao: g.canhBaoGia, _skuLa: skuLa && g.skuLa, _maCu: g.maCu && g.maCu.length ? g.maCu.join(', ') : '' };
      cols.forEach(function (c) { o[c.k] = g[c.k] === undefined ? '' : g[c.k]; });
      if (g.tenGon) o.ten = g.tenGon; // tên đã làm gọn (bỏ "Sách -", "- HA - Newshop"…)
      return o;
    });
  }

  /* result: kết quả PhanLoai.classify ; trả về workbook ExcelJS */
  function buildWorkbook(result, ExcelJS) {
    var wb = new ExcelJS.Workbook();
    wb.creator = 'Tách đơn nhập nhà';
    wb.created = new Date();
    var canhBao = function (r) { return r._canhBao ? CANH_BAO : null; };
    addSheet(wb, 'Hồng Ân', MAU.HA, COT_NHA, pick(result.nha.HA, COT_NHA, true), canhBao);
    addSheet(wb, 'Khang Việt', MAU.KV, COT_NHA, pick(result.nha.KV, COT_NHA, true), canhBao);
    addSheet(wb, 'Minh Long', MAU.ML, COT_NHA, pick(result.nha.ML, COT_NHA, true), canhBao);
    addSheet(wb, 'Combo', MAU.combo, COT_COMBO, pick(result.combo, COT_COMBO));
    addSheet(wb, 'Chưa rõ nhà', MAU.chuaRo, COT_CHUA_RO, pick(result.chuaRo, COT_CHUA_RO, true));
    return wb;
  }

  return { buildWorkbook: buildWorkbook, fileName: fileName };
});
