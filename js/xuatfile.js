/* Xuất file gửi nhà cung cấp: mỗi nhà (HA / KV / ML) 1 file, 1 sheet, 4 cột STT | Tên sách | Giá bìa | Số lượng.
 * Không tô các màu nội bộ (cam SKU, vàng lệch giá, xanh mã cũ) – cảnh báo chỉ hiện trên app. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.XuatFile = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NHA = ['HA', 'KV', 'ML'];
  var TEN_NHA = { HA: 'Hồng Ân', KV: 'Khang Việt', ML: 'Minh Long' };
  var TEN_FILE = { HA: 'Hong-An', KV: 'Khang-Viet', ML: 'Minh-Long' };
  var SO = '#,##0';
  var NEN_TIEU_DE = 'FFEFEFEF';
  var VIEN = { style: 'thin', color: { argb: 'FF8C8C8C' } };
  var KHUNG = { top: VIEN, left: VIEN, bottom: VIEN, right: VIEN };

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function ngayChu(d, tach) { return p2(d.getDate()) + tach + p2(d.getMonth() + 1) + tach + d.getFullYear(); }

  /* Don-dat-hang_Hong-An_03-10-2026.xlsx */
  function fileName(nha, date) {
    return 'Don-dat-hang_' + TEN_FILE[nha] + '_' + ngayChu(date || new Date(), '-') + '.xlsx';
  }

  function sach(v) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim(); }

  /* Danh sách dòng in ra file của 1 nhà: gộp theo TÊN GỌN + GIÁ BÌA (2 barcode khác nhau nhưng cùng tên, cùng giá → 1 dòng),
   * khác giá thì giữ 2 dòng; sắp xếp theo tên A→Z. Xử lý bên trong (gộp theo barcode, combo…) không đổi. */
  function dongCuaNha(result, nha) {
    var nhom = new Map();
    (result.nha[nha] || []).forEach(function (g) {
      if (!(g.sl > 0)) return;
      var ten = sach(g.tenGon || g.ten), gia = Number(g.gia) || 0;
      var k = ten.toLowerCase() + '|' + gia;
      var d = nhom.get(k);
      if (!d) { d = { ten: ten, gia: gia, sl: 0, sku: [] }; nhom.set(k, d); }
      d.sl += Number(g.sl) || 0;
      if (sach(g.sku) && d.sku.indexOf(sach(g.sku)) < 0) d.sku.push(sach(g.sku));
    });
    return Array.from(nhom.values()).sort(function (a, b) {
      return a.ten.localeCompare(b.ten, 'vi', { sensitivity: 'base' }) || a.gia - b.gia;
    });
  }

  /* Nhà có hàng (để "Tải cả 3 nhà" bỏ qua nhà 0 cuốn) */
  function nhaCoHang(result) {
    return NHA.filter(function (n) { return dongCuaNha(result, n).length > 0; });
  }

  /* Vấn đề cần nhắc trước khi tải. nhas: các nhà đang tải.
   * - combo chưa khai báo / sách chưa rõ nhà (tải 1 nhà: chỉ các dòng đoán được thuộc nhà đó; tải cả 3: tất cả)
   * - cùng SKU nhưng giá khác nhau (chỉ trong các nhà đang tải). File gửi nhà không có cột SKU nên không nhắc thiếu SKU. */
  function kiemTraTruocKhiTai(result, nhas) {
    var caBa = nhas.length >= NHA.length;
    var thuocNha = function (g) {
      if (caBa) return true;
      var ma = sach(g.nha).split('+');
      return nhas.some(function (n) { return ma.indexOf(n) >= 0; });
    };
    var out = { combo: (result.combo || []).filter(thuocNha), chuaRo: (result.chuaRo || []).filter(thuocNha), giaKhac: [], thieuSku: [] };
    nhas.forEach(function (n) {
      var theoSku = {};
      (result.nha[n] || []).forEach(function (g) {
        if (sach(g.sku) && g.canhBaoGia) (theoSku[g.sku] = theoSku[g.sku] || { nha: n, sku: g.sku, ten: g.tenGon || g.ten, gia: [] }).gia.push(g.gia);
      });
      Object.keys(theoSku).forEach(function (k) { out.giaKhac.push(theoSku[k]); });
    });
    out.coVanDe = !!(out.combo.length || out.chuaRo.length || out.giaKhac.length || out.thieuSku.length);
    return out;
  }

  /* File gửi nhà: 1 sheet (tên nhà), đúng 4 cột STT | Tên sách | Giá bìa | Số lượng.
   * Dòng 1 là tiêu đề cột, dữ liệu từ dòng 2. Không SKU, không thành tiền, không dòng tổng/thông tin shop. */
  function buildDonDatHang(result, nha, info, ExcelJS, date) {
    var ds = dongCuaNha(result, nha);
    var wb = new ExcelJS.Workbook();
    wb.creator = 'Tách đơn nhập nhà';
    wb.created = date || new Date();
    var ws = wb.addWorksheet(TEN_NHA[nha]);
    ws.columns = [{ width: 6 }, { width: 64 }, { width: 12 }, { width: 10 }];
    var hd = ws.getRow(1);
    hd.values = ['STT', 'Tên sách', 'Giá bìa', 'Số lượng'];
    hd.height = 20;
    hd.eachCell(function (c) {
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEN_TIEU_DE } };
      c.border = KHUNG;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    ds.forEach(function (d, i) {
      var r = ws.getRow(i + 2);
      r.values = [i + 1, d.ten, d.gia, d.sl];
      r.getCell(3).numFmt = SO;
      r.getCell(4).numFmt = SO;
      for (var k = 1; k <= 4; k++) {
        var c = r.getCell(k);
        c.border = KHUNG;
        c.alignment = { vertical: 'top', wrapText: k === 2, horizontal: k === 1 ? 'center' : undefined };
      }
    });
    // In: A4 dọc, vừa 1 trang chiều ngang, lặp dòng tiêu đề cột khi sang trang
    ws.pageSetup = {
      paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      horizontalCentered: true, printTitlesRow: '1:1',
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
    };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    return wb;
  }

  return {
    NHA: NHA, TEN_NHA: TEN_NHA,
    fileName: fileName, buildDonDatHang: buildDonDatHang, dongCuaNha: dongCuaNha,
    nhaCoHang: nhaCoHang, kiemTraTruocKhiTai: kiemTraTruocKhiTai
  };
});
