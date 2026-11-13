/* 🔁 Đơn lặp qua các ngày (Apps Script api ≥ 10): đơn đã có ở đợt trước (chưa kịp gửi, nhà giao thiếu phải đặt lại).
 * - ĐẶT NHÀ: vẫn tính bình thường. Nhãn "🔁 n đơn đã có ở đợt trước (dd/mm: x …)" + danh sách, bỏ tick từng đơn nếu không cần đặt lại
 *   (bỏ tick = không vào file 3 nhà, chỉ trên máy này, theo từng màn: phần của tôi / gộp đợt).
 * - SỐ LIỆU: gắn r._daDem = SL đã tính ở ngày trước cho từng dòng → lịch sử đặt hàng (Thống kê) chỉ đếm phần mới / phần SL tăng.
 *   BAN_HANG / THONG_KE tự chống đếm lặp ở Apps Script. */
(function (root) {
  'use strict';
  var DM = root.DanhMuc, A = root.App, DG = root.DotGop, BH = root.BanHang, PL = root.PhanLoai;
  var $ = function (id) { return document.getElementById(id); };
  var L = { khoa: '', lap: null, p: null, loi: '', bo: {} };

  function coDung() { return !!(DM.caiDat.url && DM.api >= 10); }
  function man() { return A.S.gop ? 'gop:' + A.S.gop.dot_id : 'toi'; }
  function ngayDot() { return A.S.gop ? A.S.gop.dot_id : DG.homNayVN(); }
  function boMap() { return L.bo[man()] || (L.bo[man()] = {}); }
  function maDon(r) { return r && r.orderId && r.san !== 'Web' ? r.san + ':' + r.orderId : ''; }
  function laBo(r) { var d = maDon(r); return !!(d && boMap()[d] && L.lap && L.lap[d]); }
  function soBo() { var m = boMap(); return Object.keys(m).filter(function (d) { return L.lap && L.lap[d]; }).length; }
  function khoaDong(r) { return BH.khoa([r.san, r.sku, r.ten, r.phanLoai], [0, r.orderId]); }

  /* Gắn SL đã tính ở ngày trước vào từng dòng (0 = mới) */
  function apDung() {
    A.rowsTatCa().forEach(function (r) {
      var o = L.lap && L.lap[maDon(r)];
      r._daDem = o ? Number(o.dong[khoaDong(r)]) || 0 : 0;
    });
  }
  function tra() {
    if (!coDung()) { L.khoa = ''; L.lap = null; ve(); return Promise.resolve(); }
    var ds = {}, ngay = ngayDot();
    A.rowsTatCa().forEach(function (r) { var d = maDon(r); if (d) ds[d] = 1; });
    var don = Object.keys(ds).sort(), khoa = ngay + '|' + don.length + '|' + DG.dauFileWeb(don.join(','));
    if (khoa === L.khoa) { if (L.lap) apDung(); ve(); return L.p || Promise.resolve(); }
    L.khoa = khoa; L.lap = null; L.loi = '';
    if (!don.length) { L.lap = {}; L.p = null; ve(); return Promise.resolve(); }
    var p = L.p = DM.goi('donLap', { ngay: ngay, don: don }).then(function (j) {
      if (L.khoa !== khoa) return;
      L.lap = j.lap || {};
      apDung();
      if (soBo()) A.xuLy(false); // có đơn đã bỏ tick từ trước → tính lại kết quả đặt nhà
    }).catch(function (e) { if (L.khoa === khoa) { L.lap = {}; L.loi = e.message; } })
      .then(function () { if (L.p === p) L.p = null; ve(); });
    return p;
  }

  /* Danh sách đơn lặp đang có: [{ don, san, ma, ngay: [...], dau (ngày gặp đầu tiên), dong: [{ ten, sl, cu }], bo }] */
  function dsLap() {
    if (!L.lap) return [];
    var theo = {}, out = [];
    A.rowsTatCa().forEach(function (r) {
      var d = maDon(r), o = d && L.lap[d];
      if (!o) return;
      var x = theo[d];
      if (!x) { x = theo[d] = { don: d, san: r.san, ma: r.orderId, ngay: o.ngay, dau: o.ngay[0], dong: [], bo: !!boMap()[d] }; out.push(x); }
      x.dong.push({ ten: PL.tenGon(r.ten, DM.caiDat.maKhac) + (r.phanLoai ? ' – ' + r.phanLoai : ''), sl: Number(r.sl) || 0, cu: Number(o.dong[khoaDong(r)]) || 0 });
    });
    return out.sort(function (a, b) { return a.dau < b.dau ? 1 : a.dau > b.dau ? -1 : a.don < b.don ? -1 : 1; });
  }
  function ve() {
    var el = $('don-lap');
    if (!el) return;
    var ds = dsLap();
    if (!A.S.kq || !ds.length) { el.hidden = true; if ($('dlg-donlap').open) veDlg(); return; }
    var theoNgay = {};
    ds.forEach(function (x) { theoNgay[x.dau] = (theoNgay[x.dau] || 0) + 1; });
    var ngay = Object.keys(theoNgay).sort().reverse(), bo = ds.filter(function (x) { return x.bo; }).length;
    el.hidden = false;
    el.innerHTML = '🔁 <b>' + A.so(ds.length) + ' đơn</b> đã có ở đợt trước (có từ ' + ngay.slice(0, 5).map(function (n) { return DG.ngayNgan(n) + ': ' + theoNgay[n]; }).join(' · ') +
      (ngay.length > 5 ? ' …' : '') + ') – vẫn tính để đặt nhà' + (bo ? ', <b class="dot-canh">' + A.so(bo) + ' đơn đã bỏ tick (không đặt lại)</b>' : '') + '. ' +
      '<button type="button" class="btn btn-sm" data-dl-xem>👀 Xem / bỏ tick</button> <span class="muted">Số liệu thống kê chỉ đếm mỗi đơn 1 lần.</span>';
    if ($('dlg-donlap').open) veDlg();
  }
  function veDlg() {
    var ds = dsLap(), e = A.esc;
    $('dl-tom').textContent = ds.length + ' đơn đã có ở đợt trước. Bỏ tick đơn không cần đặt lại → không vào file 3 nhà (chỉ trên máy này). Mặc định tick = tính bình thường.';
    $('dl-bang').innerHTML = !ds.length ? '<div class="trong-bang">Không còn đơn lặp.</div>' :
      '<table class="tbl"><thead><tr><th>Đặt lại</th><th>Sàn</th><th>Mã đơn</th><th>Đã có ngày</th><th>Sản phẩm</th></tr></thead><tbody>' + ds.map(function (x) {
        return '<tr' + (x.bo ? ' class="dl-bo"' : '') + '><td><input type="checkbox" data-dl-don="' + e(x.don) + '"' + (x.bo ? '' : ' checked') + ' aria-label="Đặt lại đơn ' + e(x.ma) + '"></td>' +
          '<td><span class="tag tag-' + e(x.san) + '">' + e(x.san) + '</span></td><td class="sku">' + e(x.ma) + '</td>' +
          '<td>' + x.ngay.map(DG.ngayNgan).join(', ') + '</td><td>' + x.dong.map(function (d) {
            return e(d.ten) + ' × <b>' + d.sl + '</b>' + (d.sl > d.cu ? ' <span class="dot-canh">' + (d.cu ? '(tăng từ ' + d.cu + ')' : '(dòng mới)') + '</span>' : '');
          }).join('<br>') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function doiTick(d, bo) { if (bo) boMap()[d] = 1; else delete boMap()[d]; }

  document.addEventListener('DOMContentLoaded', function () {
    $('don-lap').addEventListener('click', function (e) { if (e.target.closest('[data-dl-xem]')) { veDlg(); $('dlg-donlap').showModal(); } });
    $('dl-bang').addEventListener('change', function (e) {
      var c = e.target.closest('[data-dl-don]');
      if (!c) return;
      doiTick(c.dataset.dlDon, !c.checked);
      A.xuLy(false);
    });
    $('dl-tat').addEventListener('click', function () { dsLap().forEach(function (x) { doiTick(x.don, true); }); A.xuLy(false); });
    $('dl-bat').addEventListener('click', function () { dsLap().forEach(function (x) { doiTick(x.don, false); }); A.xuLy(false); });
    DM.nghe(function (loai) { if (loai === 'api') { L.khoa = ''; tra(); } });
  });

  root.DonLap = { sauXuLy: tra, cho: tra, laBo: laBo, soBo: soBo, ds: dsLap, L: L };
})(typeof self !== 'undefined' ? self : this);
