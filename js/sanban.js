/* Thống kê bán theo ngày (tab "🛒 Sàn bán gì") – phần thuần, chạy được bằng Node để kiểm thử:
 * - nganh(ten): Sách | Lịch | Tranh | Decal | Trà | Khác
 * - khoaTen(ten, pl): khóa gộp theo TÊN + PHÂN LOẠI đã làm gọn (dùng khi không có mã vạch hợp lệ)
 * - doanGian(tenFile, dsGian): tên gian nhận ra từ tên file (không nhận ra → '')
 * - maHoa(kq, opt): MỌI dòng trong file đã tải (sách mọi nhà, lịch, tranh, decal, trà…) → khối gọn { sp, d } gửi lên khi chốt đợt / nạp bù
 * - xoay(kq, loc): kết quả cộng dồn của Apps Script → bảng theo sản phẩm (Shopee | TikTok | Web | Tổng), thẻ tóm tắt, cơ hội
 * Không có thông tin khách. */
(function (root, factory) {
  var api = factory(typeof require === 'function' ? require('./phanloai.js') : root.PhanLoai,
                    typeof require === 'function' ? require('./dot-gop.js') : root.DotGop);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SanBan = api;
})(typeof self !== 'undefined' ? self : this, function (PL, DG) {
  'use strict';

  var SAN = ['Shopee', 'TikTok', 'Web'];
  var NGANH = ['Sách', 'Lịch', 'Tranh', 'Decal', 'Trà', 'Khác'];
  function sach(v) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim(); }
  function boDau(s) { return sach(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }

  /* Ngành hàng theo tên sản phẩm (cùng quy tắc "không phải sách" của màn Tách đơn) */
  function nganh(ten) {
    var t = PL.norm(ten);
    if (/^(sách|vở|truyện)/u.test(t)) return 'Sách';
    if (/lịch(?!\s*sử)|bloc/u.test(t)) return 'Lịch';
    if (/tranh|khung/u.test(t)) return 'Tranh';
    if (/decal/u.test(t)) return 'Decal';
    if (/trà /u.test(t)) return 'Trà';
    if (/thời khóa biểu|bài vị/u.test(t)) return 'Khác';
    return 'Sách';
  }

  /* Tên đã làm gọn: bỏ mã nhà đầu / cuối tên, "(1 cuốn)", "Mặc định", "Not Specified"… */
  function tatCaMaNha() {
    var out = [];
    PL.DS_NHA.forEach(function (x) { [x.ma].concat(x.ma_ten || []).forEach(function (c) { c = sach(c).toUpperCase(); if (c && out.indexOf(c) < 0) out.push(c); }); });
    return out;
  }
  function tenGon(ten, opt) {
    opt = opt || {};
    var s = sach(ten), ma = tatCaMaNha(), m;
    // mã nhà đứng đầu: "HA - Sách…", "[KV] …", "(ML) …"
    while ((m = /^[\[(]?\s*([\p{L}\p{N}]{1,8})\s*[\])]?\s*[-–—:|.]\s*/u.exec(s)) && ma.indexOf(m[1].toUpperCase()) >= 0 && s.length > m[0].length) s = s.slice(m[0].length);
    return PL.tenGoiY(s, '', opt.maKhac, opt.plVoNghia);
  }
  function plGon(pl, ten, opt) {
    opt = opt || {};
    return PL.plCoNghia(PL.boRac(pl, true), ten, opt.plVoNghia);
  }
  function khoaTen(ten, pl, opt) {
    var t = tenGon(ten, opt);
    return 'ten:' + PL.norm(t) + '|' + PL.norm(plGon(pl, t, opt));
  }

  /* dsGian: ["Tên gian = từ khóa 1, từ khóa 2", "Tên gian khác"] (không có "=" → từ khóa là chính tên gian).
   * So không dấu, không phân biệt hoa thường, bỏ ký tự phân cách. Nhiều gian khớp → lấy từ khóa dài nhất. */
  function chuanSo(s) { return boDau(s).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function doanGian(tenFile, dsGian) {
    var f = ' ' + chuanSo(String(tenFile || '').replace(/\.xlsx?$/i, '')) + ' ', hay = '', dai = 0;
    (dsGian || []).forEach(function (dong) {
      var i = String(dong).indexOf('='), ten = sach(i >= 0 ? String(dong).slice(0, i) : dong);
      if (!ten) return;
      (i >= 0 ? String(dong).slice(i + 1).split(/[,;]/) : [ten]).forEach(function (k) {
        k = chuanSo(k);
        if (k && k.length > dai && (f.indexOf(' ' + k + ' ') >= 0 || f.replace(/ /g, '').indexOf(k.replace(/ /g, '')) >= 0)) { hay = ten; dai = k.length; }
      });
    });
    return hay;
  }

  /* Dấu 1 dòng đơn (sàn + mã đơn + dòng sản phẩm ; web không mã đơn: dấu file + sách) – 12 ký tự */
  function dauDong(r) {
    var sku = r.skuCu !== undefined ? (r.skuCu === '(trống)' ? '' : r.skuCu) : r.sku; // SKU gốc trên sàn (không đổi khi gán barcode về sau)
    var s = r.san === 'Web' && !r.orderId
      ? 'web#' + sach(r.webKey || r.ngayXuat) + '|' + sach(sku).toUpperCase() + '|' + sach(r.ten).toLowerCase()
      : r.san + ':' + sach(r.orderId) + '|' + sach(sku).toUpperCase() + '|' + sach(r.ten).toLowerCase() + '|' + sach(r.phanLoai).toLowerCase();
    return DG.dauFileWeb(s).slice(0, 12);
  }

  /* kq: kết quả PL.classify (dùng kq.lines = MỌI dòng, trước bước lọc "chỉ nhà đặt hằng ngày").
   * opt: { catalog, maKhac, plVoNghia }. Dòng có r.ngayTk → gửi kèm ngày riêng (nạp bù chia theo ngày đặt).
   * → { sp: [[sàn, gian, khoa_sp, tên, phân loại, barcode, ngành, nhà, nhóm, combo]], d: [[chỉ số sp, dấu dòng, SL, doanh thu | null, chỉ số đơn | -1, ngày]] } */
  function maHoa(kq, opt) {
    opt = opt || {};
    var idx = PL.buildIndex(opt.catalog || {}), sp = [], map = {}, d = [], don = {}, soDon = 0;
    function tenKB(bc) { var e = idx.sku.get(PL.skuKey(bc)); return e && sach(e.ten_sach) ? sach(e.ten_sach) : ''; }
    ((kq && kq.lines) || []).forEach(function (ln) {
      var r = ln.row, sl = Number(r.sl) || 0;
      if (sl <= 0) return;
      var khoa, ten, pl = '', bc = '', ng, nha = '', nhom, cb = '';
      if (ln.combo) {
        // Combo đã khai báo: lưu nguyên combo + thành phần (tab xem tách từng cuốn hoặc nguyên combo)
        var c = ln.combo, dsNha = [];
        khoa = 'cb:' + c.combo_id; ten = sach(c.ten_combo) || tenGon(r.ten, opt); ng = 'Sách'; nhom = khoa;
        var tp = (c.thanh_phan || []).map(function (t) {
          var ma = sach(t.sku) ? PL.maMoiNhat(idx, t.sku) : '', hop = PL.barcodeHopLe(ma);
          var n = t.nha === 'KHAC' ? '' : sach(t.nha);
          if (n && dsNha.indexOf(n) < 0) dsNha.push(n);
          var tenTp = (hop && tenKB(ma)) || tenGon(t.ten, opt) || ma;
          return [hop ? 'bc:' + ma : khoaTen(t.ten || ma, '', opt), tenTp, hop ? ma : '', n, Number(t.so_luong) || 1, Number(t.gia_goc) || 0];
        });
        if (c.cach_xuat === 'nguyen' && ln.nha) nha = ln.nha;
        else nha = dsNha.join('+');
        if (tp.length) cb = JSON.stringify(tp);
      } else {
        var ma2 = sach(r.sku).toUpperCase(), coMa = !ln.isCombo && PL.barcodeHopLe(ma2);
        var tg = tenGon(r.ten, opt);
        pl = plGon(r.phanLoai, tg, opt);
        if (coMa) { khoa = 'bc:' + ma2; bc = ma2; ten = tenKB(ma2) || sach(r.tenChuan) || tg; }
        else { khoa = 'ten:' + PL.norm(tg) + '|' + PL.norm(pl); ten = tg; }
        nhom = 'n:' + PL.norm(tg);
        nha = PL.laNha(ln.nha) ? ln.nha : sach(ln.nhaKhac);
        ng = nha ? 'Sách' : nganh(r.ten);
      }
      var gian = sach(r.gian), ks = r.san + '\u0001' + gian + '\u0001' + khoa, i = map[ks];
      if (i === undefined) { i = map[ks] = sp.length; sp.push([r.san, gian, khoa, ten, pl, bc, ng, nha, nhom, cb]); }
      var iDon = -1;
      if (r.orderId) {
        var kd = r.san + ':' + r.orderId;
        if (!(kd in don)) don[kd] = soDon++;
        iDon = don[kd];
      }
      var dt = r.doanhThu === undefined || r.doanhThu === null || r.doanhThu === '' || !isFinite(Number(r.doanhThu)) ? null : Math.round(Number(r.doanhThu));
      var dong = [i, dauDong(r), sl, dt, iDon];
      if (r.ngayTk) dong.push(r.ngayTk);
      d.push(dong);
    });
    return { sp: sp, d: d };
  }

  /* ---------- Xoay kết quả cộng dồn của Apps Script thành bảng ----------
   * kq: { sp: [[khoa, tên, pl, barcode, ngành, nhà, nhóm, làCombo]], d: [[i, sàn, gian, SL, đơn, DT, SL trước, DT trước]], don: [[sàn, gian, đơn, đơn trước]] }
   * loc: { nganh, nha, gian, tim, gopPl } → { hang: [...], the: { Shopee, TikTok, Web, Tong }, gian: [...], nha: [...], nganh: [...] } */
  function cong(a, b) { return a === null && b === null ? null : (a || 0) + (b || 0); }
  function gopKq(ds) {
    // ghép nhiều kết quả (kỳ đã lưu + đợt đang mở) thành 1
    var sp = [], map = {}, d = {}, thuTu = [], don = {};
    (ds || []).forEach(function (kq) {
      if (!kq) return;
      var doi = (kq.sp || []).map(function (p) { var i = map[p[0]]; if (i === undefined) { i = map[p[0]] = sp.length; sp.push(p); } return i; });
      (kq.d || []).forEach(function (x) {
        var id = doi[x[0]] + '\u0001' + x[1] + '\u0001' + x[2], g = d[id];
        if (!g) { g = d[id] = [doi[x[0]], x[1], x[2], 0, 0, null, 0, null]; thuTu.push(id); }
        g[3] += x[3] || 0; g[4] += x[4] || 0; g[5] = cong(g[5], x[5] === undefined ? null : x[5]);
        g[6] += x[6] || 0; g[7] = cong(g[7], x[7] === undefined ? null : x[7]);
      });
      (kq.don || []).forEach(function (x) {
        var k = x[0] + '\u0001' + x[1], o = don[k] || (don[k] = [x[0], x[1], 0, 0]);
        o[2] += x[2] || 0; o[3] += x[3] || 0;
      });
    });
    return { sp: sp, d: thuTu.map(function (id) { return d[id]; }), don: Object.keys(don).map(function (k) { return don[k]; }) };
  }
  function xoay(kq, loc) {
    loc = loc || {};
    var sp = (kq && kq.sp) || [], tim = boDau(loc.tim || ''), hang = {}, thuTu = [];
    var dsGian = {}, dsNha = {}, dsNganh = {};
    function theMoi() { return { don: 0, donTruoc: 0, sl: 0, dt: null, slTruoc: 0, dtTruoc: null, nha: {} }; }
    var the = { Shopee: theMoi(), TikTok: theMoi(), Web: theMoi(), Tong: theMoi() };
    var locSp = !!(loc.nganh || loc.nha || tim);
    ((kq && kq.d) || []).forEach(function (x) {
      var p = sp[x[0]];
      if (!p) return;
      var san = x[1], gian = x[2] || '';
      if (gian) dsGian[gian] = 1;
      String(p[5] || '').split('+').forEach(function (n) { if (n) dsNha[n] = 1; });
      dsNganh[p[4] || 'Sách'] = 1;
      if (loc.gian && gian !== loc.gian) return;
      if (loc.nganh && (p[4] || 'Sách') !== loc.nganh) return;
      if (loc.nha && String(p[5] || '').split('+').indexOf(loc.nha) < 0) return;
      if (tim && boDau(p[1] + ' ' + p[2] + ' ' + p[3]).indexOf(tim) < 0) return;
      var k = loc.gopPl ? (p[6] || p[0]) : p[0], h = hang[k];
      if (!h) {
        h = hang[k] = { khoa: k, ten: p[1], pl: loc.gopPl ? '' : p[2], barcode: p[3], nganh: p[4] || 'Sách', nha: p[5] || '', laCombo: !!p[7],
                        Shopee: 0, TikTok: 0, Web: 0, tong: 0, dt: null, don: 0, slTruoc: 0, dtTruoc: null, soPl: 0, _pl: {} };
        thuTu.push(k);
      }
      if (!h._pl[p[0]]) { h._pl[p[0]] = 1; h.soPl++; if (loc.gopPl && h.soPl > 1) { h.barcode = ''; } }
      if (SAN.indexOf(san) >= 0) h[san] += x[3] || 0;
      h.tong += x[3] || 0; h.don += x[4] || 0; h.dt = cong(h.dt, x[5]);
      h.slTruoc += x[6] || 0; h.dtTruoc = cong(h.dtTruoc, x[7]);
      [the[san], the.Tong].forEach(function (t) {
        if (!t) return;
        t.sl += x[3] || 0; t.dt = cong(t.dt, x[5]); t.slTruoc += x[6] || 0; t.dtTruoc = cong(t.dtTruoc, x[7]);
        if (locSp) { t.don += x[4] || 0; }
        var n = p[5] || (p[4] && p[4] !== 'Sách' ? p[4] : 'Chưa rõ'), o = t.nha[n] || (t.nha[n] = { sl: 0, dt: null });
        o.sl += x[3] || 0; o.dt = cong(o.dt, x[5]);
      });
    });
    // Số đơn: không lọc theo sản phẩm → số đơn thật của sàn (dòng phụ "#don") ; có lọc → cộng số đơn có sản phẩm đó (1 đơn nhiều sản phẩm đếm nhiều lần)
    if (!locSp) ((kq && kq.don) || []).forEach(function (x) {
      if (loc.gian && (x[1] || '') !== loc.gian) return;
      [the[x[0]], the.Tong].forEach(function (t) { if (t) { t.don += x[2] || 0; t.donTruoc += x[3] || 0; } });
    });
    the.donUocLuong = locSp;
    var ds = thuTu.map(function (k) {
      var h = hang[k];
      delete h._pl;
      h.doi = h.tong - h.slTruoc;
      h.pt = h.slTruoc > 0 ? Math.round((h.tong - h.slTruoc) / h.slTruoc * 100) : null; // null = kỳ trước không có
      return h;
    });
    return { hang: ds, the: the, gian: Object.keys(dsGian).sort(), nha: Object.keys(dsNha).sort(), nganh: NGANH.filter(function (n) { return dsNganh[n]; }) };
  }

  /* 💡 Cơ hội: bán ≥ nguong ở 1 sàn mà sàn khác = 0 ; top tăng / giảm mạnh so với kỳ trước */
  function coHoi(hang, nguong) {
    nguong = nguong || 5;
    var lech = [];
    (hang || []).forEach(function (h) {
      SAN.forEach(function (s) {
        if (h[s] < nguong) return;
        var thieu = SAN.filter(function (k) { return k !== s && !h[k]; });
        if (thieu.length) lech.push({ h: h, san: s, sl: h[s], thieu: thieu });
      });
    });
    lech.sort(function (a, b) { return b.sl - a.sl; });
    var co = (hang || []).filter(function (h) { return h.tong !== h.slTruoc; });
    var tang = co.filter(function (h) { return h.doi > 0; }).sort(function (a, b) { return b.doi - a.doi; }).slice(0, 10);
    var giam = co.filter(function (h) { return h.doi < 0; }).sort(function (a, b) { return a.doi - b.doi; }).slice(0, 10);
    return { lech: lech, tang: tang, giam: giam };
  }

  /* Khoảng ngày của bộ lọc: 'homnay' | 'homqua' | '7' | '30' | '183' → { tu, den } */
  function congNgay(s, n) { var p = String(s).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return d.toISOString().slice(0, 10); }
  function khoang(kieu, homNay) {
    homNay = homNay || DG.homNayVN();
    if (kieu === 'homnay') return { tu: homNay, den: homNay };
    if (kieu === 'homqua') { var q = congNgay(homNay, -1); return { tu: q, den: q }; }
    var n = Number(kieu) || 7;
    return { tu: congNgay(homNay, -(n - 1)), den: homNay };
  }

  return { SAN: SAN, NGANH: NGANH, nganh: nganh, tenGon: tenGon, plGon: plGon, khoaTen: khoaTen, doanGian: doanGian, dauDong: dauDong, maHoa: maHoa,
           gopKq: gopKq, xoay: xoay, coHoi: coHoi, khoang: khoang, congNgay: congNgay };
});
