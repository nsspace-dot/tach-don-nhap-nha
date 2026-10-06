/* Kiểm thử Code.gs (Apps Script) bằng môi trường giả lập. Chạy: node test/kiemtra-appscript.js */
'use strict';
var GL = require('./gia-lap-apps-script.js');
var PL = require('../js/phanloai.js');

var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet) : '')); }
}
function soDongLs(m) { var s = m.ss.getSheetByName('LICH_SU'); return s ? s.getLastRow() - 1 : 0; }

var m = GL.taoMoiTruong();

console.log('\n1. Khởi tạo & đọc');
m.ctx.khoiTao();
check('Tạo đủ 7 sheet, bỏ Sheet1', m.ss.getSheets().map(function (s) { return s.getName(); }).join(',') === 'SKU_NHA,COMBO,COMBO_THANH_PHAN,LICH_SU,MA_CHUAN,LS_DAT_HANG,DON_DA_GHI');
var g = m.get();
check('GET danh mục rỗng', g.ok && g.skus.length === 0 && g.combos.length === 0, g);
check('POST ping (không cần PIN)', m.post('ping', {}).ok === true);
check('Hành động lạ → báo lỗi rõ ràng', /không hợp lệ/.test(m.post('xoaHet', {}).error || ''));
check('Body hỏng → báo lỗi, không sập', m.ctx.doPost({ postData: { contents: '{hỏng' } }).body.indexOf('"ok":false') >= 0);

console.log('\n2. SKU → nhà: gán tay luôn thắng tự học');
var r = m.post('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách A', nha: 'HA', nguon: 'tay' });
check('upsertSku (tay) trả về catalog mới', r.ok && r.catalog.skus.length === 1 && r.catalog.skus[0].nha === 'HA', r);
r = m.post('upsertSkuBatch', { items: [
  { key: 'sku:111', sku: '111', ten: 'Sách A', nha: 'KV', nguon: 'tu_hoc' },
  { key: 'sku:222', sku: '222', ten: 'Sách B', nha: 'KV', nguon: 'tu_hoc' },
  { key: 'sai-khoa', nha: 'HA', nguon: 'tu_hoc' }
] });
var a = r.catalog.skus.filter(function (e) { return e.key === 'sku:111'; })[0];
check('Tự học KHÔNG ghi đè gán tay', a.nha === 'HA' && a.nguon === 'tay', a);
check('Tự học thêm SKU mới, dòng lỗi bị bỏ qua không chặn cả lô', r.ok && r.soThayDoi === 1 && r.catalog.skus.length === 2, r.soThayDoi);
r = m.post('upsertSkuBatch', { items: [{ key: 'sku:222', sku: '222', ten: 'Sách B', nha: 'ML', nguon: 'tu_hoc' }] });
check('Tự học được sửa dữ liệu tự học cũ', r.catalog.skus.filter(function (e) { return e.key === 'sku:222'; })[0].nha === 'ML');
r = m.post('upsertSku', { key: 'sku:222', sku: '222', ten: 'Sách B', nha: 'HA', nguon: 'tay' });
check('Gán tay ghi đè tự học', r.catalog.skus.filter(function (e) { return e.key === 'sku:222'; })[0].nguon === 'tay');
check('Nhà không hợp lệ → lỗi', /Nhà không hợp lệ/.test(m.post('upsertSku', { key: 'sku:333', nha: 'XYZ' }).error || ''));
check('Khóa ten: (sách không mã vạch) lưu được', m.post('upsertSku', { key: PL.tenKey('Sách C', 'LẺ'), sku: '', ten: 'Sách C', nha: 'KHONG_NHAP' }).ok);
var truoc = soDongLs(m);
m.post('upsertSku', { key: 'sku:111', sku: '111', ten: 'Sách A', nha: 'HA', nguon: 'tay' });
check('Ghi lại y hệt → không thêm lịch sử thừa', soDongLs(m) === truoc);
check('SKU mã vạch giữ nguyên dạng chữ', m.ss.getSheetByName('SKU_NHA').getRange(2, 2, 1, 1).getValues()[0][0] === '111');

console.log('\n3. Combo');
var combo = {
  ten_combo: 'Combo Katakana + Hiragana', khoa: ['sku:55252'],
  thanh_phan: [
    { sku: '8935092825731', ten: 'Katakana', nha: 'HA', gia_goc: 25000, so_luong: 1 },
    { sku: '8935092825724', ten: 'Hiragana', nha: 'HA', gia_goc: 25000, so_luong: 1 }
  ]
};
r = m.post('upsertCombo', combo);
check('upsertCombo tạo mã C001', r.ok && r.combo_id === 'C001' && r.catalog.combos.length === 1, r.combo_id);
check('Thành phần lưu đủ, giá là số', r.catalog.combos[0].thanh_phan.length === 2 && r.catalog.combos[0].thanh_phan[0].gia_goc === 25000);
r = m.post('addComboKey', { combo_id: 'C001', khoa: 'sku:8935092825724' });
check('addComboKey gắn thêm khóa', r.catalog.combos[0].khoa.join(',') === 'sku:55252,sku:8935092825724', r.catalog.combos[0].khoa);
r = m.post('upsertCombo', { ten_combo: 'Combo khác', khoa: ['sku:8935092825724', 'sku:999'], thanh_phan: [{ ten: 'X', nha: 'KHAC' }] });
var c1 = r.catalog.combos.filter(function (c) { return c.combo_id === 'C001'; })[0];
check('1 khóa chỉ thuộc 1 combo (tự gỡ khỏi combo cũ)', r.combo_id === 'C002' && c1.khoa.join(',') === 'sku:55252', c1.khoa);
var rTk = m.post('upsertCombo', { ten_combo: 'Y', khoa: ['sku:1'], thanh_phan: [] });
check('Combo thiếu thành phần vẫn lưu được (app chỉ cảnh báo)', rTk.ok, rTk.error);
m.post('deleteCombo', { combo_id: rTk.combo_id });
check('Gắn khóa vào combo không tồn tại → lỗi', /Không tìm thấy combo/.test(m.post('addComboKey', { combo_id: 'C999', khoa: 'sku:1' }).error || ''));
r = m.post('deleteCombo', { combo_id: 'C002' });
check('deleteCombo xóa combo + thành phần', r.catalog.combos.length === 1 && m.ss.getSheetByName('COMBO_THANH_PHAN').getLastRow() === 3);
r = m.post('deleteSku', { key: 'sku:222' });
check('deleteSku', r.catalog.skus.every(function (e) { return e.key !== 'sku:222'; }));
check('Xóa thứ không có → lỗi rõ ràng', /Không tìm thấy/.test(m.post('deleteSku', { key: 'sku:222' }).error || ''));

console.log('\n3b. Xuất nguyên combo & đổi khóa mã vạch');
r = m.post('upsertCombo', { ten_combo: 'Combo GETV 3', khoa: ['sku:55889'], cach_xuat: 'nguyen', nha: 'HA', ma_he_thong: 'NS-CB1', ten_xuat: '', thanh_phan: [] });
var cn = r.catalog.combos.filter(function (c) { return c.combo_id === r.combo_id; })[0];
check('Lưu combo "nguyen" không cần thành phần', r.ok && cn.cach_xuat === 'nguyen' && cn.nha === 'HA' && cn.ma_he_thong === 'NS-CB1' && cn.thanh_phan.length === 0, r.error || cn);
var rN = m.post('upsertCombo', { ten_combo: 'Z', khoa: ['sku:1'], cach_xuat: 'nguyen', thanh_phan: [] });
check('Combo "nguyen" thiếu nhà vẫn lưu (nhà trống – app cảnh báo trước)', rN.ok && m.get().combos.filter(function (c) { return c.combo_id === rN.combo_id; })[0].nha === '', rN.error);
m.post('deleteCombo', { combo_id: rN.combo_id });
check('Combo không ghi cach_xuat → mặc định "tach"', m.get().combos.filter(function (c) { return c.combo_id === 'C001'; })[0].cach_xuat === 'tach');
r = m.post('upsertCombo', Object.assign({}, cn, { cach_xuat: 'tach', thanh_phan: [{ sku: '1', ten: 'Tập 1', nha: 'HA' }] }));
check('Đổi combo từ "nguyen" sang "tach"', r.catalog.combos.filter(function (c) { return c.combo_id === cn.combo_id; })[0].cach_xuat === 'tach');
var lsCx = m.get({ action: 'lichSu' }).lich_su[0];
check('LICH_SU ghi nhận đổi cách xuất (trước nguyen → sau tach)', JSON.parse(lsCx.du_lieu_cu).cach_xuat === 'nguyen' && JSON.parse(lsCx.du_lieu_moi).cach_xuat === 'tach');
m.post('addComboKey', { combo_id: 'C001', khoa: 'sku:8935092825724' });
r = m.post('doiKhoaCombo', { combo_id: 'C001', khoa_cu: 'sku:8935092825724', khoa_moi: ['sku:8935092825724|combo.ha'] });
var c001 = r.catalog.combos.filter(function (c) { return c.combo_id === 'C001'; })[0];
check('doiKhoaCombo: bỏ khóa mã vạch trơn, thêm khóa kèm phân loại', c001.khoa.indexOf('sku:8935092825724') < 0 && c001.khoa.indexOf('sku:8935092825724|combo.ha') >= 0, c001.khoa);
check('doiKhoaCombo có ghi LICH_SU', m.get({ action: 'lichSu' }).lich_su[0].hanh_dong === 'doiKhoaCombo');
var truocDk = soDongLs(m);
m.post('doiKhoaCombo', { combo_id: 'C001', khoa_cu: 'sku:8935092825724', khoa_moi: ['sku:8935092825724|combo.ha'] });
check('Đổi khóa lần 2 (máy khác đã đổi) → không ghi thừa', soDongLs(m) === truocDk);

console.log('\n3c. Sheet COMBO bản cũ (4 cột) vẫn đọc được');
var m2 = GL.taoMoiTruong();
m2.ctx.khoiTao();
var shC = m2.ss.getSheetByName('COMBO');
shC.data = [['combo_id', 'ten_combo', 'khoa', 'cap_nhat'], ['C001', 'Combo cũ', 'sku:55252', '2026-10-01 10:00:00']];
m2.ss.getSheetByName('COMBO_THANH_PHAN').data.push(['C001', '1', 'Sách A', 'HA', 25000, 1]);
var g2 = m2.get();
check('Combo cũ chưa có cach_xuat → coi là "tach"', g2.ok && g2.combos[0].cach_xuat === 'tach' && g2.combos[0].thanh_phan.length === 1, g2);
check('Tiêu đề sheet COMBO tự bổ sung cột mới', shC.data[0].join(',') === 'combo_id,ten_combo,khoa,cap_nhat,cach_xuat,ma_he_thong,ten_xuat,nha', shC.data[0]);

console.log('\n4. Nạp Excel hàng loạt');
r = m.post('importBatch', {
  skus: [{ key: 'sku:444', sku: '444', ten: 'Sách D', nha: 'ML', nguon: 'tay' }, { key: 'sku:555', nha: 'SAI' }],
  combos: [{ combo_id: 'C010', ten_combo: 'Combo nạp', khoa: ['sku:777'], thanh_phan: [{ sku: '444', ten: 'Sách D', nha: 'ML', gia_goc: 10000, so_luong: 2 }] }]
});
check('importBatch nạp dòng đúng, báo dòng lỗi', r.ok && r.loi.length === 1 && r.catalog.combos.some(function (c) { return c.combo_id === 'C010'; }), r.loi);

console.log('\n5. Lịch sử (chỉ thêm dòng)');
var ls = m.get({ action: 'lichSu' });
check('GET lichSu trả về, mới nhất ở trên', ls.ok && ls.lich_su[0].hanh_dong === 'importBatch', ls.lich_su[0]);
var del = ls.lich_su.filter(function (x) { return x.hanh_dong === 'deleteSku'; })[0];
check('Xóa có ghi dữ liệu cũ', del && JSON.parse(del.du_lieu_cu).key === 'sku:222' && del.du_lieu_moi === '');
check('Có ghi việc chuyển khóa giữa 2 combo', ls.lich_su.some(function (x) { return x.hanh_dong === 'boKhoa' && x.khoa === 'sku:8935092825724'; }));
var dem = [];
for (var i = 0; i < 120; i++) {
  m.post('upsertSku', { key: 'sku:9' + i, sku: '9' + i, ten: 'S' + i, nha: 'HA', nguon: 'tay' });
  dem.push(soDongLs(m));
}
check('Lịch sử chỉ tăng, không bao giờ giảm', dem.every(function (v, i) { return i === 0 || v > dem[i - 1]; }));
check('GET lichSu tối đa 100 dòng', m.get({ action: 'lichSu' }).lich_su.length === 100);

console.log('\n6. Sao lưu tự động');
m.ctx.caiDatSaoLuuTuDong();
check('Cài trigger hằng ngày lúc 23h', m.triggers().length === 1 && m.triggers()[0].hour === 23 && m.triggers()[0].fn === 'saoLuuHangNgay');
m.ctx.caiDatSaoLuuTuDong();
check('Chạy lại không tạo trigger trùng', m.triggers().length === 1);
var bk = m.files[m.props.SAO_LUU_ID];
var ten = bk.getSheets().map(function (s) { return s.getName(); });
check('File sao lưu có 3 sheet của hôm nay (không còn Sheet1)', ten.length === 3 && ten.every(function (t) { return /^\d{4}-\d{2}-\d{2} (SKU_NHA|COMBO|COMBO_THANH_PHAN)$/.test(t); }), ten);
for (var d = 1; d <= 35; d++) {
  ['SKU_NHA', 'COMBO', 'COMBO_THANH_PHAN'].forEach(function (t) { bk.insertSheet('2020-01-' + (d < 10 ? '0' : '') + d + ' ' + t); });
}
m.ctx.saoLuuHangNgay();
var ngays = {};
bk.getSheets().forEach(function (s) { ngays[s.getName().slice(0, 10)] = 1; });
check('Chỉ giữ 30 bản gần nhất', Object.keys(ngays).length === 30 && !ngays['2020-01-01'] && Object.keys(ngays).some(function (k) { return k > '2025'; }), Object.keys(ngays).length);

console.log('\n7. Khôi phục từ sao lưu');
var homNay = Object.keys(ngays).sort().reverse()[0];
var soSkuTruoc = m.get().skus.length;
m.post('deleteSku', { key: 'sku:444' });
m.post('deleteCombo', { combo_id: 'C001' });
m.ctx.NGAY_KHOI_PHUC = homNay;
m.ctx.khoiPhucSaoLuu();
var sau = m.get();
check('Khôi phục lấy lại SKU và combo đã xóa', sau.skus.length === soSkuTruoc && sau.combos.some(function (c) { return c.combo_id === 'C001' && c.thanh_phan.length === 2; }), [sau.skus.length, soSkuTruoc]);
check('Có ghi lịch sử khôi phục + bản "truoc-khoi-phuc"', m.get({ action: 'lichSu' }).lich_su[0].hanh_dong === 'khoiPhuc' &&
  bk.getSheets().some(function (s) { return /^truoc-khoi-phuc /.test(s.getName()); }));

console.log('\n8. Danh mục từ Apps Script dùng được cho phân loại');
var cat = m.get();
var kq = PL.classify([{ san: 'TikTok', orderId: '1', sku: '55252', ten: 'Combo Katakana + Hiragana (Bộ 2 Cuốn) - HA', phanLoai: 'COMBO HA (2 cuốn)', gia: 50000, sl: 3 }],
  { skus: cat.skus, combos: cat.combos });
check('Combo 55252 tách đúng 3 Katakana + 3 Hiragana', kq.nha.HA.length === 2 && kq.nha.HA.every(function (x) { return x.sl === 3; }));

console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.');
process.exit(loi ? 1 : 0);
