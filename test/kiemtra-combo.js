/* Kiểm thử nhận diện combo dạng "A+B", nghi combo theo giá, "Không phải combo", khai báo combo cho dòng trông như sách lẻ.
 * Chạy: node test/kiemtra-combo.js  (dữ liệu giả lập) */
'use strict';
var PL = require('../js/phanloai.js');
var XuatFile = require('../js/xuatfile.js');
var GL = require('./gia-lap-apps-script.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet) : '')); }
}
var TG = '8936067606331', VN = '8936238100101';
var TEN = 'Sách - Tuyển Tập Truyện Cổ Tích Việt Nam Dành Cho Thiếu Nhi (ML)';
function sp(id, sku, ten, pl, gia, sl) { return { san: 'Shopee', orderId: id, sku: sku, ten: ten, phanLoai: pl, gia: gia, sl: sl || 1 }; }
var rong = function () { return { skus: [], combos: [], ma_chuan: [] }; };
var coTich = [sp('1', TG, TEN, 'Cổ tích Thế Giới', 125000), sp('2', VN, TEN, 'Cổ tích Việt Nam', 125000), sp('3', '', TEN, 'CỔ TÍCH VN+TG (ML)', 250000)];

console.log('\n1. Bộ cổ tích: 2 cuốn lẻ + 1 dòng "VN+TG" SKU trống 250.000');
var kq = PL.classify(coTich, rong());
check('Minh Long chỉ còn 2 dòng lẻ (Thế Giới, Việt Nam)', kq.nha.ML.length === 2 && kq.nha.ML.every(function (g) { return g.sku === TG || g.sku === VN; }),
  kq.nha.ML.map(function (g) { return [g.sku, g.gia]; }));
var cb = kq.combo.filter(function (g) { return /VN\+TG/.test(g.phanLoai); })[0];
check('Dòng "VN+TG" sang tab Combo, nhãn nghi combo, đoán nhà ML', cb && cb.nghiCombo && cb.nha === 'ML', cb && [cb.nghiCombo, cb.nha, cb.comboLyDo]);
check('Lý do có cả dạng "A+B" và giá = tổng 2 phân loại', cb && /A\+B/.test(cb.comboLyDo) && /250000 = /.test(cb.comboLyDo), cb && cb.comboLyDo);
check('Gợi ý thành phần: Thế Giới + Việt Nam (có barcode)', cb && cb.goiYTp.length === 2 && cb.goiYTp.map(function (x) { return x.sku; }).sort().join(',') === [TG, VN].sort().join(','), cb && cb.goiYTp);
check('Tên gợi ý thành phần có phân loại', cb && cb.goiYTp.some(function (x) { return /– Cổ tích Thế Giới$/.test(x.ten); }), cb && cb.goiYTp);

console.log('\n2. Khai báo combo = TG + VN');
var cat = rong();
cat.combos.push({ combo_id: 'C1', ten_combo: 'Cổ tích VN + TG', khoa: [cb.key], cach_xuat: 'tach', thanh_phan: [
  { sku: TG, ten: 'Truyện Cổ Tích Thế Giới', nha: 'ML', gia_goc: 125000, so_luong: 1 },
  { sku: VN, ten: 'Truyện Cổ Tích Việt Nam', nha: 'ML', gia_goc: 125000, so_luong: 1 }] });
kq = PL.classify(coTich, cat);
var sl = function (s) { return kq.nha.ML.filter(function (g) { return g.sku === s; }).reduce(function (t, g) { return t + g.sl; }, 0); };
check('Minh Long: Thế Giới 2, Việt Nam 2, không còn dòng 250.000', sl(TG) === 2 && sl(VN) === 2 && kq.nha.ML.length === 2 && kq.combo.length === 0,
  kq.nha.ML.map(function (g) { return [g.sku, g.gia, g.sl]; }));
var d = XuatFile.dongCuaNha(kq, 'ML');
check('File Minh Long 2 dòng, mỗi dòng 2 cuốn, giá 125.000', d.length === 2 && d.every(function (x) { return x.sl === 2 && x.gia === 125000; }), d);

console.log('\n3. Nhận diện "A+B"');
var laCombo = function (ten, pl) { return !!PL.lyDoComboCong({ ten: ten, phanLoai: pl || '' }); };
check('"VN+TG", "Toán + Văn", "Q1+Q2" → combo', laCombo('Sách X', 'VN+TG') && laCombo('Sách X', 'Toán + Văn') && laCombo('Sách X', 'Q1+Q2') && laCombo('Bộ Toán + Văn Lớp 5', ''));
check('"C++", "Lớp 1+", "+" đứng cuối → không phải combo', !laCombo('Lập Trình C++ Cơ Bản', '') && !laCombo('Tiếng Anh Lớp 1+', '') && !laCombo('Sách Y +', 'Lẻ'));
check('"+" chỉ trong tên, phân loại đã chọn 1 cuốn ("Lớp 2") → không phải combo', !laCombo('Luyện Viết Tiếng Anh Lớp 1+2+3', 'LỚP 2'));
check('"+" trong tên, phân loại vô nghĩa ("Lẻ") → combo', laCombo('Luyện Viết Tiếng Anh Lớp 1+2+3', 'Lẻ'));
check('Quy tắc cũ giữ nguyên: "Tập 1 + 2", "combo", "bộ 3 cuốn", "(2 cuốn)"', !!PL.comboReason({ ten: 'Toán 5 Tập 1 + 2', phanLoai: '' }) &&
  !!PL.comboReason({ ten: 'Combo Toán', phanLoai: '' }) && !!PL.comboReason({ ten: 'Trọn bộ 3 cuốn', phanLoai: '' }) && !!PL.comboReason({ ten: 'Sách (2 cuốn)', phanLoai: '' }));
kq = PL.classify([sp('9', '', 'Toán 5 Tập 1 + 2 - HA', '', 100000)], rong());
check('"Tập 1 + 2" vẫn vào tab Combo như cũ (không phải "nghi")', kq.combo.length === 1 && !kq.combo[0].nghiCombo);

console.log('\n4. Nghi combo theo giá (không có dấu "+")');
var bo = [sp('1', TG, TEN, 'Thế Giới', 125000), sp('2', VN, TEN, 'Việt Nam', 125000), sp('3', 'BO2', TEN, 'Trọn bộ', 247600)];
kq = PL.classify(bo, rong());
var nb = kq.combo.filter(function (g) { return g.phanLoai === 'Trọn bộ'; })[0];
check('Giá 247.600 ≈ 125.000 + 125.000 (lệch ≤ 2%), SKU không phải barcode → nghi combo', nb && nb.nghiCombo && /theo giá/.test(nb.comboLyDo), kq.combo);
kq = PL.classify([sp('1', TG, TEN, 'Thế Giới', 125000), sp('2', VN, TEN, 'Việt Nam', 125000), sp('3', '', TEN, 'Trọn bộ', 240000)], rong());
check('Lệch 4% → không nghi', kq.combo.length === 0);
kq = PL.classify([sp('1', TG, TEN, 'Thế Giới', 125000), sp('2', VN, TEN, 'Việt Nam', 125000), sp('3', '8935092845425', TEN, 'Trọn bộ', 250000)], rong());
check('Phân loại có barcode hợp lệ → không nghi theo giá', kq.combo.length === 0);
kq = PL.classify([sp('1', TG, TEN, 'Thế Giới', 125000), sp('3', '', TEN, 'Trọn bộ', 125000)], rong());
check('Chỉ bằng giá 1 phân loại (không phải tổng ≥ 2) → không nghi', kq.combo.length === 0);

console.log('\n5. "Không phải combo" (ghi nhớ trên Apps Script)');
var m = GL.taoMoiTruong();
m.ctx.khoiTao();
var r3 = coTich[2];
var r = m.post('khongPhaiCombo', { key: PL.rowKey(r3, false), sku: '', ten: r3.ten, phan_loai: r3.phanLoai, nha: 'ML' });
var e = r.catalog.skus[0];
check('Lưu khong_combo trên khóa sách lẻ (tên|phân loại), nguồn tự học', e && e.key === PL.rowKey(r3, false) && e.khong_combo === '1' && e.nguon === 'tu_hoc' && e.nha === 'ML', e);
kq = PL.classify(coTich, m.get());
check('Lần sau: dòng VN+TG trả về sách lẻ Minh Long (không nghi nữa)', kq.combo.length === 0 && kq.nha.ML.length === 3, kq.nha.ML.map(function (g) { return g.tenGon; }));
check('Ghi Lịch sử "khongPhaiCombo"', m.get({ action: 'lichSu' }).lich_su.some(function (x) { return x.hanh_dong === 'khongPhaiCombo'; }));
r = m.post('upsertSkuBatch', { items: [{ key: PL.rowKey(r3, false), sku: '', ten: r3.ten, nha: 'KV', nguon: 'tu_hoc' }] });
check('Tự học sau đó không làm mất ghi nhớ', r.catalog.skus[0].khong_combo === '1');
m.post('khongPhaiCombo', { key: PL.rowKey(r3, false), bo: true });
check('Bỏ ghi nhớ → lại nghi combo', PL.classify(coTich, m.get()).combo.length === 1);
cat = rong();
cat.skus.push({ key: PL.rowKey(r3, false), sku: '', ten: r3.ten, nha: 'ML', nguon: 'tay' });
check('Dòng đã gán tay là sách lẻ → không nghi', PL.classify(coTich, cat).combo.length === 0);

console.log('\n6. "🎁 Đây là combo" cho dòng trông như sách lẻ có barcode');
var le = [sp('1', '8935092845425', 'Sách - Bộ Đề Toán Lớp 5 - HA', 'Bản đặc biệt', 90000, 2)];
kq = PL.classify(le, rong());
check('Trước: là sách lẻ Hồng Ân', kq.nha.HA.length === 1 && kq.combo.length === 0);
cat = rong();
cat.combos.push({ combo_id: 'C2', ten_combo: 'Bộ đề Toán 5 (2 cuốn)', khoa: [PL.rowKey(le[0], true)], cach_xuat: 'tach', thanh_phan: [
  { sku: '8935092845432', ten: 'Đề Toán 5 Tập 1', nha: 'HA', gia_goc: 45000, so_luong: 1 },
  { sku: '8935092845449', ten: 'Đề Toán 5 Tập 2', nha: 'HA', gia_goc: 45000, so_luong: 1 }] });
kq = PL.classify(le, cat);
check('Khóa combo = barcode|phân loại; sau khi khai báo → tách 2 cuốn × 2', kq.nha.HA.length === 2 && kq.nha.HA.every(function (g) { return g.sl === 2; }) &&
  PL.rowKey(le[0], true) === 'sku:8935092845425|bản đặc biệt', kq.nha.HA.map(function (g) { return [g.sku, g.sl]; }));
kq = PL.classify([sp('1', '8935092845425', 'Sách - Bộ Đề Toán Lớp 5 - HA', 'Bản thường', 90000, 1)], cat);
check('Cùng barcode nhưng phân loại khác → vẫn là sách lẻ', kq.nha.HA.length === 1 && kq.nha.HA[0].sku === '8935092845425');
check('thanhPhanGoiY: các phân loại khác cùng sản phẩm có barcode', PL.thanhPhanGoiY(coTich[2], coTich).length === 2);

console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
if (loi) process.exitCode = 1;
