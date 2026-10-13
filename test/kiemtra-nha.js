/* Kiểm thử sổ nhà dùng chung: mặc định, nhận diện (mã trong tên / NCC web / tiền tố barcode), gán tay nhà mới,
 * nhà "Đặt hằng ngày" thứ 4, thêm / sửa / xóa nhà (chuyển sách). Chạy: node test/kiemtra-nha.js */
'use strict';
var GL = require('./gia-lap-apps-script.js');
var PL = require('../js/phanloai.js');
var XF = require('../js/xuatfile.js');
var TK = require('../js/thongke.js');
var BH = require('../js/banhang.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet).slice(0, 300) : '')); }
}
function dong(ten, sku, extra) { return Object.assign({ san: 'TikTok', orderId: String(Math.random()).slice(2, 12), sku: sku || '', ten: ten, phanLoai: '', gia: 50000, sl: 1, ngayDat: '2026-10-10' }, extra || {}); }
function ap(ds) { PL.datNha(ds); XF.datNha(PL.DS_NHA); }
function phanLoai(rows, cat) { return PL.classify(rows, cat || {}, { maKhac: PL.maNhapKho(), caNhaKhac: true }); }

console.log('\n1. Sổ nhà mặc định (chưa có sheet NHA) = HA/KV/ML + "Mã nhà khác" cũ');
var m = GL.taoMoiTruong(); m.ctx.khoiTao();
m.post('luuCaiDatChung', { maKhac: ['MEGA', 'VT', 'STK'] }, 'Tú');
var g = m.get();
check('GET kèm sổ nhà: 3 Đặt hằng ngày + mã nhà khác đã đặt (STK) là Nhập kho', g.api >= 6 && g.nha.filter(function (x) { return x.loai === 'hang_ngay'; }).map(function (x) { return x.ma; }).join(',') === 'HA,KV,ML' &&
  g.nha.filter(function (x) { return x.loai === 'nhap_kho'; }).map(function (x) { return x.ma; }).join(',') === 'MEGA,VT,STK', g.nha.map(function (x) { return x.ma; }));
check('Không mất dữ liệu: sheet NHA chưa ghi gì cho tới khi sửa', m.ss.getSheetByName('NHA').getLastRow() <= 1);

console.log('\n2. Nhận diện nhà mới: mã trong tên, tên NCC web, tiền tố barcode');
ap(g.nha.concat([{ ma: 'DT', ten: 'Đinh Tị', loai: 'nhap_kho', ma_ten: 'ĐT', ncc: 'đinh tị' }, ]).map(function (x, i) { return i === 0 ? Object.assign({}, x, {}) : x; }));
var ml = PL.DS_NHA.filter(function (x) { return x.ma === 'ML'; })[0]; ml.tien_to = ['8936067'];
var kq = phanLoai([dong('Sách Kỹ Năng Sống - DT'), dong('Sách Hay Cho Bé (ĐT)'), dong('Sách Web', '8935000000011', { san: 'Web', orderId: '', ncc: 'Công Ty Sách Đinh Tị', ngayXuat: '2026-10-10' }),
                   dong('Sách Không Có Mã Nhà', '8936067000017'), dong('Sách - Ôn Thi - HA')]);
check('Mã trong tên "DT" và bí danh "ĐT" → nhà DT (Nhập kho → dự báo, không vào đơn hằng ngày)', (kq.nhaKhac.DT || []).reduce(function (s, x) { return s + x.sl; }, 0) === 3 &&
  kq.boQua.filter(function (x) { return /Nhà khác/.test(x.lyDo); }).length === 3, Object.keys(kq.nhaKhac));
check('Tiền tố barcode 8936067 → ML (sách không có mã nhà trong tên)', kq.nha.ML.length === 1 && kq.nha.ML[0].sku === '8936067000017');
check('Mã HA trong tên vẫn → HA như cũ', kq.nha.HA.length === 1 && kq.chuaRo.length === 0);

console.log('\n3. Gán tay sách chưa rõ cho nhà "Nhập kho" mới → lần sau tự nhận, dự báo tính');
var r = m.post('themNha', { nha: { ma: 'DT', ten: 'Đinh Tị', loai: 'nhap_kho' } }, 'Lan');
check('Mọi người thêm được nhà mới (không cần mã Admin)', r.ok && r.nha.some(function (x) { return x.ma === 'DT' && x.ten === 'Đinh Tị'; }));
r = m.post('upsertSku', { key: 'sku:8935999000012', sku: '8935999000012', ten: 'Sách Lạ', nha: 'DT', nguon: 'tay' }, 'Lan');
check('Server nhận nhà DT cho dòng danh mục', r.ok && r.catalog.skus[0].nha === 'DT', r.error);
ap(r.nha || m.get().nha);
kq = phanLoai([dong('Sách Lạ', '8935999000012')], m.get());
check('Lần sau: dòng đó → nhà DT (không còn chưa rõ), có trong dự báo', !kq.chuaRo.length && (kq.nhaKhac.DT || []).length === 1);
r = m.post('upsertSku', { key: 'sku:1', sku: '1', ten: 'x', nha: 'XYZ', nguon: 'tay' }, 'Lan');
check('Nhà không có trong sổ → báo lỗi', !r.ok && /Nhà không hợp lệ/.test(r.error));

console.log('\n4. Đổi loại: thêm nhà "Đặt hằng ngày" thứ 4');
var ds = m.get().nha.map(function (x) { return x.ma === 'DT' ? Object.assign({}, x, { loai: 'hang_ngay' }) : x; });
r = m.postTho('luuNha', { ds: ds }, 'Lan');
check('Sửa sổ nhà không có mã Admin → từ chối', !r.ok && /^CAN_MA_ADMIN/.test(r.error));
r = m.post('luuNha', { ds: ds }, 'Tú');
check('Admin đổi DT thành "Đặt hằng ngày"', r.ok && r.nha.filter(function (x) { return x.loai === 'hang_ngay'; }).map(function (x) { return x.ma; }).join(',') === 'HA,KV,ML,DT');
ap(r.nha);
kq = phanLoai([dong('Sách Lạ', '8935999000012'), dong('Sách - Toán - KV')], m.get());
check('DT có bảng riêng như HA/KV/ML', PL.NHA.join(',') === 'HA,KV,ML,DT' && kq.nha.DT.length === 1 && kq.nha.KV.length === 1);
check('File đặt riêng của DT', XF.nhaCoHang(kq).join(',') === 'KV,DT' && XF.fileName('DT', new Date(2026, 9, 13)) === 'Don-dat-hang_Dinh-Ti_13-10-2026.xlsx');
var bg = TK.banGhiNgay(kq, PL.NHA.slice(), '2026-10-13');
r = m.post('chotDot', { dot_id: '2026-10-13', lich_su: bg, ban_hang: BH.maHoa([{ san: 'TikTok', rows: [dong('Sách Lạ', '8935999000012')] }], '2026-10-13') }, 'Tú');
var ls = m.get({ action: 'lichSuDatHang', tu: '2026-01-01' }).dong;
check('Chốt đợt ghi lịch sử cả nhà DT', r.ok && ls.some(function (x) { return x[1] === 'DT'; }), ls);

console.log('\n5. Xóa nhà đang có sách → chuyển sách sang nhà khác');
m.post('upsertCombo', { ten_combo: 'Combo có DT', khoa: ['sku:CB-1'], thanh_phan: [{ sku: '8935999000012', ten: 'Sách Lạ', nha: 'DT' }, { sku: '8935000000028', ten: 'B', nha: 'HA' }] }, 'Tú');
r = m.postTho('xoaNha', { ma: 'DT', chuyen_sang: 'MEGA' }, 'Lan');
check('Xóa nhà không mã Admin → từ chối', !r.ok && /^CAN_MA_ADMIN/.test(r.error));
r = m.post('xoaNha', { ma: 'DT', chuyen_sang: 'MEGA' }, 'Tú');
var cat = m.get();
check('Admin xóa DT: sách + thành phần combo chuyển sang MEGA', r.ok && r.soChuyen === 2 && !r.nha.some(function (x) { return x.ma === 'DT'; }) &&
  cat.skus.filter(function (e) { return e.key === 'sku:8935999000012'; })[0].nha === 'MEGA' && cat.combos[0].thanh_phan[0].nha === 'MEGA', r);
r = m.post('luuNha', { ds: [{ ma: 'MEGA', loai: 'nhap_kho' }] }, 'Tú');
check('Phải còn ít nhất 1 nhà Đặt hằng ngày', !r.ok && /Đặt hằng ngày/.test(r.error));
check('Lịch sử ghi thao tác sổ nhà', m.get({ action: 'lichSu' }).lich_su.some(function (x) { return x.hanh_dong === 'luuNha' && /Xóa nhà DT/.test(x.khoa); }));

console.log('\n6. Mặc định khi chưa có sổ nhà (Code.gs cũ): y như trước');
ap(PL.nhaMacDinh(['MEGA', 'VT']));
check('HA/KV/ML + MEGA, VT', PL.NHA.join(',') === 'HA,KV,ML' && PL.maNhapKho().join(',') === 'MEGA,VT' && XF.NHA.join(',') === 'HA,KV,ML');
check('NCC web: Hồng Ân → HA, MegaBook → nhà khác', PL.nhaTheoNcc('Nhà Sách Hồng Ân') === 'HA' && PL.nhaTheoNcc('Nhà Sách MegaBook') === 'KHAC' && PL.nhaCuaNcc('Nhà Sách MegaBook') === 'MEGA');

console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
process.exit(loi ? 1 : 0);
