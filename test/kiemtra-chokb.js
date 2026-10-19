/* Kiểm thử tab Chờ khai báo: nhà đoán được, tên gợi ý gọn, "Là sách lẻ", xác nhận tên + nhà, gán nhà, hàng loạt, ẩn có ghi LICH_SU.
 * Chạy: node test/kiemtra-chokb.js */
'use strict';
var GL = require('./gia-lap-apps-script.js');
var BH = require('../js/banhang.js');
var PL = require('../js/phanloai.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet).slice(0, 300) : '')); }
}
var so = 0;
function dong(sku, ten, pl) { return { san: 'TikTok', orderId: 'D' + (++so), sku: sku, ten: ten, phanLoai: pl || '', gia: 50000, sl: 1, ngayDat: '2026-10-15' }; }
var m = GL.taoMoiTruong(); m.ctx.khoiTao();
PL.datNha(m.get().nha);
var ROWS = [dong('CB-THO', 'Combo Thơ Cho Bé 3 Cuốn (HH)'), dong('8935000000011', 'Nấu Ăn Gia Đình (MEGA)', 'Nấu Ăn Gia Đình (1 cuốn)'),
            dong('8935000000028', 'Sách - Truyện Kiều (VT)', 'LẺ'), dong('8935000000035', 'Sách Toán Vui (QB)')];
function ck(deSau) { return BH.choKhaiBao(BH.tongHop([], m.get(), { maKhac: PL.maNhapKho() }, ROWS), deSau || {}); }
function tim(ds, loai, re) { return ds.filter(function (x) { return x.loai === loai && re.test(x.ten); })[0]; }

console.log('\n1. Nhà đoán được + tên gợi ý gọn');
var ds = ck();
var cb = tim(ds, 'combo_khac', /Thơ/);
check('Combo Thơ … (HH) → cột Nhà = HH', cb && cb.nha === 'HH', cb && cb.nha);
var na = tim(ds, 'ten', /Nấu Ăn/);
check('"Nấu Ăn Gia Đình – Nấu Ăn Gia Đình (1 cuốn)" → gợi ý "Nấu Ăn Gia Đình"', na && PL.tenGoiY(na.g.tenSan, na.g.phanLoai, PL.maNhapKho()) === 'Nấu Ăn Gia Đình', na && na.ten);
var tk = tim(ds, 'ten', /Truyện Kiều/);
check('Bỏ "LẺ" / "Mặc định" / "Not Specified"', PL.tenGoiY(tk.g.tenSan, tk.g.phanLoai, PL.maNhapKho()) === 'Truyện Kiều' &&
  PL.tenGoiY('Toán Lớp 1', 'Not Specified') === 'Toán Lớp 1' && PL.tenGoiY('Bé Tô Màu', 'Mặc định') === 'Bé Tô Màu');
check('Phân loại có nghĩa vẫn giữ', PL.tenGoiY('Bé Học Màu', 'Tập 2') === 'Bé Học Màu – Tập 2');

console.log('\n2. Xác nhận tên + nhà (1 lần bấm), hàng loạt');
var r = m.post('khaiBaoLo', { items: [
  { viec: 'ten', key: na.g.khoaTen, sku: na.g.sku, ten: na.g.tenSan, phan_loai: na.g.phanLoai, nha: 'MEGA', ten_sach: 'Nấu Ăn Gia Đình' },
  { viec: 'ten', key: tk.g.khoaTen, sku: tk.g.sku, ten: tk.g.tenSan, phan_loai: tk.g.phanLoai, nha: 'VT', ten_sach: 'Truyện Kiều' }] }, 'Lan');
check('api 7, lưu 2 sách', m.get().api === 7 && r.ok && r.soThayDoi === 2 && !r.loi.length, r);
ds = ck();
check('Đã xác nhận → biến khỏi danh sách', !tim(ds, 'ten', /Nấu Ăn|Truyện Kiều/));
var e = m.get().skus.filter(function (x) { return x.key === na.g.khoaTen; })[0];
check('Danh mục: tên + nhà, nguồn tay', e && e.ten_sach === 'Nấu Ăn Gia Đình' && e.nha === 'MEGA' && e.nguon === 'tay', e);

console.log('\n3. Đổi nhà tại chỗ (nguồn tay)');
var qb = tim(ds, 'ten', /Toán Vui/);
r = m.post('khaiBaoLo', { items: [{ viec: 'nha', key: qb.g.khoaTen, sku: qb.g.sku, ten: qb.g.tenSan, nha: 'TN' }] }, 'Lan');
ds = ck();
check('Sách QB → TN: dòng chuyển sang nhà TN', r.ok && tim(ds, 'ten', /Toán Vui/).nha === 'TN', tim(ds, 'ten', /Toán Vui/));

console.log('\n4. Combo → "📖 Là sách lẻ" (nhà + tên)');
var row = cb.g.lines[0].row;
r = m.post('khaiBaoLo', { items: [{ viec: 'le', key_le: PL.khoaKhongCombo(row), key: PL.rowKey(row, false), sku: row.sku, ten: row.ten, phan_loai: row.phanLoai, nha: 'HH', ten_sach: 'Thơ Cho Bé' }] }, 'Lan');
ds = ck();
var t = BH.tongHop([], m.get(), { maKhac: PL.maNhapKho() }, ROWS);
var hh = (t.kq.nhaKhac.HH || [])[0];
check('Không còn combo chưa khai báo; thành sách lẻ HH tên "Thơ Cho Bé"', r.ok && !tim(ds, 'combo_khac', /Thơ/) && hh && hh.tenGon === 'Thơ Cho Bé' && !hh.chuaCoTen, hh);

console.log('\n5. Ẩn / bỏ ẩn có ghi LICH_SU; mọi thao tác đều ghi');
r = m.post('deSau', { khoa: 'bo:ten|TN|x', ten: 'Toán Vui' }, 'Lan');
m.post('deSau', { khoa: 'bo:ten|TN|x', ten: 'Toán Vui', bo: true }, 'Lan');
var ls = m.get({ action: 'lichSu' }).lich_su.map(function (x) { return x.hanh_dong; });
check('LICH_SU: ẩn, bỏ ẩn, tên sách, gán nhà, không phải combo', ['anChoKhaiBao', 'boAnChoKhaiBao', 'luuTenSach', 'upsertSku', 'khongPhaiCombo'].every(function (h) { return ls.indexOf(h) >= 0; }), ls);
r = m.post('khaiBaoLo', { items: [{ viec: 'ten', key: 'sku:1', nha: 'MEGA', ten_sach: '' }, { viec: 'nha', key: 'sku:2', nha: 'XYZ' }] }, 'Lan');
check('Dòng lỗi báo lại, không chặn cả lô', r.ok && r.loi.length === 2, r);

console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
process.exit(loi ? 1 : 0);
