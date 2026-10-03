/* Xuất ĐƠN ĐẶT HÀNG gửi nhà cung cấp: mỗi nhà (HA / KV / ML) 1 file, 1 sheet.
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

  /* Danh sách dòng sẽ in ra đơn của 1 nhà (đã gộp, đã sắp xếp theo tên gọn A→Z) */
  function dongCuaNha(result, nha) {
    return (result.nha[nha] || []).filter(function (g) { return g.sl > 0; }).map(function (g) {
      return { sku: sach(g.sku), ten: g.tenGon || g.ten, gia: Number(g.gia) || 0, sl: Number(g.sl) || 0 };
    });
  }

  /* Nhà có hàng (để "Tải cả 3 nhà" bỏ qua nhà 0 cuốn) */
  function nhaCoHang(result) {
    return NHA.filter(function (n) { return dongCuaNha(result, n).length > 0; });
  }

  /* Vấn đề cần nhắc trước khi tải. nhas: các nhà đang tải.
   * - combo chưa khai báo / sách chưa rõ nhà (tải 1 nhà: chỉ các dòng đoán được thuộc nhà đó; tải cả 3: tất cả)
   * - cùng SKU nhưng giá khác nhau, dòng thiếu SKU (chỉ trong các nhà đang tải) */
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
        if (!sach(g.sku)) out.thieuSku.push({ nha: n, ten: g.tenGon || g.ten, sl: g.sl });
        else if (g.canhBaoGia) (theoSku[g.sku] = theoSku[g.sku] || { nha: n, sku: g.sku, ten: g.tenGon || g.ten, gia: [] }).gia.push(g.gia);
      });
      Object.keys(theoSku).forEach(function (k) { out.giaKhac.push(theoSku[k]); });
    });
    out.coVanDe = !!(out.combo.length || out.chuaRo.length || out.giaKhac.length || out.thieuSku.length);
    return out;
  }

  /* info: { tenShop, sdt, diaChi, ghiChu } (đều không bắt buộc) ; trả về workbook ExcelJS */
  function buildDonDatHang(result, nha, info, ExcelJS, date) {
    info = info || {};
    date = date || new Date();
    var ten = TEN_NHA[nha];
    var ds = dongCuaNha(result, nha);
    var wb = new ExcelJS.Workbook();
    wb.creator = sach(info.tenShop) || 'Tách đơn nhập nhà';
    wb.created = date;
    var ws = wb.addWorksheet(ten);
    ws.columns = [{ width: 6 }, { width: 17 }, { width: 54 }, { width: 12 }, { width: 10 }, { width: 15 }];

    var dongSo = 0;
    function dongGop(text, font, align) {
      dongSo++;
      ws.mergeCells(dongSo, 1, dongSo, 6);
      var c = ws.getCell(dongSo, 1);
      c.value = text;
      c.font = font || {};
      c.alignment = Object.assign({ vertical: 'middle', wrapText: true }, align || {});
      return ws.getRow(dongSo);
    }

    // Tiêu đề + thông tin
    dongGop('ĐƠN ĐẶT HÀNG – ' + ten.toUpperCase(), { bold: true, size: 16 }, { horizontal: 'center' }).height = 28;
    dongGop('Ngày: ' + ngayChu(date, '/'));
    var benDat = [sach(info.tenShop), sach(info.sdt) ? 'SĐT: ' + sach(info.sdt) : ''].filter(Boolean).join(' – ');
    if (benDat) dongGop('Bên đặt: ' + benDat);
    if (sach(info.diaChi)) dongGop('Địa chỉ nhận hàng: ' + sach(info.diaChi));
    dongSo++; // dòng trống

    // Bảng
    var dauBang = ++dongSo;
    var hd = ws.getRow(dauBang);
    hd.values = ['STT', 'SKU', 'Tên sách', 'Giá bìa', 'Số lượng', 'Thành tiền'];
    hd.height = 20;
    hd.eachCell(function (c) {
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEN_TIEU_DE } };
      c.border = KHUNG;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    ds.forEach(function (d, i) {
      var r = ws.getRow(++dongSo);
      r.getCell(1).value = i + 1;
      r.getCell(2).value = d.sku;          // giữ dạng chữ (mã vạch dài không bị đổi thành 8.9E+12)
      r.getCell(2).numFmt = '@';
      r.getCell(3).value = d.ten;
      r.getCell(4).value = d.gia;
      r.getCell(5).value = d.sl;
      r.getCell(6).value = { formula: 'D' + dongSo + '*E' + dongSo, result: d.gia * d.sl };
      [4, 5, 6].forEach(function (k) { r.getCell(k).numFmt = SO; });
      for (var k = 1; k <= 6; k++) {
        var c = r.getCell(k);
        c.border = KHUNG;
        c.alignment = { vertical: 'top', wrapText: k === 3, horizontal: k === 1 ? 'center' : undefined };
      }
    });
    var cuoiBang = dongSo;

    // Dòng tổng
    var tg = ws.getRow(++dongSo);
    ws.mergeCells(dongSo, 1, dongSo, 4);
    tg.getCell(1).value = 'TỔNG CỘNG';
    tg.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
    var coDong = cuoiBang > dauBang;
    tg.getCell(5).value = coDong ? { formula: 'SUM(E' + (dauBang + 1) + ':E' + cuoiBang + ')', result: ds.reduce(function (s, d) { return s + d.sl; }, 0) } : 0;
    tg.getCell(6).value = coDong ? { formula: 'SUM(F' + (dauBang + 1) + ':F' + cuoiBang + ')', result: ds.reduce(function (s, d) { return s + d.gia * d.sl; }, 0) } : 0;
    for (var k = 1; k <= 6; k++) {
      tg.getCell(k).font = { bold: true };
      tg.getCell(k).border = KHUNG;
      if (k >= 5) tg.getCell(k).numFmt = SO;
    }

    // Ghi chú cuối đơn
    if (sach(info.ghiChu)) {
      dongSo++;
      dongGop('Ghi chú: ' + sach(info.ghiChu), { italic: true });
    }

    // In: A4 dọc, vừa 1 trang chiều ngang, lặp dòng tiêu đề cột
    ws.pageSetup = {
      paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      horizontalCentered: true, printTitlesRow: dauBang + ':' + dauBang,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
    };
    ws.views = [{ state: 'frozen', ySplit: dauBang }];
    return wb;
  }

  return {
    NHA: NHA, TEN_NHA: TEN_NHA,
    fileName: fileName, buildDonDatHang: buildDonDatHang, dongCuaNha: dongCuaNha,
    nhaCoHang: nhaCoHang, kiemTraTruocKhiTai: kiemTraTruocKhiTai
  };
});
