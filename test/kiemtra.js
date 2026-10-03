/* Kiểm thử tự động bằng 2 file mẫu trong thư mục mau/ (không có trên repo vì chứa dữ liệu khách).
 * Chạy: node test/kiemtra.js
 * Cần: mau/tiktok.xlsx và mau/shopee.xlsx */
'use strict';
var fs = require('fs');
var path = require('path');
var XLSX = require('../lib/xlsx-0.18.5.full.min.js');
var ExcelJS = require('../lib/exceljs-4.4.0.min.js');
var DocFile = require('../js/docfile.js');
var PL = require('../js/phanloai.js');
var XuatFile = require('../js/xuatfile.js');

var MAU = path.join(__dirname, '..', 'mau');
var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet ? '  → ' + chiTiet : '')); }
}

function doc(file) {
  var buf = fs.readFileSync(path.join(MAU, file));
  return DocFile.parseWorkbook(XLSX.read(buf, { type: 'buffer' }), XLSX, file);
}

if (!fs.existsSync(path.join(MAU, 'tiktok.xlsx')) || !fs.existsSync(path.join(MAU, 'shopee.xlsx'))) {
  console.log('Thiếu mau/tiktok.xlsx hoặc mau/shopee.xlsx → bỏ qua kiểm thử bằng file mẫu.');
  process.exit(0);
}

console.log('\n1. Đọc file');
var tt = doc('tiktok.xlsx'), sp = doc('shopee.xlsx');
check('Nhận ra file TikTok', tt.san === 'TikTok', tt.san);
check('Nhận ra file Shopee', sp.san === 'Shopee', sp.san);
check('TikTok đọc ra 103 dòng', tt.rows.length === 103, tt.rows.length);
check('Shopee đọc ra 38 dòng', sp.rows.length === 38, sp.rows.length);

// Giả lập lỗi !ref của TikTok: chỉ còn 1 cột → vẫn phải đọc đủ
var wbLoi = XLSX.read(fs.readFileSync(path.join(MAU, 'tiktok.xlsx')), { type: 'buffer' });
wbLoi.Sheets.OrderSKUList['!ref'] = 'A1:A2';
check('TikTok bị sai vùng dữ liệu vẫn đọc đủ 103 dòng', DocFile.parseWorkbook(wbLoi, XLSX).rows.length === 103);
check('Shopee: giá "90000.00" đọc thành số 90000', sp.rows[0].gia === 90000, sp.rows[0].gia);
var sai = DocFile.parseWorkbook(XLSX.utils.book_new && (function () {
  var w = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 2]]), 'x'); return w;
})(), XLSX);
check('File lạ → báo lỗi thân thiện', !!sai.error);

var rows = tt.rows.concat(sp.rows);

console.log('\n2. Nhận mã nhà (regex)');
var f = function (s) { return PL.findCodes(s, PL.RE_NHA).join(','); };
[['Sách - X - HA', 'HA'], ['Sách - X - HA - Newshop', 'HA'], ['X - HA - Tác Giả Lê Thị Nương', 'HA'],
 ['Kết Nối) _HA', 'HA'], ['Mĩ Thuật (HA)', 'HA'], ['COMBO.HA', 'HA'], ['COMBO HA (2 cuốn)', 'HA'],
 ['KV07 - PHONG THỦY', ''], ['HAI', ''], ['Hà Nội', ''], ['Lịch Sử 9 - KV - Newshop', 'KV'], ['-HA', 'HA']
].forEach(function (c) { check('"' + c[0] + '" → ' + (c[1] || '(không có)'), f(c[0]) === c[1], f(c[0])); });

console.log('\n3. Phân loại với danh mục rỗng');
var kq = PL.classify(rows, { skus: [], combos: [] });
var d = kq.dongTheoNha;
check('Tổng dòng 3 nhà = 48', d.HA + d.KV + d.ML === 48, JSON.stringify(d));
check('HA 43 dòng', d.HA === 43, d.HA);
check('KV 5 dòng', d.KV === 5, d.KV);
check('ML 0 dòng', d.ML === 0, d.ML);
var chuaRoDong = kq.chuaRo.reduce(function (s, g) { return s + g.lines.length; }, 0);
check('Chưa rõ nhà = 1 dòng (Liễu Phàm Tứ Huấn)', chuaRoDong === 1 && /Liễu Phàm Tứ Huấn/.test(kq.chuaRo[0].ten),
  kq.chuaRo.map(function (g) { return g.ten; }).join(' | '));
var kv07 = kq.lines.filter(function (l) { return /KV07/.test(l.row.sku + l.row.phanLoai) && l.nha === 'KV'; });
check('Không dòng lịch KV07 nào vào Khang Việt', kv07.length === 0, kv07.length);
check('"Lịch Sử 9 - KV" vẫn vào Khang Việt', kq.nha.KV.some(function (g) { return /Lịch Sử 9/.test(g.ten); }));
var c55252 = kq.combo.filter(function (g) { return g.sku === '55252'; });
check('Combo 55252 nằm ở sheet Combo', c55252.length > 0 && c55252.every(function (g) { return g.nha === 'HA'; }));
check('"Vở Bài Tập Thực Hành Mĩ Thuật Các Lớp (HA)" vào Hồng Ân', kq.nha.HA.some(function (g) { return /Mĩ Thuật Các Lớp \(HA\)/.test(g.ten); }));
check('"Tập Viết Tiếng Nhật Hiragana (HA)" (COMBO.HA, SKU mã vạch) là combo, nhà HA',
  kq.combo.some(function (g) { return g.sku === '8935092825724' && g.nha === 'HA' && g.phanLoai === 'COMBO.HA'; }) &&
  !kq.nha.HA.some(function (g) { return g.sku === '8935092825724'; }));
var gd = kq.nha.HA.filter(function (g) { return g.sku === 'GDĐĐKNSDCHSL6'; });
check('SKU dạng chữ "GDĐĐKNSDCHSL6" (không dấu hiệu combo) là sách lẻ Hồng Ân, tô cam', gd.length === 1 && gd[0].skuLa && /^ten:/.test(gd[0].key));
var tt25 = kq.nha.HA.filter(function (g) { return /Tuyển Tập 25 Năm/.test(g.ten); });
check('SKU trống "Tuyển Tập 25 Năm…" (phân loại LẺ) là sách lẻ Hồng Ân, tô cam', tt25.length === 1 && tt25[0].skuLa && tt25[0].sku === '');
check('Sheet Combo chỉ còn dòng có dấu hiệu combo', kq.combo.every(function (g) { return !!g.comboLyDo; }));
var tron = kq.combo.filter(function (g) { return /Tập Viết Hiragana \(MEGA\)/.test(g.phanLoai); })[0];
check('Combo trộn nhà "COMBO HA + … (MEGA)" thuộc HA, có ghi chú', tron && tron.nha === 'HA' && /trộn nhà/.test(tron.ghiChu), tron && tron.ghiChu);
check('Có danh sách SKU tự học', kq.hoc.length > 0, kq.hoc.length);
check('Tự học chỉ gồm SKU mã vạch', kq.hoc.every(function (h) { return PL.isBarcode(h.sku); }));

console.log('\n4. Sau khi khai báo combo 55252 (Katakana + Hiragana)');
var HIRA = '8935092825724', KATA = '8935092825731'; // KATA: SKU giả lập để kiểm thử
var catalog = {
  skus: [],
  combos: [{
    combo_id: 'C1', ten_combo: 'Combo Tập Viết Tiếng Nhật Katakana + Hiragana',
    khoa: ['sku:55252', 'sku:8935092825724'], // 55252 (TikTok + Shopee) và dòng Shopee "Hiragana (HA)" COMBO.HA
    thanh_phan: [
      { sku: KATA, ten: 'Sách - Tập Viết Tiếng Nhật Katakana (HA)', nha: 'HA', gia_goc: 25000, so_luong: 1 },
      { sku: HIRA, ten: 'Sách - Tập Viết Tiếng Nhật Hiragana (HA)', nha: 'HA', gia_goc: 25000, so_luong: 1 }
    ]
  }]
};
var nCombo = function (san) { return rows.filter(function (r) { return r.san === san && (r.sku === '55252' || r.sku === HIRA); })
  .reduce(function (s, r) { return s + r.sl; }, 0); };
check('Có 11 đơn combo Katakana + Hiragana (9 TikTok + 2 Shopee)', nCombo('TikTok') === 9 && nCombo('Shopee') === 2, nCombo('TikTok') + '+' + nCombo('Shopee'));
var kq2 = PL.classify(rows, catalog);
check('55252 và "Hiragana (HA)" COMBO.HA biến mất khỏi Combo', !kq2.combo.some(function (g) { return g.sku === '55252' || g.sku === HIRA; }));
var kata = kq2.nha.HA.filter(function (g) { return g.sku === KATA; });
var hira = kq2.nha.HA.filter(function (g) { return g.sku === HIRA; });
check('Katakana trong Hồng Ân = 11', kata.length === 1 && kata[0].sl === 11, JSON.stringify(kata.map(function (g) { return [g.gia, g.sl]; })));
check('Hiragana trong Hồng Ân = 11, chỉ 1 dòng', hira.length === 1 && hira[0].sl === 11, JSON.stringify(hira.map(function (g) { return [g.gia, g.sl]; })));
check('Không còn dòng Hiragana giá 50.000', !hira.some(function (g) { return g.gia === 50000; }));
check('Combo trộn nhà (không SKU) vẫn ở Combo vì chưa khai báo', kq2.combo.some(function (g) { return /MEGA/.test(g.phanLoai); }));

console.log('\n5. Danh mục gán tay & tự học');
var kq3 = PL.classify(rows, { skus: [{ key: 'sku:9786320103126', sku: '9786320103126', nha: 'ML', nguon: 'tay' }], combos: [] });
check('Gán tay Liễu Phàm Tứ Huấn → Minh Long', kq3.nha.ML.length === 1 && kq3.chuaRo.length === 0);
var kq4 = PL.classify(rows, { skus: [{ key: 'sku:9786320103126', sku: '9786320103126', nha: 'KHONG_NHAP', nguon: 'tay' }], combos: [] });
check('Đánh dấu "Không nhập" → vào Đã bỏ qua', kq4.chuaRo.length === 0 && kq4.boQua.some(function (g) { return /Không nhập/.test(g.lyDo); }));
var tay = { key: 'sku:8935092845425', sku: '8935092845425', nha: 'KV', nguon: 'tay' };
var kq5 = PL.classify(rows, { skus: [tay], combos: [] });
check('Gán tay thắng mã trong tên (HA → KV)', kq5.nha.KV.some(function (g) { return g.sku === '8935092845425'; }));
check('Tự học không đè gán tay', !kq5.hoc.some(function (h) { return h.sku === '8935092845425'; }));
var kq6 = PL.classify(rows, { skus: kq.hoc, combos: [] });
check('Lần 2 (đã học) không học lại', kq6.hoc.length === 0, kq6.hoc.length);
var k25 = PL.tenKey(tt25[0] ? 'Sách - Tuyển Tập 25 Năm Đề Thi Olympic 30 Tháng 4 Ngữ Văn 10 - HA - Newshop' : '', 'LẺ');
var kq8 = PL.classify(rows, { skus: [{ key: k25, sku: '', nha: 'KV', nguon: 'tay' }], combos: [] });
check('Gán tay theo tên + phân loại (SKU trống) có tác dụng', kq8.nha.KV.some(function (g) { return /Tuyển Tập 25 Năm/.test(g.ten); }));
var blocRow = rows.filter(function (r) { return /KV07/.test(r.sku); })[0];
var kq7 = PL.classify([blocRow], { skus: [{ key: PL.skuKey(blocRow.sku), sku: blocRow.sku, nha: 'KV', nguon: 'tu_hoc' }], combos: [] });
check('Lịch KV07 vẫn bỏ qua dù danh mục tự học ghi nhầm KV', kq7.nha.KV.length === 0);

console.log('\n6. Combo / sách lẻ');
var cr = function (sku, ten, pl) { return !!PL.comboReason({ sku: sku, ten: ten, phanLoai: pl || '' }); };
check('"(1 cuốn)" không phải combo', !cr('8935092825724', 'Sách X', 'X (1 cuốn)'));
check('"TẬP 1" không phải combo', !cr('8935092825724', 'Sách X', 'TẬP 1'));
check('"Bộ 2 Cuốn" là combo', cr('8935092825724', 'Sách X (Bộ 2 Cuốn)'));
check('"Tập 1 + 2" là combo', cr('8935092825724', 'Sách X - Tập 1 + 2'));
check('"COMBO.HA" là combo dù SKU là mã vạch', cr('8935092825724', 'Sách - Tập Viết Hiragana (HA)', 'COMBO.HA'));
check('SKU "55252" không có dấu hiệu combo → sách lẻ', !cr('55252', 'Sách X', 'LẺ'));
check('SKU trống không có dấu hiệu combo → sách lẻ', !cr('', 'Sách X', 'LẺ'));
check('"Lớp 1+2+3" không phải combo', !cr('8935092839820', 'Luyện Viết Tiếng Anh Lớp 1+2+3', 'LỚP 2'));

console.log('\n7. Xuất Excel');
var wb = XuatFile.buildWorkbook(kq2, ExcelJS);
check('Có đủ 5 sheet đúng thứ tự', wb.worksheets.map(function (w) { return w.name; }).join(',') === 'Hồng Ân,Khang Việt,Minh Long,Combo,Chưa rõ nhà');
check('Tên file đúng mẫu', XuatFile.fileName(new Date(2026, 9, 3)) === 'Don-nhap-nha_03-10-2026.xlsx');
var empty = XuatFile.buildWorkbook(PL.classify([], {}), ExcelJS);
check('Sheet trống vẫn có tiêu đề', empty.getWorksheet('Minh Long').getRow(1).getCell(1).value === 'SKU');

wb.xlsx.writeBuffer().then(function (buf) {
  var out = path.join(MAU, 'ket-qua-kiem-thu.xlsx');
  fs.writeFileSync(out, Buffer.from(buf));
  var back = XLSX.read(fs.readFileSync(out), { type: 'buffer' });
  var ha = XLSX.utils.sheet_to_json(back.Sheets['Hồng Ân']);
  check('Đọc lại file xuất: Hồng Ân có ' + kq2.nha.HA.length + ' dòng, cột số là kiểu số',
    ha.length === kq2.nha.HA.length && typeof ha[0]['Số lượng'] === 'number' && typeof ha[0]['Giá gốc'] === 'number');
  console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.  File xuất thử: mau/ket-qua-kiem-thu.xlsx');
  process.exit(loi ? 1 : 0);
});
