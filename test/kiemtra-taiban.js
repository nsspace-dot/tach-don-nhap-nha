/* Kiểm thử "Giá gần nhất" và "Thay mã tái bản": Code.gs (giả lập) + phân loại + xuất Excel, dùng 2 file mẫu.
 * Chạy: node test/kiemtra-taiban.js   (cần mau/tiktok.xlsx, mau/shopee.xlsx) */
'use strict';
var fs = require('fs');
var path = require('path');
var XLSX = require('../lib/xlsx-0.18.5.full.min.js');
var ExcelJS = require('../lib/exceljs-4.4.0.min.js');
var DocFile = require('../js/docfile.js');
var PL = require('../js/phanloai.js');
var XuatFile = require('../js/xuatfile.js');
var GL = require('./gia-lap-apps-script.js');

var MAU = path.join(__dirname, '..', 'mau');
if (!fs.existsSync(path.join(MAU, 'tiktok.xlsx')) || !fs.existsSync(path.join(MAU, 'shopee.xlsx'))) {
  console.log('Thiếu file mẫu trong mau/ → bỏ qua.');
  process.exit(0);
}
var loi = 0, dat = 0;
function check(ten, ok, chiTiet) {
  if (ok) { dat++; console.log('  ✅ ' + ten); }
  else { loi++; console.log('  ❌ ' + ten + (chiTiet !== undefined ? '  → ' + JSON.stringify(chiTiet) : '')); }
}
var docFile = function (f) { return DocFile.parseWorkbook(XLSX.read(fs.readFileSync(path.join(MAU, f)), { type: 'buffer' }), XLSX, f).rows; };
var mau = docFile('tiktok.xlsx').concat(docFile('shopee.xlsx'));

var KATA = '8935092825731', HIRA = '8935092825724', Y = '8935092999999', Z = '8935092777777';
var TEN_KATA = 'Sách - Tập Viết Tiếng Nhật Katakana (HA)';
function dongLe(sku, gia, sl, id) {
  return { san: 'TikTok', orderId: id || 'T-' + sku + '-' + gia, sku: sku, ten: TEN_KATA + ' - Newshop', phanLoai: 'LẺ', gia: gia, sl: sl || 1 };
}
function tong(list, sku) { return list.filter(function (g) { return g.sku === sku; }).reduce(function (s, g) { return s + g.sl; }, 0); }
function lichSu(m) { return m.get({ action: 'lichSu' }).lich_su; }

/* ---------- Danh mục ban đầu ---------- */
var m = GL.taoMoiTruong();
m.ctx.khoiTao();
m.post('upsertSku', { key: 'sku:' + KATA, sku: KATA, ten: TEN_KATA, nha: 'HA', nguon: 'tay' });
m.post('upsertSku', { key: 'sku:' + HIRA, sku: HIRA, ten: 'Sách - Tập Viết Tiếng Nhật Hiragana (HA)', nha: 'HA', nguon: 'tay' });
m.post('upsertSkuBatch', { items: [], gia: [{ key: 'sku:' + KATA, gia: 25000 }, { key: 'sku:' + HIRA, gia: 25000 }] });
m.post('upsertCombo', {
  ten_combo: 'Combo Tập Viết Tiếng Nhật Katakana + Hiragana', cach_xuat: 'tach',
  khoa: ['sku:55252', 'sku:' + HIRA + '|combo.ha', 'sku:' + KATA + '|combo.ha'],
  thanh_phan: [
    { sku: KATA, ten: TEN_KATA, nha: 'HA', gia_goc: 25000, so_luong: 1 },
    { sku: HIRA, ten: 'Sách - Tập Viết Tiếng Nhật Hiragana (HA)', nha: 'HA', gia_goc: 25000, so_luong: 1 }
  ]
});
var cat = function () { var g = m.get(); return { skus: g.skus, combos: g.combos }; };
var dongSku = function (ma) { return m.get().skus.filter(function (e) { return e.key === 'sku:' + ma; })[0]; };

console.log('\n1. Giá gần nhất');
var rows1 = mau.concat([dongLe(KATA, 28000, 2, 'A1'), dongLe(KATA, 27000, 1, 'A2')]);
var kq = PL.classify(rows1, cat());
var cn = kq.capNhatGia.filter(function (g) { return g.sku === KATA; })[0];
check('Phát hiện giá mới Katakana 25.000 → 28.000 (nhiều giá trong ngày → lấy cao nhất)', cn && cn.cu === 25000 && cn.gia === 28000, cn);
var truocLs = lichSu(m).length;
var r = m.post('upsertSkuBatch', { items: kq.hoc, gia: kq.capNhatGia.map(function (g) { return { key: g.key, gia: g.gia }; }) });
var k = dongSku(KATA);
check('Ghi gom 1 lần: gia_gan_nhat = 28.000, ngay_gia = hôm nay', r.ok && Number(k.gia_gan_nhat) === 28000 && /^\d{4}-\d{2}-\d{2}$/.test(k.ngay_gia), k);
check('Không đổi nha / nguon của dòng gán tay', k.nha === 'HA' && k.nguon === 'tay');
var lsGia = lichSu(m).filter(function (x) { return x.hanh_dong === 'capNhatGia' && x.khoa === 'sku:' + KATA; })[0];
check('LICH_SU ghi "Cập nhật giá: 25.000 → 28.000"', lsGia && JSON.parse(lsGia.du_lieu_moi).ghi_chu === 'Cập nhật giá: 25.000 → 28.000', lsGia && lsGia.du_lieu_moi);
var sau1 = lichSu(m).length;
m.post('upsertSkuBatch', { items: [], gia: [{ key: 'sku:' + KATA, gia: 28000 }] });
check('Giá không đổi → không ghi thêm lịch sử', lichSu(m).length === sau1, [truocLs, sau1, lichSu(m).length]);
kq = PL.classify(rows1, cat());
var kataHA = kq.nha.HA.filter(function (g) { return g.sku === KATA; });
var k28 = kataHA.filter(function (g) { return g.gia === 28000; })[0];
check('Combo tách ra Katakana giá 28.000, gộp với đơn lẻ cùng giá (11 combo + 2 lẻ = 13)', k28 && k28.sl === 13, kataHA.map(function (g) { return [g.gia, g.sl]; }));
check('Đơn lẻ giá 27.000 vẫn tách dòng riêng + tô cảnh báo khác giá', kataHA.length === 2 && kataHA.every(function (g) { return g.canhBaoGia; }));
var kq0 = PL.classify(mau, cat()); // không có dòng lẻ Katakana trong file → dùng giá gần nhất trong danh mục
check('Không có dòng lẻ trong file → dùng gia_gan_nhat (28.000)', kq0.nha.HA.filter(function (g) { return g.sku === KATA; })[0].gia === 28000);
var lech = kq.lechGiaHomNay[0];
check('Cảnh báo lệch giá: "Giá đã đổi: 25.000 → 28.000"', kq.lechGiaHomNay.length === 1 && lech.ds.length === 1 && lech.ds[0].sku === KATA && lech.ds[0].cu === 25000 && lech.ds[0].moi === 28000, kq.lechGiaHomNay);
check('Danh mục > Combo cũng thấy lệch giá (không cần file)', PL.lechGiaCombo(cat(), {}).length === 1);
r = m.post('capNhatGiaCombo', { items: [{ combo_id: lech.combo_id, gia: { '8935092825731': 28000 } }] });
check('"Cập nhật giá" combo → hết lệch, có ghi LICH_SU', r.ok && r.soCombo === 1 && PL.lechGiaCombo(cat(), {}).length === 0 &&
  lichSu(m)[0].hanh_dong === 'capNhatGiaCombo' && /25\.000 → 28\.000/.test(JSON.parse(lichSu(m)[0].du_lieu_moi).ghi_chu));

console.log('\n2. Thay mã tái bản Katakana ' + KATA + ' → ' + Y);
var catTruoc = JSON.stringify(m.get());
r = m.post('thayMaTaiBan', { ma_cu: KATA, ma_moi: Y, gia: 30000 });
check('thayMaTaiBan thành công', r.ok, r.error);
var dy = dongSku(Y), dx = dongSku(KATA);
check('Dòng Y: nhà theo X, nguồn "tay", giá mới 30.000', dy && dy.nha === 'HA' && dy.nguon === 'tay' && Number(dy.gia_gan_nhat) === 30000, dy);
check('Dòng X giữ lại, ma_moi = Y (mã phụ)', dx && dx.ma_moi === Y);
var cb = m.get().combos[0];
check('Thành phần combo đổi sang mã mới (giá 30.000)', cb.thanh_phan[0].sku === Y && cb.thanh_phan[0].gia_goc === 30000, cb.thanh_phan[0]);
check('Khóa "sku:X|combo.ha" giữ nguyên VÀ thêm "sku:Y|combo.ha"', cb.khoa.indexOf('sku:' + KATA + '|combo.ha') >= 0 && cb.khoa.indexOf('sku:' + Y + '|combo.ha') >= 0, cb.khoa);
check('LICH_SU ghi "Thay mã tái bản" có dữ liệu trước/sau', lichSu(m)[0].hanh_dong === 'thayMaTaiBan' && JSON.parse(lichSu(m)[0].du_lieu_cu).skus.length === 2);
var rows2 = mau.concat([dongLe(KATA, 30000, 2, 'B1')]); // đơn còn dùng mã cũ
kq = PL.classify(rows2, cat());
var gY = kq.nha.HA.filter(function (g) { return g.sku === Y; });
check('Combo tách ra mã mới; đơn mã cũ cũng ra mã mới, cộng chung (11 + 2 = 13)', gY.length === 1 && gY[0].sl === 13 && tong(kq.nha.HA, KATA) === 0, gY.map(function (g) { return [g.sku, g.sl, g.gia]; }));
check('Đánh dấu mã cũ trên sàn', gY[0] && gY[0].maCu && gY[0].maCu[0] === KATA);
check('Gợi ý listing cần sửa (sàn, tên, mã cũ → mã mới)', kq.listingCanSua.length === 1 && kq.listingCanSua[0].san === 'TikTok' &&
  kq.listingCanSua[0].maCu === KATA && kq.listingCanSua[0].maMoi === Y, kq.listingCanSua);
check('Mã phụ không bị coi là "tái bản mới"', kq.taiBan.length === 0, kq.taiBan);

var wb = XuatFile.buildDonDatHang(kq, 'HA', {}, ExcelJS);
var ws = wb.getWorksheet('Hồng Ân'), dongY = null;
var mauNB = 0;
ws.eachRow(function (row, n) { if (n > 1) row.eachCell(function (c) { if (c.fill) mauNB++; }); if (row.getCell(2).value === 'Tập Viết Tiếng Nhật Katakana' && row.getCell(3).value === 30000) dongY = row; });
check('File gửi nhà: Katakana (mã mới) có mặt, SL 13, không tô màu nội bộ (cảnh báo chỉ hiện trên app)', dongY && dongY.getCell(4).value === 13 && mauNB === 0,
  dongY && dongY.values);

var lsDong = lichSu(m)[0].dong;
r = m.post('hoanTacTaiBan', { dong: lsDong });
check('Hoàn tác thành công', r.ok, r.error);
check('Hoàn tác: danh mục trở về y như trước khi thay', JSON.stringify(m.get()) === catTruoc);
check('Hoàn tác có ghi LICH_SU', lichSu(m)[0].hanh_dong === 'hoanTacTaiBan' && lichSu(m)[0].khoa.indexOf('LS#' + lsDong + ' ') === 0);
check('Hoàn tác lần 2 → báo đã hoàn tác', /đã được hoàn tác/.test(m.post('hoanTacTaiBan', { dong: lsDong }).error || ''));
check('Hoàn tác dòng không hoàn tác được (vd tự học) → lỗi', /không hoàn tác được/.test(m.post('hoanTacTaiBan', { dong: 2 }).error || ''));
kq = PL.classify(rows2, cat());
check('Sau hoàn tác: lại ra mã cũ, không còn mã mới', tong(kq.nha.HA, KATA) === 13 && tong(kq.nha.HA, Y) === 0);

console.log('\n3. Tự phát hiện tái bản');
var Y2 = '8935092888888';
var rows3 = mau.concat([dongLe(Y2, 32000, 1, 'C1'), { san: 'Shopee', orderId: 'C2', sku: '8935092111111', ten: 'Sách - Một Cuốn Khác Hẳn - HA', phanLoai: '', gia: 1, sl: 1 }]);
kq = PL.classify(rows3, cat());
var tb = kq.taiBan;
check('Hiện khung nhắc: mã cũ ' + KATA + ' (28.000) → mã mới ' + Y2 + ' (32.000)', tb.length === 1 && tb[0].maCu === KATA && tb[0].maMoi === Y2 && tb[0].giaCu === 28000 && tb[0].giaMoi === 32000, tb);
check('Mã nghi tái bản chưa bị tự học (chờ bạn quyết định)', !kq.hoc.some(function (h) { return h.sku === Y2; }) && kq.hoc.some(function (h) { return h.sku === '8935092111111'; }));
r = m.post('boQuaTaiBan', { ma_cu: KATA, ma_moi: Y2 });
check('"Không phải" → ghi nhớ cặp trong danh mục + LICH_SU', r.ok && dongSku(KATA).khong_tai_ban === Y2 && lichSu(m)[0].hanh_dong === 'boQuaTaiBan', r.error);
kq = PL.classify(rows3, cat());
check('Lần sau không hỏi lại', kq.taiBan.length === 0);
check('…và mã đó được tự học bình thường', kq.hoc.some(function (h) { return h.sku === Y2; }));
r = m.post('thayMaTaiBan', { ma_cu: KATA, ma_moi: Y, gia: '' });
m.post('hoanTacTaiBan', { dong: lichSu(m)[0].dong });
check('Bấm "Đúng, thay mã" (không nhập giá) → Y lấy giá gần nhất của X', r.ok);

console.log('\n4. Chuỗi tái bản X → Y → Z và chặn vòng lặp');
m.post('thayMaTaiBan', { ma_cu: KATA, ma_moi: Y });
r = m.post('thayMaTaiBan', { ma_cu: Y, ma_moi: Z, gia: 35000 });
check('Thay tiếp Y → Z', r.ok, r.error);
kq = PL.classify(mau.concat([dongLe(KATA, 25000, 1, 'D1'), dongLe(Y, 30000, 1, 'D2')]), cat());
check('Đơn mã X và mã Y đều ra mã Z (11 combo + 2 lẻ = 13)', tong(kq.nha.HA, Z) === 13 && tong(kq.nha.HA, KATA) === 0 && tong(kq.nha.HA, Y) === 0,
  kq.nha.HA.filter(function (g) { return /89350927|89350929|8935092825731/.test(g.sku); }).map(function (g) { return [g.sku, g.sl]; }));
check('Combo: thành phần đã là Z, có khóa theo X, Y và Z', m.get().combos[0].thanh_phan[0].sku === Z &&
  ['sku:' + KATA + '|combo.ha', 'sku:' + Y + '|combo.ha', 'sku:' + Z + '|combo.ha'].every(function (x) { return m.get().combos[0].khoa.indexOf(x) >= 0; }));
check('Chặn vòng lặp: Z → X bị từ chối', /vòng lặp/.test(m.post('thayMaTaiBan', { ma_cu: Z, ma_moi: KATA }).error || ''));
check('Thay mã trên mã đã cũ (X) → yêu cầu dùng mã mới nhất', /đã được thay/.test(m.post('thayMaTaiBan', { ma_cu: KATA, ma_moi: '8935092555555' }).error || ''));
check('Mã mới không phải mã vạch → từ chối', /mã vạch/.test(m.post('thayMaTaiBan', { ma_cu: Z, ma_moi: 'ABC' }).error || ''));
var vong = PL.buildIndex({ skus: [{ key: 'sku:1111111', sku: '1111111', ma_moi: '2222222' }, { key: 'sku:2222222', sku: '2222222', ma_moi: '1111111' }] });
check('Dữ liệu lỡ bị vòng lặp → app vẫn không treo', /^(1111111|2222222)$/.test(PL.maMoiNhat(vong, '1111111')));

console.log('\n5. Sheet SKU_NHA bản cũ (6 cột) vẫn đọc/ghi được');
var m2 = GL.taoMoiTruong();
m2.ctx.khoiTao();
var sh = m2.ss.getSheetByName('SKU_NHA');
sh.data = [['key', 'sku', 'ten', 'nha', 'nguon', 'cap_nhat'], ['sku:' + KATA, KATA, TEN_KATA, 'HA', 'tay', '2026-10-01 10:00:00']];
r = m2.post('upsertSkuBatch', { items: [], gia: [{ key: 'sku:' + KATA, gia: 26000 }] });
check('Tự thêm tiêu đề cột mới, không mất dữ liệu', sh.data[0].join(',') === 'key,sku,ten,nha,nguon,cap_nhat,gia_gan_nhat,ngay_gia,ma_moi,khong_tai_ban,nguon_ma,ten_sach,phan_loai,khong_combo' &&
  m2.get().skus[0].nha === 'HA' && Number(m2.get().skus[0].gia_gan_nhat) === 26000, sh.data[0]);
r = m2.post('upsertSku', { key: 'sku:' + KATA, sku: KATA, ten: TEN_KATA, nha: 'KV', nguon: 'tay' });
check('Đổi nhà không làm mất giá gần nhất', Number(m2.get().skus[0].gia_gan_nhat) === 26000 && m2.get().skus[0].nha === 'KV');

// File Excel xuất thử của bước 2 (sau khi thay mã, còn đơn dùng mã cũ) – chỉ lưu trong mau/
wb.xlsx.writeBuffer().then(function (buf) {
  fs.writeFileSync(path.join(MAU, 'ket-qua-tai-ban.xlsx'), Buffer.from(buf));
  console.log('\nKẾT QUẢ: ' + dat + ' đạt, ' + loi + ' lỗi.  File xuất thử (đơn Hồng Ân): mau/ket-qua-tai-ban.xlsx');
  process.exit(loi ? 1 : 0);
});
