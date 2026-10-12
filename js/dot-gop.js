/* Đợt đặt hàng – phần thuần (chạy được bằng Node để kiểm thử):
 * - dongGui(files): danh sách dòng ĐÃ CHUẨN HÓA để "Báo xong" (không thông tin khách, không file gốc)
 * - gopPhan(phans): gộp phần của nhiều người thành các "file ảo" cho màn Tách đơn; đánh dấu trùng giữa các người
 *   (cùng sàn + mã đơn ; file web cùng dấu nhận dạng) – người gửi TRƯỚC được giữ, người sau bị bỏ phần trùng. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DotGop = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // nguồn, mã đơn, barcode/SKU, tên sàn, phân loại, giá, SL, ngày đặt, tên file, nhà cung cấp (web), ngày xuất (web), dấu file web
  var COT = ['san', 'ma_don', 'sku', 'ten', 'phan_loai', 'gia', 'sl', 'ngay_dat', 'file', 'ncc', 'ngay_xuat', 'web_key'];

  /* Dấu nhận dạng file web (từ thời gian xuất + nội dung) – ngắn gọn, đủ để so trùng */
  function dauFileWeb(s) {
    s = String(s || '');
    var h1 = 0x811c9dc5, h2 = 0x01000193 ^ s.length;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
    }
    return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8);
  }

  /* files: S.files sau khi gộp (p.rows = dòng thật sự dùng: đã lọc trạng thái Shopee, đã bỏ đơn trùng giữa các file) */
  function dongGui(files) {
    var dong = [], nguon = [], don = {};
    (files || []).forEach(function (p) {
      if (p.error || !p.rows) return;
      if (nguon.indexOf(p.san) < 0) nguon.push(p.san);
      var wk = p.san === 'Web' ? dauFileWeb(p.webKey) : '';
      p.rows.forEach(function (r) {
        dong.push([r.san || p.san, r.orderId || '', r.sku || '', r.ten || '', r.phanLoai || '', Number(r.gia) || 0, Number(r.sl) || 0,
                   r.ngayDat || '', r.file || p.file || '', r.ncc || '', r.ngayXuat || '', wk]);
        if (r.orderId) don[(r.san || p.san) + ':' + r.orderId] = 1;
        else if (wk) don['web#' + wk] = 1;
      });
    });
    return { cot: COT.slice(), dong: dong, nguon: nguon, soDon: Object.keys(don).length };
  }

  /* 1 dòng đã lưu → dòng giống DocFile đọc ra */
  function rowTuDong(cot, a) {
    var o = {};
    cot.forEach(function (c, i) { o[c] = a[i]; });
    var r = { san: String(o.san || ''), orderId: String(o.ma_don || ''), sku: String(o.sku || ''), ten: String(o.ten || ''), phanLoai: String(o.phan_loai || ''),
              gia: Number(o.gia) || 0, sl: Number(o.sl) || 0, file: String(o.file || '') };
    if (o.ngay_dat) r.ngayDat = String(o.ngay_dat);
    if (r.san === 'Web') { r.ncc = String(o.ncc || ''); if (o.ngay_xuat) r.ngayXuat = String(o.ngay_xuat); }
    r.webKey = String(o.web_key || '');
    return r;
  }

  /* phans: [{ nguoi, gui_luc, trang_thai, cot, dong }]. Trả về
   *   files: file ảo theo thứ tự gửi (mỗi người × mỗi sàn; web: mỗi file web) – đưa vào DocFile.gopFile để bỏ đơn trùng
   *   trung: [{ nguoi, voi, so_don }] – số đơn của "nguoi" trùng với phần "voi" (gửi trước) ; tongTrung */
  function gopPhan(phans) {
    var ds = (phans || []).filter(function (p) { return p.dong && p.dong.length; }).slice()
      .sort(function (a, b) { return String(a.gui_luc) < String(b.gui_luc) ? -1 : String(a.gui_luc) > String(b.gui_luc) ? 1 : 0; });
    var chuDon = {}, chuWeb = {}, dem = {}, files = [], id = 0;
    function demTrung(nguoi, voi) { var k = nguoi + '\u0001' + voi; dem[k] = (dem[k] || 0) + 1; }
    ds.forEach(function (p) {
      var theoSan = {}, web = {}, daDem = {};
      p.dong.forEach(function (a) {
        var r = rowTuDong(p.cot, a);
        if (r.san === 'Web' && !r.orderId) {
          var wk = r.webKey || 'khong-dau';
          (web[wk] = web[wk] || []).push(r);
          return;
        }
        var kd = r.orderId ? r.san + ':' + r.orderId : '';
        if (kd && chuDon[kd] && chuDon[kd] !== p.nguoi && !daDem[kd]) { daDem[kd] = 1; demTrung(p.nguoi, chuDon[kd]); }
        (theoSan[r.san] = theoSan[r.san] || []).push(r);
      });
      Object.keys(theoSan).forEach(function (san) {
        var rows = theoSan[san];
        rows.forEach(function (r) { var kd = r.orderId ? r.san + ':' + r.orderId : ''; if (kd && !chuDon[kd]) chuDon[kd] = p.nguoi; });
        files.push({ id: ++id, san: san, file: p.nguoi + ' · ' + san, nguoi: p.nguoi, rows: rows, rowsTatCa: rows, error: null });
      });
      Object.keys(web).forEach(function (wk) {
        if (wk !== 'khong-dau' && chuWeb[wk] && chuWeb[wk] !== p.nguoi) { demTrung(p.nguoi, chuWeb[wk]); return; } // file web người khác đã gửi → bỏ cả file
        if (wk !== 'khong-dau') chuWeb[wk] = p.nguoi;
        var rows = web[wk];
        files.push({ id: ++id, san: 'Web', file: p.nguoi + ' · Web' + (rows[0] && rows[0].file ? ' (' + rows[0].file + ')' : ''), nguoi: p.nguoi,
                     rows: rows, rowsTatCa: rows, webKey: wk, ngayXuat: rows[0] && rows[0].ngayXuat, error: null });
      });
    });
    var trung = Object.keys(dem).map(function (k) { var x = k.split('\u0001'); return { nguoi: x[0], voi: x[1], so_don: dem[k] }; });
    return { files: files, trung: trung, tongTrung: trung.reduce(function (s, x) { return s + x.so_don; }, 0) };
  }

  /* Ngày VN hôm nay (yyyy-MM-dd) – đợt = 1 ngày */
  function homNayVN(d) {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date()); }
    catch (e) { var x = new Date((d || new Date()).getTime() + 7 * 3600e3); return x.toISOString().slice(0, 10); }
  }
  function ngayNgan(id) { var p = String(id || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : String(id || ''); }
  function ngayDate(id) { var p = String(id || '').split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2], 12) : new Date(); }

  return { COT: COT, dauFileWeb: dauFileWeb, dongGui: dongGui, rowTuDong: rowTuDong, gopPhan: gopPhan, homNayVN: homNayVN, ngayNgan: ngayNgan, ngayDate: ngayDate };
});
