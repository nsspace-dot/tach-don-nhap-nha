/**
 * Tách đơn nhập nhà – Apps Script cho danh mục dùng chung (Google Sheets).
 *
 * Cách dùng: xem HUONG-DAN.md. Tóm tắt:
 *   1. Mở file Google Sheets → Tiện ích mở rộng → Apps Script → dán toàn bộ file này.
 *   2. Chạy hàm khoiTao() 1 lần (tạo đủ các sheet).
 *   3. Chạy hàm caiDatSaoLuuTuDong() 1 lần (sao lưu tự động mỗi ngày khoảng 23h).
 *   4. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 *   5. Đặt mã Admin: sửa dòng MA_ADMIN_MOI (phần "Admin" bên dưới) rồi chạy datMaAdmin() – xong xóa mã khỏi dòng đó.
 *
 * Các sheet:
 *   SKU_NHA           key | sku | ten | nha | nguon | cap_nhat | gia_gan_nhat | ngay_gia | ma_moi | khong_tai_ban | nguon_ma | ten_sach | phan_loai | khong_combo
 *                     (ten: tên listing trên sàn ; ten_sach: TÊN SÁCH ĐÃ KHAI BÁO dùng để xuất file – chỉ bạn sửa, tự học không ghi đè ;
 *                      khong_combo = 1: bạn đã bấm "Không phải combo" cho dòng bị nghi combo)
 *                     (ma_moi: mã tái bản thay thế ; khong_tai_ban: các mã đã xác nhận "không phải tái bản", cách nhau " ;; ")
 *   COMBO             combo_id | ten_combo | khoa | cap_nhat | cach_xuat | ma_he_thong | ten_xuat | nha
 *                     (khoa cách nhau bằng " ;; " ; cach_xuat = tach | nguyen ; trống = tach)
 *   COMBO_THANH_PHAN  combo_id | sku | ten | nha | gia_goc | so_luong
 *   LICH_SU           thoi_gian | hanh_dong | khoa | du_lieu_cu | du_lieu_moi   (chỉ thêm dòng)
 *   MA_CHUAN          barcode | ten_gon | gia_bia | ncc | nha | ngay_thay | khong_phai   (sổ mã chuẩn = barcode đơn web)
 *   LS_DAT_HANG       ngay | nha | barcode | ten | gia | sl | sl_shopee | sl_tiktok | sl_web | sl_treo | cap_nhat
 *   DON_DA_GHI        ma_don | ngay   (chống nạp trùng đơn vào lịch sử)
 *   DM_XOA            loai | khoa | phien_ban | luc | nguoi   (bản ghi danh mục đã xóa – để máy khác đồng bộ)
 *
 * Nhiều người dùng (từ bản api 2) – CHỈ THÊM cột vào cuối, không đổi cột cũ:
 *   SKU_NHA, COMBO, MA_CHUAN thêm  phien_ban | dong_bo | nguoi_sua
 *     phien_ban: số phiên bản – tăng khi có người SỬA TAY (dùng chống ghi đè: gửi kèm phiên bản đang thấy, lệch → báo xung đột)
 *     dong_bo:   mốc đồng bộ – tăng ở MỌI thay đổi (kể cả tự học) → máy khác chỉ tải phần thay đổi
 *     nguoi_sua: tên người sửa tay gần nhất ("Tôi là" trên máy)
 *   LICH_SU thêm  nguoi | phien_ban
 *   Dòng cũ chưa có các cột này vẫn đọc bình thường (coi như phiên bản 0).
 *   GET <url>?action=thayDoi&tu=<mốc> → { ok, api, rev, khongDoi } hoặc { ok, api, rev, skus, combos, ma_chuan, xoa, log } (chỉ phần thay đổi)
 *                                        hoặc { toanBo: true, … } khi mốc quá cũ → tải lại toàn bộ
 *   POST body { action, data, nguoi }  ; data._pb = { "sku|<khoa>": phiên bản, "combo|<id>": … } → kiểm tra xung đột
 *        → xung đột: { ok:false, xungDot:[…], catalog }   ; data._ghiDe = true: vẫn ghi
 *        upsertCombo combo mới trùng thành phần combo đã có → { ok:false, comboTrung } (data._boQuaTrung = true: vẫn tạo)
 *
 * Người dùng + Đợt đặt hàng (từ bản api 3) – các sheet mới:
 *   NGUOI_DUNG   ten | vai_tro (san = nhân viên sàn, dat_hang = người đặt hàng) | cap_nhat
 *   DOT          dot_id (yyyy-MM-dd, giờ VN) | trang_thai (dang_nhan | da_chot) | tao_luc | chot_luc | chot_boi | mo_lai_luc | mo_lai_boi | ghi_lich_su_luc
 *   DOT_PHAN     phan_id (dot_id|người) | dot_id | nguoi | nguon | trang_thai (da_gui | mo_lai) | gui_luc | so_dong | so_don | con_combo | con_chua_ro | phien | ghi_chu
 *   DOT_DL_<ngày> (ẩn, mỗi đợt 1 sheet) phan_id | thu_tu | du_lieu  – danh sách dòng đơn ĐÃ CHUẨN HÓA (JSON, chia nhỏ ≤ 40.000 ký tự/ô):
 *                cột: nguồn, mã đơn, barcode/SKU, tên sàn, phân loại, giá, SL, ngày đặt, tên file, nhà cung cấp (web), ngày xuất (web), dấu file web.
 *                KHÔNG có thông tin khách, không lưu file gốc. Đợt cũ hơn 30 ngày tự dọn.
 *   GET  ?action=dot&id=<ngày>[&duLieu=1] → { ok, dot, phan, nguoi_dung, hom_nay }     GET ?action=dsDot → { ok, dot: [...] }
 *
 * Admin (từ bản api 4):
 *   Mã Admin lưu ở Script Properties (khóa ADMIN_MA) – KHÔNG nằm trong code. Đặt / đổi: sửa dòng MA_ADMIN_MOI rồi chạy datMaAdmin().
 *   Thao tác Admin gửi kèm data._maAdmin; sai 5 lần liên tiếp → khóa 10 phút. Lịch sử ghi "Tên (Admin)".
 *   Chỉ Admin: luuNguoiDung, moLaiDot, xoaDot, xoaPhan, suaPhan, moLaiPhan của người khác, luuCaiDatChung, importBatch,
 *              upsertMaChuan, xoaHangLoat, hoàn tác thao tác của người khác.
 *   CAI_DAT_CHUNG  khoa | gia_tri (JSON) | cap_nhat | nguoi   (mã nhà khác, trạng thái Shopee, phân loại vô nghĩa – dùng chung mọi máy)
 *   NGUOI_DUNG.vai_tro thêm giá trị "admin".
 *
 * Lịch sử bán + Dự báo nhập kho + Chờ khai báo (từ bản api 5):
 *   BAN_HANG  ngay (yyyy-MM-dd; yyyy-MM khi đã gom tháng) | nguon (dot | nap | thang) | thu_tu | du_lieu | cap_nhat
 *             du_lieu = JSON gọn { sp: [[nguồn, barcode/SKU, tên sàn, phân loại, giá, nhà cung cấp web]], d: [[chỉ số sp, mã đơn, SL, ngày đặt, dấu file web]] }
 *             = dòng đơn ĐÃ CHUẨN HÓA của MỌI sách (kể cả nhà khác), KHÔNG có thông tin khách. Ghi khi chốt đợt / nạp file đơn cũ.
 *             Mỗi (sàn + mã đơn + dòng sản phẩm) chỉ lưu 1 lần; file web: (dấu file + sách). Quá nhiều dòng → tự gom các ngày cũ thành tháng.
 *   DE_SAU    khoa | ten | luc | nguoi   (dòng "⏭ Để sau" – chuyển sang tab Chờ khai báo)
 *   CAI_DAT_CHUNG thêm khoa "duBaoNgay" = { "<nhà>": số ngày muốn đủ bán }
 *   GET ?action=banHang&tu=yyyy-MM-dd → { ok, khoi: [{ ngay, nguon, du_lieu }] }
 *   POST chotDot { …, ban_hang: { sp, d } }, napBanHang { sp, d }, deSau { khoa, ten, bo }, luuDuBaoNgay { nha, so_ngay }
 *
 * Sổ nhà (từ bản api 6):
 *   NHA  ma | ten | loai (hang_ngay = Đặt hằng ngày, có thẻ + file đặt riêng ; nhap_kho = Nhập kho, vào dự báo) | mau |
 *        ma_ten (mã trong tên sản phẩm, cách nhau dấu phẩy) | ncc (tên nhà cung cấp trên file web, cách nhau ";") | tien_to (tiền tố barcode) | thu_tu | cap_nhat
 *        Sheet trống → mặc định HA/KV/ML (Đặt hằng ngày) + "Mã nhà khác" cũ (Nhập kho). Nhà hợp lệ ở mọi chỗ = theo sổ này.
 *   POST luuNha { ds } (Admin), themNha { nha } (mọi người – chỉ thêm), xoaNha { ma, chuyen_sang } (Admin – chuyển sách sang nhà khác)
 *
 * Tab Chờ khai báo (từ bản api 7):
 *   POST khaiBaoLo { items: [{ viec, key, sku, ten, phan_loai, nha, ten_sach, key_le }] } – nhiều việc trong 1 lần ghi, mỗi việc 1 dòng LICH_SU:
 *        viec "nha" = gán nhà (nguồn tay) ; "ten" = tên sách + nhà ; "le" = "không phải combo – là sách lẻ" (key_le) + tên + nhà (key)
 *   deSau ghi thêm LICH_SU (deSau / boDeSau / anChoKhaiBao / boAnChoKhaiBao)
 *   POST luuNguoiDung { ds }, baoXong { dot_id, cot, dong, nguon, so_don, con_combo, con_chua_ro }, moLaiPhan { dot_id },
 *        chotDot { dot_id, lich_su }, moLaiDot { dot_id }
 *   GET  <url>?action=lichSuDatHang&tu=yyyy-MM-dd → { ok, cot, dong }
 *   POST ghiLichSuDatHang (ghi đè theo ngày + nhà), napLichSuDatHang (cộng theo ngày đặt, bỏ đơn trùng)
 *
 * Thống kê bán theo ngày – tab "Sàn bán gì" (từ bản api 8):
 *   THONG_KE       ngay | san | gian | khoa_sp | ten_sp | phan_loai | barcode | nganh | nha | so_luong | so_don | doanh_thu | nguon | nhom | combo | cap_nhat
 *                  1 dòng = tổng của 1 sản phẩm / ngày / sàn / gian. MỌI mặt hàng trong file đã tải (sách mọi nhà, lịch, tranh, decal, trà…), sau bộ lọc
 *                  trạng thái Shopee, KHÔNG có thông tin khách. ngay = ngày của đợt (nạp bù: ngày chọn cho file). doanh_thu trống = file không có cột giá bán.
 *                  khoa_sp: "bc:<mã vạch>" | "ten:<tên gọn>|<phân loại gọn>" | "cb:<combo_id>" | "#don" (dòng phụ: số đơn của sàn + gian trong ngày)
 *                  nguon: dot (ghi khi chốt đợt – chốt lại thì thay) | nap (nạp bù số liệu cũ) ; nhom: khóa gộp phân loại ; combo: JSON thành phần
 *                  [[khoa_sp, tên, barcode, nhà, SL / combo, giá gốc]] (combo đã khai báo). Dòng cũ hơn 183 ngày tự xóa (chạy chung trigger sao lưu 23h).
 *   THONG_KE_KHOA  ngay | nguon | thu_tu | du_lieu | cap_nhat   – dấu (sàn + mã đơn + dòng) đã tính, để đơn treo nhiều ngày / nạp lại file không cộng 2 lần
 *   GET  ?action=thongKe&tu=&den=&combo=tach|nguyen[&truoc=1] → tổng theo khoảng ngày (cộng dồn ở server) { sp, d, don, … } (+ kỳ trước cùng độ dài)
 *   POST chotDot { …, thong_ke: { sp, d } } ; napThongKe { ngay, dl: { sp, d } } (Admin) ; thongKeTam { ngay, dl } (xem đợt đang mở, không ghi)
 *        sp: [[sàn, gian, khoa_sp, tên, phân loại, barcode, ngành, nhà, nhóm, combo]] ; d: [[chỉ số sp, dấu dòng, SL, doanh thu | null, chỉ số đơn | -1, ngày]]
 *
 * Phân quyền theo từng người (từ bản api 9) – thay 3 vai trò cố định bằng bảng quyền:
 *   QUYEN  loai (nguoi | mau) | ten | mau | quyen | khoa | cap_nhat | nguoi_sua
 *          loai "nguoi": ten = tên người dùng, mau = mẫu vai trò đã áp, quyen = các quyền (cách nhau dấu phẩy), khoa = 1 khi tạm khóa
 *          loai "mau":   ten = tên mẫu vai trò tự tạo / mẫu gốc đã sửa, quyen = các quyền của mẫu
 *          Mã quyền: xem DS_QUYEN bên dưới (tab_… xem tab ; tai_… tải đơn sàn nào ; dot_… đợt ; dm_… danh mục ; qt_… quản trị).
 *          CHUYỂN ĐỔI TỰ ĐỘNG: người có trong NGUOI_DUNG mà chưa có dòng QUYEN → quyền theo vai trò cũ (san → mẫu "Nhân viên sàn",
 *          dat_hang → "Người đặt hàng", admin → "Admin"). Không cần chạy hàm nào. NGUOI_DUNG vẫn được ghi (vai_tro suy ra từ quyền) cho máy bản cũ.
 *   GET (danh mục) và ?action=thayDoi trả thêm quyen: { ds: [mã quyền], mau: [{ ten, quyen, goc }], nguoi: [{ ten, mau, quyen, khoa }] }
 *   POST luuQuyen { nguoi: [{ ten, mau, quyen, khoa }], mau: [{ ten, quyen }] } (cần mã Admin; luôn còn ≥ 1 người có quyền "Quản lý người dùng" không bị khóa)
 *        → ghi LICH_SU từng người đổi quyền, tăng mốc đồng bộ để máy khác nhận ở lần đồng bộ 30 giây.
 *   Nhóm Quản trị (qt_…) + mở lại / xóa đợt vẫn kiểm tra MÃ ADMIN ở đây như trước. Người bị tạm khóa: mọi thao tác ghi bị từ chối.
 *   GET ?action=saoLuu → { ngay: [các ngày có bản sao lưu] } ; POST khoiPhucSaoLuu { ngay } (cần mã Admin) – như chạy tay hàm khoiPhucSaoLuu
 *
 * API:
 *   GET  <url>                  → { ok, skus, combos }
 *   GET  <url>?action=lichSu    → { ok, lich_su }   (100 thay đổi gần nhất, mới nhất trước)
 *   POST <url>  body {action, data}  (Content-Type: text/plain)
 *        action: ping, upsertSku, upsertSkuBatch (kèm cập nhật giá), deleteSku, upsertCombo, addComboKey, doiKhoaCombo,
 *                deleteCombo, importBatch, thayMaTaiBan, hoanTacTaiBan, boQuaTaiBan, capNhatGiaCombo,
 *                upsertMaChuan, luuMaPhu, boQuaCungCuon, luuTenSach, khongPhaiCombo, ganBarcode, boGanBarcode, suaSku   (upsertSkuBatch nhận thêm maChuan, maPhu)
 *        → { ok, catalog, ... }  hoặc  { ok: false, error }
 */

var API = 9; // phiên bản Apps Script – app mới đọc số này để biết đã cập nhật Code.gs chưa (2: đồng bộ danh mục, 3: người dùng + đợt, 4: Admin, 5: lịch sử bán + dự báo, 6: sổ nhà, 7: khai báo lô, 8: thống kê bán theo ngày, 9: phân quyền theo từng người)
var SH = { SKU: 'SKU_NHA', COMBO: 'COMBO', TP: 'COMBO_THANH_PHAN', LS: 'LICH_SU', MC: 'MA_CHUAN', DH: 'LS_DAT_HANG', DON: 'DON_DA_GHI', XOA: 'DM_XOA',
           ND: 'NGUOI_DUNG', DOT: 'DOT', PHAN: 'DOT_PHAN', CDC: 'CAI_DAT_CHUNG', BH: 'BAN_HANG', DS: 'DE_SAU', NHA: 'NHA', TK: 'THONG_KE', TKK: 'THONG_KE_KHOA', Q: 'QUYEN' };
var BH_TRUNG_NGAY = 60;      // chống trùng khi chốt: so với lịch sử bán 60 ngày gần nhất (đơn treo nhiều ngày)
var BH_GOM_SAU_NGAY = 120;   // gom các ngày cũ hơn 120 ngày thành 1 khối / tháng
var BH_NGUONG_GOM = 3000;    // … khi sheet BAN_HANG quá số dòng này
var VAI_TRO = ['san', 'dat_hang', 'admin'];
var HD_ADMIN = ['kiemTraMaAdmin', 'luuNha', 'xoaNha', 'luuNguoiDung', 'moLaiDot', 'xoaDot', 'xoaPhan', 'suaPhan', 'luuCaiDatChung', 'importBatch', 'upsertMaChuan', 'xoaHangLoat', 'napThongKe', 'luuQuyen', 'khoiPhucSaoLuu'];
var ADMIN_SAI_TOI_DA = 5, ADMIN_KHOA_PHUT = 10;
var KHOA_CAI_DAT_CHUNG = ['maKhac', 'trangThaiShopee', 'plVoNghia', 'gian']; // gian: "Tên gian = từ khóa trong tên file, …"
var DOT_DL = 'DOT_DL_';   // + yyyy-MM-dd : dữ liệu dòng đơn của 1 đợt
var GIU_DOT = 30;         // giữ dữ liệu đợt 30 ngày
var CHIA_O = 40000;       // ký tự tối đa mỗi ô (giới hạn Google Sheets 50.000)
var MUI_GIO_VN = 'Asia/Ho_Chi_Minh';
var COT = {
  SKU_NHA: ['key', 'sku', 'ten', 'nha', 'nguon', 'cap_nhat', 'gia_gan_nhat', 'ngay_gia', 'ma_moi', 'khong_tai_ban', 'nguon_ma', 'ten_sach', 'phan_loai', 'khong_combo',
            'phien_ban', 'dong_bo', 'nguoi_sua'],
  // Sổ mã chuẩn: barcode trên đơn web (chuẩn) – khong_phai: các listing đã xác nhận "không phải cùng cuốn"
  MA_CHUAN: ['barcode', 'ten_gon', 'gia_bia', 'ncc', 'nha', 'ngay_thay', 'khong_phai', 'phien_ban', 'dong_bo', 'nguoi_sua'],
  // Lịch sử đặt hàng (KHÔNG có thông tin khách): 1 dòng / (ngày, nhà, barcode chuẩn). ngay dạng yyyy-MM-dd, hoặc yyyy-MM khi đã gom tháng cũ
  LS_DAT_HANG: ['ngay', 'nha', 'barcode', 'ten', 'gia', 'sl', 'sl_shopee', 'sl_tiktok', 'sl_web', 'sl_treo', 'cap_nhat'],
  // Mã đơn đã tính vào lịch sử (chống nạp trùng). Web: "web:<ngày xuất>|<barcode>"
  DON_DA_GHI: ['ma_don', 'ngay'],
  COMBO: ['combo_id', 'ten_combo', 'khoa', 'cap_nhat', 'cach_xuat', 'ma_he_thong', 'ten_xuat', 'nha', 'phien_ban', 'dong_bo', 'nguoi_sua'],
  COMBO_THANH_PHAN: ['combo_id', 'sku', 'ten', 'nha', 'gia_goc', 'so_luong'],
  LICH_SU: ['thoi_gian', 'hanh_dong', 'khoa', 'du_lieu_cu', 'du_lieu_moi', 'nguoi', 'phien_ban'],
  // Bản ghi danh mục đã xóa (loai: sku | combo | mc) – máy khác đồng bộ để xóa theo
  DM_XOA: ['loai', 'khoa', 'phien_ban', 'luc', 'nguoi'],
  NGUOI_DUNG: ['ten', 'vai_tro', 'cap_nhat'],
  DOT: ['dot_id', 'trang_thai', 'tao_luc', 'chot_luc', 'chot_boi', 'mo_lai_luc', 'mo_lai_boi', 'ghi_lich_su_luc'],
  DOT_PHAN: ['phan_id', 'dot_id', 'nguoi', 'nguon', 'trang_thai', 'gui_luc', 'so_dong', 'so_don', 'con_combo', 'con_chua_ro', 'phien', 'ghi_chu'],
  DOT_DL: ['phan_id', 'thu_tu', 'du_lieu'],
  CAI_DAT_CHUNG: ['khoa', 'gia_tri', 'cap_nhat', 'nguoi'],
  BAN_HANG: ['ngay', 'nguon', 'thu_tu', 'du_lieu', 'cap_nhat'],
  DE_SAU: ['khoa', 'ten', 'luc', 'nguoi'],
  NHA: ['ma', 'ten', 'loai', 'mau', 'ma_ten', 'ncc', 'tien_to', 'thu_tu', 'cap_nhat'],
  // Thống kê bán theo ngày (tab "Sàn bán gì") – xem mô tả đầu file
  THONG_KE: ['ngay', 'san', 'gian', 'khoa_sp', 'ten_sp', 'phan_loai', 'barcode', 'nganh', 'nha', 'so_luong', 'so_don', 'doanh_thu', 'nguon', 'nhom', 'combo', 'cap_nhat'],
  THONG_KE_KHOA: ['ngay', 'nguon', 'thu_tu', 'du_lieu', 'cap_nhat'],
  // Bảng quyền theo từng người + mẫu vai trò – xem mô tả đầu file
  QUYEN: ['loai', 'ten', 'mau', 'quyen', 'khoa', 'cap_nhat', 'nguoi_sua']
};
/* Mã quyền (thứ tự = thứ tự cột trong tab "👥 Người dùng"). PHẢI khớp js/quyen.js */
var DS_QUYEN = ['tab_tachdon', 'tab_dot', 'tab_dubao', 'tab_chokb', 'tab_thongke', 'tab_sanban', 'tab_danhmuc', 'tab_lichsu', 'tab_caidat', 'tab_nguoidung',
                'tai_shopee', 'tai_tiktok', 'tai_web',
                'dot_baoxong', 'dot_chot', 'dot_molai', 'dot_xuat',
                'dm_khaibao', 'dm_sua', 'dm_xoa', 'dm_themnha',
                'qt_caidat', 'qt_khoiphuc', 'qt_napbu', 'qt_nguoidung'];
var Q_SAN = ['tab_tachdon', 'tab_chokb', 'tab_thongke', 'tab_danhmuc', 'tab_lichsu', 'tab_caidat', 'tai_shopee', 'tai_tiktok', 'tai_web',
             'dot_baoxong', 'dot_xuat', 'dm_khaibao', 'dm_sua', 'dm_xoa', 'dm_themnha'];
/* Mẫu vai trò gốc. 3 mẫu đầu = đúng quyền của 3 vai trò cũ (không ai mất quyền khi cập nhật). */
var MAU_GOC = [
  { ten: 'Nhân viên sàn', vai_tro: 'san', quyen: Q_SAN },
  { ten: 'Người đặt hàng', vai_tro: 'dat_hang', quyen: Q_SAN.concat(['tab_dot', 'tab_dubao', 'tab_sanban', 'dot_chot']) },
  { ten: 'Chỉ xem', vai_tro: 'san', quyen: ['tab_dot', 'tab_dubao', 'tab_thongke', 'tab_sanban', 'tab_danhmuc', 'tab_lichsu'] },
  { ten: 'Admin', vai_tro: 'admin', quyen: DS_QUYEN }
];
var TK_GIU_NGAY = 183;     // THONG_KE giữ 183 ngày (6 tháng)
var TK_TRUNG_NGAY = 60;    // chốt đợt: so dấu dòng với 60 ngày trước (đơn treo)
var TK_KHOA_MOI_O = 3000;  // số dấu dòng mỗi ô
var TK_DON = '#don';       // khoa_sp của dòng phụ "số đơn của sàn + gian trong ngày"
// Thao tác tự động (tự học, đổi khóa combo cũ): vẫn tăng mốc đồng bộ nhưng KHÔNG tăng số phiên bản / không đổi người sửa
var HD_TU_DONG = ['upsertSkuBatch', 'doiKhoaCombo'];
var META = { phien_ban: 1, dong_bo: 1, nguoi_sua: 1 };
var GIU_XOA = 2000; // số bản ghi xóa giữ lại để đồng bộ
// Cột số; mọi cột khác lưu dạng chữ (tránh Google Sheets tự đổi mã vạch thành số / ngày tháng)
var COT_SO = { SKU_NHA: ['gia_gan_nhat', 'phien_ban', 'dong_bo'], COMBO: ['phien_ban', 'dong_bo'], COMBO_THANH_PHAN: ['gia_goc', 'so_luong'],
               MA_CHUAN: ['gia_bia', 'phien_ban', 'dong_bo'], DM_XOA: ['phien_ban'],
               DOT_PHAN: ['so_dong', 'so_don', 'con_combo', 'con_chua_ro', 'phien'], DOT_DL: ['thu_tu'],
               LS_DAT_HANG: ['gia', 'sl', 'sl_shopee', 'sl_tiktok', 'sl_web', 'sl_treo'],
               THONG_KE: ['so_luong', 'so_don', 'doanh_thu'] };
var NGUONG_GOM_THANG = 40000;   // LS_DAT_HANG quá số dòng này → gom các ngày cũ hơn 180 ngày thành 1 dòng / tháng
var NGUONG_NHAC_LON = 30000;    // nhắc khi dữ liệu lớn
var GIU_DON_DA_GHI = 400;       // giữ mã đơn đã ghi trong 400 ngày
var NHA_SKU = ['HA', 'KV', 'ML', 'KHONG_NHAP'];
var NHA_TP = ['HA', 'KV', 'ML', 'KHAC'];
var NHA_CHINH = ['HA', 'KV', 'ML'];
var MA_KHAC_MAC_DINH = ['MEGA', 'VT', 'HH', 'NS', 'QB', 'TN', 'HT'];
var soNhaNho_ = null; // sổ nhà đọc 1 lần mỗi lượt gọi
var TACH_KHOA = ' ;; ';
var SO_BAN_SAO_LUU = 30;
var GIO_SAO_LUU = 23;
var SO_LICH_SU = 100;

/* ===================== Web App ===================== */

function doGet(e) {
  soNhaNho_ = null;
  try {
    var action = e && e.parameter && e.parameter.action;
    if (action === 'lichSu') return traVe_({ ok: true, lich_su: docLichSu_(SO_LICH_SU) });
    if (action === 'lichSuDatHang') return traVe_(docLichSuDatHang_(e.parameter.tu));
    if (action === 'thayDoi') return traVe_(docThayDoi_(e.parameter.tu));
    if (action === 'dot') return traVe_(docDot_(e.parameter.id, e.parameter.duLieu === '1'));
    if (action === 'dsDot') return traVe_(dsDot_());
    if (action === 'thongKe') return traVe_(tkTongHop_(e.parameter));
    if (action === 'saoLuu') return traVe_({ ok: true, api: API, ngay: dsNgaySaoLuu_() });
    if (action === 'banHang') return traVe_({ ok: true, api: API, khoi: docBanHang_(e.parameter.tu) });
    if (action === 'admin') return traVe_({ ok: true, api: API, da_dat_ma: !!maAdmin_(), khoa_con_phut: khoaAdminConPhut_() });
    var rev = revHienTai_(); // đọc mốc TRƯỚC dữ liệu: có ai ghi chen giữa thì lần đồng bộ sau tải lại phần đó
    var cat = docCatalog_();
    return traVe_({ ok: true, api: API, rev: rev, skus: cat.skus, combos: cat.combos, ma_chuan: cat.ma_chuan, nguoi_dung: docNguoiDung_(), nha: soNha_(),
                    cai_dat_chung: docCaiDatChung_(), admin_da_dat_ma: !!maAdmin_(), de_sau: docDeSau_(), quyen: docQuyen_() });
  } catch (err) {
    return traVe_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  soNhaNho_ = null;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return traVe_({ ok: false, error: 'Đang có máy khác ghi danh mục, thử lại sau vài giây nha.' });
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var out = xuLy_(String(body.action || ''), body.data || {}, chuoi_(body.nguoi).slice(0, 60));
    out.api = API;
    if (out.rev === undefined) out.rev = revHienTai_();
    return traVe_(out);
  } catch (err) {
    return traVe_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function traVe_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ===================== Xử lý ghi ===================== */

function xuLy_(action, data, nguoi) {
  if (action === 'ping') return { ok: true };
  // Thao tác Admin: kiểm tra mã ở đây (Script Properties), sai thì dừng luôn
  var admin = false;
  if (data._maAdmin !== undefined || HD_ADMIN.indexOf(action) >= 0 ||
      (action === 'moLaiPhan' && chuoi_(data.nguoi) && chuoi_(data.nguoi) !== nguoi)) {
    kiemTraAdmin_(data._maAdmin);
    admin = true;
  }
  var nguoiLog = admin ? (nguoi || '?') + ' (Admin)' : nguoi;
  if (action === 'kiemTraMaAdmin') return { ok: true, admin: true };
  // Người bị tạm khóa (tab "👥 Người dùng"): không ghi được gì (trừ khi gửi kèm đúng mã Admin)
  if (!admin && nguoi && biKhoa_(nguoi)) throw new Error('TAM_KHOA: Tài khoản "' + nguoi + '" đang bị tạm khóa – nhờ Admin mở lại ở tab 👥 Người dùng.');
  if (action === 'luuQuyen') return luuQuyen_(data, nguoi, nguoiLog);
  if (action === 'khoiPhucSaoLuu') return khoiPhucTuApp_(data, nguoiLog);
  if (action === 'luuCaiDatChung') return luuCaiDatChung_(data, nguoiLog);
  if (action === 'luuNha') return luuNha_(data, nguoiLog);
  if (action === 'themNha') return themNha_(data, nguoiLog);
  if (action === 'xoaDot') return xoaDot_(data, nguoiLog);
  if (action === 'xoaPhan') return xoaPhan_(data, nguoiLog);
  if (action === 'suaPhan') return suaPhan_(data, nguoiLog);
  if (action === 'ghiLichSuDatHang') return ghiLichSuDatHang_(data);
  if (action === 'napLichSuDatHang') return napLichSuDatHang_(data);
  if (action === 'luuNguoiDung') return luuNguoiDung_(data, nguoiLog);
  if (action === 'baoXong') return baoXong_(data, nguoi);
  if (action === 'napBanHang') return napBanHang_(data);
  if (action === 'napThongKe') return tkNap_(data, nguoiLog);
  if (action === 'thongKeTam') return tkTam_(data);
  if (action === 'deSau') return deSau_(data, nguoi);
  if (action === 'luuDuBaoNgay') return luuDuBaoNgay_(data, nguoi);
  if (action === 'moLaiPhan') return moLaiPhan_(data, nguoi, admin);
  if (action === 'chotDot') return chotDot_(data, nguoiLog);
  if (action === 'moLaiDot') return moLaiDot_(data, nguoiLog);
  var cat = docCatalog_();
  var revCu = revHienTai_();
  var ctx = { action: action, now: bayGio_(), log: [], doiSku: false, doiCombo: false, nguoi: nguoi || '', nguoiLog: nguoiLog || '', admin: admin, rev: revCu + 1 };
  var extra = {};

  // Chống ghi đè: bản ghi đã bị người khác sửa sau phiên bản máy này đang thấy → KHÔNG ghi, trả về xung đột
  if (data._pb && !data._ghiDe) {
    var xd = kiemTraPhienBan_(cat, data._pb, ctx.nguoi);
    if (xd.length) return { ok: false, error: 'XUNG_DOT', xungDot: xd, catalog: cat, rev: revCu };
  }
  // Combo mới trùng thành phần với combo đã có (có thể người khác vừa tạo) → hỏi gắn vào combo đó
  if (action === 'upsertCombo' && !chuoi_(data.combo_id) && !data._boQuaTrung) {
    var trung = timComboTrung_(cat, data);
    if (trung) return { ok: false, error: 'COMBO_TRUNG', comboTrung: trung, catalog: cat, rev: revCu };
  }
  var truocKhi = anhChup_(cat);

  switch (action) {
    case 'upsertSku':
      upsertSku_(cat, data, ctx, true);
      break;
    case 'upsertSkuBatch':
      // Tự học / ghi gom: dòng lỗi bỏ qua, không chặn cả lô; KHÔNG đè dữ liệu gán tay
      extra.soThayDoi = 0;
      (data.items || []).forEach(function (it) {
        try { if (upsertSku_(cat, it, ctx, false)) extra.soThayDoi++; } catch (e) { /* bỏ qua dòng lỗi */ }
      });
      // Giá gần nhất của sách lẻ trong file hôm nay (chỉ ghi khi giá đổi; không đụng nha/nguon)
      extra.soCapNhatGia = 0;
      (data.gia || []).forEach(function (g) { if (capNhatGia_(cat, g, ctx)) extra.soCapNhatGia++; });
      // Sổ mã chuẩn từ đơn web + mã phụ tự khớp (tên trùng hẳn + cùng giá) – gom chung 1 lần ghi
      if (data.maChuan && data.maChuan.length) extra.soMaChuan = ghiSoMaChuan_(cat, data.maChuan, ctx);
      extra.soMaPhu = 0;
      (data.maPhu || []).forEach(function (it) { try { if (luuMaPhu_(cat, it, ctx, true)) extra.soMaPhu++; } catch (e) { /* bỏ qua */ } });
      break;
    case 'luuTenSach':
      // Khai báo tên sách (1 dòng hoặc hàng loạt) – nguồn tay
      extra.soTenSach = 0;
      (data.items || [data]).forEach(function (it) { if (luuTenSach_(cat, it, ctx)) extra.soTenSach++; });
      break;
    case 'ganBarcode':
      extra.soKhoa = ganBarcode_(cat, data, ctx);
      break;
    case 'suaSku':
      suaSku_(cat, data, ctx);
      break;
    case 'boGanBarcode':
      boGanBarcode_(cat, data, ctx);
      break;
    case 'khongPhaiCombo':
      khongPhaiCombo_(cat, data, ctx);
      break;
    case 'khaiBaoLo':
      Object.assign(extra, khaiBaoLo_(cat, data, ctx));
      break;
    case 'upsertMaChuan':
      extra.soMaChuan = ghiSoMaChuan_(cat, data.items || [], ctx);
      break;
    case 'luuMaPhu':
      luuMaPhu_(cat, data, ctx, false);
      break;
    case 'boQuaCungCuon':
      boQuaCungCuon_(cat, data, ctx);
      break;
    case 'thayMaTaiBan':
      thayMaTaiBan_(cat, data, ctx);
      break;
    case 'hoanTacTaiBan':
      hoanTacTaiBan_(cat, data, ctx);
      break;
    case 'boQuaTaiBan':
      boQuaTaiBan_(cat, data, ctx);
      break;
    case 'capNhatGiaCombo':
      extra.soCombo = 0;
      (data.items || []).forEach(function (it) { if (capNhatGiaCombo_(cat, it, ctx)) extra.soCombo++; });
      break;
    case 'deleteSku':
      deleteSku_(cat, data, ctx);
      break;
    case 'upsertCombo':
      extra.combo_id = upsertCombo_(cat, data, ctx);
      break;
    case 'addComboKey':
      addComboKey_(cat, data, ctx);
      break;
    case 'doiKhoaCombo':
      doiKhoaCombo_(cat, data, ctx);
      break;
    case 'deleteCombo':
      deleteCombo_(cat, data, ctx);
      break;
    case 'xoaNha':
      // Admin: xóa 1 nhà khỏi sổ, chuyển sách / thành phần combo của nhà đó sang nhà khác
      extra.soChuyen = xoaNha_(cat, data, ctx);
      break;
    case 'xoaHangLoat':
      // Admin: xóa hàng loạt dòng SKU / combo (mỗi dòng 1 bản ghi lịch sử – hoàn tác được)
      extra.soXoa = 0;
      (data.skus || []).forEach(function (k) { try { deleteSku_(cat, { key: k }, ctx); extra.soXoa++; } catch (e) { /* đã bị xóa */ } });
      (data.combos || []).forEach(function (id) { try { deleteCombo_(cat, { combo_id: id }, ctx); extra.soXoa++; } catch (e) { /* đã bị xóa */ } });
      break;
    case 'importBatch':
      extra.loi = [];
      (data.skus || []).forEach(function (it, i) {
        try { upsertSku_(cat, it, ctx, true); } catch (e) { extra.loi.push('SKU #' + (i + 1) + ': ' + e.message); }
      });
      (data.combos || []).forEach(function (it, i) {
        try { upsertCombo_(cat, it, ctx); } catch (e) { extra.loi.push('Combo #' + (i + 1) + ': ' + e.message); }
      });
      break;
    default:
      throw new Error('Hành động không hợp lệ: ' + action);
  }

  // Đóng dấu phiên bản / mốc đồng bộ cho các bản ghi vừa đổi, ghi lại bản ghi đã xóa
  var doi = danhDauThayDoi_(cat, truocKhi, ctx);
  if (doi.sku) ctx.doiSku = true;
  if (doi.combo) ctx.doiCombo = true;
  if (doi.mc) ctx.doiMc = true;

  if (ctx.doiSku) ghiBang_(SH.SKU, cat.skus);
  if (ctx.doiMc) ghiBang_(SH.MC, cat.ma_chuan);
  if (ctx.doiCombo) {
    ghiBang_(SH.COMBO, cat.combos.map(function (c) {
      return { combo_id: c.combo_id, ten_combo: c.ten_combo, khoa: c.khoa.join(TACH_KHOA), cap_nhat: c.cap_nhat,
               cach_xuat: c.cach_xuat, ma_he_thong: c.ma_he_thong, ten_xuat: c.ten_xuat, nha: c.nha,
               phien_ban: c.phien_ban, dong_bo: c.dong_bo, nguoi_sua: c.nguoi_sua };
    }));
    var tps = [];
    cat.combos.forEach(function (c) {
      c.thanh_phan.forEach(function (t) {
        tps.push({ combo_id: c.combo_id, sku: t.sku, ten: t.ten, nha: t.nha, gia_goc: t.gia_goc, so_luong: t.so_luong });
      });
    });
    ghiBang_(SH.TP, tps);
  }
  ghiXoa_(doi.xoa);
  ghiLichSu_(ctx.log);
  // Tăng mốc SAU KHI đã ghi xong dữ liệu (máy đọc mốc mới chắc chắn thấy dữ liệu mới)
  var rev = revCu;
  if (doi.co || ctx.log.length) { rev = ctx.rev; datRev_(rev); }

  var out = { ok: true, catalog: cat, rev: rev, soThayDoiLichSu: ctx.log.length };
  if (action === 'xoaNha') out.nha = soNha_();
  Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

function chuoi_(v) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim(); }

function upsertSku_(cat, d, ctx, choGhiDeTay) {
  var key = chuoi_(d.key);
  var nha = chuoi_(d.nha).toUpperCase();
  // Nguồn: tay (gán tay) > web (nhà cung cấp trên đơn web) > tu_hoc (đoán từ mã trong tên)
  var nguon = ['tu_hoc', 'web'].indexOf(chuoi_(d.nguon)) >= 0 ? chuoi_(d.nguon) : 'tay';
  if (!key) throw new Error('Thiếu khóa (key).');
  if (!/^(sku|ten):/.test(key)) throw new Error('Khóa không hợp lệ: ' + key);
  if (nhaSku_().indexOf(nha) < 0) throw new Error('Nhà không hợp lệ: ' + d.nha);
  var i = timViTri_(cat.skus, 'key', key);
  var cu = i >= 0 ? cat.skus[i] : null;
  // Nhãn "tay" luôn ưu tiên hơn "tu_hoc": tự học không bao giờ ghi đè gán tay
  if (cu && cu.nguon === 'tay' && nguon !== 'tay') return false;
  if (cu && cu.nguon === 'web' && nguon === 'tu_hoc') return false;
  if (cu && chuoi_(cu.ma_moi) && nguon !== 'tay') return false; // mã phụ > web > tự học
  if (!choGhiDeTay && cu && cu.nguon === 'tay') return false;
  // Giữ các cột khác (giá gần nhất, mã tái bản…) của dòng cũ
  var moi = Object.assign({}, cu || {}, { key: key, sku: chuoi_(d.sku), ten: chuoi_(d.ten) || (cu ? cu.ten : ''), nha: nha, nguon: nguon, cap_nhat: ctx.now });
  // Phân loại trên sàn (để gợi ý tên): chỉ điền khi đang trống
  if (!chuoi_(moi.phan_loai) && chuoi_(d.phan_loai)) moi.phan_loai = chuoi_(d.phan_loai);
  // Tên sách khai báo: chỉ thao tác của bạn (gán tay / nạp Excel có cột "Tên sách") mới được ghi – tự học KHÔNG đụng
  if (choGhiDeTay && d.ten_sach !== undefined) moi.ten_sach = chuoi_(d.ten_sach);
  if (!cu && soDuong_(d.gia_gan_nhat)) { moi.gia_gan_nhat = soDuong_(d.gia_gan_nhat); moi.ngay_gia = chuoi_(d.ngay_gia) || homNay_(); }
  if (ctx.action === 'importBatch') {
    // Nạp Excel: cho phép ghi kèm giá gần nhất / mã tái bản nếu file có
    if (soDuong_(d.gia_gan_nhat)) { moi.gia_gan_nhat = soDuong_(d.gia_gan_nhat); moi.ngay_gia = chuoi_(d.ngay_gia) || homNay_(); }
    if (chuoi_(d.ma_moi)) moi.ma_moi = chuoi_(d.ma_moi).toUpperCase();
    if (chuoi_(d.khong_tai_ban)) moi.khong_tai_ban = chuoi_(d.khong_tai_ban);
  }
  var giong = function (a, b) {
    return ['nha', 'nguon', 'sku', 'ten', 'gia_gan_nhat', 'ma_moi', 'khong_tai_ban', 'ten_sach', 'phan_loai', 'khong_combo'].every(function (f) { return chuoi_(a[f]) === chuoi_(b[f]); });
  };
  if (cu && giong(cu, moi)) return false;
  if (i >= 0) cat.skus[i] = moi; else cat.skus.push(moi);
  ctx.doiSku = true;
  ghiLog_(ctx, ctx.action, key, cu, moi);
  return true;
}

/* Khai báo tên sách cho 1 khóa (sku:<barcode> hoặc ten:…). Chưa có trong danh mục → tạo mới (cần nhà), nguồn tay.
 * Đã có → chỉ đổi tên sách, giữ nguyên nhà / nguồn. ten_sach rỗng = bỏ khai báo. */
function luuTenSach_(cat, d, ctx) {
  var key = chuoi_(d.key);
  if (!/^(sku|ten):/.test(key)) throw new Error('Khóa không hợp lệ: ' + key);
  var i = timViTri_(cat.skus, 'key', key), cu = i >= 0 ? cat.skus[i] : null, ten = chuoi_(d.ten_sach);
  var moi;
  if (cu) {
    if (chuoi_(cu.ten_sach) === ten) return false;
    moi = Object.assign({}, cu, { ten_sach: ten, cap_nhat: ctx.now });
    if (!chuoi_(moi.phan_loai) && chuoi_(d.phan_loai)) moi.phan_loai = chuoi_(d.phan_loai);
    cat.skus[i] = moi;
  } else {
    var nha = chuoi_(d.nha).toUpperCase();
    if (nhaSku_().indexOf(nha) < 0) throw new Error('Cần chọn nhà cho sách mới: ' + key); // KHONG_NHAP: sách nhà khác (tab Chờ khai báo)
    if (!ten) return false;
    moi = { key: key, sku: chuoi_(d.sku), ten: chuoi_(d.ten), nha: nha, nguon: 'tay', cap_nhat: ctx.now, ten_sach: ten, phan_loai: chuoi_(d.phan_loai) };
    cat.skus.push(moi);
  }
  ctx.doiSku = true;
  ghiLog_(ctx, 'luuTenSach', key, cu, Object.assign({ ghi_chu: 'Tên sách: ' + (chuoi_(cu && cu.ten_sach) || '(chưa có)') + ' → ' + (ten || '(bỏ khai báo)') }, moi));
  return true;
}

/* Tab Chờ khai báo: nhiều việc trong 1 lần ghi (gán nhà / tên sách / là sách lẻ). Việc lỗi bỏ qua, báo lại; mỗi việc ghi LICH_SU
 * dưới tên thao tác quen thuộc (upsertSku / luuTenSach / khongPhaiCombo) để xem & hoàn tác như cũ. */
function khaiBaoLo_(cat, d, ctx) {
  var goc = ctx.action, so = 0, loi = [];
  (d.items || []).forEach(function (it) {
    try {
      var viec = chuoi_(it.viec), nha = chuoi_(it.nha).toUpperCase();
      var sach = { key: it.key, sku: it.sku, ten: it.ten, nha: nha, nguon: 'tay', phan_loai: it.phan_loai };
      if (['nha', 'ten', 'le'].indexOf(viec) < 0) throw new Error('Việc không hợp lệ: ' + viec);
      if (viec === 'le') {
        ctx.action = 'khongPhaiCombo';
        if (khongPhaiCombo_(cat, { key: it.key_le, sku: it.sku, ten: it.ten, phan_loai: it.phan_loai, nha: nha }, ctx)) so++;
      }
      if (viec !== 'nha' && chuoi_(it.ten_sach)) sach.ten_sach = chuoi_(it.ten_sach);
      else if (viec === 'ten') throw new Error('Thiếu tên sách.');
      // "le": khóa sách lẻ (barcode trơn) khác khóa ghi nhớ (barcode + phân loại) → gán nhà cả khóa sách lẻ
      if (viec !== 'le' || sach.ten_sach !== undefined || chuoi_(it.key) !== chuoi_(it.key_le)) {
        ctx.action = sach.ten_sach !== undefined ? 'luuTenSach' : 'upsertSku';
        if (upsertSku_(cat, sach, ctx, true)) so++;
      }
    } catch (e) { loi.push(chuoi_(it.key) + ': ' + e.message); }
  });
  ctx.action = goc;
  return { soThayDoi: so, loi: loi };
}

/* Dòng bị nghi combo (dạng "A+B" / theo giá) mà bạn bảo "Không phải combo" → ghi nhớ trên khóa sách lẻ của dòng.
 * Chưa có trong danh mục → tạo dòng nguồn tự học (để tự học vẫn điền được nhà). bo = true: bỏ ghi nhớ. */
function khongPhaiCombo_(cat, d, ctx) {
  var key = chuoi_(d.key);
  if (!/^(sku|ten):/.test(key)) throw new Error('Khóa không hợp lệ: ' + key);
  var i = timViTri_(cat.skus, 'key', key), cu = i >= 0 ? cat.skus[i] : null, gt = d.bo ? '' : '1';
  var nha = chuoi_(d.nha).toUpperCase();
  // "Là sách lẻ của nhà X" (chọn nhà) → gán tay luôn nhà đó
  var ganNha = !d.bo && nhaSku_().indexOf(nha) >= 0;
  var moi = cu ? Object.assign({}, cu, { khong_combo: gt }, ganNha ? { nha: nha, nguon: 'tay' } : {})
    : { key: key, sku: chuoi_(d.sku), ten: chuoi_(d.ten), nha: ganNha ? nha : '', nguon: ganNha ? 'tay' : 'tu_hoc',
        phan_loai: chuoi_(d.phan_loai), khong_combo: gt };
  if (cu && ['khong_combo', 'nha', 'nguon'].every(function (f) { return chuoi_(cu[f]) === chuoi_(moi[f]); })) return false;
  moi.cap_nhat = ctx.now;
  if (i >= 0) cat.skus[i] = moi; else cat.skus.push(moi);
  ctx.doiSku = true;
  ghiLog_(ctx, 'khongPhaiCombo', key, cu, Object.assign({ ghi_chu: gt ? 'Không phải combo – là sách lẻ' + (ganNha ? ' ' + nha : '') + ': ' + chuoi_(d.ten || moi.ten) +
    (d.phan_loai ? ' – ' + chuoi_(d.phan_loai) : '') : 'Bỏ ghi nhớ "không phải combo"' }, moi));
  return true;
}

/* ===================== Gán / sửa barcode cho dòng sàn ===================== */
/* data: { items: [{ key, sku, ten, phan_loai, ma_moi? }], ma_moi, nha?, ten_sach?, ghi_de?, thanh_phan?: { combo_ids: [], ten } }
 * - key = sku:<SKU chữ / barcode sai> hoặc ten:<tên>|<phân loại>  → lưu mã phụ trỏ về barcode đúng (nguon_ma gan_tay, nguồn tay)
 * - barcode đúng chưa có trong danh mục + có nhà → tạo luôn (nguồn tay, kèm tên sách)
 * - thanh_phan: thành phần combo chưa có SKU → điền barcode vào thành phần (theo tên) trong các combo đó
 * - Khóa đã được gán TAY sang barcode khác → báo CAN_XAC_NHAN (trừ khi ghi_de)
 * Ghi 1 dòng LICH_SU có ảnh chụp trước/sau → hoàn tác được. */
function ganBarcode_(cat, d, ctx) {
  var Ychung = chuoi_(d.ma_moi).toUpperCase(), items = d.items || [], tp = d.thanh_phan;
  if (!items.length && !tp) throw new Error('Không có dòng nào để gán barcode.');
  var anh = {}, combosDung = {};
  function chup(key) { if (!(key in anh)) { var j = timViTri_(cat.skus, 'key', key); anh[key] = j >= 0 ? saoChep_(cat.skus[j]) : null; } }
  // Kiểm tra trước, chưa sửa gì
  var viec = items.map(function (it) {
    var key = chuoi_(it.key), Y = chuoi_(it.ma_moi || Ychung).toUpperCase();
    if (!/^(sku|ten):/.test(key)) throw new Error('Khóa không hợp lệ: ' + key);
    if (!Y) throw new Error('Thiếu barcode.');
    if (!/^\d{7,}$/.test(Y) && !d.ep) throw new Error('CAN_XAC_NHAN: "' + Y + '" không giống mã vạch (chỉ gồm chữ số, từ 7 ký tự). Vẫn lưu?');
    var X = key.indexOf('sku:') === 0 ? key.slice(4) : '';
    if (X === Y) throw new Error('Barcode mới trùng barcode đang có.');
    var i = timViTri_(cat.skus, 'key', key), cu = i >= 0 ? cat.skus[i] : null;
    var maCu = cu ? chuoi_(cu.ma_moi).toUpperCase() : '';
    if (maCu && maCu !== Y && cu.nguon === 'tay' && !d.ghi_de) {
      throw new Error('CAN_XAC_NHAN: Dòng "' + (cu.ten || key) + '" đã được gán tay sang barcode ' + maCu + '. Ghi đè thành ' + Y + '?');
    }
    var cur = Y, da = {};
    while (cur && !da[cur]) {
      if (X && cur === X && !d.ep) throw new Error('CAN_XAC_NHAN: Trỏ ' + X + ' về ' + Y + ' sẽ tạo vòng lặp (' + Y + ' đang trỏ về ' + X + '). Vẫn lưu?');
      da[cur] = 1;
      var j = timSku_(cat, cur);
      cur = j >= 0 ? chuoi_(cat.skus[j].ma_moi).toUpperCase() : '';
    }
    return { it: it, key: key, Y: Y, i: i, cu: cu };
  });
  var dsY = {};
  viec.forEach(function (v) { dsY[v.Y] = 1; });
  if (tp && Ychung) dsY[Ychung] = 1;
  var nha = chuoi_(d.nha).toUpperCase(), tenSach = chuoi_(d.ten_sach);
  viec.forEach(function (v) { chup(v.key); });
  Object.keys(dsY).forEach(function (Y) { chup('sku:' + Y); });
  var truocCombo = [];
  if (tp && Ychung) {
    cat.combos.forEach(function (c, k) {
      if ((tp.combo_ids || []).indexOf(c.combo_id) < 0) return;
      if (c.thanh_phan.some(function (t) { return !chuoi_(t.sku) && chuoi_(t.ten) === chuoi_(tp.ten); })) { combosDung[k] = 1; truocCombo.push(saoChep_(c)); }
    });
    if (!truocCombo.length) throw new Error('Không tìm thấy thành phần combo cần gán barcode.');
  }
  // Sửa
  viec.forEach(function (v) {
    var it = v.it, i = timViTri_(cat.skus, 'key', v.key), cu = i >= 0 ? cat.skus[i] : null;
    var goc = cu || { key: v.key, sku: chuoi_(it.sku), ten: chuoi_(it.ten), nha: '', phan_loai: chuoi_(it.phan_loai) };
    var moi = Object.assign({}, goc, { ma_moi: v.Y, nguon_ma: 'gan_tay', nguon: 'tay', cap_nhat: ctx.now });
    if (i >= 0) cat.skus[i] = moi; else cat.skus.push(moi);
  });
  Object.keys(dsY).forEach(function (Y) {
    var j = timSku_(cat, Y), ry = j >= 0 ? cat.skus[j] : null;
    if (ry) {
      if (tenSach && !chuoi_(ry.ten_sach)) cat.skus[j] = Object.assign({}, ry, { ten_sach: tenSach, cap_nhat: ctx.now });
      return;
    }
    if (nhaSku_().indexOf(nha) < 0) return; // không có nhà → chưa tạo (app vẫn nhận nhà theo mã trong tên)
    var mau = viec.filter(function (v) { return v.Y === Y; })[0];
    cat.skus.push({ key: 'sku:' + Y, sku: Y, ten: mau ? chuoi_(mau.it.ten) : chuoi_(tp && tp.ten), nha: nha, nguon: 'tay', cap_nhat: ctx.now,
                    ten_sach: tenSach, phan_loai: '' });
  });
  Object.keys(combosDung).forEach(function (k) {
    var c = cat.combos[k];
    c.thanh_phan.forEach(function (t) { if (!chuoi_(t.sku) && chuoi_(t.ten) === chuoi_(tp.ten)) t.sku = Ychung; });
    c.cap_nhat = ctx.now;
  });
  var truoc = { skus: Object.keys(anh).map(function (k) { return { key: k, dong: anh[k] }; }), combos: truocCombo };
  var sau = {
    skus: Object.keys(anh).map(function (k) { var j = timViTri_(cat.skus, 'key', k); return { key: k, dong: j >= 0 ? saoChep_(cat.skus[j]) : null }; }),
    combos: Object.keys(combosDung).map(function (k) { return saoChep_(cat.combos[k]); })
  };
  ctx.doiSku = true;
  if (truocCombo.length) ctx.doiCombo = true;
  var moTa = viec.map(function (v) { return (v.key.indexOf('sku:') === 0 ? v.key.slice(4) : '(trống) ' + (v.cu ? v.cu.ten : v.it.ten)) + ' → ' + v.Y; });
  if (tp && Ychung) moTa.push('thành phần "' + tp.ten + '" → ' + Ychung);
  ghiLog_(ctx, 'ganBarcode', moTa.join('; ').slice(0, 300), truoc, sau);
  return viec.length;
}

/* Sửa tay MỌI trường của 1 dòng danh mục (kể cả khóa, mã chính của mã phụ). Nguồn → tay. Không chặn dữ liệu lạ
 * (app đã cảnh báo); chỉ hỏi lại (CAN_XAC_NHAN) khi đổi khóa trùng 1 dòng khác. Ảnh chụp trước/sau → hoàn tác được. */
function suaSku_(cat, d, ctx) {
  var keyCu = chuoi_(d.key_cu), key = chuoi_(d.key) || keyCu;
  if (!key) throw new Error('Thiếu khóa.');
  var iCu = keyCu ? timViTri_(cat.skus, 'key', keyCu) : -1, iMoi = timViTri_(cat.skus, 'key', key);
  if (key !== keyCu && iMoi >= 0 && !d.ghi_de) throw new Error('CAN_XAC_NHAN: Khóa ' + key + ' đã có dòng khác trong danh mục. Ghi đè dòng đó?');
  var truoc = [{ key: keyCu || key, dong: iCu >= 0 ? saoChep_(cat.skus[iCu]) : null }];
  if (key !== keyCu) truoc.push({ key: key, dong: iMoi >= 0 ? saoChep_(cat.skus[iMoi]) : null });
  var cu = iCu >= 0 ? cat.skus[iCu] : {};
  var maMoi = chuoi_(d.ma_moi).toUpperCase();
  var moi = Object.assign({}, cu, {
    key: key, sku: chuoi_(d.sku), ten: chuoi_(d.ten), ten_sach: chuoi_(d.ten_sach), phan_loai: chuoi_(d.phan_loai),
    nha: chuoi_(d.nha).toUpperCase(), nguon: 'tay', cap_nhat: ctx.now, ma_moi: maMoi,
    nguon_ma: maMoi ? (maMoi === chuoi_(cu.ma_moi).toUpperCase() && chuoi_(cu.nguon_ma) ? cu.nguon_ma : 'gan_tay') : '',
    khong_combo: d.khong_combo ? '1' : '', khong_tai_ban: chuoi_(d.khong_tai_ban)
  });
  var gia = soDuong_(d.gia_gan_nhat);
  if (gia !== soDuong_(cu.gia_gan_nhat)) { moi.gia_gan_nhat = gia || ''; moi.ngay_gia = gia ? homNay_() : ''; }
  // Bỏ dòng cũ (khi đổi khóa) và dòng trùng khóa mới (đã xác nhận ghi đè), rồi ghi dòng mới
  cat.skus = cat.skus.filter(function (e) { return e.key !== keyCu && e.key !== key; });
  cat.skus.push(moi);
  ctx.doiSku = true;
  var sau = truoc.map(function (x) { return { key: x.key, dong: x.key === key ? saoChep_(moi) : null }; });
  ghiLog_(ctx, 'suaSku', key === keyCu ? key : keyCu + ' → ' + key, { skus: truoc, combos: [] }, { skus: sau, combos: [] });
}

/* Xóa ánh xạ "Barcode gán tay" của 1 khóa (bỏ ma_moi / nguon_ma). Hoàn tác được. */
function boGanBarcode_(cat, d, ctx) {
  var key = chuoi_(d.key), i = timViTri_(cat.skus, 'key', key);
  if (i < 0 || !chuoi_(cat.skus[i].ma_moi)) throw new Error('Khóa này chưa được gán barcode.');
  var cu = saoChep_(cat.skus[i]);
  var moi = Object.assign({}, cat.skus[i], { ma_moi: '', nguon_ma: '', cap_nhat: ctx.now });
  // Dòng chỉ tạo ra để gán barcode (không nhà, không tên khai báo) → xóa hẳn
  if (!chuoi_(moi.nha) && !chuoi_(moi.ten_sach) && !chuoi_(moi.khong_combo)) { cat.skus.splice(i, 1); moi = null; }
  else cat.skus[i] = moi;
  ctx.doiSku = true;
  ghiLog_(ctx, 'boGanBarcode', key + ' (bỏ → ' + cu.ma_moi + ')', { skus: [{ key: key, dong: cu }], combos: [] }, { skus: [{ key: key, dong: moi }], combos: [] });
}

function soDuong_(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }
function homNay_() { return dinhDang_(new Date(), 'yyyy-MM-dd'); }
function dinhSo_(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function timSku_(cat, ma) { return timViTri_(cat.skus, 'key', 'sku:' + chuoi_(ma).toUpperCase()); }

/* ===================== Giá gần nhất ===================== */

function capNhatGia_(cat, g, ctx) {
  var i = timViTri_(cat.skus, 'key', chuoi_(g.key));
  var gia = soDuong_(g.gia);
  if (i < 0 || !gia) return false;
  var cu = cat.skus[i];
  if (soDuong_(cu.gia_gan_nhat) === gia) return false;
  var moi = Object.assign({}, cu, { gia_gan_nhat: gia, ngay_gia: homNay_() }); // KHÔNG đổi nha / nguon
  cat.skus[i] = moi;
  ctx.doiSku = true;
  ghiLog_(ctx, 'capNhatGia', moi.key, cu, Object.assign({ ghi_chu: 'Cập nhật giá: ' + dinhSo_(cu.gia_gan_nhat) + ' → ' + dinhSo_(gia) }, moi));
  return true;
}

/* items: { combo_id, gia: { "<sku>": giá mới } } → sửa giá khai báo của thành phần */
function capNhatGiaCombo_(cat, d, ctx) {
  var i = timViTri_(cat.combos, 'combo_id', chuoi_(d.combo_id));
  if (i < 0) return false;
  var c = cat.combos[i], cu = saoChep_(c), doi = [];
  c.thanh_phan.forEach(function (t) {
    var g = soDuong_((d.gia || {})[t.sku]);
    if (g && g !== (Number(t.gia_goc) || 0)) { doi.push(t.ten + ': ' + dinhSo_(t.gia_goc) + ' → ' + dinhSo_(g)); t.gia_goc = g; }
  });
  if (!doi.length) return false;
  c.cap_nhat = ctx.now;
  ctx.doiCombo = true;
  ghiLog_(ctx, 'capNhatGiaCombo', c.combo_id, cu, Object.assign({ ghi_chu: 'Cập nhật giá: ' + doi.join('; ') }, c));
  return true;
}

/* ===================== Sổ mã chuẩn (barcode web) & mã phụ ===================== */

/* Ghi / cập nhật sổ mã chuẩn. Bản cũ hơn (ngay_thay nhỏ hơn) không đè bản mới. Ghi 1 dòng tóm tắt vào LICH_SU. */
function ghiSoMaChuan_(cat, items, ctx) {
  var theoMa = {}, moi = 0, doi = 0;
  cat.ma_chuan.forEach(function (e, i) { theoMa[e.barcode] = i; });
  items.forEach(function (it) {
    var bc = chuoi_(it.barcode).toUpperCase();
    if (!/^\d{7,}$/.test(bc)) return;
    var x = { barcode: bc, ten_gon: chuoi_(it.ten_gon), gia_bia: soDuong_(it.gia_bia) || '', ncc: chuoi_(it.ncc),
              nha: nhaChinh_().indexOf(chuoi_(it.nha)) >= 0 ? chuoi_(it.nha) : '', ngay_thay: chuoi_(it.ngay_thay) || homNay_() };
    if (!(bc in theoMa)) { x.khong_phai = ''; theoMa[bc] = cat.ma_chuan.length; cat.ma_chuan.push(x); moi++; return; }
    var cu = cat.ma_chuan[theoMa[bc]];
    if (x.ngay_thay < chuoi_(cu.ngay_thay)) return;
    var khac = ['ten_gon', 'gia_bia', 'ncc', 'nha', 'ngay_thay'].some(function (f) { return chuoi_(cu[f]) !== chuoi_(x[f]); });
    if (!khac) return;
    cat.ma_chuan[theoMa[bc]] = Object.assign({}, cu, x);
    doi++;
  });
  if (moi || doi) {
    ctx.doiMc = true;
    ghiLog_(ctx, 'soMaChuan', moi + ' mới, ' + doi + ' cập nhật', null, { ghi_chu: 'Sổ mã chuẩn: thêm ' + moi + ' barcode, cập nhật ' + doi + ' barcode' });
  }
  return { moi: moi, doi: doi };
}

/* Lưu mã phụ: listing trên sàn (key = sku:X hoặc ten:…) trỏ về barcode web Y.
 * tuDong = true: khớp chắc (nguon_ma web_tu_khop) – KHÔNG bao giờ đè dòng gán tay.
 * tuDong = false: bạn bấm "Đúng, cùng cuốn" (nguon_ma xac_nhan, nguồn tay). */
function luuMaPhu_(cat, d, ctx, tuDong) {
  var key = chuoi_(d.key), Y = chuoi_(d.ma_moi).toUpperCase();
  if (!/^(sku|ten):/.test(key)) throw new Error('Khóa không hợp lệ: ' + key);
  if (!/^\d{7,}$/.test(Y)) throw new Error('Mã chuẩn phải là mã vạch.');
  var X = key.indexOf('sku:') === 0 ? key.slice(4) : '';
  if (X === Y) return false;
  var i = timViTri_(cat.skus, 'key', key), cu = i >= 0 ? cat.skus[i] : null;
  if (tuDong && cu && cu.nguon === 'tay') return false;
  if (cu && chuoi_(cu.ma_moi).toUpperCase() === Y) return false;
  var cur = Y, da = {};
  while (cur && !da[cur]) {
    if (X && cur === X) throw new Error('Không thể trỏ ' + X + ' về ' + Y + ' vì sẽ tạo vòng lặp.');
    da[cur] = 1;
    var j = timSku_(cat, cur);
    cur = j >= 0 ? chuoi_(cat.skus[j].ma_moi).toUpperCase() : '';
  }
  var goc = cu || { key: key, sku: chuoi_(d.sku), ten: chuoi_(d.ten), nha: nhaChinh_().indexOf(chuoi_(d.nha)) >= 0 ? chuoi_(d.nha) : '' };
  var moi = Object.assign({}, goc, { ma_moi: Y, nguon_ma: tuDong ? 'web_tu_khop' : 'xac_nhan', cap_nhat: ctx.now });
  moi.nguon = tuDong ? (cu ? cu.nguon : 'web_tu_khop') : 'tay';
  if (i >= 0) cat.skus[i] = moi; else cat.skus.push(moi);
  ctx.doiSku = true;
  ghiLog_(ctx, 'luuMaPhu', key + ' → ' + Y, cu, Object.assign({ ghi_chu: (tuDong ? 'Tự khớp (tên trùng + cùng giá): ' : 'Xác nhận cùng cuốn: ') +
    (X || moi.ten) + ' → mã web ' + Y }, moi));
  return true;
}

/* "Không phải cùng cuốn": ghi nhớ listing (khoa) vào dòng sổ mã chuẩn để không hỏi lại */
function boQuaCungCuon_(cat, d, ctx) {
  var bc = chuoi_(d.barcode).toUpperCase(), khoa = chuoi_(d.khoa);
  if (!/^\d{7,}$/.test(bc) || !khoa) throw new Error('Thiếu barcode hoặc khóa listing.');
  var i = timViTri_(cat.ma_chuan, 'barcode', bc);
  if (i < 0) { // barcode mới thấy trong file web hôm nay, chưa kịp ghi sổ
    cat.ma_chuan.push({ barcode: bc, ten_gon: chuoi_(d.ten_gon), gia_bia: soDuong_(d.gia_bia) || '', ncc: chuoi_(d.ncc),
                        nha: nhaChinh_().indexOf(chuoi_(d.nha)) >= 0 ? chuoi_(d.nha) : '', ngay_thay: homNay_(), khong_phai: '' });
    i = cat.ma_chuan.length - 1;
  }
  var cu = cat.ma_chuan[i];
  var ds = chuoi_(cu.khong_phai) ? chuoi_(cu.khong_phai).split(/\s*;;\s*/) : [];
  if (ds.indexOf(khoa) >= 0) return;
  ds.push(khoa);
  cat.ma_chuan[i] = Object.assign({}, cu, { khong_phai: ds.join(TACH_KHOA) });
  ctx.doiMc = true;
  ghiLog_(ctx, 'boQuaCungCuon', khoa + ' ≠ ' + bc, cu, cat.ma_chuan[i]);
}

/* ===================== Lịch sử đặt hàng ===================== */

function docDH_() {
  return docBang_(SH.DH).map(function (r) {
    COT_SO.LS_DAT_HANG.forEach(function (c) { r[c] = Number(r[c]) || 0; });
    return r;
  });
}
function ghiDH_(ds) {
  ds.sort(function (a, b) { return a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : 0; });
  ghiBang_(SH.DH, ds);
}

/* Mỗi lần tải file nhà: GHI ĐÈ số của (ngày, nhà) – tải lại nhiều lần trong ngày không bị cộng dồn.
 * data: { ngay, nhas: [...], dong: [{nha, barcode, ten, gia, sl, sl_shopee, sl_tiktok, sl_web, sl_treo}], maDon: [...] } */
function ghiLichSuDatHang_(data) {
  var ngay = chuoi_(data.ngay), nhas = [].concat(data.nhas || []);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay) || !nhas.length) throw new Error('Thiếu ngày hoặc nhà.');
  var now = bayGio_();
  var ds = docDH_().filter(function (r) { return !(r.ngay === ngay && nhas.indexOf(r.nha) >= 0); });
  var soDong = 0;
  (data.dong || []).forEach(function (d) {
    if (nhas.indexOf(chuoi_(d.nha)) < 0 || !chuoi_(d.barcode)) return;
    var x = { ngay: ngay, nha: chuoi_(d.nha), barcode: chuoi_(d.barcode), ten: chuoi_(d.ten), cap_nhat: now };
    COT_SO.LS_DAT_HANG.forEach(function (c) { x[c] = Number(d[c]) || 0; });
    ds.push(x);
    soDong++;
  });
  var gom = gomThangCu_(ds);
  ghiDH_(ds);
  themDonDaGhi_((data.maDon || []).map(function (m) { return [m, ngay]; }));
  return { ok: true, soDong: soDong, tongDong: ds.length, gomThang: gom, canhBaoLon: ds.length > NGUONG_NHAC_LON };
}

/* Nạp lịch sử từ file đơn cũ: CỘNG vào ngày đặt của từng đơn; đơn đã có (trùng mã đơn) thì bỏ qua.
 * data: { dong: [{ngay, nha, barcode, ten, gia, sl, nguon, ma_don}] } */
function napLichSuDatHang_(data) {
  var daCo = {};
  docBang_(SH.DON).forEach(function (r) { daCo[r.ma_don] = 1; });
  var now = bayGio_(), ds = docDH_(), viTri = {};
  ds.forEach(function (r, i) { viTri[r.ngay + '|' + r.nha + '|' + r.barcode] = i; });
  var donMoi = {}, donBoQua = {}, soDong = 0;
  var COT_NGUON = { Shopee: 'sl_shopee', TikTok: 'sl_tiktok', Web: 'sl_web' };
  (data.dong || []).forEach(function (d) {
    var ma = chuoi_(d.ma_don), ngay = chuoi_(d.ngay), nha = chuoi_(d.nha), bc = chuoi_(d.barcode);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay) || nhaChinh_().indexOf(nha) < 0 || !bc) return;
    if (ma && daCo[ma]) { donBoQua[ma] = 1; return; }
    if (ma) donMoi[ma] = ngay;
    var k = ngay + '|' + nha + '|' + bc;
    if (!(k in viTri)) {
      viTri[k] = ds.length;
      ds.push({ ngay: ngay, nha: nha, barcode: bc, ten: chuoi_(d.ten), gia: Number(d.gia) || 0, sl: 0, sl_shopee: 0, sl_tiktok: 0, sl_web: 0, sl_treo: 0, cap_nhat: now });
    }
    var x = ds[viTri[k]], sl = Number(d.sl) || 0;
    x.sl += sl;
    if (COT_NGUON[d.nguon]) x[COT_NGUON[d.nguon]] += sl;
    if (!x.ten) x.ten = chuoi_(d.ten);
    x.cap_nhat = now;
    soDong++;
  });
  var gom = gomThangCu_(ds);
  ghiDH_(ds);
  var dsMoi = Object.keys(donMoi);
  themDonDaGhi_(dsMoi.map(function (ma) { return [ma, donMoi[ma]]; }));
  return { ok: true, soDong: soDong, soDonMoi: dsMoi.length, soDonTrung: Object.keys(donBoQua).length, tongDong: ds.length,
           gomThang: gom, canhBaoLon: ds.length > NGUONG_NHAC_LON };
}

/* Ghi 1 lần cả lô mã đơn: cap = [[ma_don, ngay], …] */
function themDonDaGhi_(cap) {
  if (!cap.length) return;
  var s = sheet_(SH.DON), n = s.getLastRow();
  var co = {};
  if (n > 1) s.getRange(2, 1, n - 1, 1).getValues().forEach(function (r) { co[String(r[0])] = 1; });
  var moi = cap.filter(function (x) { var m = chuoi_(x[0]); if (!m || co[m]) return false; co[m] = 1; return true; });
  if (!moi.length) return;
  var r = s.getRange(n + 1, 1, moi.length, 2);
  r.setNumberFormat('@');
  r.setValues(moi.map(function (x) { return [chuoi_(x[0]), chuoi_(x[1])]; }));
  // Giữ gọn: bỏ mã đơn cũ hơn GIU_DON_DA_GHI ngày
  if (n + moi.length > 60000) {
    var moc = dinhDang_(new Date(Date.now() - GIU_DON_DA_GHI * 864e5), 'yyyy-MM-dd');
    ghiBang_(SH.DON, docBang_(SH.DON).filter(function (x) { return x.ngay >= moc; }));
  }
}

/* Dữ liệu lớn: gom các ngày cũ hơn 180 ngày thành 1 dòng / tháng / nhà / barcode (ngay = yyyy-MM) */
function gomThangCu_(ds) {
  if (ds.length <= NGUONG_GOM_THANG) return 0;
  var moc = dinhDang_(new Date(Date.now() - 180 * 864e5), 'yyyy-MM-dd');
  var giu = [], gom = {}, soGom = 0;
  ds.forEach(function (r) {
    if (r.ngay.length !== 10 || r.ngay >= moc) { giu.push(r); return; }
    var k = r.ngay.slice(0, 7) + '|' + r.nha + '|' + r.barcode;
    var g = gom[k] || (gom[k] = { ngay: r.ngay.slice(0, 7), nha: r.nha, barcode: r.barcode, ten: r.ten, gia: r.gia, sl: 0, sl_shopee: 0, sl_tiktok: 0, sl_web: 0, sl_treo: 0, cap_nhat: r.cap_nhat });
    ['sl', 'sl_shopee', 'sl_tiktok', 'sl_web', 'sl_treo'].forEach(function (c) { g[c] += r[c]; });
    soGom++;
  });
  ds.length = 0;
  Array.prototype.push.apply(ds, giu.concat(Object.keys(gom).map(function (k) { return gom[k]; })));
  return soGom;
}

/* Đọc lịch sử từ ngày tu (mặc định 150 ngày gần nhất) – dạng gọn { cot, dong } */
function docLichSuDatHang_(tu) {
  tu = /^\d{4}-\d{2}-\d{2}$/.test(chuoi_(tu)) ? chuoi_(tu) : dinhDang_(new Date(Date.now() - 150 * 864e5), 'yyyy-MM-dd');
  var cot = COT.LS_DAT_HANG.slice(0, 10);
  var ds = docDH_();
  return { ok: true, cot: cot, tongDong: ds.length, canhBaoLon: ds.length > NGUONG_NHAC_LON,
           ngayCuNhat: ds.reduce(function (m, r) { return r.ngay.length === 10 && (!m || r.ngay < m) ? r.ngay : m; }, ''),
           dong: ds.filter(function (r) { return r.ngay.length === 10 && r.ngay >= tu; }).map(function (r) { return cot.map(function (c) { return r[c]; }); }) };
}

/* ===================== Tái bản (đổi mã vạch) ===================== */

/* Thay mã X → Y: tạo/cập nhật Y (nhà theo X, nguồn tay), X.ma_moi = Y, thành phần combo X → Y, thêm khóa combo theo Y */
function thayMaTaiBan_(cat, d, ctx) {
  var X = chuoi_(d.ma_cu).toUpperCase(), Y = chuoi_(d.ma_moi).toUpperCase();
  var gia = soDuong_(d.gia), ten = chuoi_(d.ten);
  if (!X || !Y) throw new Error('Thiếu mã cũ hoặc mã mới.');
  if (!/^\d{7,}$/.test(Y)) throw new Error('Mã mới phải là mã vạch (chỉ gồm chữ số, từ 7 ký tự).');
  if (X === Y) throw new Error('Mã mới phải khác mã cũ.');
  var iX = timSku_(cat, X);
  if (iX < 0) throw new Error('Mã cũ ' + X + ' chưa có trong danh mục.');
  var rx = cat.skus[iX];
  // Chặn vòng lặp: đi theo chuỗi từ Y không được quay về X
  var cur = Y, da = {};
  while (cur && !da[cur]) {
    if (cur === X) throw new Error('Không thể thay ' + X + ' → ' + Y + ' vì ' + Y + ' đang trỏ ngược về ' + X + ' (vòng lặp).');
    da[cur] = 1;
    var j = timSku_(cat, cur);
    cur = j >= 0 ? chuoi_(cat.skus[j].ma_moi).toUpperCase() : '';
  }
  var iY = timSku_(cat, Y);
  var dongCombo = [];
  cat.combos.forEach(function (c, k) {
    var dung = c.thanh_phan.some(function (t) { return chuoi_(t.sku).toUpperCase() === X; }) ||
      c.khoa.some(function (kh) { return kh === 'sku:' + X || kh.indexOf('sku:' + X + '|') === 0; });
    if (dung) dongCombo.push(k);
  });
  var truoc = {
    skus: [{ key: 'sku:' + X, dong: saoChep_(rx) }, { key: 'sku:' + Y, dong: iY >= 0 ? saoChep_(cat.skus[iY]) : null }],
    combos: dongCombo.map(function (k) { return saoChep_(cat.combos[k]); })
  };

  var ry = iY >= 0 ? cat.skus[iY] : null;
  var moiY = Object.assign({}, ry || {}, {
    key: 'sku:' + Y, sku: Y, ten: ten || (ry && ry.ten) || rx.ten, nha: rx.nha, nguon: 'tay', cap_nhat: ctx.now,
    ma_moi: ry ? chuoi_(ry.ma_moi) : '', khong_tai_ban: ry ? chuoi_(ry.khong_tai_ban) : ''
  });
  if (gia) { moiY.gia_gan_nhat = gia; moiY.ngay_gia = homNay_(); }
  else if (!soDuong_(moiY.gia_gan_nhat) && soDuong_(rx.gia_gan_nhat)) { moiY.gia_gan_nhat = rx.gia_gan_nhat; moiY.ngay_gia = rx.ngay_gia; }
  if (iY >= 0) cat.skus[iY] = moiY; else cat.skus.push(moiY);
  cat.skus[iX] = Object.assign({}, rx, { ma_moi: Y, cap_nhat: ctx.now });

  var khoaDaCo = {};
  cat.combos.forEach(function (c) { c.khoa.forEach(function (kh) { khoaDaCo[kh] = c.combo_id; }); });
  dongCombo.forEach(function (k) {
    var c = cat.combos[k];
    c.thanh_phan.forEach(function (t) {
      if (chuoi_(t.sku).toUpperCase() !== X) return;
      t.sku = Y;
      if (ten) t.ten = ten;
      if (gia) t.gia_goc = gia;
    });
    c.khoa.slice().forEach(function (kh) {
      var moi = kh === 'sku:' + X ? 'sku:' + Y : kh.indexOf('sku:' + X + '|') === 0 ? 'sku:' + Y + kh.slice(4 + X.length) : '';
      if (moi && !khoaDaCo[moi]) { c.khoa.push(moi); khoaDaCo[moi] = c.combo_id; }
    });
    c.cap_nhat = ctx.now;
  });
  var sau = {
    skus: [{ key: 'sku:' + X, dong: saoChep_(cat.skus[iX]) }, { key: 'sku:' + Y, dong: saoChep_(moiY) }],
    combos: dongCombo.map(function (k) { return saoChep_(cat.combos[k]); })
  };
  ctx.doiSku = true;
  if (dongCombo.length) ctx.doiCombo = true;
  ghiLog_(ctx, 'thayMaTaiBan', X + ' → ' + Y, truoc, sau);
}

/* Hoàn tác 1 lần thay mã: d.dong = số dòng của bản ghi thayMaTaiBan trong sheet LICH_SU */
function hoanTacTaiBan_(cat, d, ctx) {
  var dong = Math.round(Number(d.dong));
  var s = sheet_(SH.LS);
  if (!(dong >= 2 && dong <= s.getLastRow())) throw new Error('Không tìm thấy bản ghi lịch sử cần hoàn tác.');
  var r = s.getRange(dong, 1, 1, COT.LICH_SU.length).getValues()[0];
  var hd = String(r[1]);
  if (HT_ANH.indexOf(hd) < 0 && HT_SKU.indexOf(hd) < 0 && HT_COMBO.indexOf(hd) < 0) throw new Error('Bản ghi này không hoàn tác được.');
  // Thao tác của người khác → chỉ Admin được hoàn tác (bản ghi cũ chưa có tên: ai cũng hoàn tác được như trước)
  var tacGia = String(r[5] || '').replace(/ \(Admin\)$/, '');
  if (tacGia && tacGia !== ctx.nguoi && !ctx.admin) {
    throw new Error('CAN_MA_ADMIN: Đây là thao tác của ' + tacGia + ' – chỉ Admin được hoàn tác thao tác của người khác.');
  }
  var maLs = 'LS#' + dong;
  var n = s.getLastRow();
  var cot = s.getRange(2, 2, n - 1, 2).getValues();
  if (cot.some(function (x) { return String(x[0]) === 'hoanTacTaiBan' && String(x[1]).indexOf(maLs + ' ') === 0; })) {
    throw new Error('Thao tác này đã được hoàn tác rồi.');
  }
  var truoc = anhTruoc_(hd, String(r[2]), String(r[3]), String(r[4]));
  var hienTai = { skus: [], combos: [] };
  truoc.skus.forEach(function (x) {
    var i = timViTri_(cat.skus, 'key', x.key);
    hienTai.skus.push({ key: x.key, dong: i >= 0 ? saoChep_(cat.skus[i]) : null });
    if (x.dong) { if (i >= 0) cat.skus[i] = x.dong; else cat.skus.push(x.dong); }
    else if (i >= 0) cat.skus.splice(i, 1);
  });
  truoc.combos.forEach(function (c) {
    var i = timViTri_(cat.combos, 'combo_id', c.combo_id);
    hienTai.combos.push(i >= 0 ? saoChep_(cat.combos[i]) : null);
    if (i >= 0) cat.combos[i] = c; else cat.combos.push(c);
  });
  (truoc.xoaCombo || []).forEach(function (id) { // combo được tạo bởi thao tác đó → xóa đi
    var i = timViTri_(cat.combos, 'combo_id', id);
    if (i >= 0) { hienTai.combos.push(saoChep_(cat.combos[i])); cat.combos.splice(i, 1); }
  });
  ctx.doiSku = true;
  if (truoc.combos.length || (truoc.xoaCombo || []).length) ctx.doiCombo = true;
  ghiLog_(ctx, 'hoanTacTaiBan', maLs + ' (' + String(r[2]) + ')', hienTai, truoc);
}

/* Hoàn tác: các thao tác có ảnh chụp trước/sau ; thao tác 1 dòng SKU / 1 combo (dữ liệu cũ nằm ở cột du_lieu_cu) */
var HT_ANH = ['thayMaTaiBan', 'ganBarcode', 'boGanBarcode', 'suaSku'];
var HT_SKU = ['upsertSku', 'deleteSku', 'luuTenSach', 'khongPhaiCombo'];
var HT_COMBO = ['upsertCombo', 'deleteCombo', 'addComboKey', 'doiKhoaCombo', 'boKhoa', 'capNhatGiaCombo'];
function anhTruoc_(hd, khoa, cuJson, moiJson) {
  if (HT_ANH.indexOf(hd) >= 0) return JSON.parse(cuJson);
  var cu = cuJson ? JSON.parse(cuJson) : null, moi = moiJson ? JSON.parse(moiJson) : null;
  if (HT_SKU.indexOf(hd) >= 0) return { skus: [{ key: khoa, dong: cu }], combos: [] };
  var id = (cu && cu.combo_id) || (moi && moi.combo_id) || khoa;
  return { skus: [], combos: cu ? [cu] : [], xoaCombo: cu ? [] : [id] };
}

/* "Không phải tái bản": ghi nhớ cặp X–Y để không hỏi lại */
function boQuaTaiBan_(cat, d, ctx) {
  var X = chuoi_(d.ma_cu).toUpperCase(), Y = chuoi_(d.ma_moi).toUpperCase();
  var i = timSku_(cat, X);
  if (i < 0 || !Y) throw new Error('Không tìm thấy mã ' + X + ' trong danh mục.');
  var cu = cat.skus[i];
  var ds = chuoi_(cu.khong_tai_ban) ? chuoi_(cu.khong_tai_ban).split(/\s*;;\s*/) : [];
  if (ds.indexOf(Y) >= 0) return;
  ds.push(Y);
  var moi = Object.assign({}, cu, { khong_tai_ban: ds.join(TACH_KHOA), cap_nhat: ctx.now });
  cat.skus[i] = moi;
  ctx.doiSku = true;
  ghiLog_(ctx, 'boQuaTaiBan', X + ' ≠ ' + Y, cu, moi);
}

function deleteSku_(cat, d, ctx) {
  var key = chuoi_(d.key);
  var i = timViTri_(cat.skus, 'key', key);
  if (i < 0) throw new Error('Không tìm thấy SKU trong danh mục (có thể máy khác vừa xóa).');
  var cu = cat.skus.splice(i, 1)[0];
  ctx.doiSku = true;
  ghiLog_(ctx, 'deleteSku', key, cu, null);
}

function chuanCombo_(d) {
  // Sửa tay luôn được lưu: thiếu dữ liệu thì điền mặc định (app đã cảnh báo trước khi gửi)
  var ten = chuoi_(d.ten_combo) || chuoi_(d.combo_id) || chuoi_([].concat(d.khoa || [])[0]) || '(combo chưa đặt tên)';
  var khoa = [];
  [].concat(d.khoa || []).forEach(function (k) {
    k = chuoi_(k);
    if (k && khoa.indexOf(k) < 0) khoa.push(k);
  });
  var cachXuat = chuoi_(d.cach_xuat) === 'nguyen' ? 'nguyen' : 'tach';
  var nha = chuoi_(d.nha).toUpperCase();
  if (nha && nhaChinh_().indexOf(nha) < 0) nha = '';
  var tps = (d.thanh_phan || []).map(function (t) {
    var nha = chuoi_(t.nha).toUpperCase();
    if (nhaTp_().indexOf(nha) < 0) nha = 'KHAC';
    var tenTp = chuoi_(t.ten) || chuoi_(t.sku) || '(chưa có tên)';
    return {
      sku: chuoi_(t.sku), ten: tenTp, nha: nha,
      gia_goc: Number(t.gia_goc) || 0, so_luong: Math.max(1, Math.round(Number(t.so_luong) || 1))
    };
  });
  return { ten_combo: ten, khoa: khoa, thanh_phan: tps, cach_xuat: cachXuat,
           ma_he_thong: chuoi_(d.ma_he_thong), ten_xuat: chuoi_(d.ten_xuat), nha: nha };
}

/* Mỗi khóa chỉ thuộc 1 combo: gắn khóa vào combo này thì gỡ khỏi combo khác (có ghi lịch sử) */
function goKhoaKhoiComboKhac_(cat, khoa, giuId, ctx) {
  cat.combos.forEach(function (c) {
    if (c.combo_id === giuId) return;
    var j = c.khoa.indexOf(khoa);
    if (j < 0) return;
    var cu = saoChep_(c);
    c.khoa.splice(j, 1);
    c.cap_nhat = ctx.now;
    ctx.doiCombo = true;
    ghiLog_(ctx, 'boKhoa', khoa, cu, c);
  });
}

function idMoi_(cat) {
  var max = 0;
  cat.combos.forEach(function (c) {
    var m = /^C(\d+)$/.exec(c.combo_id);
    if (m) max = Math.max(max, Number(m[1]));
  });
  var s = String(max + 1);
  while (s.length < 3) s = '0' + s;
  return 'C' + s;
}

function upsertCombo_(cat, d, ctx) {
  var c = chuanCombo_(d);
  var id = chuoi_(d.combo_id) || idMoi_(cat);
  var i = timViTri_(cat.combos, 'combo_id', id);
  var cu = i >= 0 ? saoChep_(cat.combos[i]) : null;
  var moi = { combo_id: id, ten_combo: c.ten_combo, khoa: c.khoa, thanh_phan: c.thanh_phan, cap_nhat: ctx.now,
             cach_xuat: c.cach_xuat, ma_he_thong: c.ma_he_thong, ten_xuat: c.ten_xuat, nha: c.nha };
  c.khoa.forEach(function (k) { goKhoaKhoiComboKhac_(cat, k, id, ctx); });
  if (i >= 0) cat.combos[i] = moi; else cat.combos.push(moi);
  ctx.doiCombo = true;
  ghiLog_(ctx, ctx.action === 'importBatch' ? 'importBatch' : 'upsertCombo', id, cu, moi);
  return id;
}

function addComboKey_(cat, d, ctx) {
  var id = chuoi_(d.combo_id), khoa = chuoi_(d.khoa);
  if (!khoa) throw new Error('Thiếu khóa nhận diện.');
  var i = timViTri_(cat.combos, 'combo_id', id);
  if (i < 0) throw new Error('Không tìm thấy combo ' + id + ' (có thể máy khác vừa xóa).');
  var c = cat.combos[i];
  if (c.khoa.indexOf(khoa) >= 0) return;
  goKhoaKhoiComboKhac_(cat, khoa, id, ctx);
  var cu = saoChep_(c);
  c.khoa.push(khoa);
  c.cap_nhat = ctx.now;
  ctx.doiCombo = true;
  ghiLog_(ctx, 'addComboKey', id, cu, c);
}

/* Đổi khóa cũ (vd "sku:<mã vạch>" trơn) sang khóa mới ("sku:<mã vạch>|<phân loại>") */
function doiKhoaCombo_(cat, d, ctx) {
  var id = chuoi_(d.combo_id), cu = chuoi_(d.khoa_cu);
  var moi = [].concat(d.khoa_moi || []).map(chuoi_).filter(function (k) { return k; });
  if (!moi.length) throw new Error('Thiếu khóa mới.');
  var i = timViTri_(cat.combos, 'combo_id', id);
  if (i < 0) throw new Error('Không tìm thấy combo ' + id + ' (có thể máy khác vừa xóa).');
  var c = cat.combos[i];
  var truoc = saoChep_(c);
  var j = c.khoa.indexOf(cu);
  if (j >= 0) c.khoa.splice(j, 1);
  var them = false;
  moi.forEach(function (k) {
    if (c.khoa.indexOf(k) >= 0) return;
    goKhoaKhoiComboKhac_(cat, k, id, ctx);
    c.khoa.push(k);
    them = true;
  });
  if (j < 0 && !them) return; // đã đổi rồi (máy khác làm trước)
  c.cap_nhat = ctx.now;
  ctx.doiCombo = true;
  ghiLog_(ctx, 'doiKhoaCombo', id, truoc, c);
}

function deleteCombo_(cat, d, ctx) {
  var id = chuoi_(d.combo_id);
  var i = timViTri_(cat.combos, 'combo_id', id);
  if (i < 0) throw new Error('Không tìm thấy combo ' + id + ' (có thể máy khác vừa xóa).');
  var cu = cat.combos.splice(i, 1)[0];
  ctx.doiCombo = true;
  ghiLog_(ctx, 'deleteCombo', id, cu, null);
}

/* ===================== Nhiều người dùng: phiên bản, đồng bộ, xung đột ===================== */

function revHienTai_() { return Number(PropertiesService.getScriptProperties().getProperty('DM_REV')) || 0; }
function datRev_(rev) { PropertiesService.getScriptProperties().setProperty('DM_REV', String(rev)); }
function soPb_(v) { return Number(v) || 0; }

/* Chuẩn hóa để so sánh: bỏ trường meta, bỏ giá trị rỗng, số/chữ như nhau, khóa sắp xếp */
function chuanSoSanh_(v, goc) {
  if (Array.isArray(v)) return v.map(function (x) { return chuanSoSanh_(x, false); });
  if (v && typeof v === 'object') {
    var o = {};
    Object.keys(v).sort().forEach(function (k) {
      if (goc && META[k]) return;
      var x = chuanSoSanh_(v[k], false);
      if (x === '' || (Array.isArray(x) && !x.length)) return;
      o[k] = x;
    });
    return o;
  }
  return chuoi_(v);
}
function dauVet_(o) { return JSON.stringify(chuanSoSanh_(o, true)); }

function anhChup_(cat) {
  var o = { sku: {}, combo: {}, mc: {} };
  cat.skus.forEach(function (e) { o.sku[e.key] = dauVet_(e); });
  cat.combos.forEach(function (c) { o.combo[c.combo_id] = dauVet_(c); });
  cat.ma_chuan.forEach(function (x) { o.mc[x.barcode] = dauVet_(x); });
  return o;
}

/* So với ảnh chụp trước khi xử lý: bản ghi mới / đổi → đóng dấu dong_bo (và phien_ban + nguoi_sua nếu sửa tay);
 * bản ghi biến mất → danh sách xóa. Trả về { sku, combo, mc, co, xoa } */
function danhDauThayDoi_(cat, truoc, ctx) {
  var tay = HD_TU_DONG.indexOf(ctx.action) < 0;
  var kq = { sku: false, combo: false, mc: false, co: false, xoa: [] };
  function duyet(ds, khoaCua, loai) {
    var con = {};
    ds.forEach(function (r) {
      var k = khoaCua(r);
      con[k] = 1;
      if (truoc[loai][k] === dauVet_(r)) return;
      r.dong_bo = ctx.rev;
      if (tay) { r.phien_ban = ctx.rev; r.nguoi_sua = ctx.nguoi; }
      kq[loai] = true; kq.co = true;
    });
    Object.keys(truoc[loai]).forEach(function (k) {
      if (con[k]) return;
      kq.xoa.push({ loai: loai, khoa: k, phien_ban: ctx.rev, luc: ctx.now, nguoi: ctx.nguoi });
      kq[loai] = true; kq.co = true;
    });
  }
  duyet(cat.skus, function (e) { return e.key; }, 'sku');
  duyet(cat.combos, function (c) { return c.combo_id; }, 'combo');
  duyet(cat.ma_chuan, function (x) { return x.barcode; }, 'mc');
  return kq;
}

/* Ghi bản ghi đã xóa (chỉ thêm dòng). Quá nhiều thì giữ GIU_XOA dòng mới nhất; máy có mốc cũ hơn phần đã bỏ sẽ tải lại toàn bộ. */
function ghiXoa_(ds) {
  if (!ds.length) return;
  var s = sheet_(SH.XOA), n = s.getLastRow();
  var r = s.getRange(n + 1, 1, ds.length, COT.DM_XOA.length);
  r.setNumberFormat('@');
  r.setValues(ds.map(function (x) { return COT.DM_XOA.map(function (c) { return x[c] === undefined ? '' : x[c]; }); }));
  if (n + ds.length > GIU_XOA + 1000) {
    var tatCa = docBang_(SH.XOA), bo = tatCa.slice(0, tatCa.length - GIU_XOA);
    var cat = bo.reduce(function (m, x) { return Math.max(m, soPb_(x.phien_ban)); }, 0);
    PropertiesService.getScriptProperties().setProperty('DM_XOA_CAT', String(cat));
    ghiBang_(SH.XOA, tatCa.slice(tatCa.length - GIU_XOA));
  }
}

/* pb = { "sku|<khoa>": phiên bản máy đang thấy, "combo|<id>": …, "mc|<barcode>": … }
 * Xung đột khi phiên bản hiện tại khác VÀ lần sửa tay gần nhất là của người khác (hoặc bản ghi đã bị xóa). */
function kiemTraPhienBan_(cat, pb, nguoi) {
  var out = [], xoa = null;
  Object.keys(pb || {}).forEach(function (k) {
    var j = k.indexOf('|'), loai = k.slice(0, j), khoa = k.slice(j + 1), thay = soPb_(pb[k]);
    var ds = loai === 'sku' ? cat.skus : loai === 'combo' ? cat.combos : loai === 'mc' ? cat.ma_chuan : null;
    if (!ds) return;
    var i = timViTri_(ds, loai === 'sku' ? 'key' : loai === 'combo' ? 'combo_id' : 'barcode', khoa);
    if (i < 0) {
      if (!thay) return; // máy này cũng chưa thấy bản ghi → tạo mới bình thường
      if (!xoa) xoa = docBang_(SH.XOA);
      var x = xoa.filter(function (r) { return r.loai === loai && r.khoa === khoa && soPb_(r.phien_ban) > thay; }).pop();
      if (x && x.nguoi && x.nguoi !== nguoi) out.push({ loai: loai, khoa: khoa, da_xoa: true, nguoi_sua: x.nguoi, cap_nhat: x.luc, ban_ghi: null });
      return;
    }
    var r = ds[i], hienTai = soPb_(r.phien_ban);
    if (hienTai === thay || !chuoi_(r.nguoi_sua) || r.nguoi_sua === nguoi) return;
    out.push({ loai: loai, khoa: khoa, phien_ban: hienTai, nguoi_sua: r.nguoi_sua, cap_nhat: r.cap_nhat || '', ban_ghi: saoChep_(r) });
  });
  return out;
}

/* Combo mới (tách) có cùng thành phần (SKU × số lượng) với combo đã có → trả về combo đó */
function timComboTrung_(cat, d) {
  var c = chuanCombo_(d);
  if (c.cach_xuat !== 'tach' || !c.thanh_phan.length || c.thanh_phan.some(function (t) { return !t.sku; })) return null;
  var dau = function (tps) { return tps.map(function (t) { return chuoi_(t.sku).toUpperCase() + '×' + (Number(t.so_luong) || 1); }).sort().join(','); };
  var x = dau(c.thanh_phan);
  var trung = cat.combos.filter(function (k) { return k.cach_xuat !== 'nguyen' && k.thanh_phan.length && dau(k.thanh_phan) === x; })[0];
  return trung ? { combo_id: trung.combo_id, ten_combo: trung.ten_combo, nguoi_sua: trung.nguoi_sua || '', cap_nhat: trung.cap_nhat || '' } : null;
}

/* Đồng bộ: chỉ trả về phần thay đổi sau mốc tu */
function docThayDoi_(tu) {
  tu = Math.floor(Number(tu) || 0);
  var rev = revHienTai_();
  if (tu === rev) return { ok: true, api: API, rev: rev, khongDoi: true };
  var lock = LockService.getScriptLock(), coKhoa = lock.tryLock(15000);
  try {
    rev = revHienTai_();
    var cat = docCatalog_();
    var catBo = Number(PropertiesService.getScriptProperties().getProperty('DM_XOA_CAT')) || 0;
    if (tu <= 0 || tu < catBo || tu > rev) {
      return { ok: true, api: API, rev: rev, toanBo: true, skus: cat.skus, combos: cat.combos, ma_chuan: cat.ma_chuan, nguoi_dung: docNguoiDung_(),
               cai_dat_chung: docCaiDatChung_(), quyen: docQuyen_() };
    }
    var moi = function (r) { return soPb_(r.dong_bo) > tu; };
    var xoa = docBang_(SH.XOA).filter(function (x) { return soPb_(x.phien_ban) > tu; })
      .map(function (x) { return { loai: x.loai, khoa: x.khoa }; });
    return { ok: true, api: API, rev: rev, skus: cat.skus.filter(moi), combos: cat.combos.filter(moi), ma_chuan: cat.ma_chuan.filter(moi),
             xoa: xoa, log: docLogSau_(tu), nguoi_dung: docNguoiDung_(), cai_dat_chung: docCaiDatChung_(), de_sau: docDeSau_(), nha: soNha_(), quyen: docQuyen_() };
  } finally {
    if (coKhoa) lock.releaseLock();
  }
}

/* Các dòng LICH_SU có phiên bản > tu (đọc từ cuối sheet, tối đa 300 dòng) – để báo "A vừa khai báo combo X" */
function docLogSau_(tu) {
  var s = sheet_(SH.LS), n = s.getLastRow();
  if (n < 2) return [];
  var bd = Math.max(2, n - 299), out = [];
  s.getRange(bd, 1, n - bd + 1, COT.LICH_SU.length).getValues().forEach(function (r) {
    if (soPb_(r[6]) > tu) out.push({ thoi_gian: r[0] instanceof Date ? dinhDang_(r[0]) : String(r[0]), hanh_dong: String(r[1]), khoa: String(r[2]), nguoi: String(r[5] || '') });
  });
  return out;
}

/* ===================== Người dùng ===================== */

function docNguoiDung_() {
  return docBang_(SH.ND).filter(function (x) { return x.ten; })
    .map(function (x) { return { ten: x.ten, vai_tro: VAI_TRO.indexOf(x.vai_tro) >= 0 ? x.vai_tro : 'san' }; });
}
/* Thay cả danh sách (tên không trùng, vai trò san | dat_hang) */
function luuNguoiDung_(d, nguoi) {
  var now = bayGio_(), da = {}, ds = [];
  (d.ds || []).forEach(function (x) {
    var ten = chuoi_(x.ten).slice(0, 40);
    if (!ten || da[ten.toLowerCase()]) return;
    da[ten.toLowerCase()] = 1;
    ds.push({ ten: ten, vai_tro: VAI_TRO.indexOf(x.vai_tro) >= 0 ? x.vai_tro : 'san', cap_nhat: now });
  });
  var cu = docNguoiDung_();
  dongBoQuyenTheoVaiTro_(cu, ds, now, nguoi); // máy bản cũ đổi vai trò / xóa người → bảng quyền đi theo
  ghiBang_(SH.ND, ds);
  ghiLichSu_([[now, 'luuNguoiDung', ds.length + ' người', JSON.stringify(cu), JSON.stringify(ds), nguoi || '', '']]);
  datRev_(revHienTai_() + 1); // máy khác nhận danh sách mới ở lần đồng bộ 30 giây
  return { ok: true, nguoi_dung: docNguoiDung_(), quyen: docQuyen_() };
}

/* ===================== Phân quyền theo từng người (api 9) ===================== */

function chuanQuyen_(v) {
  var ds = Array.isArray(v) ? v : String(v || '').split(/[,\s]+/), co = {};
  ds.forEach(function (k) { k = chuoi_(k); if (DS_QUYEN.indexOf(k) >= 0) co[k] = 1; });
  return DS_QUYEN.filter(function (k) { return co[k]; });
}
function mauGoc_(ten) { return MAU_GOC.filter(function (m) { return m.ten === ten; })[0] || null; }
function mauTheoVaiTro_(vt) { return vt === 'admin' ? 'Admin' : vt === 'dat_hang' ? 'Người đặt hàng' : 'Nhân viên sàn'; }
/* Vai trò cũ suy ra từ quyền – ghi vào NGUOI_DUNG cho máy chạy bản app cũ */
function vaiTroTuQuyen_(q) { return q.indexOf('qt_nguoidung') >= 0 ? 'admin' : q.indexOf('dot_chot') >= 0 ? 'dat_hang' : 'san'; }
/* Bảng quyền hiện tại: mẫu vai trò (gốc + tự tạo) + quyền từng người. Người chưa có dòng QUYEN → theo vai trò cũ (chuyển đổi tự động). */
function docQuyen_() {
  var bang = docBang_(SH.Q), mau = MAU_GOC.map(function (m) { return { ten: m.ten, quyen: chuanQuyen_(m.quyen), goc: true }; }), rieng = {};
  bang.forEach(function (x) {
    if (!x.ten) return;
    if (x.loai === 'mau') {
      var m = mau.filter(function (y) { return y.ten === x.ten; })[0];
      if (m && m.ten === 'Admin') return; // mẫu Admin luôn đủ quyền
      if (m) m.quyen = chuanQuyen_(x.quyen); else mau.push({ ten: x.ten, quyen: chuanQuyen_(x.quyen), goc: false });
    } else if (x.loai === 'nguoi') rieng[x.ten] = x;
  });
  var nguoi = docBang_(SH.ND).filter(function (x) { return x.ten; }).map(function (n) {
    var r = rieng[n.ten];
    if (r) return { ten: n.ten, mau: r.mau, quyen: chuanQuyen_(r.quyen), khoa: String(r.khoa) === '1' };
    var tm = mauTheoVaiTro_(n.vai_tro);
    return { ten: n.ten, mau: tm, quyen: chuanQuyen_(mauGoc_(tm).quyen), khoa: false, tu_vai_tro: true };
  });
  return { ds: DS_QUYEN, mau: mau, nguoi: nguoi };
}
function biKhoa_(ten) {
  return docBang_(SH.Q).some(function (x) { return x.loai === 'nguoi' && x.ten === ten && String(x.khoa) === '1'; });
}
/* Lưu cả bảng quyền (thay danh sách người + mẫu tự tạo). Luôn còn ≥ 1 người quản lý được người dùng và không bị khóa. */
function luuQuyen_(d, nguoi, nguoiLog) {
  var now = bayGio_(), cu = docQuyen_(), da = {}, dsNguoi = [], dsMau = [], daMau = {};
  (d.mau || []).forEach(function (m) {
    var ten = chuoi_(m.ten).slice(0, 40);
    if (!ten || daMau[ten.toLowerCase()] || ten === 'Admin') return;
    daMau[ten.toLowerCase()] = 1;
    var goc = mauGoc_(ten), q = chuanQuyen_(m.quyen);
    if (goc && q.join() === chuanQuyen_(goc.quyen).join()) return; // mẫu gốc chưa sửa → không cần lưu
    dsMau.push({ loai: 'mau', ten: ten, mau: '', quyen: q.join(','), khoa: '', cap_nhat: now, nguoi_sua: nguoiLog || '' });
  });
  (d.nguoi || []).forEach(function (x) {
    var ten = chuoi_(x.ten).slice(0, 40);
    if (!ten || da[ten.toLowerCase()]) return;
    da[ten.toLowerCase()] = 1;
    dsNguoi.push({ ten: ten, mau: chuoi_(x.mau).slice(0, 40), quyen: chuanQuyen_(x.quyen), khoa: !!x.khoa });
  });
  if (!dsNguoi.some(function (x) { return !x.khoa && x.quyen.indexOf('qt_nguoidung') >= 0; }))
    throw new Error('Phải còn ít nhất 1 Admin (người có quyền "Quản lý người dùng" và không bị tạm khóa).');
  // Lịch sử: mỗi người đổi quyền 1 dòng (thêm / bớt quyền nào, khóa / mở khóa)
  var cuTheo = {}, log = [];
  cu.nguoi.forEach(function (x) { cuTheo[x.ten] = x; });
  dsNguoi.forEach(function (x) {
    var c = cuTheo[x.ten];
    delete cuTheo[x.ten];
    var them = x.quyen.filter(function (k) { return !c || c.quyen.indexOf(k) < 0; }), bot = c ? c.quyen.filter(function (k) { return x.quyen.indexOf(k) < 0; }) : [];
    var doiKhoa = c ? c.khoa !== x.khoa : x.khoa;
    if (c && !them.length && !bot.length && !doiKhoa && c.mau === x.mau) return;
    var ghiChu = (c ? 'Đổi quyền ' : 'Thêm người ') + x.ten + (x.mau ? ' (mẫu ' + x.mau + ')' : '') + (them.length ? ' · thêm: ' + them.join(', ') : '') +
      (bot.length ? ' · bớt: ' + bot.join(', ') : '') + (doiKhoa ? (x.khoa ? ' · TẠM KHÓA' : ' · mở khóa') : '');
    log.push([now, c ? 'doiQuyen' : 'themNguoiDung', x.ten, c ? JSON.stringify({ mau: c.mau, quyen: c.quyen.join(','), khoa: c.khoa }) : '',
              JSON.stringify({ mau: x.mau, quyen: x.quyen.join(','), khoa: x.khoa, ghi_chu: ghiChu.slice(0, 900) }), nguoiLog || '', '']);
  });
  Object.keys(cuTheo).forEach(function (ten) {
    log.push([now, 'xoaNguoiDung', ten, JSON.stringify({ mau: cuTheo[ten].mau, quyen: cuTheo[ten].quyen.join(',') }), JSON.stringify({ ghi_chu: 'Xóa người dùng ' + ten }), nguoiLog || '', '']);
  });
  ghiBang_(SH.Q, dsMau.concat(dsNguoi.map(function (x) {
    return { loai: 'nguoi', ten: x.ten, mau: x.mau, quyen: x.quyen.join(','), khoa: x.khoa ? '1' : '', cap_nhat: now, nguoi_sua: nguoiLog || '' };
  })));
  ghiBang_(SH.ND, dsNguoi.map(function (x) { return { ten: x.ten, vai_tro: vaiTroTuQuyen_(x.quyen), cap_nhat: now }; }));
  ghiLichSu_(log);
  datRev_(revHienTai_() + 1); // máy khác nhận quyền mới ở lần đồng bộ 30 giây
  return { ok: true, nguoi_dung: docNguoiDung_(), quyen: docQuyen_(), soDoi: log.length };
}
/* Máy chạy app bản cũ lưu danh sách (tên + vai trò): người đổi vai trò → quyền theo mẫu của vai trò mới ; người bị xóa → bỏ dòng quyền */
function dongBoQuyenTheoVaiTro_(cu, moi, now, nguoi) {
  var bang = docBang_(SH.Q);
  if (!bang.length) return;
  var vtCu = {}, vtMoi = {};
  cu.forEach(function (x) { vtCu[x.ten] = x.vai_tro; });
  moi.forEach(function (x) { vtMoi[x.ten] = x.vai_tro; });
  var giu = bang.filter(function (x) { return x.loai !== 'nguoi' || (vtMoi[x.ten] && vtMoi[x.ten] === (vtCu[x.ten] || vtMoi[x.ten])); });
  if (giu.length !== bang.length) ghiBang_(SH.Q, giu);
}

/* ===================== Đợt đặt hàng ===================== */

function homNayVN_() { return Utilities.formatDate(new Date(), MUI_GIO_VN, 'yyyy-MM-dd'); }
function laNgay_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(chuoi_(s)); }
function congNgay_(s, n) {
  var p = s.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
function timDot_(ds, id) { return ds.filter(function (x) { return x.dot_id === id; })[0] || null; }

/* Sheet dữ liệu dòng của 1 đợt (ẩn). taoMoi = false: chưa có thì trả null */
function sheetDl_(dotId, taoMoi) {
  var ss = bangTinh_(), ten = DOT_DL + dotId, s = ss.getSheetByName(ten);
  if (!s && taoMoi) {
    s = ss.insertSheet(ten);
    s.getRange(1, 1, 1, COT.DOT_DL.length).setValues([COT.DOT_DL]).setFontWeight('bold');
    s.setFrozenRows(1);
    try { s.hideSheet(); } catch (e) { /* không ẩn được cũng không sao */ }
  }
  return s;
}
function docDl_(dotId) {
  var s = sheetDl_(dotId, false), out = {};
  if (!s || s.getLastRow() < 2) return out;
  var manh = {};
  s.getRange(2, 1, s.getLastRow() - 1, 3).getValues().forEach(function (r) {
    var id = String(r[0]);
    if (!id) return;
    (manh[id] = manh[id] || []).push([Number(r[1]) || 0, String(r[2])]);
  });
  Object.keys(manh).forEach(function (id) {
    var chuoi = manh[id].sort(function (a, b) { return a[0] - b[0]; }).map(function (x) { return x[1]; }).join('');
    try { out[id] = JSON.parse(chuoi); } catch (e) { out[id] = { cot: [], dong: [], loi: 'Dữ liệu hỏng' }; }
  });
  return out;
}
/* Thay dữ liệu của 1 phần (xóa mảnh cũ của phan_id, ghi mảnh mới) – chỉ ghi lại sheet của đợt đó */
function ghiDl_(dotId, phanId, duLieu) {
  var s = sheetDl_(dotId, true), n = s.getLastRow();
  var giu = n > 1 ? s.getRange(2, 1, n - 1, 3).getValues().filter(function (r) { return r[0] && String(r[0]) !== phanId; }) : [];
  var json = duLieu ? JSON.stringify(duLieu) : '', moi = []; // duLieu = null: xóa hẳn dữ liệu của phần
  for (var i = 0, k = 0; i < json.length; i += CHIA_O, k++) moi.push([phanId, k, json.slice(i, i + CHIA_O)]);
  var tatCa = giu.concat(moi);
  if (tatCa.length) {
    var r = s.getRange(2, 1, tatCa.length, 3);
    r.setNumberFormat('@');
    r.setValues(tatCa.map(function (x) { return [String(x[0]), String(x[1]), String(x[2])]; }));
  }
  if (n - 1 > tatCa.length) s.getRange(tatCa.length + 2, 1, n - 1 - tatCa.length, 3).clearContent();
}

function dongDot_(x) {
  return { dot_id: x.dot_id, trang_thai: x.trang_thai === 'da_chot' ? 'da_chot' : 'dang_nhan', tao_luc: x.tao_luc, chot_luc: x.chot_luc, chot_boi: x.chot_boi,
           mo_lai_luc: x.mo_lai_luc, mo_lai_boi: x.mo_lai_boi, ghi_lich_su_luc: x.ghi_lich_su_luc };
}
function dongPhan_(x) {
  var o = {};
  COT.DOT_PHAN.forEach(function (c) { o[c] = x[c]; });
  COT_SO.DOT_PHAN.forEach(function (c) { o[c] = Number(o[c]) || 0; });
  return o;
}

/* Trạng thái 1 đợt: đợt + các phần đã gửi (+ dữ liệu dòng nếu duLieu) */
function docDot_(id, duLieu) {
  var homNay = homNayVN_();
  id = laNgay_(id) ? chuoi_(id) : homNay;
  var dot = timDot_(docBang_(SH.DOT), id);
  var phan = docBang_(SH.PHAN).filter(function (x) { return x.dot_id === id; }).map(dongPhan_);
  if (duLieu) {
    var dl = docDl_(id);
    phan.forEach(function (p) { var d = dl[p.phan_id] || { cot: [], dong: [] }; p.cot = d.cot; p.dong = d.dong; });
  }
  return { ok: true, api: API, hom_nay: homNay, dot: dot ? dongDot_(dot) : { dot_id: id, trang_thai: 'dang_nhan', chua_tao: true },
           phan: phan, nguoi_dung: docNguoiDung_() };
}
function dsDot_() {
  var phan = docBang_(SH.PHAN), dem = {};
  phan.forEach(function (p) { dem[p.dot_id] = (dem[p.dot_id] || 0) + 1; });
  var ds = docBang_(SH.DOT).map(function (x) { var o = dongDot_(x); o.so_phan = dem[x.dot_id] || 0; return o; });
  ds.sort(function (a, b) { return a.dot_id < b.dot_id ? 1 : -1; });
  return { ok: true, api: API, hom_nay: homNayVN_(), dot: ds };
}

/* Tạo đợt (đang nhận) nếu chưa có. Trả về danh sách đợt sau khi thêm. */
function damBaoDot_(ds, id) {
  if (timDot_(ds, id)) return ds;
  ds.push({ dot_id: id, trang_thai: 'dang_nhan', tao_luc: bayGio_(), chot_luc: '', chot_boi: '', mo_lai_luc: '', mo_lai_boi: '', ghi_lich_su_luc: '' });
  return ds;
}

/* Khóa nhận dạng đơn để so trùng: đơn sàn = nguồn:mã đơn ; file web = web#dấu file */
function khoaDon_(cot, r) {
  var iSan = cot.indexOf('san'), iMa = cot.indexOf('ma_don'), iWk = cot.indexOf('web_key');
  var san = String(r[iSan] || ''), ma = String(r[iMa] || '');
  if (ma) return san + ':' + ma;
  if (san === 'Web' && iWk >= 0 && r[iWk]) return 'web#' + r[iWk];
  return '';
}

/* Nhân viên "Báo xong": thay phần cũ của chính người đó trong đợt. Đợt đã chốt → chuyển sang đợt sau (ngày mai). */
function baoXong_(d, nguoi) {
  if (!nguoi) throw new Error('Máy này chưa chọn "Tôi là" (Cài đặt).');
  var cot = [].concat(d.cot || []), dong = [].concat(d.dong || []);
  if (cot.indexOf('san') < 0 || cot.indexOf('ma_don') < 0) throw new Error('Thiếu cột dữ liệu dòng đơn.');
  if (dong.length > 20000) throw new Error('Quá nhiều dòng (' + dong.length + ').');
  var goc = laNgay_(d.dot_id) ? chuoi_(d.dot_id) : homNayVN_(), dotId = goc;
  var dots = docBang_(SH.DOT), chuyen = false, k = 0;
  while (timDot_(dots, dotId) && timDot_(dots, dotId).trang_thai === 'da_chot' && k++ < 60) { dotId = congNgay_(dotId, 1); chuyen = true; }
  damBaoDot_(dots, dotId);
  ghiBang_(SH.DOT, dots);

  // So mã đơn với phần người khác đã gửi trong đợt
  var phanId = dotId + '|' + nguoi, dl = docDl_(dotId), cuaToi = {}, trung = {};
  dong.forEach(function (r) { var kd = khoaDon_(cot, r); if (kd) cuaToi[kd] = 1; });
  var phans = docBang_(SH.PHAN);
  phans.filter(function (p) { return p.dot_id === dotId && p.nguoi !== nguoi; }).forEach(function (p) {
    var x = dl[p.phan_id];
    if (!x || !x.cot) return;
    var da = {};
    (x.dong || []).forEach(function (r) { var kd = khoaDon_(x.cot, r); if (kd && cuaToi[kd] && !da[kd]) { da[kd] = 1; trung[p.nguoi] = (trung[p.nguoi] || 0) + 1; } });
  });

  ghiDl_(dotId, phanId, { cot: cot, dong: dong });
  var i = -1;
  phans.forEach(function (p, j) { if (p.phan_id === phanId) i = j; });
  var cu = i >= 0 ? phans[i] : null;
  var moi = { phan_id: phanId, dot_id: dotId, nguoi: nguoi, nguon: chuoi_([].concat(d.nguon || []).join(', ')), trang_thai: 'da_gui', gui_luc: bayGio_(),
              so_dong: dong.length, so_don: Number(d.so_don) || Object.keys(cuaToi).length, con_combo: Number(d.con_combo) || 0,
              con_chua_ro: Number(d.con_chua_ro) || 0, phien: (cu ? Number(cu.phien) || 0 : 0) + 1, ghi_chu: chuoi_(d.ghi_chu).slice(0, 200) };
  if (i >= 0) phans[i] = moi; else phans.push(moi);
  ghiBang_(SH.PHAN, phans);
  donDotCu_();
  return { ok: true, dot_id: dotId, dot_goc: goc, chuyen_dot: chuyen, phan: dongPhan_(moi), thay_ban_cu: !!cu,
           trung: Object.keys(trung).map(function (n) { return { nguoi: n, so_don: trung[n] }; }) };
}

/* "Mở lại" phần đã báo xong để sửa tiếp (đợt chưa chốt) */
function moLaiPhan_(d, nguoi, admin) {
  var dotId = laNgay_(d.dot_id) ? chuoi_(d.dot_id) : homNayVN_();
  var dot = timDot_(docBang_(SH.DOT), dotId);
  if (dot && dot.trang_thai === 'da_chot' && !admin) return { ok: true, da_chot: true, dot_id: dotId };
  var ai = admin && chuoi_(d.nguoi) ? chuoi_(d.nguoi) : nguoi;
  var phans = docBang_(SH.PHAN), id = dotId + '|' + ai, doi = false;
  phans.forEach(function (p) { if (p.phan_id === id) { p.trang_thai = 'mo_lai'; p.ghi_chu = 'Mở lại ' + bayGio_() + (ai !== nguoi ? ' bởi ' + nguoi + ' (Admin)' : ''); doi = true; } });
  if (doi && ai !== nguoi) ghiLichSu_([[bayGio_(), 'moLaiPhan', id, '', JSON.stringify({ ghi_chu: 'Admin mở lại phần của ' + ai }), (nguoi || '?') + ' (Admin)', '']]);
  if (doi) ghiBang_(SH.PHAN, phans);
  return { ok: true, dot_id: dotId, da_chot: false };
}

/* Chốt đợt: khóa đợt + ghi lịch sử đặt hàng của đợt (ghi đè theo ngày + nhà → chốt lại sau "Mở lại đợt" không cộng 2 lần) */
function chotDot_(d, nguoi) {
  var dotId = chuoi_(d.dot_id);
  if (!laNgay_(dotId)) throw new Error('Thiếu ngày đợt.');
  var dots = damBaoDot_(docBang_(SH.DOT), dotId), dot = timDot_(dots, dotId);
  if (dot.trang_thai === 'da_chot') return { ok: true, da_chot_truoc: true, dot: dongDot_(dot) };
  var kqLs = null;
  if (d.lich_su) {
    var ls = Object.assign({}, d.lich_su, { ngay: dotId, nhas: nhaChinh_() });
    kqLs = ghiLichSuDatHang_(ls);
    dot.ghi_lich_su_luc = bayGio_();
  }
  // Lịch sử bán (mọi sách, kể cả nhà khác) – chốt lại sau "Mở lại đợt" thì thay khối của ngày đó, không cộng 2 lần
  var kqBh = d.ban_hang ? ghiBanHangDot_(dotId, d.ban_hang) : null;
  // Thống kê bán theo ngày (mọi mặt hàng) – chốt lại thì ghi đè số của đợt đó
  var kqTk = d.thong_ke ? tkGhi_(dotId, 'dot', d.thong_ke) : null;
  dot.trang_thai = 'da_chot'; dot.chot_luc = bayGio_(); dot.chot_boi = nguoi || '';
  ghiBang_(SH.DOT, dots);
  ghiLichSu_([[bayGio_(), 'chotDot', dotId, '', JSON.stringify({ ghi_chu: 'Chốt đợt ' + dotId + (kqLs ? ' – ghi lịch sử ' + kqLs.soDong + ' đầu sách' : '') }), nguoi || '', '']]);
  return { ok: true, dot: dongDot_(dot), lichSu: kqLs, banHang: kqBh, thongKe: kqTk };
}
function moLaiDot_(d, nguoi) {
  var dotId = chuoi_(d.dot_id);
  var dots = docBang_(SH.DOT), dot = timDot_(dots, dotId);
  if (!dot) throw new Error('Không có đợt ' + dotId + '.');
  dot.trang_thai = 'dang_nhan'; dot.mo_lai_luc = bayGio_(); dot.mo_lai_boi = nguoi || '';
  ghiBang_(SH.DOT, dots);
  ghiLichSu_([[bayGio_(), 'moLaiDot', dotId, '', JSON.stringify({ ghi_chu: 'Mở lại đợt ' + dotId }), nguoi || '', '']]);
  return { ok: true, dot: dongDot_(dot) };
}

/* Dọn đợt cũ hơn GIU_DOT ngày (đợt, phần gửi, sheet dữ liệu) */
function donDotCu_() {
  var moc = congNgay_(homNayVN_(), -GIU_DOT);
  var dots = docBang_(SH.DOT), cu = dots.filter(function (x) { return x.dot_id < moc; });
  var ss = bangTinh_();
  ss.getSheets().forEach(function (s) {
    var n = s.getName();
    if (n.indexOf(DOT_DL) === 0 && n.slice(DOT_DL.length) < moc) ss.deleteSheet(s);
  });
  if (!cu.length) return 0;
  ghiBang_(SH.DOT, dots.filter(function (x) { return x.dot_id >= moc; }));
  ghiBang_(SH.PHAN, docBang_(SH.PHAN).filter(function (x) { return x.dot_id >= moc; }));
  return cu.length;
}

/* ===================== Admin ===================== */

/* ⬇⬇ ĐẶT / ĐỔI MÃ ADMIN: gõ mã giữa 2 dấu nháy (ít nhất 6 ký tự) → 💾 Lưu → chọn hàm datMaAdmin → ▶ Chạy.
 *    Chạy xong XÓA mã khỏi dòng này (để lại '') rồi 💾 Lưu. Mã chỉ nằm trong Script Properties (khóa ADMIN_MA). */
var MA_ADMIN_MOI = '';
function datMaAdmin() {
  var ma = String(MA_ADMIN_MOI || '').trim();
  if (ma.length < 6) throw new Error('Gõ mã Admin (ít nhất 6 ký tự) vào dòng MA_ADMIN_MOI = \'...\' rồi chạy lại.');
  var p = PropertiesService.getScriptProperties();
  p.setProperty('ADMIN_MA', ma);
  p.deleteProperty('ADMIN_SAI');
  p.deleteProperty('ADMIN_KHOA_DEN');
  Logger.log('✅ Đã đặt mã Admin. Bây giờ XÓA mã khỏi dòng MA_ADMIN_MOI (để lại \'\') rồi bấm 💾 Lưu.');
}
function maAdmin_() { return String(PropertiesService.getScriptProperties().getProperty('ADMIN_MA') || ''); }
function khoaAdminConPhut_() {
  var den = Number(PropertiesService.getScriptProperties().getProperty('ADMIN_KHOA_DEN')) || 0;
  return den > Date.now() ? Math.ceil((den - Date.now()) / 60000) : 0;
}
/* Kiểm tra mã Admin. Sai ADMIN_SAI_TOI_DA lần liên tiếp → khóa ADMIN_KHOA_PHUT phút (mọi máy). */
function kiemTraAdmin_(ma) {
  var p = PropertiesService.getScriptProperties(), dung = maAdmin_();
  if (!dung) throw new Error('CHUA_DAT_MA_ADMIN: Chưa đặt mã Admin. Mở Apps Script, sửa dòng MA_ADMIN_MOI rồi chạy hàm datMaAdmin (xem HUONG-DAN.md).');
  var con = khoaAdminConPhut_();
  if (con) throw new Error('KHOA_ADMIN: Nhập sai mã Admin quá ' + ADMIN_SAI_TOI_DA + ' lần – tạm khóa, thử lại sau ' + con + ' phút.');
  if (!ma) throw new Error('CAN_MA_ADMIN: Thao tác này cần mã Admin.');
  if (String(ma) === dung) { p.deleteProperty('ADMIN_SAI'); return true; }
  var sai = (Number(p.getProperty('ADMIN_SAI')) || 0) + 1;
  if (sai >= ADMIN_SAI_TOI_DA) {
    p.setProperty('ADMIN_KHOA_DEN', String(Date.now() + ADMIN_KHOA_PHUT * 60000));
    p.deleteProperty('ADMIN_SAI');
    ghiLichSu_([[bayGio_(), 'khoaAdmin', '', '', JSON.stringify({ ghi_chu: 'Sai mã Admin ' + ADMIN_SAI_TOI_DA + ' lần – khóa ' + ADMIN_KHOA_PHUT + ' phút' }), '', '']]);
    throw new Error('KHOA_ADMIN: Nhập sai mã Admin ' + ADMIN_SAI_TOI_DA + ' lần – tạm khóa ' + ADMIN_KHOA_PHUT + ' phút.');
  }
  p.setProperty('ADMIN_SAI', String(sai));
  throw new Error('SAI_MA_ADMIN: Mã Admin không đúng (còn ' + (ADMIN_SAI_TOI_DA - sai) + ' lần thử trước khi bị khóa ' + ADMIN_KHOA_PHUT + ' phút).');
}

/* Cài đặt chung (Admin quản lý): mã nhà khác, trạng thái Shopee cần lấy, phân loại vô nghĩa */
function docCaiDatChung_() {
  var o = {};
  docBang_(SH.CDC).forEach(function (x) {
    if (KHOA_CAI_DAT_CHUNG.indexOf(x.khoa) < 0 && x.khoa !== 'duBaoNgay') return;
    try { o[x.khoa] = JSON.parse(x.gia_tri); } catch (e) { /* bỏ qua giá trị hỏng */ }
  });
  return o;
}
function luuCaiDatChung_(d, nguoiLog) {
  var cu = docCaiDatChung_(), now = bayGio_(), ds = [];
  KHOA_CAI_DAT_CHUNG.forEach(function (k) {
    var v = d[k] !== undefined ? d[k] : cu[k];
    if (v === undefined) return;
    v = [].concat(v).map(chuoi_).filter(function (x) { return x; }).slice(0, 200);
    ds.push({ khoa: k, gia_tri: JSON.stringify(v), cap_nhat: now, nguoi: nguoiLog });
  });
  docBang_(SH.CDC).forEach(function (x) { if (x.khoa === 'duBaoNgay') ds.push(x); }); // giữ số ngày dự báo
  ghiBang_(SH.CDC, ds);
  var moi = docCaiDatChung_();
  ghiLichSu_([[now, 'luuCaiDatChung', 'Cài đặt chung', JSON.stringify(cu), JSON.stringify(moi), nguoiLog || '', '']]);
  return { ok: true, cai_dat_chung: moi };
}

/* Admin: xóa cả đợt (đợt, các phần gửi, dữ liệu). Lịch sử thống kê đã ghi khi chốt KHÔNG bị xóa. */
function xoaDot_(d, nguoiLog) {
  var dotId = chuoi_(d.dot_id);
  if (!laNgay_(dotId)) throw new Error('Thiếu ngày đợt.');
  var phans = docBang_(SH.PHAN), soPhan = phans.filter(function (p) { return p.dot_id === dotId; }).length;
  ghiBang_(SH.DOT, docBang_(SH.DOT).filter(function (x) { return x.dot_id !== dotId; }));
  ghiBang_(SH.PHAN, phans.filter(function (p) { return p.dot_id !== dotId; }));
  var s = sheetDl_(dotId, false);
  if (s) bangTinh_().deleteSheet(s);
  ghiLichSu_([[bayGio_(), 'xoaDot', dotId, JSON.stringify({ so_phan: soPhan }), '', nguoiLog || '', '']]);
  return { ok: true, so_phan: soPhan };
}
/* Admin: xóa phần gửi của 1 người */
function xoaPhan_(d, nguoiLog) {
  var dotId = chuoi_(d.dot_id), ai = chuoi_(d.nguoi), id = dotId + '|' + ai;
  var phans = docBang_(SH.PHAN), cu = phans.filter(function (p) { return p.phan_id === id; })[0];
  if (!cu) throw new Error('Không có phần của ' + ai + ' trong đợt ' + dotId + '.');
  ghiDl_(dotId, id, null);
  ghiBang_(SH.PHAN, phans.filter(function (p) { return p.phan_id !== id; }));
  ghiLichSu_([[bayGio_(), 'xoaPhan', id, JSON.stringify(dongPhan_(cu)), '', nguoiLog || '', '']]);
  return { ok: true };
}
/* Admin: sửa phần gửi của 1 người – bỏ các file gửi nhầm (bo_file: tên file) */
function suaPhan_(d, nguoiLog) {
  var dotId = chuoi_(d.dot_id), ai = chuoi_(d.nguoi), id = dotId + '|' + ai, bo = [].concat(d.bo_file || []).map(String);
  var phans = docBang_(SH.PHAN), i = -1;
  phans.forEach(function (p, j) { if (p.phan_id === id) i = j; });
  if (i < 0) throw new Error('Không có phần của ' + ai + ' trong đợt ' + dotId + '.');
  var x = docDl_(dotId)[id] || { cot: [], dong: [] }, iFile = x.cot.indexOf('file');
  var giu = x.dong.filter(function (r) { return bo.indexOf(String(r[iFile])) < 0; });
  ghiDl_(dotId, id, { cot: x.cot, dong: giu });
  var don = {};
  giu.forEach(function (r) { var kd = khoaDon_(x.cot, r); if (kd) don[kd] = 1; });
  var cu = dongPhan_(phans[i]);
  phans[i].so_dong = giu.length; phans[i].so_don = Object.keys(don).length;
  phans[i].phien = (Number(phans[i].phien) || 0) + 1;
  phans[i].ghi_chu = ('Admin bỏ file: ' + bo.join(', ')).slice(0, 200);
  ghiBang_(SH.PHAN, phans);
  ghiLichSu_([[bayGio_(), 'suaPhan', id, JSON.stringify(cu), JSON.stringify({ ghi_chu: 'Bỏ ' + (x.dong.length - giu.length) + ' dòng của file: ' + bo.join(', ') }), nguoiLog || '', '']]);
  return { ok: true, phan: dongPhan_(phans[i]), so_bo: x.dong.length - giu.length };
}

/* ===================== Sổ nhà ===================== */

function chuanNha_(x, i) {
  var ma = chuoi_(x.ma).toUpperCase().replace(/[^A-Z0-9Đ_]/g, '');
  var ds = function (v) { return [].concat(v || []).join(',').split(/\s*[,;]+\s*/).map(chuoi_).filter(function (t) { return t; }); };
  return { ma: ma, ten: chuoi_(x.ten).slice(0, 80) || ma, loai: x.loai === 'hang_ngay' ? 'hang_ngay' : 'nhap_kho', mau: chuoi_(x.mau).slice(0, 20),
           ma_ten: ds(x.ma_ten).map(function (t) { return t.toUpperCase(); }).join(', '), ncc: ds(x.ncc).join('; '),
           tien_to: ds(x.tien_to).map(function (t) { return t.replace(/\D/g, ''); }).filter(function (t) { return t; }).join(', '),
           thu_tu: i === undefined ? Number(x.thu_tu) || 0 : i };
}
/* Sổ nhà: sheet NHA; trống → mặc định HA/KV/ML + "Mã nhà khác" cũ (cài đặt chung) */
function soNha_() {
  if (soNhaNho_) return soNhaNho_;
  var ds = docBang_(SH.NHA).filter(function (x) { return x.ma; }).map(function (x) { return chuanNha_(x); })
    .sort(function (a, b) { return a.thu_tu - b.thu_tu; });
  if (!ds.some(function (x) { return x.loai === 'hang_ngay'; })) {
    var cd = docCaiDatChung_(), khac = Array.isArray(cd.maKhac) && cd.maKhac.length ? cd.maKhac : MA_KHAC_MAC_DINH;
    ds = [{ ma: 'HA', ten: 'Hồng Ân', loai: 'hang_ngay', ncc: 'hong an' }, { ma: 'KV', ten: 'Khang Việt', loai: 'hang_ngay', ncc: 'khang viet' },
          { ma: 'ML', ten: 'Minh Long', loai: 'hang_ngay', ncc: 'minh long' }]
      .concat(khac.map(function (m) { m = chuoi_(m).toUpperCase(); return { ma: m, ten: m, loai: 'nhap_kho', ncc: m === 'MEGA' ? 'mega book; megabook' : m === 'QB' ? 'quang binh' : '' }; }))
      .filter(function (x, i, a) { return x.ma && a.map(function (y) { return y.ma; }).indexOf(x.ma) === i; })
      .map(chuanNha_);
  }
  soNhaNho_ = ds;
  return ds;
}
function maTatCa_() { return soNha_().map(function (x) { return x.ma; }); }
function nhaChinh_() { var d = soNha_().filter(function (x) { return x.loai === 'hang_ngay'; }).map(function (x) { return x.ma; }); return d.length ? d : NHA_CHINH.slice(); }
function nhaSku_() { return maTatCa_().concat(['KHONG_NHAP']); }
function nhaTp_() { return maTatCa_().concat(['KHAC']); }
function ghiSoNha_(ds, nguoiLog, ghiChu) {
  var cu = soNha_(), now = bayGio_();
  ghiBang_(SH.NHA, ds.map(function (x, i) { var o = chuanNha_(x, i); o.cap_nhat = now; return o; }));
  soNhaNho_ = null;
  ghiLichSu_([[now, 'luuNha', ghiChu || 'Sổ nhà', JSON.stringify(cu), JSON.stringify(soNha_()), nguoiLog || '', '']]);
  return soNha_();
}
/* Admin: thay cả sổ nhà (mã không trùng, ít nhất 1 nhà Đặt hằng ngày) */
function luuNha_(d, nguoiLog) {
  var da = {}, ds = [];
  (d.ds || []).forEach(function (x) { var o = chuanNha_(x); if (!o.ma || o.ma === 'KHONG_NHAP' || o.ma === 'KHAC' || da[o.ma]) return; da[o.ma] = 1; ds.push(o); });
  if (!ds.some(function (x) { return x.loai === 'hang_ngay'; })) throw new Error('Cần ít nhất 1 nhà "Đặt hằng ngày".');
  return { ok: true, nha: ghiSoNha_(ds, nguoiLog, 'Sửa sổ nhà (' + ds.length + ' nhà)') };
}
/* Mọi người: thêm 1 nhà mới (vd khi gán nhà cho dòng chưa rõ) – không sửa / xóa nhà đã có */
function themNha_(d, nguoiLog) {
  var o = chuanNha_(d.nha || d);
  if (!o.ma || o.ma === 'KHONG_NHAP' || o.ma === 'KHAC') throw new Error('Mã nhà không hợp lệ.');
  var ds = soNha_().slice();
  if (ds.some(function (x) { return x.ma === o.ma; })) return { ok: true, nha: ds, da_co: true };
  ds.push(o);
  return { ok: true, nha: ghiSoNha_(ds, nguoiLog, 'Thêm nhà ' + o.ma + ' – ' + o.ten) };
}
/* Admin: xóa nhà, chuyển sách (SKU_NHA) + thành phần combo sang nhà chuyen_sang (trống = Không nhập / Khác) */
function xoaNha_(cat, d, ctx) {
  var ma = chuoi_(d.ma).toUpperCase(), sang = chuoi_(d.chuyen_sang).toUpperCase();
  var ds = soNha_().filter(function (x) { return x.ma !== ma; });
  if (ds.length === soNha_().length) throw new Error('Không có nhà ' + ma + '.');
  if (!ds.some(function (x) { return x.loai === 'hang_ngay'; })) throw new Error('Cần giữ ít nhất 1 nhà "Đặt hằng ngày".');
  if (sang && !ds.some(function (x) { return x.ma === sang; })) throw new Error('Nhà chuyển sang không có: ' + sang);
  var n = 0;
  cat.skus.forEach(function (e, i) {
    if (e.nha !== ma) return;
    cat.skus[i] = Object.assign({}, e, { nha: sang || 'KHONG_NHAP', cap_nhat: ctx.now });
    ghiLog_(ctx, 'upsertSku', e.key, e, Object.assign({ ghi_chu: 'Xóa nhà ' + ma + ' → ' + (sang || 'Không nhập') }, cat.skus[i]));
    n++;
  });
  var ngay = ds.filter(function (x) { return x.loai === 'hang_ngay'; }).map(function (x) { return x.ma; });
  cat.combos.forEach(function (c) {
    var doi = false;
    c.thanh_phan.forEach(function (t) { if (t.nha === ma) { t.nha = sang || 'KHAC'; doi = true; n++; } });
    if (c.nha === ma) { c.nha = ngay.indexOf(sang) >= 0 ? sang : ''; doi = true; }
    if (doi) c.cap_nhat = ctx.now;
  });
  ghiSoNha_(ds, ctx.nguoiLog, 'Xóa nhà ' + ma + (sang ? ' (chuyển sang ' + sang + ')' : ''));
  return n;
}

/* ===================== Lịch sử bán (dự báo nhập kho, chờ khai báo) ===================== */

function chuThuong_(v) { return chuoi_(v).toLowerCase(); }
/* Khóa 1 dòng bán: Shopee/TikTok = sàn + mã đơn + dòng sản phẩm ; web (không mã đơn) = dấu file + sách. PHẢI khớp js/banhang.js */
function khoaBan_(sp, d) {
  if (sp[0] === 'Web' && !d[1]) return 'web#' + chuoi_(d[4]) + '|' + chuoi_(sp[1]).toUpperCase() + '|' + chuThuong_(sp[2]);
  return sp[0] + ':' + chuoi_(d[1]) + '|' + chuoi_(sp[1]).toUpperCase() + '|' + chuThuong_(sp[2]) + '|' + chuThuong_(sp[3]);
}
/* Vị trí các khối trong sheet (chỉ đọc 2 cột đầu – nhẹ) → [{ dong, ngay, nguon }] */
function viTriBh_() {
  var s = sheet_(SH.BH), n = s.getLastRow();
  if (n < 2) return [];
  return s.getRange(2, 1, n - 1, 2).getValues().map(function (r, i) {
    return { dong: i + 2, ngay: r[0] instanceof Date ? dinhDang_(r[0], 'yyyy-MM-dd') : String(r[0]), nguon: String(r[1]) };
  }).filter(function (x) { return x.ngay; });
}
/* Đọc các khối thỏa điều kiện (gộp mảnh theo ngay|nguon) → [{ ngay, nguon, du_lieu }] */
function docKhoiBh_(chon) {
  var s = sheet_(SH.BH), vt = viTriBh_().filter(function (x) { return chon(x.ngay, x.nguon); });
  var manh = {}, thuTu = [];
  // đọc theo từng đoạn dòng liền nhau cho nhanh
  var i = 0;
  while (i < vt.length) {
    var j = i;
    while (j + 1 < vt.length && vt[j + 1].dong === vt[j].dong + 1) j++;
    s.getRange(vt[i].dong, 1, j - i + 1, 4).getValues().forEach(function (r) {
      var k = String(r[0] instanceof Date ? dinhDang_(r[0], 'yyyy-MM-dd') : r[0]) + '|' + String(r[1]);
      if (!manh[k]) { manh[k] = []; thuTu.push(k); }
      manh[k].push([Number(r[2]) || 0, String(r[3])]);
    });
    i = j + 1;
  }
  return thuTu.map(function (k) {
    var p = k.split('|'), json = manh[k].sort(function (a, b) { return a[0] - b[0]; }).map(function (x) { return x[1]; }).join('');
    var dl;
    try { dl = JSON.parse(json); } catch (e) { dl = { sp: [], d: [] }; }
    return { ngay: p[0], nguon: p[1], du_lieu: dl };
  });
}
function xoaKhoiBh_(ngay, nguon) {
  var s = sheet_(SH.BH);
  viTriBh_().forEach(function (x) { if (x.ngay === ngay && x.nguon === nguon) s.getRange(x.dong, 1, 1, COT.BAN_HANG.length).clearContent(); });
}
function themKhoiBh_(ngay, nguon, dl) {
  if (!dl.d.length) return;
  var json = JSON.stringify(dl), dong = [], now = bayGio_();
  for (var i = 0, k = 0; i < json.length; i += CHIA_O, k++) dong.push([ngay, nguon, String(k), json.slice(i, i + CHIA_O), now]);
  var s = sheet_(SH.BH), n = s.getLastRow(), r = s.getRange(n + 1, 1, dong.length, COT.BAN_HANG.length);
  r.setNumberFormat('@');
  r.setValues(dong);
}
/* Bỏ dòng có khóa đã có; trả về khối mới (chỉ giữ sản phẩm còn dùng) */
function locTrung_(dl, daCo) {
  var sp = [], map = {}, d = [], bo = 0;
  (dl.d || []).forEach(function (x) {
    var p = (dl.sp || [])[x[0]];
    if (!p) return;
    var k = khoaBan_(p, x);
    if (daCo[k]) { bo++; return; }
    daCo[k] = 1;
    var ks = JSON.stringify(p);
    if (!(ks in map)) { map[ks] = sp.length; sp.push(p); }
    d.push([map[ks], x[1], Number(x[2]) || 0, chuoi_(x[3]), chuoi_(x[4])]);
  });
  return { dl: { sp: sp, d: d }, bo: bo };
}
function khoaDaCo_(khoi) {
  var daCo = {};
  khoi.forEach(function (b) { (b.du_lieu.d || []).forEach(function (x) { var p = b.du_lieu.sp[x[0]]; if (p) daCo[khoaBan_(p, x)] = 1; }); });
  return daCo;
}
/* Chốt đợt: thay khối "dot" của ngày đó, bỏ dòng đã có trong 60 ngày trước (đơn treo nhiều ngày chỉ tính 1 lần) */
function ghiBanHangDot_(ngay, dl) {
  var tu = congNgay_(ngay, -BH_TRUNG_NGAY);
  var daCo = khoaDaCo_(docKhoiBh_(function (n, ng) { return n >= tu.slice(0, n.length) && !(n === ngay && ng === 'dot'); }));
  var x = locTrung_(dl, daCo);
  xoaKhoiBh_(ngay, 'dot');
  themKhoiBh_(ngay, 'dot', x.dl);
  gomBanHang_();
  return { soDong: x.dl.d.length, boTrung: x.bo };
}
/* Nạp từ file đơn cũ: so với TOÀN BỘ lịch sử bán, chia khối theo ngày đặt */
function napBanHang_(dl) {
  var daCo = khoaDaCo_(docKhoiBh_(function () { return true; }));
  var x = locTrung_(dl, daCo), theoNgay = {};
  x.dl.d.forEach(function (r) {
    var ngay = laNgay_(r[3]) ? r[3] : homNayVN_();
    (theoNgay[ngay] = theoNgay[ngay] || []).push(r);
  });
  Object.keys(theoNgay).sort().forEach(function (ngay) {
    var cu = docKhoiBh_(function (n, ng) { return n === ngay && ng === 'nap'; })[0];
    var gop = cu ? cu.du_lieu : { sp: [], d: [] };
    var map = {};
    gop.sp.forEach(function (p, i) { map[JSON.stringify(p)] = i; });
    theoNgay[ngay].forEach(function (r) {
      var p = x.dl.sp[r[0]], ks = JSON.stringify(p);
      if (!(ks in map)) { map[ks] = gop.sp.length; gop.sp.push(p); }
      gop.d.push([map[ks], r[1], r[2], r[3], r[4]]);
    });
    xoaKhoiBh_(ngay, 'nap');
    themKhoiBh_(ngay, 'nap', gop);
  });
  gomBanHang_();
  return { ok: true, soDongMoi: x.dl.d.length, soDongTrung: x.bo, soNgay: Object.keys(theoNgay).length };
}
/* GET: các khối từ ngày tu (mặc định 60 ngày gần nhất) */
function docBanHang_(tu) {
  tu = laNgay_(tu) ? chuoi_(tu) : congNgay_(homNayVN_(), -60);
  return docKhoiBh_(function (n) { return n.length === 7 ? n >= tu.slice(0, 7) : n >= tu; });
}
/* Sheet lớn: gom các ngày cũ thành 1 khối / tháng; dọn dòng trống (khối đã thay) */
function gomBanHang_() {
  var s = sheet_(SH.BH), n = s.getLastRow();
  var vt = viTriBh_();
  if (n - 1 <= BH_NGUONG_GOM && (n - 1) - vt.length < 1000) return 0;
  var moc = congNgay_(homNayVN_(), -BH_GOM_SAU_NGAY);
  var tatCa = docKhoiBh_(function () { return true; }), thang = {}, giu = [];
  tatCa.forEach(function (b) {
    if (b.ngay.length === 10 && b.ngay >= moc) { giu.push(b); return; }
    var t = b.ngay.slice(0, 7), g = thang[t] || (thang[t] = { sp: [], d: [], map: {} });
    (b.du_lieu.d || []).forEach(function (x) {
      var p = b.du_lieu.sp[x[0]], ks = JSON.stringify(p);
      if (!p) return;
      if (!(ks in g.map)) { g.map[ks] = g.sp.length; g.sp.push(p); }
      g.d.push([g.map[ks], x[1], x[2], x[3] || b.ngay, x[4]]);
    });
  });
  if (n > 1) s.getRange(2, 1, n - 1, COT.BAN_HANG.length).clearContent();
  giu.forEach(function (b) { themKhoiBh_(b.ngay, b.nguon, b.du_lieu); });
  Object.keys(thang).sort().forEach(function (t) { themKhoiBh_(t, 'thang', { sp: thang[t].sp, d: thang[t].d }); });
  return Object.keys(thang).length;
}

/* ===================== Thống kê bán theo ngày – tab "Sàn bán gì" (api 8) ===================== */

function tkNgay_(v) { return v instanceof Date ? dinhDang_(v, 'yyyy-MM-dd') : String(v === null || v === undefined ? '' : v).slice(0, 10); }
/* Vị trí các dòng (chỉ đọc cột ngày + cột nguồn – nhẹ) → [{ dong, ngay, nguon }] */
function tkViTri_(ten, cotNguon) {
  var s = sheet_(ten), n = s.getLastRow();
  if (n < 2) return [];
  var a = s.getRange(2, 1, n - 1, 1).getValues(), b = cotNguon ? s.getRange(2, cotNguon, n - 1, 1).getValues() : null;
  var out = [];
  for (var i = 0; i < a.length; i++) {
    var ngay = tkNgay_(a[i][0]);
    if (ngay) out.push({ dong: i + 2, ngay: ngay, nguon: b ? String(b[i][0]) : '' });
  }
  return out;
}
/* Gom các dòng liền nhau thành đoạn [dòng đầu, số dòng] */
function tkDoan_(vt) {
  var out = [];
  vt.forEach(function (x) {
    var c = out[out.length - 1];
    if (c && c[0] + c[1] === x.dong) c[1]++; else out.push([x.dong, 1]);
  });
  return out;
}
/* Xóa hẳn các dòng (đoạn liền nhau: deleteRows ; quá rời rạc: ghi lại cả sheet) */
function tkXoaDong_(ten, vt) {
  if (!vt.length) return 0;
  var s = sheet_(ten), doan = tkDoan_(vt), cols = COT[ten].length;
  if (doan.length > 40) {
    var n = s.getLastRow(), bo = {};
    vt.forEach(function (x) { bo[x.dong] = 1; });
    var giu = s.getRange(2, 1, n - 1, cols).getValues().filter(function (r, i) { return !bo[i + 2]; });
    if (giu.length) s.getRange(2, 1, giu.length, cols).setValues(giu);
    if (n - 1 > giu.length) s.getRange(giu.length + 2, 1, n - 1 - giu.length, cols).clearContent();
    return vt.length;
  }
  for (var i = doan.length - 1; i >= 0; i--) {
    var tong = s.getMaxRows(); // Google Sheets không cho xóa hết dòng không cố định → luôn chừa ≥ 1 dòng trống
    if (tong - doan[i][1] < 2) s.insertRowsAfter(tong, 2 - (tong - doan[i][1]));
    s.deleteRows(doan[i][0], doan[i][1]);
  }
  return vt.length;
}
/* Thêm dòng vào cuối sheet; cotSo: chỉ số (từ 0) các cột số, còn lại lưu dạng chữ (barcode không bị đổi thành số) */
function tkThemDong_(ten, dong, cotSo) {
  if (!dong.length) return;
  var s = sheet_(ten), n = s.getLastRow(), cols = COT[ten].length, cuoi = n + dong.length;
  if (s.getMaxRows() < cuoi) s.insertRowsAfter(s.getMaxRows(), cuoi - s.getMaxRows());
  for (var j = 0; j < cols; j++) if ((cotSo || []).indexOf(j) < 0) s.getRange(n + 1, j + 1, dong.length, 1).setNumberFormat('@');
  s.getRange(n + 1, 1, dong.length, cols).setValues(dong);
}
/* Dấu dòng đã tính (THONG_KE_KHOA) của các (ngày, nguồn) thỏa điều kiện → { dấu: 1 } */
function tkKhoaDaCo_(chon) {
  var s = sheet_(SH.TKK), daCo = {};
  tkDoan_(tkViTri_(SH.TKK, 2).filter(function (x) { return chon(x.ngay, x.nguon); })).forEach(function (d) {
    s.getRange(d[0], 4, d[1], 1).getValues().forEach(function (r) {
      String(r[0]).split(',').forEach(function (k) { if (k) daCo[k] = 1; });
    });
  });
  return daCo;
}
function tkXoa_(ngay, nguon) {
  var chon = function (x) { return x.ngay === ngay && x.nguon === nguon; };
  tkXoaDong_(SH.TKK, tkViTri_(SH.TKK, 2).filter(chon));
  return tkXoaDong_(SH.TK, tkViTri_(SH.TK, 13).filter(chon));
}
function tkChu_(v, dai) { return chuoi_(v).slice(0, dai || 300); }
/* Khối { sp, d } từ máy → các dòng THONG_KE (đã cộng theo ngày + sản phẩm), bỏ dòng có dấu đã tính.
 * motNgay: mọi dòng tính vào ngayMacDinh (chốt đợt) ; không thì theo ngày của từng dòng (nạp bù chia theo ngày đặt). tuNgay: bỏ dòng cũ hơn. */
function tkTuDl_(ngayMacDinh, nguon, dl, daCo, motNgay, tuNgay) {
  var sp = (dl && dl.sp) || [], nhom = {}, thuTu = [], don = {}, khoa = {}, bo = 0, boCu = 0, soDong = 0, now = bayGio_();
  ((dl && dl.d) || []).forEach(function (x) {
    var p = sp[x[0]], k = chuoi_(x[1]);
    if (!p || !k) return;
    var ngay = !motNgay && laNgay_(x[5]) ? chuoi_(x[5]) : ngayMacDinh;
    if (!laNgay_(ngay)) return;
    if (tuNgay && ngay < tuNgay) { boCu++; return; }
    if (daCo[k]) { bo++; return; }
    daCo[k] = 1;
    (khoa[ngay] = khoa[ngay] || []).push(k);
    soDong++;
    var id = ngay + '\u0001' + x[0], g = nhom[id];
    if (!g) { g = nhom[id] = { ngay: ngay, p: p, sl: 0, dt: 0, coDt: false, don: {}, soDon: 0 }; thuTu.push(id); }
    g.sl += Number(x[2]) || 0;
    if (x[3] !== null && x[3] !== undefined && x[3] !== '' && isFinite(Number(x[3]))) { g.dt += Number(x[3]); g.coDt = true; }
    var dn = x[4] === null || x[4] === undefined || x[4] === '' ? -1 : Number(x[4]);
    if (dn >= 0) {
      if (!g.don[dn]) { g.don[dn] = 1; g.soDon++; }
      var kd = ngay + '\u0001' + tkChu_(p[0], 20) + '\u0001' + tkChu_(p[1], 60), o = don[kd];
      if (!o) o = don[kd] = { ngay: ngay, san: tkChu_(p[0], 20), gian: tkChu_(p[1], 60), ds: {}, n: 0 };
      if (!o.ds[dn]) { o.ds[dn] = 1; o.n++; }
    }
  });
  var dong = thuTu.map(function (id) {
    var g = nhom[id], p = g.p, cb = typeof p[9] === 'string' ? p[9] : p[9] ? JSON.stringify(p[9]) : '';
    return [g.ngay, tkChu_(p[0], 20), tkChu_(p[1], 60), tkChu_(p[2], 400), tkChu_(p[3], 300), tkChu_(p[4], 200), tkChu_(p[5], 40), tkChu_(p[6], 30), tkChu_(p[7], 40),
            g.sl, g.soDon, g.coDt ? Math.round(g.dt) : '', nguon, tkChu_(p[8], 400), cb.length <= CHIA_O ? cb : '', now];
  });
  Object.keys(don).forEach(function (kd) {
    var o = don[kd];
    dong.push([o.ngay, o.san, o.gian, TK_DON, '(số đơn)', '', '', '', '', 0, o.n, '', nguon, '', '', now]);
  });
  return { dong: dong, khoa: khoa, soDong: soDong, bo: bo, boCu: boCu };
}
function tkLuu_(x, nguon) {
  tkThemDong_(SH.TK, x.dong, [9, 10, 11]);
  var now = bayGio_(), dk = [];
  Object.keys(x.khoa).sort().forEach(function (ngay) {
    for (var i = 0, k = 0; i < x.khoa[ngay].length; i += TK_KHOA_MOI_O, k++) dk.push([ngay, nguon, String(k), x.khoa[ngay].slice(i, i + TK_KHOA_MOI_O).join(','), now]);
  });
  tkThemDong_(SH.TKK, dk, []);
}
/* Chốt đợt: thay số liệu "dot" của ngày đó; bỏ dòng đã tính trong 60 ngày trước (đơn treo) hoặc đã nạp bù */
function tkGhi_(ngay, nguon, dl) {
  tkXoa_(ngay, nguon);
  var tu = congNgay_(ngay, -TK_TRUNG_NGAY);
  var x = tkTuDl_(ngay, nguon, dl, tkKhoaDaCo_(function (n) { return n >= tu; }), true, '');
  tkLuu_(x, nguon);
  return { soDong: x.soDong, boTrung: x.bo, soSp: x.dong.length };
}
/* Admin "Nạp bù số liệu cũ": CHỈ ghi THONG_KE (không tạo đợt, không đụng danh mục). Dòng (sàn + mã đơn + dòng) đã có ở bất kỳ ngày nào → bỏ qua. */
function tkNap_(d, nguoiLog) {
  var ngay = laNgay_(d.ngay) ? chuoi_(d.ngay) : '';
  if (!ngay && !d.theo_dong) throw new Error('Thiếu ngày của file.');
  var homNay = homNayVN_();
  if (ngay > homNay) throw new Error('Ngày ' + ngay + ' ở tương lai.');
  var x = tkTuDl_(ngay || homNay, 'nap', d.dl, tkKhoaDaCo_(function () { return true; }), !d.theo_dong, congNgay_(homNay, -TK_GIU_NGAY));
  tkLuu_(x, 'nap');
  var soNgay = Object.keys(x.khoa).length;
  if (x.soDong) ghiLichSu_([[bayGio_(), 'napThongKe', tkChu_(d.file, 120) || ngay, '', JSON.stringify({ ghi_chu: 'Nạp bù số liệu bán: ' + x.soDong + ' dòng mới, ' + soNgay + ' ngày' +
    (x.bo ? ', bỏ ' + x.bo + ' dòng đã có' : '') }), nguoiLog || '', '']]);
  return { ok: true, soDongMoi: x.soDong, soDongTrung: x.bo, soDongCu: x.boCu, soNgay: soNgay };
}
/* Cộng dồn các dòng THONG_KE trong kỳ [tu, den] (+ kỳ trước [tuT, denT]) theo sản phẩm × sàn × gian.
 * tach: combo đã khai báo → tách ra từng cuốn (doanh thu chia theo giá gốc × SL). Trả về
 *   sp: [[khoa_sp, tên, phân loại, barcode, ngành, nhà, nhóm, là combo]]
 *   d:  [[chỉ số sp, sàn, gian, SL, số đơn, doanh thu | null, SL kỳ trước, doanh thu kỳ trước | null]]
 *   don: [[sàn, gian, số đơn, số đơn kỳ trước]] */
function tkGop_(dong, tu, den, tuT, denT, tach) {
  var sp = [], spMap = {}, d = {}, thuTu = [], don = {};
  function cong(ky, san, gian, tt, sl, sd, dt) {
    var i = spMap[tt[0]];
    if (i === undefined) { i = spMap[tt[0]] = sp.length; sp.push(tt); } else if (ky) sp[i] = tt; // tên / ngành / nhà: lấy theo dòng mới nhất trong kỳ
    var id = i + '\u0001' + san + '\u0001' + gian, g = d[id];
    if (!g) { g = d[id] = [i, san, gian, 0, 0, null, 0, null]; thuTu.push(id); }
    if (ky) { g[3] += sl; g[4] += sd; if (dt !== null) g[5] = (g[5] || 0) + dt; }
    else { g[6] += sl; if (dt !== null) g[7] = (g[7] || 0) + dt; }
  }
  dong.forEach(function (r) {
    var ngay = tkNgay_(r[0]), ky = ngay >= tu && ngay <= den;
    if (!ky && !(tuT && ngay >= tuT && ngay <= denT)) return;
    var san = String(r[1]), gian = String(r[2]), khoa = String(r[3]);
    var sl = Number(r[9]) || 0, sd = Number(r[10]) || 0, dt = r[11] === '' || r[11] === null || r[11] === undefined ? null : Number(r[11]) || 0;
    if (khoa === TK_DON) {
      var kd = san + '\u0001' + gian, o = don[kd] || (don[kd] = [san, gian, 0, 0]);
      o[ky ? 2 : 3] += sd;
      return;
    }
    var tp = null;
    if (tach && r[14]) { try { tp = JSON.parse(String(r[14])); } catch (e) { tp = null; } }
    if (tp && tp.length) {
      var tongGia = 0, tongSl = 0;
      tp.forEach(function (t) { var n = Number(t[4]) || 1; tongGia += (Number(t[5]) || 0) * n; tongSl += n; });
      tp.forEach(function (t) {
        var n = Number(t[4]) || 1, tl = tongGia > 0 ? (Number(t[5]) || 0) * n / tongGia : n / tongSl;
        cong(ky, san, gian, [String(t[0]), String(t[1]), '', String(t[2] || ''), 'Sách', String(t[3] || ''), String(t[0]), 0], sl * n, sd, dt === null ? null : dt * tl);
      });
      return;
    }
    cong(ky, san, gian, [khoa, String(r[4]), String(r[5]), String(r[6]), String(r[7]), String(r[8]), String(r[13] || '') || khoa, r[14] ? 1 : 0], sl, sd, dt);
  });
  return { sp: sp, don: Object.keys(don).map(function (k) { return don[k]; }),
           d: thuTu.map(function (id) { var g = d[id]; if (g[5] !== null) g[5] = Math.round(g[5]); if (g[7] !== null) g[7] = Math.round(g[7]); return g; }) };
}
/* GET ?action=thongKe&tu=&den=&combo=tach|nguyen&truoc=1 – cộng dồn ở server, máy không tải toàn bộ 6 tháng */
function tkTongHop_(q) {
  q = q || {};
  var homNay = homNayVN_(), den = laNgay_(q.den) ? chuoi_(q.den) : homNay, tu = laNgay_(q.tu) ? chuoi_(q.tu) : congNgay_(den, -6);
  if (tu > den) tu = den;
  var soNgay = Math.round((Date.parse(den) - Date.parse(tu)) / 864e5) + 1, tuT = '', denT = '';
  if (q.truoc === '1') { denT = congNgay_(tu, -1); tuT = congNgay_(tu, -soNgay); }
  var s = sheet_(SH.TK), vt = tkViTri_(SH.TK, 0), dau = tuT || tu, min = '', max = '';
  vt.forEach(function (x) { if (!min || x.ngay < min) min = x.ngay; if (x.ngay > max) max = x.ngay; });
  var dong = [];
  tkDoan_(vt.filter(function (x) { return x.ngay >= dau && x.ngay <= den; })).forEach(function (d) {
    Array.prototype.push.apply(dong, s.getRange(d[0], 1, d[1], 15).getValues());
  });
  var kq = tkGop_(dong, tu, den, tuT, denT, q.combo === 'tach');
  kq.ok = true; kq.api = API; kq.tu = tu; kq.den = den; kq.tu_truoc = tuT; kq.den_truoc = denT; kq.hom_nay = homNay;
  kq.ngay_min = min; kq.ngay_max = max; kq.so_dong = dong.length;
  var dot = timDot_(docBang_(SH.DOT), homNay);
  kq.dot_hom_nay = dot ? dot.trang_thai : '';
  return kq;
}
/* Đợt đang mở (chưa chốt): tính thử số liệu của ngày đó như khi chốt, KHÔNG ghi gì → { tach: {…}, nguyen: {…} } */
function tkTam_(d) {
  var ngay = laNgay_(d.ngay) ? chuoi_(d.ngay) : homNayVN_(), tu = congNgay_(ngay, -TK_TRUNG_NGAY);
  var daCo = tkKhoaDaCo_(function (n, ng) { return n >= tu && !(n === ngay && ng === 'dot'); });
  var x = tkTuDl_(ngay, 'dot', d.dl, daCo, true, '');
  return { ok: true, ngay: ngay, soDong: x.soDong, boTrung: x.bo, tach: tkGop_(x.dong, ngay, ngay, '', '', true), nguyen: tkGop_(x.dong, ngay, ngay, '', '', false) };
}
/** Xóa số liệu THONG_KE cũ hơn 183 ngày (tự chạy chung với sao lưu 23h; chạy tay cũng được). */
function tkDonCu() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var moc = congNgay_(homNayVN_(), -TK_GIU_NGAY), cu = function (x) { return x.ngay < moc; };
    tkXoaDong_(SH.TKK, tkViTri_(SH.TKK, 0).filter(cu));
    return tkXoaDong_(SH.TK, tkViTri_(SH.TK, 0).filter(cu));
  } finally {
    lock.releaseLock();
  }
}

/* "⏭ Để sau": dòng chưa rõ nhà chuyển sang tab Chờ khai báo (dùng chung mọi máy) */
function docDeSau_() { return docBang_(SH.DS).filter(function (x) { return x.khoa; }).map(function (x) { return x.khoa; }); }
function deSau_(d, nguoi) {
  var khoa = chuoi_(d.khoa);
  if (!khoa) throw new Error('Thiếu khóa dòng.');
  var ds = docBang_(SH.DS).filter(function (x) { return x.khoa && x.khoa !== khoa; });
  var co = docBang_(SH.DS).some(function (x) { return x.khoa === khoa; });
  if (!d.bo) ds.push({ khoa: khoa, ten: chuoi_(d.ten).slice(0, 200), luc: bayGio_(), nguoi: nguoi || '' });
  ghiBang_(SH.DS, ds);
  if (co === !!d.bo) { // có đổi → ghi LICH_SU
    var an = khoa.indexOf('bo:') === 0;
    ghiLichSu_([[bayGio_(), (d.bo ? 'bo' : '') + (an ? (d.bo ? 'AnChoKhaiBao' : 'anChoKhaiBao') : (d.bo ? 'DeSau' : 'deSau')), khoa, '',
                 JSON.stringify({ ten: chuoi_(d.ten).slice(0, 200), ghi_chu: (d.bo ? (an ? 'Bỏ ẩn' : 'Đưa lại màn sáng') : (an ? 'Ẩn khỏi Chờ khai báo' : 'Để sau')) + ': ' + chuoi_(d.ten).slice(0, 120) }),
                 nguoi || '', '']]);
  }
  return { ok: true, de_sau: ds.map(function (x) { return x.khoa; }) };
}
/* Số ngày muốn đủ bán (gợi ý đặt) của từng nhà – người đặt hàng chỉnh, dùng chung */
function luuDuBaoNgay_(d, nguoi) {
  var nha = chuoi_(d.nha), so = Math.max(1, Math.min(90, Math.round(Number(d.so_ngay) || 7)));
  if (!nha) throw new Error('Thiếu nhà.');
  var ds = docBang_(SH.CDC), x = ds.filter(function (r) { return r.khoa === 'duBaoNgay'; })[0], v = {};
  try { v = x ? JSON.parse(x.gia_tri) || {} : {}; } catch (e) { v = {}; }
  v[nha] = so;
  ds = ds.filter(function (r) { return r.khoa !== 'duBaoNgay'; });
  ds.push({ khoa: 'duBaoNgay', gia_tri: JSON.stringify(v), cap_nhat: bayGio_(), nguoi: nguoi || '' });
  ghiBang_(SH.CDC, ds);
  return { ok: true, cai_dat_chung: docCaiDatChung_() };
}

/* ===================== Đọc / ghi sheet ===================== */

function bangTinh_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Script này phải được tạo từ trong file Google Sheets (Tiện ích mở rộng → Apps Script).');
  return ss;
}

function sheet_(ten) {
  var ss = bangTinh_();
  var s = ss.getSheetByName(ten);
  if (!s) {
    s = ss.insertSheet(ten);
    s.getRange(1, 1, 1, COT[ten].length).setValues([COT[ten]]).setFontWeight('bold');
    s.setFrozenRows(1);
  } else {
    // Bản cũ thiếu cột mới (vd COMBO thêm cach_xuat…) → bổ sung tiêu đề; cột mới luôn nằm sau cột cũ
    var dau = s.getRange(1, 1, 1, COT[ten].length).getValues()[0];
    if (dau.join('|') !== COT[ten].join('|')) s.getRange(1, 1, 1, COT[ten].length).setValues([COT[ten]]).setFontWeight('bold');
  }
  return s;
}

function docBang_(ten) {
  var s = sheet_(ten), cols = COT[ten], n = s.getLastRow();
  if (n < 2) return [];
  return s.getRange(2, 1, n - 1, cols.length).getValues()
    .filter(function (r) { return r.some(function (x) { return x !== '' && x !== null; }); })
    .map(function (r) {
      var o = {};
      cols.forEach(function (c, j) { o[c] = r[j] instanceof Date ? dinhDang_(r[j]) : chuoi_(r[j]); });
      return o;
    });
}

function ghiBang_(ten, ds) {
  var s = sheet_(ten), cols = COT[ten], n = s.getLastRow();
  // Ghi đè tại chỗ rồi mới xóa phần đuôi thừa – máy khác đọc giữa chừng không bao giờ thấy bảng trống
  if (ds.length) {
    var so = COT_SO[ten] || [];
    cols.forEach(function (c, j) { if (so.indexOf(c) < 0) s.getRange(2, j + 1, ds.length, 1).setNumberFormat('@'); });
    s.getRange(2, 1, ds.length, cols.length).setValues(ds.map(function (o) {
      return cols.map(function (c) { return o[c] === undefined || o[c] === null ? '' : o[c]; });
    }));
  }
  if (n - 1 > ds.length) s.getRange(ds.length + 2, 1, n - 1 - ds.length, cols.length).clearContent();
}

function docCatalog_() {
  var skus = docBang_(SH.SKU);
  var tps = docBang_(SH.TP);
  var combos = docBang_(SH.COMBO).map(function (c) {
    return {
      combo_id: c.combo_id, ten_combo: c.ten_combo, cap_nhat: c.cap_nhat,
      khoa: c.khoa.split(/\s*;;\s*/).map(chuoi_).filter(function (k) { return k; }),
      cach_xuat: c.cach_xuat === 'nguyen' ? 'nguyen' : 'tach', // combo cũ chưa có giá trị → tach
      ma_he_thong: c.ma_he_thong || '', ten_xuat: c.ten_xuat || '', nha: c.nha || '',
      phien_ban: c.phien_ban || '', dong_bo: c.dong_bo || '', nguoi_sua: c.nguoi_sua || '',
      thanh_phan: []
    };
  });
  var theoId = {};
  combos.forEach(function (c) { theoId[c.combo_id] = c; });
  tps.forEach(function (t) {
    var c = theoId[t.combo_id];
    if (c) c.thanh_phan.push({ sku: t.sku, ten: t.ten, nha: t.nha, gia_goc: Number(t.gia_goc) || 0, so_luong: Number(t.so_luong) || 1 });
  });
  return { skus: skus, combos: combos, ma_chuan: docBang_(SH.MC) };
}

/* ===================== Lịch sử (chỉ thêm dòng) ===================== */

function ghiLog_(ctx, hanhDong, khoa, cu, moi) {
  ctx.log.push([ctx.now, hanhDong, khoa, cu ? JSON.stringify(cu) : '', moi ? JSON.stringify(moi) : '', ctx.nguoiLog || ctx.nguoi || '', ctx.rev || '']);
}

function ghiLichSu_(dong) {
  if (!dong.length) return;
  var s = sheet_(SH.LS), n = s.getLastRow();
  var r = s.getRange(n + 1, 1, dong.length, COT.LICH_SU.length);
  r.setNumberFormat('@');
  r.setValues(dong);
}

function docLichSu_(soDong) {
  var s = sheet_(SH.LS), n = s.getLastRow();
  if (n < 2) return [];
  var tu = Math.max(2, n - soDong + 1);
  return s.getRange(tu, 1, n - tu + 1, COT.LICH_SU.length).getValues().map(function (r, i) {
    var o = { dong: tu + i }; // số dòng trong sheet – dùng cho "Hoàn tác"
    COT.LICH_SU.forEach(function (c, j) { o[c] = r[j] instanceof Date ? dinhDang_(r[j]) : String(r[j]); });
    return o;
  }).reverse();
}

/* ===================== Tiện ích ===================== */

function timViTri_(ds, truong, gt) {
  for (var i = 0; i < ds.length; i++) if (ds[i][truong] === gt) return i;
  return -1;
}
function saoChep_(o) { return JSON.parse(JSON.stringify(o)); }
function muiGio_() { return bangTinh_().getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh'; }
function dinhDang_(d, mau) { return Utilities.formatDate(d, muiGio_(), mau || 'yyyy-MM-dd HH:mm:ss'); }
function bayGio_() { return dinhDang_(new Date()); }

/* ===================== Chạy tay trong trình soạn thảo ===================== */

/** Chạy 1 lần: tạo đủ 4 sheet có dòng tiêu đề. */
function khoiTao() {
  [SH.SKU, SH.COMBO, SH.TP, SH.LS, SH.MC, SH.DH, SH.DON, SH.XOA, SH.ND, SH.DOT, SH.PHAN, SH.CDC, SH.BH, SH.DS, SH.NHA, SH.TK, SH.TKK, SH.Q].forEach(sheet_);
  var ss = bangTinh_();
  ss.getSheets().forEach(function (s) {
    if (/^(Sheet1|Trang tính1)$/.test(s.getName()) && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  Logger.log('Đã tạo xong các sheet: SKU_NHA, COMBO, COMBO_THANH_PHAN, LICH_SU, MA_CHUAN, LS_DAT_HANG, DON_DA_GHI, DM_XOA, NGUOI_DUNG, DOT, DOT_PHAN, CAI_DAT_CHUNG, BAN_HANG, DE_SAU, NHA, THONG_KE, THONG_KE_KHOA, QUYEN.');
}

/** Sao lưu 3 sheet danh mục sang file "Sao lưu danh mục – Tách đơn nhập nhà", giữ 30 bản gần nhất. */
function saoLuuHangNgay() {
  var bk = fileSaoLuu_();
  var ngay = dinhDang_(new Date(), 'yyyy-MM-dd');
  [SH.SKU, SH.COMBO, SH.TP].forEach(function (ten) {
    var tenMoi = ngay + ' ' + ten;
    var cu = bk.getSheetByName(tenMoi);
    if (cu) bk.deleteSheet(cu); // chạy lại trong ngày → thay bản cũ của ngày đó
    sheet_(ten).copyTo(bk).setName(tenMoi);
  });
  // Bỏ sheet trống mặc định của file mới
  bk.getSheets().forEach(function (s) {
    if (!/^\d{4}-\d{2}-\d{2} /.test(s.getName()) && bk.getSheets().length > 1) bk.deleteSheet(s);
  });
  // Giữ 30 bản (ngày) gần nhất
  var ngays = [];
  bk.getSheets().forEach(function (s) {
    var d = s.getName().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && ngays.indexOf(d) < 0) ngays.push(d);
  });
  ngays.sort().reverse();
  var xoa = ngays.slice(SO_BAN_SAO_LUU);
  bk.getSheets().forEach(function (s) {
    if (xoa.indexOf(s.getName().slice(0, 10)) >= 0) bk.deleteSheet(s);
  });
  Logger.log('Đã sao lưu ngày ' + ngay + ' vào: ' + bk.getUrl());
  // Chạy chung trigger 23h: xóa số liệu THONG_KE cũ hơn 183 ngày (lỗi ở đây không làm hỏng việc sao lưu)
  try { Logger.log('THONG_KE: đã xóa ' + tkDonCu() + ' dòng cũ hơn ' + TK_GIU_NGAY + ' ngày.'); } catch (e) { Logger.log('Chưa dọn được THONG_KE: ' + e); }
  return bk.getUrl();
}

function fileSaoLuu_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SAO_LUU_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* file đã bị xóa → tạo lại */ }
  }
  var bk = SpreadsheetApp.create('Sao lưu danh mục – Tách đơn nhập nhà');
  props.setProperty('SAO_LUU_ID', bk.getId());
  return bk;
}

/** Chạy 1 lần: cài sao lưu tự động mỗi ngày khoảng 23h (và sao lưu ngay 1 bản để kiểm tra). */
function caiDatSaoLuuTuDong() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'saoLuuHangNgay') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('saoLuuHangNgay').timeBased().everyDays(1).atHour(GIO_SAO_LUU).create();
  var url = saoLuuHangNgay();
  Logger.log('Đã cài sao lưu tự động lúc khoảng ' + GIO_SAO_LUU + 'h mỗi ngày. File sao lưu: ' + url);
}

/**
 * Khôi phục danh mục từ 1 bản sao lưu.
 * Cách dùng: sửa NGAY_KHOI_PHUC bên dưới thành ngày cần lấy lại (dạng 2026-10-03), rồi chạy hàm khoiPhucSaoLuu.
 * Trước khi khôi phục, danh mục hiện tại được sao lưu thêm 1 bản (tên có chữ "truoc-khoi-phuc").
 */
var NGAY_KHOI_PHUC = '2026-10-03';
/* Các ngày có bản sao lưu đủ 3 sheet (mới nhất trước) – cho nút "♻️ Khôi phục sao lưu" trong app */
function dsNgaySaoLuu_() {
  var id = PropertiesService.getScriptProperties().getProperty('SAO_LUU_ID'), dem = {};
  if (!id) return [];
  var bk;
  try { bk = SpreadsheetApp.openById(id); } catch (e) { return []; }
  bk.getSheets().forEach(function (s) { var m = /^(\d{4}-\d{2}-\d{2}) /.exec(s.getName()); if (m) dem[m[1]] = (dem[m[1]] || 0) + 1; });
  return Object.keys(dem).filter(function (n) { return dem[n] >= 3; }).sort().reverse();
}
/* Người có quyền "Khôi phục sao lưu" bấm trong app (đã kiểm tra mã Admin; doPost đang giữ khóa) */
function khoiPhucTuApp_(d, nguoiLog) {
  var ngay = chuoi_(d.ngay);
  if (!laNgay_(ngay)) throw new Error('Thiếu ngày bản sao lưu.');
  khoiPhuc_(ngay, nguoiLog || '(khôi phục sao lưu)');
  return { ok: true, catalog: docCatalog_(), ngay: ngay };
}
function khoiPhucSaoLuu() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    khoiPhuc_(NGAY_KHOI_PHUC, '(khôi phục sao lưu)');
    Logger.log('Đã khôi phục danh mục từ bản sao lưu ngày ' + NGAY_KHOI_PHUC + '.');
  } finally {
    lock.releaseLock();
  }
}
function khoiPhuc_(NGAY_KHOI_PHUC, nguoiKp) {
  {
    var bk = fileSaoLuu_();
    var tenBang = [SH.SKU, SH.COMBO, SH.TP];
    tenBang.forEach(function (ten) {
      if (!bk.getSheetByName(NGAY_KHOI_PHUC + ' ' + ten)) throw new Error('Không có bản sao lưu ngày ' + NGAY_KHOI_PHUC + ' (' + ten + ').');
    });
    var gio = dinhDang_(new Date(), 'HHmmss');
    var ss = bangTinh_();
    var revKp = revHienTai_() + 1;
    var ctx = { now: bayGio_(), log: [], nguoi: nguoiKp, rev: revKp };
    tenBang.forEach(function (ten) {
      var hienTai = sheet_(ten);
      hienTai.copyTo(bk).setName('truoc-khoi-phuc ' + gio + ' ' + ten);
      var nguon = bk.getSheetByName(NGAY_KHOI_PHUC + ' ' + ten);
      var duLieu = nguon.getDataRange().getValues().slice(1).filter(function (r) { return r.some(function (x) { return x !== ''; }); });
      var cu = docBang_(ten).length;
      ghiBang_(ten, duLieu.map(function (r) {
        var o = {};
        COT[ten].forEach(function (c, j) { o[c] = r[j] instanceof Date ? dinhDang_(r[j]) : r[j]; });
        return o;
      }));
      ghiLog_(ctx, 'khoiPhuc', ten, { so_dong: cu }, { so_dong: duLieu.length, tu_ngay: NGAY_KHOI_PHUC });
    });
    ghiLichSu_(ctx.log);
    // Mọi máy tải lại toàn bộ danh mục ở lần đồng bộ tới
    datRev_(revKp);
    PropertiesService.getScriptProperties().setProperty('DM_XOA_CAT', String(revKp));
  }
}
