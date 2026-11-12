/* Phân quyền theo từng người (Apps Script api ≥ 9) – phần thuần, chạy được bằng Node để kiểm thử.
 * DS / MAU_GOC PHẢI khớp DS_QUYEN / MAU_GOC trong Code.gs. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Quyen = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NHOM = [
    { ten: 'Xem tab', ds: [['tab_tachdon', 'Tách đơn'], ['tab_dot', 'Tổng hợp đợt'], ['tab_dubao', 'Dự báo'], ['tab_chokb', 'Chờ khai báo'], ['tab_thongke', 'Thống kê'], ['tab_sanban', 'Sàn bán gì'],
                            ['tab_danhmuc', 'Danh mục'], ['tab_lichsu', 'Lịch sử'], ['tab_caidat', 'Cài đặt'], ['tab_nguoidung', 'Người dùng']] },
    { ten: 'Tải đơn', ds: [['tai_shopee', 'Shopee'], ['tai_tiktok', 'TikTok'], ['tai_web', 'Web']] },
    { ten: 'Đợt', ds: [['dot_baoxong', 'Báo xong'], ['dot_chot', 'Chốt đợt'], ['dot_molai', 'Mở lại đợt', 'Mở lại / xóa đợt, quản lý phần gửi của người khác (cần mã Admin)'], ['dot_xuat', 'Xuất file nhà']] },
    { ten: 'Danh mục', ds: [['dm_khaibao', 'Khai báo', 'Khai báo combo / tên sách / nhà / barcode'], ['dm_sua', 'Sửa'], ['dm_xoa', 'Xóa'], ['dm_themnha', 'Thêm nhà']] },
    { ten: 'Quản trị (cần mã Admin)', ds: [['qt_caidat', 'Cài đặt', 'Cài đặt chung, sổ nhà, nạp / xóa hàng loạt danh mục, hoàn tác của người khác'], ['qt_khoiphuc', 'Khôi phục sao lưu'],
                                            ['qt_napbu', 'Nạp bù số liệu'], ['qt_nguoidung', 'Quản lý người dùng']] }
  ];
  var DS = [], TEN = {};
  NHOM.forEach(function (n) { n.ds.forEach(function (q) { DS.push(q[0]); TEN[q[0]] = q[1]; }); });
  var Q_SAN = ['tab_tachdon', 'tab_chokb', 'tab_thongke', 'tab_danhmuc', 'tab_lichsu', 'tab_caidat', 'tai_shopee', 'tai_tiktok', 'tai_web',
               'dot_baoxong', 'dot_xuat', 'dm_khaibao', 'dm_sua', 'dm_xoa', 'dm_themnha'];
  var MAU_GOC = [
    { ten: 'Nhân viên sàn', vai_tro: 'san', quyen: Q_SAN, goc: true },
    { ten: 'Người đặt hàng', vai_tro: 'dat_hang', quyen: Q_SAN.concat(['tab_dot', 'tab_dubao', 'tab_sanban', 'dot_chot']), goc: true },
    { ten: 'Chỉ xem', vai_tro: 'san', quyen: ['tab_dot', 'tab_dubao', 'tab_thongke', 'tab_sanban', 'tab_danhmuc', 'tab_lichsu'], goc: true },
    { ten: 'Admin', vai_tro: 'admin', quyen: DS.slice(), goc: true }
  ];
  function chuan(v) {
    var ds = Array.isArray(v) ? v : String(v || '').split(/[,\s]+/), co = {};
    ds.forEach(function (k) { if (DS.indexOf(k) >= 0) co[k] = 1; });
    return DS.filter(function (k) { return co[k]; });
  }
  function mauTheoVaiTro(vt) { return vt === 'admin' ? 'Admin' : vt === 'dat_hang' ? 'Người đặt hàng' : 'Nhân viên sàn'; }
  function timMau(dsMau, ten) { return (dsMau || MAU_GOC).filter(function (m) { return m.ten === ten; })[0] || null; }
  /* Quyền theo vai trò cũ (Apps Script chưa có bảng quyền) */
  function theoVaiTro(vt) { return chuan(timMau(MAU_GOC, mauTheoVaiTro(vt)).quyen); }
  /* Mẫu nào khớp đúng bộ quyền này ('' = đã chỉnh riêng) */
  function mauKhop(dsMau, quyen) {
    var k = chuan(quyen).join();
    var m = (dsMau || MAU_GOC).filter(function (x) { return chuan(x.quyen).join() === k; })[0];
    return m ? m.ten : '';
  }
  /* Thao tác ghi → cần MỘT trong các quyền. Thao tác không có ở đây (tự học, ghi lịch sử, tính thử…) không cần quyền riêng. */
  var HD = {
    upsertSku: ['dm_khaibao', 'dm_sua'], upsertCombo: ['dm_khaibao', 'dm_sua'], addComboKey: ['dm_khaibao', 'dm_sua'], luuTenSach: ['dm_khaibao', 'dm_sua'],
    khongPhaiCombo: ['dm_khaibao', 'dm_sua'], khaiBaoLo: ['dm_khaibao'], ganBarcode: ['dm_khaibao', 'dm_sua'], boGanBarcode: ['dm_khaibao', 'dm_sua', 'dm_xoa'],
    luuMaPhu: ['dm_khaibao', 'dm_sua'], boQuaCungCuon: ['dm_khaibao', 'dm_sua'], thayMaTaiBan: ['dm_khaibao', 'dm_sua'], hoanTacTaiBan: ['dm_khaibao', 'dm_sua'],
    boQuaTaiBan: ['dm_khaibao', 'dm_sua'], capNhatGiaCombo: ['dm_khaibao', 'dm_sua'], deSau: ['dm_khaibao'], suaSku: ['dm_sua'],
    deleteSku: ['dm_xoa'], deleteCombo: ['dm_xoa'], themNha: ['dm_themnha'],
    baoXong: ['dot_baoxong'], chotDot: ['dot_chot'], moLaiDot: ['dot_molai'], xoaDot: ['dot_molai'], xoaPhan: ['dot_molai'], suaPhan: ['dot_molai'],
    luuCaiDatChung: ['qt_caidat'], luuNha: ['qt_caidat'], xoaNha: ['qt_caidat'], importBatch: ['qt_caidat'], upsertMaChuan: ['qt_caidat'], xoaHangLoat: ['qt_caidat'],
    napThongKe: ['qt_napbu'], khoiPhucSaoLuu: ['qt_khoiphuc'], luuQuyen: ['qt_nguoidung'], luuNguoiDung: ['qt_nguoidung']
  };
  /* Màn hình → quyền xem tab */
  var MAN = { chinh: 'tab_tachdon', dot: 'tab_dot', dubao: 'tab_dubao', chokb: 'tab_chokb', thongke: 'tab_thongke', sanban: 'tab_sanban', danhmuc: 'tab_danhmuc',
              caidat: 'tab_caidat', nguoidung: 'tab_nguoidung' };

  return { NHOM: NHOM, DS: DS, TEN: TEN, MAU_GOC: MAU_GOC, HD: HD, MAN: MAN, chuan: chuan, mauTheoVaiTro: mauTheoVaiTro, timMau: timMau, theoVaiTro: theoVaiTro, mauKhop: mauKhop };
});
