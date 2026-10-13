/* Biểu đồ SVG tự vẽ (không tải thư viện ngoài) – dùng ở màn "📈 Dự báo nhập kho".
 * Màu lấy từ biến CSS của chủ đề (--brand, --kv-ink, …) nên đổi chủ đề là đổi màu theo, không cần vẽ lại.
 * Ô gợi ý (tooltip): phần tử nào có data-tip trong khung .bd-khung sẽ hiện chữ khi rê chuột / chạm. */
(function (root) {
  'use strict';
  var MAU = ['var(--brand)', 'var(--kv-ink)', 'var(--cb-ink)', 'var(--info-ink)', 'var(--ha-ink)', 'var(--ml-ink)',
             'var(--cr-ink)', 'var(--err-ink)', 'var(--bq-ink)', 'var(--focus)'];
  var soVN = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
  function so(n) { return soVN.format(Math.round((Number(n) || 0) * 10) / 10); }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r1(n) { return Math.round(n * 10) / 10; }
  /* Thang trục dọc "đẹp": bước 1/2/5 × 10ⁿ, số nguyên */
  function thang(max) {
    max = Math.max(0, Number(max) || 0);
    var tho = max / 4 || 1, mu = Math.pow(10, Math.floor(Math.log10(tho))), c = tho / mu;
    var buoc = Math.max(1, (c <= 1 ? 1 : c <= 2 ? 2 : c <= 5 ? 5 : 10) * mu);
    return { buoc: buoc, dinh: Math.max(buoc, Math.ceil(max / buoc) * buoc) };
  }
  function nhanNgay(d) { var p = String(d).split('-'); return p[2] + '/' + p[1]; }
  function catChu(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; }

  function luoiDoc(t, x0, x1, y) { // đường lưới ngang + nhãn số
    var h = '';
    for (var v = 0; v <= t.dinh + 1e-9; v += t.buoc) {
      var yy = r1(y(v));
      h += '<line class="bd-luoi" x1="' + x0 + '" x2="' + x1 + '" y1="' + yy + '" y2="' + yy + '"/>' +
        '<text class="bd-truc" x="' + (x0 - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + so(v) + '</text>';
    }
    return h;
  }
  function nhanTrucNgang(ngay, x, yChu, rong) { // nhãn ngày, cách nhau ≥ 46px
    var n = ngay.length, moi = Math.max(1, Math.ceil(46 / Math.max(1, rong / Math.max(1, n - 1)))), h = '';
    for (var i = n - 1; i >= 0; i -= moi) h += '<text class="bd-truc" x="' + r1(x(i)) + '" y="' + yChu + '" text-anchor="middle">' + nhanNgay(ngay[i]) + '</text>';
    return h;
  }

  /* Biểu đồ đường: o = { rong, cao, ngay: [d…], loat: [{ ma, ten, mau, gt: [số…], dam }] } – loạt dam (nhà đang chọn) vẽ đậm, các loạt khác nhạt */
  function duong(o) {
    var W = Math.max(260, o.rong), H = o.cao || 230, L = 40, R = 14, T = 12, B = 26, n = o.ngay.length;
    var max = 0;
    o.loat.forEach(function (s) { s.gt.forEach(function (v) { if (v > max) max = v; }); });
    var t = thang(max), rong = W - L - R, cao = H - T - B;
    var x = function (i) { return L + (n > 1 ? i * rong / (n - 1) : rong / 2); };
    var y = function (v) { return T + (1 - v / t.dinh) * cao; };
    var h = '<svg class="bd-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(o.nhan || 'Biểu đồ') + '">';
    h += luoiDoc(t, L, W - R, y) + nhanTrucNgang(o.ngay, x, H - 8, rong);
    var ve = function (s) {
      var d = s.gt.map(function (v, i) { return (i ? 'L' : 'M') + r1(x(i)) + ' ' + r1(y(v)); }).join('');
      var g = '<path class="bd-duong' + (s.dam ? ' bd-dam' : '') + '" d="' + d + '" style="stroke:' + s.mau + '"/>';
      if (s.dam) g += s.gt.map(function (v, i) { return v ? '<circle class="bd-cham" cx="' + r1(x(i)) + '" cy="' + r1(y(v)) + '" r="2.6" style="fill:' + s.mau + '"/>' : ''; }).join('');
      return g;
    };
    h += o.loat.filter(function (s) { return !s.dam; }).map(ve).join('') + o.loat.filter(function (s) { return s.dam; }).map(ve).join('');
    h += '<line class="bd-x" x1="0" x2="0" y1="' + T + '" y2="' + (T + cao) + '" style="display:none"/>';
    // Cột rê chuột: mỗi ngày 1 cột trong suốt, gợi ý = số bán từng nhà ngày đó
    var buocX = n > 1 ? rong / (n - 1) : rong;
    for (var i = 0; i < n; i++) {
      var dong = o.loat.map(function (s) { return { ma: s.ma, v: s.gt[i], dam: s.dam }; }).sort(function (a, b) { return b.v - a.v; })
        .map(function (z) { return (z.dam ? '▶ ' : '   ') + z.ma + ': ' + so(z.v); });
      h += '<rect class="bd-cot-an" x="' + r1(x(i) - buocX / 2) + '" y="' + T + '" width="' + r1(buocX) + '" height="' + cao + '" data-bd-x="' + r1(x(i)) + '" data-tip="' +
        esc(nhanNgay(o.ngay[i]) + (o.loat.length ? '\n' + dong.join('\n') : '\nKhông có nhà nào đang hiện')) + '"/>';
    }
    return h + '</svg>';
  }

  /* Thanh ngang: o = { rong, muc: [{ nhan, gt, tip, attr }], mau } */
  function thanhNgang(o) {
    var W = Math.max(260, o.rong), hang = 26, T = 4, n = o.muc.length, H = T * 2 + n * hang;
    var LW = Math.min(Math.round(W * 0.48), 260), x0 = LW + 8, rong = W - x0 - 46;
    var max = o.muc.reduce(function (m, z) { return Math.max(m, z.gt); }, 0) || 1;
    var soChu = Math.max(6, Math.floor(LW / 6.6));
    var h = '<svg class="bd-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(o.nhan || 'Biểu đồ thanh') + '">';
    o.muc.forEach(function (z, i) {
      var yy = T + i * hang, w = Math.max(2, r1(z.gt / max * rong));
      h += '<g class="bd-hang" ' + (z.attr || '') + ' data-tip="' + esc(z.tip || (z.nhan + ': ' + so(z.gt))) + '">' +
        '<rect class="bd-nen-hang" x="0" y="' + yy + '" width="' + W + '" height="' + hang + '" rx="6"/>' +
        '<text class="bd-nhan" x="' + LW + '" y="' + (yy + 17) + '" text-anchor="end">' + esc(catChu(z.nhan, soChu)) + '</text>' +
        '<rect class="bd-thanh" x="' + x0 + '" y="' + (yy + 5) + '" width="' + w + '" height="' + (hang - 10) + '" rx="5" style="fill:' + (o.mau || 'var(--brand)') + '"/>' +
        '<text class="bd-so" x="' + (x0 + w + 6) + '" y="' + (yy + 17) + '">' + so(z.gt) + '</text></g>';
    });
    return h + '</svg>';
  }

  /* Đường nhỏ trong bảng (14 ngày) */
  function tiaNho(gt, o) {
    o = o || {};
    var W = o.rong || 84, H = o.cao || 24, n = gt.length, max = Math.max.apply(null, gt.concat([1]));
    var x = function (i) { return 2 + i * (W - 6) / Math.max(1, n - 1); }, y = function (v) { return H - 3 - v / max * (H - 6); };
    var d = gt.map(function (v, i) { return (i ? 'L' : 'M') + r1(x(i)) + ' ' + r1(y(v)); }).join('');
    var tong = gt.reduce(function (s, v) { return s + v; }, 0), cao = Math.max.apply(null, gt);
    return '<svg class="bd-tia" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" data-tip="' +
      esc('14 ngày gần nhất: ' + so(tong) + ' cuốn\nNgày cao nhất: ' + so(cao) + '\nHôm qua → nay: ' + gt.slice(-2).map(so).join(' → ')) + '" aria-label="Bán 14 ngày: ' + so(tong) + ' cuốn">' +
      '<path class="bd-tia-nen" d="' + d + 'L' + r1(x(n - 1)) + ' ' + (H - 2) + 'L' + r1(x(0)) + ' ' + (H - 2) + 'Z"/>' +
      '<path class="bd-tia-duong" d="' + d + '"/>' +
      '<circle class="bd-tia-cham" cx="' + r1(x(n - 1)) + '" cy="' + r1(y(gt[n - 1])) + '" r="2.4"/></svg>';
  }

  /* Chi tiết 1 cuốn: cột bán từng ngày (30 ngày) + vùng dự báo nét đứt cho số ngày "đủ bán"
   * o = { rong, cao, ngay: [d…], gt: [số…], tb, soNgay, goiY } */
  function chiTiet(o) {
    var W = Math.max(280, o.rong), H = o.cao || 220, L = 40, R = 14, T = 16, B = 26;
    var nLs = o.gt.length, nDb = Math.min(30, Math.max(1, o.soNgay || 7)), n = nLs + nDb;
    var max = Math.max(o.tb || 0, Math.max.apply(null, o.gt.concat([0])));
    var t = thang(max), rong = W - L - R, cao = H - T - B, o1 = rong / n;
    var x = function (i) { return L + i * o1; }, y = function (v) { return T + (1 - v / t.dinh) * cao; };
    var h = '<svg class="bd-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Bán theo ngày và dự báo">';
    h += luoiDoc(t, L, W - R, y);
    // vùng dự báo
    var xDb = x(nLs), yTb = r1(y(o.tb || 0));
    h += '<rect class="bd-vung-db" x="' + r1(xDb) + '" y="' + T + '" width="' + r1(nDb * o1) + '" height="' + cao + '" data-tip="' +
      esc('Dự báo ' + nDb + ' ngày tới: ~' + so(o.tb) + ' cuốn/ngày\nGợi ý đặt: ' + so(o.goiY) + ' cuốn (làm tròn lên ' + so(o.tb) + ' × ' + nDb + ')') + '"/>';
    h += '<text class="bd-truc" x="' + r1(xDb + nDb * o1 / 2) + '" y="' + (T - 4) + '" text-anchor="middle">dự báo ' + nDb + ' ngày</text>';
    o.gt.forEach(function (v, i) {
      var cx = x(i) + o1 * 0.15, w = Math.max(1, o1 * 0.7);
      h += '<rect class="bd-cot' + (v ? '' : ' bd-cot-0') + '" x="' + r1(cx) + '" y="' + r1(v ? y(v) : T + cao - 1.5) + '" width="' + r1(w) + '" height="' + r1(v ? T + cao - y(v) : 1.5) + '" rx="2"/>' +
        '<rect class="bd-cot-an" x="' + r1(x(i)) + '" y="' + T + '" width="' + r1(o1) + '" height="' + cao + '" data-tip="' + esc(nhanNgay(o.ngay[i]) + ': ' + so(v) + ' cuốn') + '"/>';
    });
    h += '<line class="bd-tb" x1="' + r1(xDb) + '" x2="' + r1(W - R) + '" y1="' + yTb + '" y2="' + yTb + '"/>' +
      '<text class="bd-tb-chu" x="' + r1(W - R - 2) + '" y="' + (yTb - 5) + '" text-anchor="end">~' + so(o.tb) + '/ngày</text>';
    for (var i = nLs - 1; i >= 0; i -= Math.max(1, Math.ceil(46 / o1))) h += '<text class="bd-truc" x="' + r1(x(i) + o1 / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + nhanNgay(o.ngay[i]) + '</text>';
    return h + '</svg>';
  }

  /* ---------- Ô gợi ý ---------- */
  var tip = null, xDang = null;
  function anX() { if (xDang) { xDang.style.display = 'none'; xDang = null; } }
  function reChuot(e) {
    var t = e.target && e.target.closest && e.target.closest('.bd-khung [data-tip]');
    if (!t) { if (tip) tip.hidden = true; anX(); return; }
    if (!tip) { tip = document.createElement('div'); tip.className = 'bd-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    tip.textContent = t.getAttribute('data-tip');
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight, X = e.clientX + 14, Y = e.clientY + 14;
    if (X + w > innerWidth - 8) X = Math.max(8, e.clientX - w - 14);
    if (Y + h > innerHeight - 8) Y = Math.max(8, e.clientY - h - 14);
    tip.style.left = X + 'px'; tip.style.top = Y + 'px';
    var bx = t.getAttribute('data-bd-x'), ln = bx && t.ownerSVGElement && t.ownerSVGElement.querySelector('.bd-x');
    if (ln) { if (xDang && xDang !== ln) anX(); ln.setAttribute('x1', bx); ln.setAttribute('x2', bx); ln.style.display = ''; xDang = ln; } else anX();
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('pointermove', reChuot, { passive: true });
    document.addEventListener('pointerdown', reChuot, { passive: true });
    document.addEventListener('scroll', function () { if (tip) tip.hidden = true; anX(); }, { passive: true, capture: true });
  }

  root.BieuDo = { duong: duong, thanhNgang: thanhNgang, tiaNho: tiaNho, chiTiet: chiTiet, MAU: MAU, so: so, nhanNgay: nhanNgay };
})(typeof self !== 'undefined' ? self : this);
