/* Danh mục dùng chung (Google Sheets qua Apps Script) + cài đặt lưu trên máy.
 * - Đọc: GET <url>  → { ok, skus, combos }
 * - Ghi: POST <url> body {action, data} (Content-Type text/plain để tránh CORS preflight)
 * - Lịch sử: GET <url>?action=lichSu → { ok, lich_su }
 * - Lịch sử đặt hàng: GET <url>?action=lichSuDatHang&tu=yyyy-MM-dd → { ok, cot, dong }
 * URL chỉ lưu trong localStorage của từng máy, không bao giờ nằm trong code.
 *        → { ok, catalog } hoặc { ok:false, error }
 * Nhiều người dùng (Apps Script api ≥ 2):
 * - Đồng bộ: mỗi 30 giây + khi quay lại tab / chuyển màn → GET ?action=thayDoi&tu=<mốc> (chỉ phần thay đổi)
 * - Chống ghi đè: goi(action, data, { pb, cu, moTa }) gửi kèm phiên bản đang thấy; server báo xung đột → hỏi giữ / đổi
 * - Apps Script cũ (không có api) → chạy chế độ 1 người như trước, báo cần cập nhật. */
(function (root) {
  'use strict';

  var LS_CAIDAT = 'tdn.caidat.v1';
  var LS_DANHMUC = 'tdn.danhmuc.v1';
  var LS_ADMIN = 'tdn.admin.v1'; // mã Admin của máy này (nhập 1 lần, "Đăng xuất Admin" để xóa)
  // Thao tác chỉ Admin (Apps Script api ≥ 4 kiểm tra mã)
  var HD_ADMIN = { kiemTraMaAdmin: 1, luuNha: 1, xoaNha: 1, luuNguoiDung: 1, moLaiDot: 1, xoaDot: 1, xoaPhan: 1, suaPhan: 1, luuCaiDatChung: 1, importBatch: 1, upsertMaChuan: 1, xoaHangLoat: 1 };
  var RE_LOI_ADMIN = /^(SAI_MA_ADMIN|KHOA_ADMIN|CHUA_DAT_MA_ADMIN|CAN_MA_ADMIN):\s*/;

  function docLS(k, macDinh) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : macDinh; } catch (e) { return macDinh; }
  }
  function ghiLS(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* hết chỗ / chế độ riêng tư */ }
  }

  var caiDat = Object.assign({ url: '', toiLa: '', maKhac: root.PhanLoai.MA_KHAC_MAC_DINH.slice(), tenShop: '', sdt: '', diaChi: '', ghiChu: '',
    trangThaiShopee: root.DocFile.TRANG_THAI_MAC_DINH.slice(), duPhongBat: true, soNgayDuPhong: 2,
    plVoNghia: root.PhanLoai.PL_VO_NGHIA_MAC_DINH.slice() },
    docLS(LS_CAIDAT, {}));
  if ('pin' in caiDat) { delete caiDat.pin; ghiLS(LS_CAIDAT, caiDat); } // bản cũ có PIN – không dùng nữa
  var cache = docLS(LS_DANHMUC, null);
  var catalog = chuanHoa(cache && cache.catalog);
  var trangThai = { state: caiDat.url ? 'idle' : 'none', luc: cache ? cache.luc : null, loi: '' };
  var nghe = [];
  // api: phiên bản Apps Script (0 = bản cũ, chưa có nhiều người dùng; null = chưa biết) ; rev: mốc đồng bộ đang có
  var may = { api: null, rev: 0, urlRev: '', dangDongBo: null, lanToanBo: 0, adminDaDatMa: null, caiDatChung: null };
  var maAdmin = (docLS(LS_ADMIN, {}) || {}).ma || '';
  function luuMaAdmin(ma) { maAdmin = ma || ''; ghiLS(LS_ADMIN, { ma: maAdmin }); phat('admin'); }
  /* Cài đặt chung do Admin đặt (mã nhà khác, trạng thái Shopee, phân loại vô nghĩa) → ghi đè cài đặt trên máy */
  /* Dòng "⏭ Để sau" (dùng chung mọi máy) */
  var deSau = {};
  function nhanDeSau(ds) {
    var moi = {};
    (ds || []).forEach(function (k) { moi[k] = 1; });
    if (JSON.stringify(moi) === JSON.stringify(deSau)) return;
    deSau = moi;
    phat('desau');
  }
  function nhanCaiDatChung(cd) {
    if (!cd || typeof cd !== 'object') return;
    may.caiDatChung = cd;
    var doi = false;
    ['maKhac', 'trangThaiShopee', 'plVoNghia'].forEach(function (k) {
      if (k === 'maKhac' && may.api >= 6) return; // có sổ nhà: mã nhà khác lấy từ sổ nhà
      if (Array.isArray(cd[k]) && JSON.stringify(cd[k]) !== JSON.stringify(caiDat[k])) { caiDat[k] = cd[k].slice(); doi = true; }
    });
    if (doi) { ghiLS(LS_CAIDAT, caiDat); phat('caidat'); }
  }
  // Danh sách người dùng chung (Apps Script api ≥ 3) – lưu tạm trên máy để mở app lúc mất mạng vẫn biết vai trò
  var nguoiDung = (cache && cache.nguoiDung) || [];
  function nhanNguoiDung(ds) {
    if (!Array.isArray(ds)) return;
    var moi = ds.map(function (x) { return { ten: String(x.ten || ''), vai_tro: ['dat_hang', 'admin'].indexOf(x.vai_tro) >= 0 ? x.vai_tro : 'san' }; }).filter(function (x) { return x.ten; });
    if (JSON.stringify(moi) === JSON.stringify(nguoiDung)) return;
    nguoiDung = moi;
    luuCache();
    phat('nguoidung');
  }
  var DONG_BO_MS = 30000, TOAN_BO_MS = 10 * 60000;

  function chuanHoa(c) {
    c = c || {};
    var skus = (c.skus || []).map(function (e) {
      return { key: String(e.key || ''), sku: String(e.sku || ''), ten: String(e.ten || ''), nha: String(e.nha || ''),
               nguon: String(e.nguon || 'tay'), cap_nhat: e.cap_nhat || '',
               gia_gan_nhat: Number(e.gia_gan_nhat) || 0, ngay_gia: String(e.ngay_gia || ''),
               ma_moi: String(e.ma_moi || ''), khong_tai_ban: String(e.khong_tai_ban || ''), nguon_ma: String(e.nguon_ma || ''),
               ten_sach: String(e.ten_sach || ''), phan_loai: String(e.phan_loai || ''), khong_combo: String(e.khong_combo || ''),
               phien_ban: Number(e.phien_ban) || 0, dong_bo: Number(e.dong_bo) || 0, nguoi_sua: String(e.nguoi_sua || '') };
    }).filter(function (e) { return e.key; });
    var combos = (c.combos || []).map(function (x) {
      var khoa = Array.isArray(x.khoa) ? x.khoa : String(x.khoa || '').split(' ;; ');
      return {
        combo_id: String(x.combo_id || ''), ten_combo: String(x.ten_combo || ''), cap_nhat: x.cap_nhat || '',
        khoa: khoa.map(function (k) { return String(k).trim(); }).filter(Boolean),
        cach_xuat: x.cach_xuat === 'nguyen' ? 'nguyen' : 'tach', // combo cũ chưa có giá trị → tách
        ma_he_thong: String(x.ma_he_thong || ''), ten_xuat: String(x.ten_xuat || ''), nha: String(x.nha || ''),
        phien_ban: Number(x.phien_ban) || 0, dong_bo: Number(x.dong_bo) || 0, nguoi_sua: String(x.nguoi_sua || ''),
        thanh_phan: (x.thanh_phan || []).map(function (t) {
          return { sku: String(t.sku || ''), ten: String(t.ten || ''), nha: String(t.nha || 'KHAC'),
                   gia_goc: Number(t.gia_goc) || 0, so_luong: Number(t.so_luong) || 1 };
        })
      };
    }).filter(function (x) { return x.combo_id; });
    var maChuan = (c.ma_chuan || []).map(function (x) {
      return { barcode: String(x.barcode || ''), ten_gon: String(x.ten_gon || ''), gia_bia: Number(x.gia_bia) || 0, ncc: String(x.ncc || ''),
               nha: String(x.nha || ''), ngay_thay: String(x.ngay_thay || ''), khong_phai: String(x.khong_phai || ''),
               phien_ban: Number(x.phien_ban) || 0, dong_bo: Number(x.dong_bo) || 0, nguoi_sua: String(x.nguoi_sua || '') };
    }).filter(function (x) { return x.barcode; });
    return { skus: skus, combos: combos, ma_chuan: maChuan };
  }

  function phat(loai, info) { nghe.forEach(function (f) { f(loai, info); }); }
  function datTrangThai(state, loi) {
    trangThai.state = state; trangThai.loi = loi || '';
    if (state === 'ok') trangThai.luc = new Date().toISOString();
    phat('trangthai');
  }
  function luuCache() { ghiLS(LS_DANHMUC, { catalog: catalog, luc: new Date().toISOString(), nguoiDung: nguoiDung, nha: soNhaMay }); }

  /* ---------- Sổ nhà dùng chung (Apps Script api ≥ 6). Chưa có → HA/KV/ML + "Mã nhà khác" trên máy (như cũ) ---------- */
  var soNhaMay = (cache && cache.nha) || null;
  function apSoNha(ds) {
    var PL = root.PhanLoai;
    if (!PL.datNha(ds)) return false;
    if (root.XuatFile) root.XuatFile.datNha(PL.DS_NHA);
    caiDat.maKhac = PL.maNhapKho(); // ô "Mã nhà khác" cũ = mã các nhà "Nhập kho"
    return true;
  }
  function nhanNha(ds) {
    if (!Array.isArray(ds) || !ds.length) return;
    if (JSON.stringify(ds) === JSON.stringify(soNhaMay)) return;
    soNhaMay = ds;
    if (!apSoNha(ds)) return;
    ghiLS(LS_CAIDAT, caiDat);
    luuCache();
    phat('nha');
    phat('caidat');
  }
  function nhanCatalog(c, info) {
    catalog = chuanHoa(c);
    luuCache();
    phat('catalog', info);
  }
  /* Ghi nhận phiên bản Apps Script + mốc đồng bộ từ 1 phản hồi. Trả về false nếu phản hồi CŨ hơn dữ liệu đang có. */
  function nhanMoc(j) {
    var apiMoi = Number(j.api) || 0;
    if (may.api !== apiMoi) { may.api = apiMoi; phat('api'); }
    if (j.nguoi_dung) nhanNguoiDung(j.nguoi_dung);
    if (j.nha) nhanNha(j.nha);
    if (j.admin_da_dat_ma !== undefined && may.adminDaDatMa !== !!j.admin_da_dat_ma) { may.adminDaDatMa = !!j.admin_da_dat_ma; phat('admin'); }
    if (j.cai_dat_chung) nhanCaiDatChung(j.cai_dat_chung);
    if (j.de_sau) nhanDeSau(j.de_sau);
    if (!apiMoi) return true;
    var rev = Number(j.rev) || 0;
    if (may.urlRev === caiDat.url && rev < may.rev) return false;
    may.rev = rev; may.urlRev = caiDat.url;
    return true;
  }
  function nhieuNguoi() { return !!(caiDat.url && may.api >= 2); }
  /* Có Người dùng + Đợt đặt hàng (Apps Script api ≥ 3) */
  function coDot() { return !!(caiDat.url && may.api >= 3); }
  /* Có vai trò Admin (Apps Script api ≥ 4) */
  function coAdmin() { return !!(caiDat.url && may.api >= 4); }
  /* Có lịch sử bán + dự báo + chờ khai báo (Apps Script api ≥ 5) */
  function coBanHang() { return !!(caiDat.url && may.api >= 5); }
  /* Vai trò của "Tôi là" trên máy này: admin | dat_hang | san | '' (chưa chọn / không có trong danh sách) */
  function vaiTro() {
    var x = nguoiDung.filter(function (n) { return n.ten === caiDat.toiLa; })[0];
    return x ? x.vai_tro : '';
  }

  function taiLai() {
    if (!caiDat.url) { datTrangThai('none'); return Promise.resolve(false); }
    datTrangThai('syncing');
    var url = caiDat.url;
    return fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || j.ok === false) throw new Error((j && j.error) || 'Dữ liệu trả về không hợp lệ');
        if (url !== caiDat.url) return false;
        may.lanToanBo = Date.now();
        if (nhanMoc(j)) nhanCatalog(j, { nguon: 'taiLai' });
        datTrangThai('ok');
        return true;
      })
      .catch(function (e) { datTrangThai('error', moTaLoi(e)); return false; });
  }

  /* Đồng bộ phần thay đổi (Apps Script mới). Không đổi trạng thái "Đang đồng bộ…" để khỏi nháy thanh trên cùng. */
  function dongBo() {
    if (!nhieuNguoi() || may.dangDongBo) return may.dangDongBo || Promise.resolve(false);
    if (Date.now() - may.lanToanBo > TOAN_BO_MS) return taiLaiNgam();
    var url = caiDat.url, tu = may.urlRev === url ? may.rev : 0;
    var p = may.dangDongBo = fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=thayDoi&tu=' + tu, { method: 'GET', redirect: 'follow', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || j.ok === false) throw new Error((j && j.error) || 'Dữ liệu trả về không hợp lệ');
        if (url !== caiDat.url) return false;
        if (trangThai.state === 'error') datTrangThai('ok');
        if (j.khongDoi || !nhanMoc(j)) { trangThai.luc = new Date().toISOString(); phat('trangthai'); return false; }
        if (j.toanBo) { may.lanToanBo = Date.now(); nhanCatalog(j, { nguon: 'dongBo', log: [] }); }
        else apDungThayDoi(j);
        trangThai.luc = new Date().toISOString(); phat('trangthai');
        return true;
      })
      .catch(function (e) { datTrangThai('error', moTaLoi(e)); return false; })
      .then(function (x) { may.dangDongBo = null; return x; });
    return p;
  }
  function taiLaiNgam() {
    var url = caiDat.url;
    var p = may.dangDongBo = fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || j.ok === false) throw new Error((j && j.error) || 'Dữ liệu trả về không hợp lệ');
        if (url !== caiDat.url) return false;
        may.lanToanBo = Date.now();
        if (trangThai.state === 'error') datTrangThai('ok');
        if (!nhanMoc(j)) return false;
        if (JSON.stringify(chuanHoa(j)) !== JSON.stringify(catalog)) nhanCatalog(j, { nguon: 'dongBo', log: [] });
        trangThai.luc = new Date().toISOString(); phat('trangthai');
        return true;
      })
      .catch(function (e) { datTrangThai('error', moTaLoi(e)); return false; })
      .then(function (x) { may.dangDongBo = null; return x; });
    return p;
  }
  /* Ghép phần thay đổi vào danh mục trên máy: xóa trước, rồi thêm / thay bản ghi mới */
  function apDungThayDoi(j) {
    var xoa = { sku: {}, combo: {}, mc: {} };
    (j.xoa || []).forEach(function (x) { if (xoa[x.loai]) xoa[x.loai][x.khoa] = 1; });
    function ghep(ds, moi, khoaCua, loai) {
      var theo = {};
      (moi || []).forEach(function (r) { theo[khoaCua(r)] = r; });
      var out = ds.filter(function (r) { var k = khoaCua(r); return !xoa[loai][k] && !theo[k]; });
      return out.concat(moi || []);
    }
    var c = {
      skus: ghep(catalog.skus, j.skus, function (e) { return String(e.key); }, 'sku'),
      combos: ghep(catalog.combos, j.combos, function (x) { return String(x.combo_id); }, 'combo'),
      ma_chuan: ghep(catalog.ma_chuan, j.ma_chuan, function (x) { return String(x.barcode); }, 'mc')
    };
    nhanCatalog(c, { nguon: 'dongBo', log: j.log || [] });
  }
  function batDongBo() {
    setInterval(function () { if (!document.hidden) dongBo(); }, DONG_BO_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) dongBo(); });
    window.addEventListener('focus', function () { dongBo(); });
  }

  function moTaLoi(e) {
    var m = (e && e.message) || String(e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Không kết nối được tới Apps Script (kiểm tra mạng hoặc URL).';
    if (/Unexpected token|JSON/i.test(m)) return 'URL không trả về dữ liệu danh mục (có thể dán sai link, hoặc Web App chưa để quyền "Anyone").';
    return m;
  }

  /* Gửi 1 thao tác ghi. Trả về Promise kết quả (đã cập nhật catalog nếu server trả về).
   * opt.pb: { "sku|<khoa>": phiên bản đang thấy, "combo|<id>": … } – có thì server kiểm tra người khác đã sửa chưa
   * opt.cu: bản ghi máy này đang thấy (để mô tả xung đột) ; opt.moTa: giá trị mình định ghi, vd "Khang Việt"
   * Xung đột → hỏi "Giữ hay đổi"; chọn giữ → lỗi có e.daGiu = true (nơi gọi không cần báo lỗi). */
  function goi(action, data, opt) {
    if (!caiDat.url) return Promise.reject(new Error('Chưa dán URL Apps Script ở màn Cài đặt.'));
    opt = opt || {};
    data = data || {};
    // Thao tác Admin: kèm mã Admin của máy này (chưa có thì hỏi)
    if (coAdmin() && (HD_ADMIN[action] || opt.admin) && data._maAdmin === undefined) {
      if (!maAdmin) return hoiMaAdmin('').then(function (ma) { return goi(action, Object.assign({}, data, { _maAdmin: ma }), opt); });
      data = Object.assign({}, data, { _maAdmin: maAdmin });
    }
    if (opt.pb && nhieuNguoi() && !data._ghiDe) data = Object.assign({}, data, { _pb: opt.pb });
    datTrangThai('syncing');
    return fetch(caiDat.url, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: data, nguoi: caiDat.toiLa || '' })
    })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (j && (j.xungDot || j.comboTrung)) {
          nhanMoc(j);
          if (j.catalog) nhanCatalog(j.catalog, { nguon: 'ghi' });
          datTrangThai('ok');
          var ex = new Error(j.xungDot ? 'Người khác vừa sửa bản ghi này.' : 'Đã có combo cùng thành phần.');
          ex.xungDot = j.xungDot; ex.comboTrung = j.comboTrung; ex.daXuLy = true;
          throw ex;
        }
        if (j && !j.ok && RE_LOI_ADMIN.test(j.error || '')) {
          datTrangThai('ok');
          var ea = new Error(String(j.error).replace(RE_LOI_ADMIN, ''));
          ea.maLoi = RE_LOI_ADMIN.exec(j.error)[1]; ea.daXuLy = true;
          if (ea.maLoi === 'CHUA_DAT_MA_ADMIN' && may.adminDaDatMa !== false) { may.adminDaDatMa = false; phat('admin'); }
          throw ea;
        }
        if (!j || !j.ok) throw new Error((j && j.error) || 'Lỗi không rõ');
        if (data._maAdmin && data._maAdmin !== maAdmin) luuMaAdmin(data._maAdmin); // mã vừa nhập đúng → nhớ trên máy này
        var moi = nhanMoc(j);
        if (j.catalog && moi) nhanCatalog(j.catalog, { nguon: 'ghi' });
        datTrangThai('ok');
        return j;
      })
      .catch(function (e) {
        if (e.daXuLy) throw e;
        var msg = moTaLoi(e);
        datTrangThai('error', msg);
        throw new Error(msg);
      })
      .catch(function (e) {
        // Sai mã / thiếu mã Admin → hỏi lại mã rồi thử lại (hủy thì dừng)
        if ((e.maLoi === 'SAI_MA_ADMIN' || e.maLoi === 'CAN_MA_ADMIN') && coAdmin() && !opt.khongHoiLai) {
          if (e.maLoi === 'SAI_MA_ADMIN') luuMaAdmin('');
          return hoiMaAdmin(e.message).then(function (ma) { return goi(action, Object.assign({}, data, { _maAdmin: ma }), opt); });
        }
        if (!e.xungDot || !opt.pb) throw e;
        return hoiXungDot(e.xungDot, opt).then(function (ghiDe) {
          if (ghiDe) return goi(action, Object.assign({}, data, { _ghiDe: true, _pb: undefined }), opt);
          var giu = new Error('Đã giữ thay đổi của ' + (e.xungDot[0].nguoi_sua || 'người khác') + '.');
          giu.daGiu = true;
          throw giu;
        });
      });
  }

  /* ---------- Xung đột: "A vừa đổi X thành Hồng Ân lúc 8:45. Giữ hay đổi thành Khang Việt?" ---------- */
  var TEN_NHA = Object.assign(Object.create(root.PhanLoai.TEN_NHA), { KHONG_NHAP: 'Không nhập', KHAC: 'nhà khác' }); // + sổ nhà dùng chung
  function gioPhut(s) {
    var m = /(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/.exec(String(s || ''));
    if (!m) return '';
    var d = new Date(), hn = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    var g = Number(m[4]) + ':' + m[5];
    return m[1] + '-' + m[2] + '-' + m[3] === hn ? g : g + ' ngày ' + m[3] + '/' + m[2];
  }
  function tenBanGhi(x) {
    var r = x.ban_ghi || {};
    if (x.loai === 'combo') return 'combo "' + (r.ten_combo || x.khoa) + '"';
    var ten = r.ten_sach || r.ten || x.khoa.replace(/^(sku|ten):/, '');
    return '"' + String(ten).slice(0, 60) + '"';
  }
  function moTaXungDot(x, cu) {
    var r = x.ban_ghi, ai = x.nguoi_sua || 'Người khác', luc = gioPhut(x.cap_nhat);
    var ten = tenBanGhi(x.da_xoa && cu ? { loai: x.loai, khoa: x.khoa, ban_ghi: cu } : x);
    var lam, giu = 'Giữ bản của ' + ai;
    if (x.da_xoa) { lam = 'xóa ' + ten; giu = 'Để xóa như ' + ai; }
    else if (x.loai === 'sku' && r && (!cu || cu.nha !== r.nha) && TEN_NHA[r.nha]) { lam = 'đổi ' + ten + ' thành ' + TEN_NHA[r.nha]; giu = 'Giữ ' + TEN_NHA[r.nha]; }
    else if (x.loai === 'sku' && r && cu && cu.ten_sach !== r.ten_sach) lam = 'đặt tên sách ' + ten;
    else lam = 'sửa ' + ten;
    return { cau: ai + ' vừa ' + lam + (luc ? ' lúc ' + luc : '') + '.', giu: giu };
  }
  function hoiXungDot(ds, opt) {
    var x = ds[0], m = moTaXungDot(x, opt.cu);
    var doi = opt.moTa ? 'Đổi thành ' + opt.moTa : 'Ghi bản của tôi';
    var hoi = root.App && root.App.hoi;
    var cau = m.cau + (ds.length > 1 ? '\n(và ' + (ds.length - 1) + ' bản ghi khác cũng vừa bị sửa)' : '') +
      '\n\n' + (opt.moTa ? m.giu + ' hay đổi thành ' + opt.moTa + '?' : 'Giữ bản của ' + (x.nguoi_sua || 'người khác') + ' hay ghi đè bằng bản của bạn?');
    if (!hoi) return Promise.resolve(root.confirm ? root.confirm(cau) : false);
    return hoi(cau, doi, { huy: m.giu, nhe: true, tieuDe: '⚠️ Có người vừa sửa' });
  }

  /* Hỏi mã Admin (hộp thoại của App). Hủy → lỗi daHuy */
  function hoiMaAdmin(loi) {
    var f = root.App && root.App.hoiMaAdmin;
    var p = f ? f(loi) : Promise.resolve(root.prompt ? root.prompt('Mã Admin:') : null);
    return p.then(function (ma) {
      if (!ma) { var e = new Error('Đã hủy – thao tác này cần mã Admin.'); e.daHuy = true; throw e; }
      return ma;
    });
  }
  /* Đăng nhập Admin trên máy này: kiểm tra mã ở Apps Script rồi mới nhớ */
  function dangNhapAdmin(ma) { return goi('kiemTraMaAdmin', { _maAdmin: ma }, { khongHoiLai: true }).then(function () { luuMaAdmin(ma); return true; }); }

  /* Phiên bản đang thấy của bản ghi (để gửi kèm khi lưu) */
  function timSku(key) { return catalog.skus.filter(function (e) { return e.key === key; })[0] || null; }
  function timCombo(id) { return catalog.combos.filter(function (c) { return c.combo_id === id; })[0] || null; }
  function pbSku(keys, rec) {
    var o = {};
    [].concat(keys).forEach(function (k) { if (k) { var e = rec && rec.key === k ? rec : timSku(k); o['sku|' + k] = e ? e.phien_ban || 0 : 0; } });
    return o;
  }
  function pbCombo(id, rec) {
    var o = {}, c = rec || timCombo(id);
    if (id) o['combo|' + id] = c ? c.phien_ban || 0 : 0;
    return o;
  }

  function docGet(thamSo) {
    if (!caiDat.url) return Promise.reject(new Error('Chưa dán URL Apps Script ở màn Cài đặt.'));
    var u = caiDat.url + (caiDat.url.indexOf('?') >= 0 ? '&' : '?') + thamSo;
    return fetch(u, { method: 'GET', redirect: 'follow', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || 'Lỗi không rõ');
        return j;
      })
      .catch(function (e) { throw new Error(moTaLoi(e)); });
  }

  /* 100 thay đổi gần nhất (sheet LICH_SU) */
  function lichSu() {
    return docGet('action=lichSu').then(function (j) { return j.lich_su || []; });
  }

  /* Lịch sử đặt hàng (sheet LS_DAT_HANG) từ ngày tu → { cot, dong, tongDong, canhBaoLon, ngayCuNhat } */
  function lichSuDatHang(tu) {
    return docGet('action=lichSuDatHang' + (tu ? '&tu=' + encodeURIComponent(tu) : ''));
  }

  function luuCaiDat(moi) {
    var doiUrl = moi.url !== undefined && moi.url !== caiDat.url;
    Object.assign(caiDat, moi);
    if (moi.maKhac && !(may.api >= 6)) root.PhanLoai.datNha(root.PhanLoai.nhaMacDinh(moi.maKhac)); // chưa có sổ nhà: như cũ
    ghiLS(LS_CAIDAT, caiDat);
    if (doiUrl) { may.api = null; may.rev = 0; may.urlRev = ''; }
    phat('caidat');
    if (doiUrl) taiLai();
  }

  // Áp sổ nhà ngay khi tải (trước lần phân loại đầu tiên)
  if (!(soNhaMay && apSoNha(soNhaMay))) root.PhanLoai.datNha(root.PhanLoai.nhaMacDinh(caiDat.maKhac));

  root.DanhMuc = {
    get catalog() { return catalog; },
    get caiDat() { return caiDat; },
    get trangThai() { return trangThai; },
    coTheGhi: function () { return !!caiDat.url; },
    get api() { return may.api; },
    get rev() { return may.rev; },
    nhieuNguoi: nhieuNguoi,
    canCapNhatAppsScript: function () { return !!caiDat.url && may.api !== null && may.api < 7; },
    coAdmin: coAdmin,
    coBanHang: coBanHang,
    coNha: function () { return !!(caiDat.url && may.api >= 6); },
    coKhaiBaoLo: function () { return !!(caiDat.url && may.api >= 7); },
    get soNha() { return root.PhanLoai.DS_NHA; },
    nhanNha: nhanNha,
    get deSau() { return deSau; },
    nhanDeSau: nhanDeSau,
    get coMaAdmin() { return !!maAdmin; },
    get adminDaDatMa() { return may.adminDaDatMa; },
    get caiDatChung() { return may.caiDatChung; },
    dangNhapAdmin: dangNhapAdmin,
    dangXuatAdmin: function () { luuMaAdmin(''); },
    nhanCaiDatChung: nhanCaiDatChung,
    get nguoiDung() { return nguoiDung; },
    nhanNguoiDung: nhanNguoiDung,
    coDot: coDot,
    vaiTro: vaiTro,
    docGet: docGet,
    dongBo: dongBo,
    batDongBo: batDongBo,
    pbSku: pbSku,
    pbCombo: pbCombo,
    timSku: timSku,
    timCombo: timCombo,
    gioPhut: gioPhut,
    moTaXungDot: moTaXungDot,
    lichSu: lichSu,
    lichSuDatHang: lichSuDatHang,
    taiLai: taiLai,
    goi: goi,
    luuCaiDat: luuCaiDat,
    chuanHoa: chuanHoa,
    nghe: function (f) { nghe.push(f); }
  };
})(typeof self !== 'undefined' ? self : this);
