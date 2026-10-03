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

console.log('\n1b. Nhiều file cùng sàn – chống trùng đơn giữa các file');
var f = function (p, ten) { return { file: ten, san: p.san, rowsGoc: p.rows.slice() }; };
var tongDong = function (ds) { return ds.reduce(function (s, x) { return s + x.rows.length; }, 0); };
var ds = DocFile.gopFile([f(tt, 'tiktok.xlsx'), f(sp, 'shopee.xlsx')]);
check('TikTok + Shopee: không đơn nào trùng, đủ 141 dòng', tongDong(ds) === 141 && ds[0].soDonTrung === 0 && ds[1].soDonTrung === 0);
var demDon = function (rs) { var o = {}; rs.forEach(function (r) { o[r.orderId] = 1; }); return Object.keys(o).length; };
var soDonTT = demDon(tt.rows);
var nhieuDong = tt.rows.filter(function (r, i, a) { return a.filter(function (x) { return x.orderId === r.orderId; }).length > 1; });
check('Trong 1 file, 1 đơn nhiều dòng vẫn giữ đủ (có ' + nhieuDong.length + ' dòng thuộc đơn nhiều sản phẩm)', nhieuDong.length > 0 && ds[0].rows.length === 103);
ds = DocFile.gopFile([f(tt, 'tiktok.xlsx'), f(tt, 'tiktok-ban-sao.xlsx')]);
check('Thả lại cùng file TikTok: file sau 0 đơn mới, bỏ qua ' + soDonTT + ' đơn trùng', ds[1].soDonMoi === 0 && ds[1].soDonTrung === soDonTT && tongDong(ds) === 103,
  [ds[1].soDonMoi, ds[1].soDonTrung]);
// Chia file TikTok thành 2 "gian hàng" có phần đơn chồng lên nhau
var ids = []; tt.rows.forEach(function (r) { if (ids.indexOf(r.orderId) < 0) ids.push(r.orderId); });
var A = ids.slice(0, 60), B = ids.slice(40);
var fa = { file: 'gian-1.xlsx', san: 'TikTok', rowsGoc: tt.rows.filter(function (r) { return A.indexOf(r.orderId) >= 0; }) };
var fb = { file: 'gian-2.xlsx', san: 'TikTok', rowsGoc: tt.rows.filter(function (r) { return B.indexOf(r.orderId) >= 0; }) };
ds = DocFile.gopFile([fa, fb, f(sp, 'shopee.xlsx')]);
check('2 file TikTok chồng 20 đơn: file 2 bỏ qua 20 đơn trùng, cộng thêm ' + (B.length - 20) + ' đơn mới', ds[1].soDonTrung === 20 && ds[1].soDonMoi === B.length - 20, [ds[1].soDonTrung, ds[1].soDonMoi]);
check('Tổng sau gộp vẫn đúng 141 dòng', tongDong(ds) === 141, tongDong(ds));
var kqGop = PL.classify(ds.reduce(function (a, x) { return a.concat(x.rows); }, []), { skus: [], combos: [] });
check('Kết quả phân loại sau gộp vẫn HA 43 / KV 5', kqGop.dongTheoNha.HA === 43 && kqGop.dongTheoNha.KV === 5);
ds = DocFile.gopFile([fb, f(sp, 'shopee.xlsx')]); // gỡ file gian-1 ra
check('Gỡ file 1 → file 2 tính lại, không còn đơn trùng', ds[0].soDonTrung === 0 && ds[0].soDonMoi === B.length);
var spGia = { file: 'x.xlsx', san: 'Shopee', rowsGoc: [{ san: 'Shopee', orderId: tt.rows[0].orderId, sku: '1', ten: 'X', phanLoai: '', gia: 1, sl: 1 }] };
ds = DocFile.gopFile([f(tt, 'tiktok.xlsx'), spGia]);
check('Trùng mã đơn nhưng khác sàn → không coi là trùng', ds[1].soDonTrung === 0 && ds[1].rows.length === 1);

console.log('\n2. Nhận mã nhà (regex)');
var f = function (s) { return PL.findCodes(s, PL.RE_NHA).join(','); };
[['Sách - X - HA', 'HA'], ['Sách - X - HA - Newshop', 'HA'], ['X - HA - Tác Giả Lê Thị Nương', 'HA'],
 ['Kết Nối) _HA', 'HA'], ['Mĩ Thuật (HA)', 'HA'], ['COMBO.HA', 'HA'], ['COMBO HA (2 cuốn)', 'HA'],
 ['KV07 - PHONG THỦY', ''], ['HAI', ''], ['Hà Nội', ''], ['Lịch Sử 9 - KV - Newshop', 'KV'], ['-HA', 'HA']
].forEach(function (c) { check('"' + c[0] + '" → ' + (c[1] || '(không có)'), f(c[0]) === c[1], f(c[0])); });

console.log('\n2b. Việc 1 – Làm gọn tên sách');
JSON.parse(fs.readFileSync(path.join(__dirname, 'vi-du-ten-gon.json'), 'utf8')).forEach(function (v) {
  var g = PL.tenGon(v[0]);
  check('"' + v[0].slice(0, 45) + '…" → "' + v[1].slice(0, 40) + '…"', g === v[1], g);
});
check('Không có mã nhà, không Newshop → giữ nguyên', PL.tenGon('Sách - Tuyển Tập 25 Năm Đề Thi Olympic 30 Tháng 4 Ngữ Văn 10') === 'Tuyển Tập 25 Năm Đề Thi Olympic 30 Tháng 4 Ngữ Văn 10');
check('Mã nhà khác (MEGA, NS…) cũng cắt hậu tố', PL.tenGon('Sách Tâm Lý - Đắc Nhân Tâm (NS) - Newshop') === 'Đắc Nhân Tâm' && PL.tenGon('Sách - Takenote - Kiến Thức Toán Và Dạng Toán 5 - MEGA - Newshop') === 'Takenote - Kiến Thức Toán Và Dạng Toán 5');
check('Tên làm gọn rỗng → giữ tên gốc', PL.tenGon('HA') === 'HA');
check('Không đổi dữ liệu gốc: dòng vẫn giữ tên gốc', rows[0].ten === 'Sách - Hướng Dẫn Giải VIOLYMPIC Toán 1 - HA');

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
    khoa: ['sku:55252', 'sku:8935092825724|combo.ha'], // 55252 (TikTok + Shopee) và dòng Shopee "Hiragana (HA)" COMBO.HA
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
check('Đếm dòng HA vẫn = 43 sau khi khai báo combo', kq2.dongTheoNha.HA === 43, kq2.dongTheoNha.HA);
check('Không còn dòng Hiragana giá 50.000', !hira.some(function (g) { return g.gia === 50000; }));
check('Combo trộn nhà (không SKU) vẫn ở Combo vì chưa khai báo', kq2.combo.some(function (g) { return /MEGA/.test(g.phanLoai); }));
check('Dòng combo trộn nhà được đánh dấu tronNha (không cho xuất nguyên)', kq2.combo.filter(function (g) { return /MEGA/.test(g.phanLoai); }).every(function (g) { return g.tronNha; }) &&
  kq2.combo.filter(function (g) { return g.sku === '55889'; }).every(function (g) { return !g.tronNha; }));
check('Tên thành phần combo cũng được làm gọn', kata[0].tenGon === 'Tập Viết Tiếng Nhật Katakana' && hira[0].tenGon === 'Tập Viết Tiếng Nhật Hiragana', [kata[0].tenGon, hira[0].tenGon]);

console.log('\n4b. Việc 3 – Khóa combo có SKU là mã vạch');
var rowHiraCombo = rows.filter(function (r) { return r.sku === HIRA; })[0];
check('Dòng Shopee COMBO.HA (SKU mã vạch) → khóa "sku:8935092825724|combo.ha"', PL.rowKey(rowHiraCombo) === 'sku:8935092825724|combo.ha', PL.rowKey(rowHiraCombo));
check('SKU không phải mã vạch (55252) giữ khóa "sku:55252"', PL.rowKey(rows.filter(function (r) { return r.sku === '55252'; })[0]) === 'sku:55252');
check('Sách lẻ mã vạch vẫn dùng khóa "sku:<mã>"', PL.rowKey({ sku: '8935092845425', ten: 'Sách - X - HA', phanLoai: 'LẺ' }) === 'sku:8935092845425');
var catCu = JSON.parse(JSON.stringify(catalog));
catCu.combos[0].khoa = ['sku:55252', 'sku:8935092825724']; // combo khai báo trước đây bằng mã vạch trơn
var kqCu = PL.classify(rows, catCu);
check('Combo dùng khóa mã vạch trơn (cũ) vẫn được nhận', kqCu.nha.HA.filter(function (g) { return g.sku === HIRA; }).reduce(function (a, g) { return a + g.sl; }, 0) === 11);
check('…và được đề nghị đổi sang khóa mới', kqCu.doiKhoa.length === 1 && kqCu.doiKhoa[0].khoa_cu === 'sku:8935092825724' &&
  kqCu.doiKhoa[0].khoa_moi.join(',') === 'sku:8935092825724|combo.ha', kqCu.doiKhoa);
check('Khóa mới rồi thì không đề nghị đổi nữa', kq2.doiKhoa.length === 0);
var leMaVach = { san: 'TikTok', orderId: '9', sku: HIRA, ten: 'Sách - Tập Viết Tiếng Nhật Hiragana (HA)', phanLoai: 'LẺ', gia: 25000, sl: 1 };
check('Sách lẻ trùng mã vạch Hiragana KHÔNG bị nhận nhầm thành combo', PL.classify([leMaVach], catalog).nha.HA[0].sl === 1 &&
  PL.classify([leMaVach], catalog).nha.HA.length === 1 && PL.classify([leMaVach], catalog).nha.HA[0].sku === HIRA);

console.log('\n4c. Việc 2 – Xuất nguyên combo');
var cbNguyen = { combo_id: 'C2', ten_combo: 'Combo Giúp Em Học Tốt Tiếng Việt Lớp 3 - Tập 1 + 2', khoa: ['sku:55889'],
  cach_xuat: 'nguyen', nha: 'HA', ma_he_thong: '', ten_xuat: '', thanh_phan: [] };
var catNguyen = { skus: [], combos: catalog.combos.concat([cbNguyen]) };
var kqN = PL.classify(rows, catNguyen);
var d55889 = kqN.nha.HA.filter(function (g) { return g.sku === '55889'; });
check('Khai báo 55889 "Xuất nguyên combo" → Hồng Ân có 1 dòng SKU 55889, SL 1', d55889.length === 1 && d55889[0].sl === 1, d55889.map(function (g) { return [g.sku, g.sl]; }));
check('Tên đã làm gọn', d55889[0] && d55889[0].tenGon === 'Combo Giúp Em Học Tốt Tiếng Việt Lớp 3 - Tập 1 + 2 (Dùng Kèm SGK Kết Nối Tri Thức) (Bộ 2 Cuốn)', d55889[0] && d55889[0].tenGon);
check('Giá gốc = giá combo trên sàn (118.000)', d55889[0] && d55889[0].gia === 118000);
check('55889 không còn ở sheet Combo', !kqN.combo.some(function (g) { return g.sku === '55889'; }));
check('Đếm dòng HA vẫn = 43', kqN.dongTheoNha.HA === 43, kqN.dongTheoNha.HA);
var cbN2 = Object.assign({}, cbNguyen, { khoa: ['sku:55889', 'sku:SP-55889'], ma_he_thong: 'NS-CB-TV3', ten_xuat: 'Combo GETV Lớp 3 (2 tập)' });
var dongShopee = { san: 'Shopee', orderId: 'X1', sku: 'SP-55889', ten: 'Sách - Combo Giúp Em Học Tốt Tiếng Việt Lớp 3 - Tập 1 + 2 - HA', phanLoai: 'COMBO', gia: 118000, sl: 2 };
var kqN2 = PL.classify(rows.concat([dongShopee]), { skus: [], combos: [cbN2] });
var d2 = kqN2.nha.HA.filter(function (g) { return g.sku === 'NS-CB-TV3'; });
check('Gộp đơn 2 sàn (khác SKU, cùng combo) thành 1 dòng, cộng SL = 3', d2.length === 1 && d2[0].sl === 3, d2.map(function (g) { return [g.sku, g.sl]; }));
check('Dùng "Mã trên hệ thống" và "Tên xuất" khi có', d2[0] && d2[0].tenGon === 'Combo GETV Lớp 3 (2 tập)' && !d2[0].skuLa);

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

console.log('\n6b. File mẫu nạp danh mục');
global.PhanLoai = PL;
var DX = require('../js/danhmuc-excel.js');
var mauNap = DX.nap(XLSX.read(XLSX.write(DX.mau(XLSX), { type: 'buffer', bookType: 'xlsx' })), XLSX);
check('File mẫu nạp lại được: 3 SKU, combo tách 2 thành phần + combo xuất nguyên, không lỗi', mauNap.skus.length === 3 && mauNap.combos.length === 2 &&
  mauNap.combos[0].thanh_phan.length === 2 && mauNap.loi.length === 0, mauNap.loi);
check('Khóa "55252 ;; 8935092825724|COMBO.HA" → sku:55252, sku:8935092825724|combo.ha', mauNap.combos[0].khoa.join(',') === 'sku:55252,sku:8935092825724|combo.ha', mauNap.combos[0].khoa);
check('Combo mẫu C002 là "nguyen", nhà HA, không cần thành phần', mauNap.combos[1].cach_xuat === 'nguyen' && mauNap.combos[1].nha === 'HA' && mauNap.combos[1].thanh_phan.length === 0);
var napLoi = DX.nap((function () {
  var w = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet([['combo_id', 'ten_combo', 'khoa', 'cach_xuat', 'nha'], ['C9', 'X', '111', 'nguyen', '']]), 'COMBO');
  return w;
})(), XLSX);
check('Nạp combo "nguyen" thiếu nhà → báo lỗi', napLoi.combos.length === 0 && /cần cột nha/.test(napLoi.loi[0] || ''), napLoi.loi);
var xuatLai = DX.nap(XLSX.read(XLSX.write(DX.xuat({ skus: mauNap.skus, combos: mauNap.combos }, XLSX), { type: 'buffer', bookType: 'xlsx' })), XLSX);
check('Xuất danh mục rồi nạp lại giữ nguyên', JSON.stringify(xuatLai.skus) === JSON.stringify(mauNap.skus) && JSON.stringify(xuatLai.combos) === JSON.stringify(mauNap.combos));

console.log('\n7. Xuất Excel');
var wb = XuatFile.buildWorkbook(kqN, ExcelJS); // có combo Katakana+Hiragana (tách) và 55889 (xuất nguyên)
check('Có đủ 5 sheet đúng thứ tự', wb.worksheets.map(function (w) { return w.name; }).join(',') === 'Hồng Ân,Khang Việt,Minh Long,Combo,Chưa rõ nhà');
check('Tên file đúng mẫu', XuatFile.fileName(new Date(2026, 9, 3)) === 'Don-nhap-nha_03-10-2026.xlsx');
var empty = XuatFile.buildWorkbook(PL.classify([], {}), ExcelJS);
check('Sheet trống vẫn có tiêu đề', empty.getWorksheet('Minh Long').getRow(1).getCell(1).value === 'SKU');

wb.xlsx.writeBuffer().then(function (buf) {
  var out = path.join(MAU, 'ket-qua-kiem-thu.xlsx');
  fs.writeFileSync(out, Buffer.from(buf));
  var back = XLSX.read(fs.readFileSync(out), { type: 'buffer' });
  var ha = XLSX.utils.sheet_to_json(back.Sheets['Hồng Ân']);
  check('Đọc lại file xuất: Hồng Ân có ' + kqN.nha.HA.length + ' dòng, cột số là kiểu số',
    ha.length === kqN.nha.HA.length && typeof ha[0]['Số lượng'] === 'number' && typeof ha[0]['Giá gốc'] === 'number');
  check('Việc 1: tên trong file xuất đã làm gọn (không còn "Sách -", "- HA", "Newshop")', ha.every(function (r) {
    return !/^Sách\b.* - /.test(r['Tên sản phẩm']) && !/(?<![\p{L}\p{N}])(HA|KV|ML)(?![\p{L}\p{N}])/u.test(r['Tên sản phẩm']) && !/newshop/i.test(r['Tên sản phẩm']);
  }), ha.map(function (r) { return r['Tên sản phẩm']; }).filter(function (t) { return /HA|Newshop|^Sách/.test(t); }));
  check('Việc 1: sheet Combo và Chưa rõ nhà cũng dùng tên gọn', XLSX.utils.sheet_to_json(back.Sheets['Chưa rõ nhà'])[0]['Tên sản phẩm'] === 'Liễu Phàm Tứ Huấn' &&
    XLSX.utils.sheet_to_json(back.Sheets['Combo']).every(function (r) { return !/newshop/i.test(r['Tên sản phẩm']); }));
  check('Việc 2: dòng 55889 trong file xuất ở sheet Hồng Ân', ha.some(function (r) { return String(r.SKU) === '55889' && r['Số lượng'] === 1; }) &&
    !XLSX.utils.sheet_to_json(back.Sheets['Combo']).some(function (r) { return String(r.SKU) === '55889'; }));
  console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.  File xuất thử: mau/ket-qua-kiem-thu.xlsx');
  process.exit(loi ? 1 : 0);
});
