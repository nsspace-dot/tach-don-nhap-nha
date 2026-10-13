/* Lịch sử bán – phần thuần (chạy được bằng Node để kiểm thử):
 * - maHoa(files): dòng đơn đã chuẩn hóa của MỌI sách (kể cả nhà khác) → khối gọn { sp, d } để lưu khi chốt đợt / nạp file cũ
 * - tongHop(khoi, catalog, settings): giải mã + bỏ trùng toàn lịch sử + phân loại lại theo DANH MỤC MỚI NHẤT
 * - duBao(th, ngay, soNgayTheoNha): mỗi cuốn 1 dòng – bán 7 / 30 ngày, TB/ngày (trọng số 28 ngày), xu hướng, gợi ý đặt
 * - choKhaiBao(th, deSau): các việc khai báo để sau (combo nhà khác, combo trộn thiếu phần nhà khác, dòng để sau, tên, barcode)
 * Không có thông tin khách. */
(function (root, factory) {
  var api = factory(typeof require === 'function' ? require('./phanloai.js') : root.PhanLoai,
                    typeof require === 'function' ? require('./dot-gop.js') : root.DotGop);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BanHang = api;
})(typeof self !== 'undefined' ? self : this, function (PL, DG) {
  'use strict';

  var NHA = ['HA', 'KV', 'ML'];
  function sach(v) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim(); }
  function d2s(d) { return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function s2d(s) { var p = String(s).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function congNgay(s, n) { var d = s2d(s); d.setUTCDate(d.getUTCDate() + n); return d2s(d); }
  function cachNgay(a, b) { return Math.round((s2d(b) - s2d(a)) / 864e5); }
  function laNgay(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

  /* Khóa 1 dòng bán – PHẢI khớp khoaBan_ trong Code.gs */
  function khoa(sp, d) {
    if (sp[0] === 'Web' && !d[1]) return 'web#' + sach(d[4]) + '|' + sach(sp[1]).toUpperCase() + '|' + sach(sp[2]).toLowerCase();
    return sp[0] + ':' + sach(d[1]) + '|' + sach(sp[1]).toUpperCase() + '|' + sach(sp[2]).toLowerCase() + '|' + sach(sp[3]).toLowerCase();
  }

  /* files: [{ san, rows, webKey, error }] (S.files sau gộp, hoặc file ảo khi gộp đợt). ngayMacDinh: ngày dùng khi dòng không có ngày đặt.
   * Bỏ hàng không phải sách (lịch, tranh, decal, trà…) và dòng SL ≤ 0. */
  function maHoa(files, ngayMacDinh) {
    var sp = [], map = {}, d = [];
    (files || []).forEach(function (p) {
      if (p.error || !p.rows) return;
      var wkFile = p.webKey ? DG.dauFileWeb(p.webKey) : '';
      p.rows.forEach(function (r) {
        var sl = Number(r.sl) || 0;
        if (sl <= 0 || PL.isNotBook(r.ten)) return;
        var san = r.san || p.san;
        var x = [san, sach(r.sku), sach(r.ten), sach(r.phanLoai), Number(r.gia) || 0, san === 'Web' ? sach(r.ncc) : ''];
        var ks = JSON.stringify(x);
        if (!(ks in map)) { map[ks] = sp.length; sp.push(x); }
        var ngay = laNgay(r.ngayDat) ? r.ngayDat : laNgay(r.ngayXuat) ? r.ngayXuat : ngayMacDinh || '';
        d.push([map[ks], sach(r.orderId), sl, ngay, san === 'Web' && !r.orderId ? (r.webKey && r.webKey.length === 16 ? r.webKey : wkFile) : '']);
      });
    });
    return { sp: sp, d: d };
  }

  /* khoi: [{ ngay, nguon, du_lieu: { sp, d } }] (+ themRows: dòng đang mở trên máy, đã ở dạng DocFile)
   * → { kq: kết quả phân loại (kèm nhà khác), rows, ngayMin, ngayMax, soDong } */
  /* Để nhanh: phân loại theo SẢN PHẨM (cùng nguồn + SKU + tên + phân loại + giá + nhà cung cấp) – 1 dòng đại diện mang
   * tổng SL; số bán theo ngày (_ngay), số đơn (_don), lần cuối gặp giữ riêng. Kết quả phân loại không phụ thuộc số lượng. */
  function tongHop(khoi, catalog, settings, themRows) {
    var ds = (khoi || []).slice().sort(function (a, b) { return a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : 0; });
    var daCo = {}, rows = [], theoSp = {}, ngayMin = '', ngayMax = '', soDong = 0;
    function them(r, k) {
      if (daCo[k]) return;
      daCo[k] = 1;
      soDong++;
      var ngay = r.ngayDat || r.ngayXuat || '';
      if (ngay) { if (!ngayMin || ngay < ngayMin) ngayMin = ngay; if (ngay > ngayMax) ngayMax = ngay; }
      var ks = JSON.stringify([r.san, sach(r.sku), sach(r.ten), sach(r.phanLoai), Number(r.gia) || 0, r.san === 'Web' ? sach(r.ncc) : '']);
      var dd = theoSp[ks];
      if (!dd) {
        dd = theoSp[ks] = { san: r.san, orderId: '', sku: sach(r.sku), ten: sach(r.ten), phanLoai: sach(r.phanLoai), gia: Number(r.gia) || 0, sl: 0,
                            _ngay: {}, _don: {}, _soDon: 0, _lanCuoi: '' };
        if (r.san === 'Web') dd.ncc = sach(r.ncc);
        rows.push(dd);
      }
      var sl = Number(r.sl) || 0;
      dd.sl += sl;
      if (ngay) dd._ngay[ngay] = (dd._ngay[ngay] || 0) + sl;
      var kd = r.orderId ? r.orderId : 'w' + soDong;
      if (!dd._don[kd]) { dd._don[kd] = 1; dd._soDon++; }
      if (ngay > dd._lanCuoi) { dd._lanCuoi = ngay; dd.ngayDat = ngay; if (r.san === 'Web') dd.ngayXuat = ngay; }
    }
    ds.forEach(function (b) {
      var dl = b.du_lieu || {}, sp = dl.sp || [];
      (dl.d || []).forEach(function (x) {
        var p = sp[x[0]];
        if (!p) return;
        var r = { san: p[0], orderId: sach(x[1]), sku: p[1], ten: p[2], phanLoai: p[3], gia: Number(p[4]) || 0, sl: Number(x[2]) || 0,
                  ngayDat: laNgay(x[3]) ? x[3] : (laNgay(b.ngay) ? b.ngay : '') };
        if (p[0] === 'Web') { r.ncc = p[5] || ''; r.ngayXuat = r.ngayDat; r.webKey = sach(x[4]); }
        them(r, khoa(p, x));
      });
    });
    // Dòng đang mở trên máy (chưa chốt): r.webKey = dấu file web (16 ký tự)
    (themRows || []).forEach(function (r) {
      if (!(Number(r.sl) > 0) || PL.isNotBook(r.ten)) return;
      var sp = [r.san, sach(r.sku), sach(r.ten), sach(r.phanLoai)], x = [0, sach(r.orderId), 0, '', sach(r.webKey)];
      them(r, khoa(sp, x));
    });
    rows.forEach(function (r) { delete r._don; });
    var kq = PL.classify(rows, catalog || {}, Object.assign({}, settings || {}, { caNhaKhac: true }));
    return { kq: kq, rows: rows, ngayMin: ngayMin, ngayMax: ngayMax, soDong: soDong };
  }

  /* ---------- Dự báo nhập kho ----------
   * Cửa sổ kết thúc ở ngayCuoi (hôm nay nếu đã có số liệu hôm nay, không thì hôm qua).
   * TB/ngày: trung bình có trọng số 28 ngày (ngày gần nặng hơn: 28, 27, …, 1). Xu hướng: 7 ngày gần nhất so với 7 ngày trước đó.
   * Gợi ý = làm tròn lên (TB/ngày × số ngày muốn đủ bán). Cần ≥ 14 ngày dữ liệu – thiếu thì vẫn tính, chỉ đánh dấu. */
  var SO_NGAY_TB = 28, NGAY_TOI_THIEU = 14;
  function khoaCuon(g) { var s = PL.clean(g.sku); return PL.isBarcode(s) ? s.toUpperCase() : 'ten:' + PL.norm(g.tenGon || g.ten); }
  function nhomTheoCuon(list) {
    var m = new Map();
    (list || []).forEach(function (g) {
      var k = khoaCuon(g), c = m.get(k);
      if (!c) { c = { khoa: k, ten: g.tenGon || g.ten, sku: g.sku, gia: Number(g.gia) || 0, ngay: {}, chuaCoTen: g.chuaCoTen, _giaNgay: '' }; m.set(k, c); }
      (g.nguon || []).forEach(function (src) {
        var r = src.row || {}, heSo = r.sl ? (Number(src.sl) || 0) / r.sl : 0; // thành phần combo: × số cuốn mỗi combo
        Object.keys(r._ngay || {}).forEach(function (ngay) {
          c.ngay[ngay] = (c.ngay[ngay] || 0) + r._ngay[ngay] * heSo;
          if (ngay >= c._giaNgay && Number(g.gia)) { c._giaNgay = ngay; c.gia = Number(g.gia); } // giá bìa mới nhất
        });
      });
    });
    return Array.from(m.values());
  }
  function duBao(th, homNay, soNgayTheoNha) {
    homNay = homNay || DG.homNayVN();
    var ngayCuoi = th.ngayMax && th.ngayMax >= homNay ? homNay : congNgay(homNay, -1);
    var soNgayDuLieu = th.ngayMin ? cachNgay(th.ngayMin, ngayCuoi) + 1 : 0;
    var tongW = SO_NGAY_TB * (SO_NGAY_TB + 1) / 2;
    var tatCa = {};
    NHA.forEach(function (n) { tatCa[n] = th.kq.nha[n] || []; });
    Object.keys(th.kq.nhaKhac || {}).forEach(function (n) { tatCa[n] = th.kq.nhaKhac[n]; });
    var out = { ngayCuoi: ngayCuoi, soNgayDuLieu: soNgayDuLieu, duDuLieu: soNgayDuLieu >= NGAY_TOI_THIEU, nha: {} };
    Object.keys(tatCa).forEach(function (n) {
      var soNgay = Number((soNgayTheoNha || {})[n]) || 7;
      var ds = nhomTheoCuon(tatCa[n]).map(function (c) {
        var b7 = 0, b30 = 0, truoc7 = 0, ts = 0;
        Object.keys(c.ngay).forEach(function (d) {
          var tuoi = cachNgay(d, ngayCuoi); // 0 = ngày cuối
          if (tuoi < 0) return;
          var v = c.ngay[d];
          if (tuoi < 7) b7 += v; else if (tuoi < 14) truoc7 += v;
          if (tuoi < 30) b30 += v;
          if (tuoi < SO_NGAY_TB) ts += (SO_NGAY_TB - tuoi) * v;
        });
        var tb = ts / tongW;
        var xh = b7 === truoc7 ? 'deu' : truoc7 === 0 ? 'tang' : b7 > truoc7 * 1.2 ? 'tang' : b7 < truoc7 * 0.8 ? 'giam' : 'deu';
        return { khoa: c.khoa, ten: c.ten, sku: c.sku, gia: c.gia, b7: b7, b30: b30, truoc7: truoc7, tb: tb, xuHuong: xh,
                 goiY: tb > 0 ? Math.ceil(tb * soNgay - 1e-9) : 0 };
      }).filter(function (c) { return c.b30 > 0; });
      if (ds.length) out.nha[n] = { soNgay: soNgay, ds: ds };
    });
    return out;
  }

  /* ---------- Chờ khai báo ----------
   * deSau: { khóa dòng: 1 } – dòng chưa rõ nhà người dùng bấm "⏭ Để sau" */
  function thongTin(lines) {
    var ngay = '', san = [], soLan = 0, da = [];
    (lines || []).forEach(function (r) {
      if (!r || da.indexOf(r) >= 0) return;
      da.push(r);
      if ((r._lanCuoi || '') > ngay) ngay = r._lanCuoi;
      if (san.indexOf(r.san) < 0) san.push(r.san);
      soLan += r._soDon || 0;
    });
    return { soLan: soLan, lanCuoi: ngay, nguon: san };
  }
  function choKhaiBao(th, deSau) {
    var kq = th.kq, out = [];
    deSau = deSau || {};
    function them(loai, ten, g, rows, extra) { out.push(Object.assign({ loai: loai, ten: ten, g: g }, thongTin(rows), extra || {})); }
    // 1. Combo nhà khác chưa khai báo
    kq.boQua.forEach(function (g) {
      if (g.isCombo && /^Nhà khác/.test(g.lyDo)) them('combo_khac', g.tenGon || g.ten, g, g.lines.map(function (l) { return l.row; }), { ghiChu: g.lyDo });
    });
    // 2. Combo trộn nhà đã khai báo nhưng còn thiếu phần nhà khác
    var tron = {};
    kq.lines.forEach(function (ln) {
      if (ln.loai !== 'tach_combo' || !ln.tronNha) return;
      if (ln.combo.thanh_phan.some(function (t) { return NHA.indexOf(t.nha) < 0; })) return;
      (tron[ln.combo.combo_id] = tron[ln.combo.combo_id] || { combo: ln.combo, rows: [] }).rows.push(ln.row);
    });
    Object.keys(tron).forEach(function (id) {
      them('combo_thieu', tron[id].combo.ten_combo, tron[id].combo, tron[id].rows, { ghiChu: 'còn thiếu phần nhà khác' });
    });
    // 3. Dòng "để sau"
    kq.chuaRo.forEach(function (g) {
      if (deSau[g.key]) them('de_sau', g.tenGon || g.ten, g, g.lines.map(function (l) { return l.row; }), { ghiChu: 'để sau – chưa rõ nhà' });
    });
    // 4–5. Sách nhà khác chưa có tên khai báo / barcode thiếu
    Object.keys(kq.nhaKhac || {}).forEach(function (ma) {
      kq.nhaKhac[ma].forEach(function (g) {
        var rows = (g.nguon || []).map(function (s) { return s.row; }).filter(Boolean);
        var le = (g.nguon || []).some(function (s) { return s.row && !s.combo; });
        if (le && g.skuLa) them('barcode', g.tenGon, g, rows, { nha: ma, ghiChu: 'thiếu barcode (SKU trống / dạng chữ)' });
        else if (g.chuaCoTen && g.khoaTen) them('ten', g.tenGon, g, rows, { nha: ma, ghiChu: 'chưa có tên khai báo' });
      });
    });
    // Barcode sai số kiểm tra (mọi nhà)
    (kq.listingCanSua || []).forEach(function (l) {
      if (l.lyDo !== 'mã sai số kiểm tra') return;
      var rows = th.rows.filter(function (r) { return r.san === l.san && PL.clean(r.sku).toUpperCase() === l.maCu && r.ten === l.ten; }); // dòng đại diện
      them('barcode_sai', PL.tenGon(l.ten, kq.maKhac), l, rows, { ghiChu: 'barcode ' + l.maCu + ' sai số kiểm tra' });
    });
    return out.sort(function (a, b) { return b.soLan - a.soLan || (b.lanCuoi < a.lanCuoi ? -1 : 1); });
  }

  return { khoa: khoa, maHoa: maHoa, tongHop: tongHop, duBao: duBao, choKhaiBao: choKhaiBao, khoaCuon: khoaCuon, congNgay: congNgay, cachNgay: cachNgay };
});
