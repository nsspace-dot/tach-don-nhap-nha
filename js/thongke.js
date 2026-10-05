/* Lịch sử đặt hàng, thống kê và gợi ý đặt dự phòng (phần tính toán – không đụng giao diện).
 * Lịch sử KHÔNG lưu thông tin khách: chỉ ngày, nhà, barcode, tên sách, giá, số lượng (+ mã đơn để chống nạp trùng). */
(function (root, factory) {
  var api = factory(root.PhanLoai || (typeof require === 'function' ? require('./phanloai.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ThongKe = api;
})(typeof self !== 'undefined' ? self : this, function (PL) {
  'use strict';

  var NHA = ['HA', 'KV', 'ML'];
  var COT = ['ngay', 'nha', 'barcode', 'ten', 'gia', 'sl', 'sl_shopee', 'sl_tiktok', 'sl_web', 'sl_treo'];
  var NGUON = { Shopee: 'sl_shopee', TikTok: 'sl_tiktok', Web: 'sl_web' };

  /* ---------- Ngày ---------- */
  function d2s(d) { return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function s2d(s) { var p = String(s).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function congNgay(s, n) { var d = s2d(s); d.setUTCDate(d.getUTCDate() + n); return d2s(d); }
  function cachNgay(a, b) { return Math.round((s2d(b) - s2d(a)) / 864e5); }
  function dauTuan(s) { var d = s2d(s), t = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - t); return d2s(d); } // Thứ Hai
  function homNay() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  /* Khóa 1 cuốn trong lịch sử: barcode (đã quy về mã chuẩn); không có barcode thì theo tên đã làm gọn */
  function khoaSach(g) {
    var sku = PL.clean(g.sku);
    return PL.isBarcode(sku) ? sku.toUpperCase() : 'ten:' + PL.tenSoSanh(g.tenGon || g.ten);
  }

  /* Từng dòng đóng góp (theo đơn) của các nhà – dùng cho lịch sử */
  function dongTuKetQua(kq, nhas) {
    var out = [];
    (nhas || NHA).forEach(function (n) {
      (kq.nha[n] || []).forEach(function (g) {
        var k = khoaSach(g), ten = g.tenGon || g.ten;
        (g.nguon || []).forEach(function (src) {
          var r = src.row || {};
          var maDon = r.orderId ? r.san + ':' + r.orderId : r.san === 'Web' ? 'web:' + (r.ngayXuat || '') + '|' + (PL.clean(r.sku) || PL.norm(r.ten)) : '';
          out.push({ nha: n, barcode: k, ten: ten, gia: Number(g.gia) || 0, sl: Number(src.sl) || 0, nguon: src.san || r.san,
                     maDon: maDon, ngayDat: r.ngayDat || r.ngayXuat || '' });
        });
      });
    });
    return out;
  }

  /* Bản ghi lịch sử của ngày tải file (ghi đè theo ngày + nhà): tách số lượng từng nguồn + số lượng đơn treo từ ngày trước */
  function banGhiNgay(kq, nhas, ngay) {
    ngay = ngay || homNay();
    var gom = {}, maDon = {};
    dongTuKetQua(kq, nhas).forEach(function (l) {
      var k = l.nha + '|' + l.barcode;
      var b = gom[k] || (gom[k] = { ngay: ngay, nha: l.nha, barcode: l.barcode, ten: l.ten, gia: l.gia, sl: 0, sl_shopee: 0, sl_tiktok: 0, sl_web: 0, sl_treo: 0, _gia: 0 });
      b.sl += l.sl;
      if (NGUON[l.nguon]) b[NGUON[l.nguon]] += l.sl;
      if ((l.nguon === 'Shopee' || l.nguon === 'TikTok') && l.ngayDat && l.ngayDat < ngay) b.sl_treo += l.sl;
      if (l.sl > b._gia) { b._gia = l.sl; b.gia = l.gia; } // nhiều giá → lấy giá của phần nhiều cuốn nhất
      if (l.maDon) maDon[l.maDon] = 1;
    });
    var dong = Object.keys(gom).map(function (k) { delete gom[k]._gia; return gom[k]; });
    return { ngay: ngay, nhas: nhas, dong: dong, maDon: Object.keys(maDon) };
  }

  /* Dòng nạp lịch sử từ file đơn cũ: theo NGÀY ĐẶT của từng đơn (web: ngày xuất). Đơn hủy đã bị loại trước khi phân loại. */
  function dongNapLichSu(kq) {
    return dongTuKetQua(kq, NHA).filter(function (l) { return l.ngayDat && l.sl > 0; }).map(function (l) {
      return { ngay: l.ngayDat, nha: l.nha, barcode: l.barcode, ten: l.ten, gia: l.gia, sl: l.sl, nguon: l.nguon, ma_don: l.maDon };
    });
  }

  /* ---------- Đọc dữ liệu lịch sử ---------- */
  /* raw: { cot: [...], dong: [[...]] } từ Apps Script, hoặc mảng object */
  function chuanHoa(raw) {
    if (!raw) return [];
    var ds = Array.isArray(raw) ? raw : (raw.dong || []).map(function (a) {
      var o = {};
      raw.cot.forEach(function (c, i) { o[c] = a[i]; });
      return o;
    });
    return ds.map(function (o) {
      var x = { ngay: String(o.ngay), nha: String(o.nha), barcode: String(o.barcode), ten: String(o.ten || '') };
      ['gia', 'sl', 'sl_shopee', 'sl_tiktok', 'sl_web', 'sl_treo'].forEach(function (c) { x[c] = Number(o[c]) || 0; });
      return x;
    }).filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x.ngay); }); // dòng đã gom theo tháng không dùng cho thống kê ngày
  }

  /* Số lượng dùng cho thống kê: tất cả nguồn = số đặt − phần đơn treo từ ngày trước (đã tính ở ngày trước);
   * lọc 1 nguồn = số của nguồn đó. */
  function soLuong(r, nguon) {
    if (nguon && NGUON[nguon]) return r[NGUON[nguon]];
    return Math.max(0, r.sl - r.sl_treo);
  }

  function locDong(rows, opt) {
    return rows.filter(function (r) { return (!opt.nha || opt.nha === r.nha) && (!opt.tu || r.ngay >= opt.tu) && (!opt.den || r.ngay <= opt.den); });
  }

  /* opt: { tu, den, nha, nguon } → bảng thống kê */
  function tinhThongKe(rows, opt) {
    opt = opt || {};
    var den = opt.den || homNay(), tu = opt.tu || congNgay(den, -29);
    var q = function (r) { return soLuong(r, opt.nguon); };
    var tatCa = locDong(rows, { nha: opt.nha });
    var trong = locDong(tatCa, { tu: tu, den: den });

    // Top sách
    var sach = {};
    trong.forEach(function (r) {
      var v = q(r);
      if (!v) return;
      var k = r.nha + '|' + r.barcode;
      var s = sach[k] || (sach[k] = { nha: r.nha, barcode: r.barcode, ten: r.ten, gia: r.gia, sl: 0, ngay: {} });
      s.sl += v; s.ngay[r.ngay] = 1; s.ten = r.ten || s.ten;
    });
    var top = Object.keys(sach).map(function (k) { var s = sach[k]; s.soNgay = Object.keys(s.ngay).length; delete s.ngay; return s; })
      .sort(function (a, b) { return b.sl - a.sl || a.ten.localeCompare(b.ten, 'vi'); });

    // Theo tuần (từng nhà) và theo ngày
    var tuan = {}, ngay = {};
    for (var d = tu; d <= den; d = congNgay(d, 1)) { ngay[d] = 0; tuan[dauTuan(d)] = tuan[dauTuan(d)] || { tuan: dauTuan(d), HA: 0, KV: 0, ML: 0 }; }
    trong.forEach(function (r) {
      var v = q(r);
      ngay[r.ngay] += v;
      if (tuan[dauTuan(r.ngay)] && NHA.indexOf(r.nha) >= 0) tuan[dauTuan(r.ngay)][r.nha] += v;
    });
    var theoNgay = Object.keys(ngay).sort().map(function (k) { return { ngay: k, sl: ngay[k] }; });
    var theoTuan = Object.keys(tuan).sort().map(function (k) { return tuan[k]; });

    // Gom theo cuốn trên toàn bộ dữ liệu đã tải (không giới hạn khoảng thời gian)
    var moiCuon = {};
    tatCa.forEach(function (r) {
      var k = r.nha + '|' + r.barcode;
      var c = moiCuon[k] || (moiCuon[k] = { nha: r.nha, barcode: r.barcode, ten: r.ten, gia: r.gia, theoNgay: {}, treo: {}, cuoi: '' });
      var v = q(r);
      if (v) { c.theoNgay[r.ngay] = (c.theoNgay[r.ngay] || 0) + v; if (r.ngay > c.cuoi) c.cuoi = r.ngay; }
      if (r.sl_treo > 0) c.treo[r.ngay] = (c.treo[r.ngay] || 0) + r.sl_treo;
      if (r.ten) c.ten = r.ten;
    });
    var tong = function (c, a, b) { var s = 0; Object.keys(c.theoNgay).forEach(function (k) { if (k >= a && k <= b) s += c.theoNgay[k]; }); return s; };
    var dangTang = [], lauKhong = [], hayThieu = [];
    Object.keys(moiCuon).forEach(function (k) {
      var c = moiCuon[k];
      // 📈 Đang tăng: 7 ngày gần nhất so với 7 ngày trước – tăng ≥ 50% và thêm ≥ 5 cuốn
      var nay = tong(c, congNgay(den, -6), den), truoc = tong(c, congNgay(den, -13), congNgay(den, -7));
      if (nay - truoc >= 5 && nay >= truoc * 1.5) dangTang.push({ nha: c.nha, barcode: c.barcode, ten: c.ten, nay: nay, truoc: truoc, tang: truoc ? Math.round((nay / truoc - 1) * 100) : null });
      // 💤 Lâu không có đơn: từng có đơn nhưng ≥ 30 ngày không có
      if (c.cuoi && cachNgay(c.cuoi, den) >= 30) lauKhong.push({ nha: c.nha, barcode: c.barcode, ten: c.ten, cuoi: c.cuoi, soNgay: cachNgay(c.cuoi, den) });
      // ⚠️ Hay bị thiếu: có đơn treo từ ngày trước ≥ 3 lần (ngày) trong 30 ngày
      var lan = Object.keys(c.treo).filter(function (x) { return x > congNgay(den, -30) && x <= den; });
      if (lan.length >= 3) hayThieu.push({ nha: c.nha, barcode: c.barcode, ten: c.ten, soLan: lan.length, slTreo: lan.reduce(function (s, x) { return s + c.treo[x]; }, 0) });
    });
    dangTang.sort(function (a, b) { return (b.nay - b.truoc) - (a.nay - a.truoc); });
    lauKhong.sort(function (a, b) { return b.soNgay - a.soNgay; });
    hayThieu.sort(function (a, b) { return b.soLan - a.soLan || b.slTreo - a.slTreo; });
    return { tu: tu, den: den, top: top, theoTuan: theoTuan, theoNgay: theoNgay, dangTang: dangTang, lauKhong: lauKhong, hayThieu: hayThieu,
             tongCuon: top.reduce(function (s, x) { return s + x.sl; }, 0) };
  }

  /* ---------- Dự báo / gợi ý dự phòng ----------
   * 28 ngày gần nhất (tính đến hôm qua), trọng số ngày gần nặng hơn: hôm qua 28, hôm kia 27, …, ngày thứ 28 trước là 1.
   * Chỉ gợi ý cho sách bán đều: có đơn ≥ 10/28 ngày. Gợi ý = làm tròn lên (trung bình/ngày × số ngày dự phòng).
   * Cần ≥ 14 ngày dữ liệu (ngày cũ nhất trong lịch sử cách hôm nay ≥ 14 ngày). */
  var SO_NGAY = 28, NGUONG_DEU = 10, NGAY_TOI_THIEU = 14;
  function duBao(rows, soNgayDuPhong, ngay) {
    ngay = ngay || homNay();
    var cuNhat = rows.reduce(function (m, r) { return !m || r.ngay < m ? r.ngay : m; }, '');
    var duDuLieu = !!cuNhat && cachNgay(cuNhat, ngay) >= NGAY_TOI_THIEU;
    var out = { duDuLieu: duDuLieu, ngayDuLieu: cuNhat ? cachNgay(cuNhat, ngay) : 0, theoSach: {} };
    if (!duDuLieu) return out;
    var tu = congNgay(ngay, -SO_NGAY), den = congNgay(ngay, -1), tongW = SO_NGAY * (SO_NGAY + 1) / 2;
    var cuon = {};
    rows.forEach(function (r) {
      if (r.ngay < tu || r.ngay > den) return;
      var v = soLuong(r);
      if (!v) return;
      var k = r.nha + '|' + r.barcode;
      (cuon[k] = cuon[k] || {})[r.ngay] = ((cuon[k] || {})[r.ngay] || 0) + v;
    });
    Object.keys(cuon).forEach(function (k) {
      var tongTs = 0, soNgayCo = 0;
      Object.keys(cuon[k]).forEach(function (d) {
        var w = SO_NGAY + 1 - cachNgay(d, ngay); // hôm qua (cách 1 ngày) → 28
        tongTs += w * cuon[k][d];
        soNgayCo++;
      });
      var tb = tongTs / tongW;
      var goiY = soNgayCo >= NGUONG_DEU && soNgayDuPhong > 0 ? Math.ceil(tb * soNgayDuPhong - 1e-9) : 0;
      out.theoSach[k] = { tb: tb, soNgayCo: soNgayCo, deu: soNgayCo / SO_NGAY, goiY: goiY };
    });
    return out;
  }

  /* Cộng số dự phòng ĐÃ BẤM "Thêm vào đơn" vào kết quả để xuất file (không đổi kết quả gốc).
   * duPhong: { HA: { "<khóa sách>": số }, … } */
  function apDungDuPhong(kq, duPhong) {
    if (!duPhong) return kq;
    var nha = {};
    NHA.forEach(function (n) {
      var them = duPhong[n] || {}, daCong = {};
      nha[n] = (kq.nha[n] || []).map(function (g) {
        var k = khoaSach(g);
        if (!them[k] || daCong[k]) return g;
        daCong[k] = 1;
        return Object.assign({}, g, { sl: g.sl + them[k], duPhong: them[k] });
      });
    });
    return Object.assign({}, kq, { nha: nha });
  }

  return {
    COT: COT, NHA: NHA, congNgay: congNgay, cachNgay: cachNgay, dauTuan: dauTuan, homNay: homNay,
    khoaSach: khoaSach, dongTuKetQua: dongTuKetQua, banGhiNgay: banGhiNgay, dongNapLichSu: dongNapLichSu,
    chuanHoa: chuanHoa, soLuong: soLuong, tinhThongKe: tinhThongKe, duBao: duBao, apDungDuPhong: apDungDuPhong
  };
});
