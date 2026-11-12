/* Màn "🛒 Sàn bán gì" (cần Apps Script api ≥ 8): sàn nào bán gì theo khoảng ngày.
 * - Chỉ tải dữ liệu khi mở tab (không làm chậm tab khác); Apps Script cộng dồn sẵn theo khoảng ngày.
 * - "Hôm nay" / khoảng có hôm nay: cộng thêm đợt đang mở chưa chốt (tính thử từ các phần đã Báo xong, không ghi gì).
 * - Bộ lọc Ngành / Nhà / Gian / tìm tên, Gộp phân loại, Combo tách / nguyên chỉ đổi cách hiện. */
(function (root) {
  'use strict';
  var DM = root.DanhMuc, A = root.App, SB = root.SanBan, DG = root.DotGop, PL = root.PhanLoai;
  var $ = function (id) { return document.getElementById(id); };
  var MOI_TRANG = 50, SAN = SB.SAN;
  var V = { kieu: '7', tu: '', den: '', nganh: '', nha: '', gian: '', tim: '', gopPl: false, combo: 'tach', sap: 'tong', giam: true, trang: 0,
            dang: 0, loi: '', kq: null, x: null, lan: 0 };
  var nho = {}, tam = null; // nho: kết quả đã tải theo "tu|den|combo" ; tam: đợt đang mở { ngay, phien, tach, nguyen }

  function duocXem() { return DM.coThongKe() && (A.coQuyen ? A.coQuyen('tab_sanban') : A.laDatHang()); }
  function veNav() { $('nav-sanban').hidden = !duocXem(); }
  function khoang() {
    if (V.kieu !== 'tuy') return SB.khoang(V.kieu);
    var hn = DG.homNayVN(), den = V.den || hn, tu = V.tu || den;
    if (tu > den) { var t = tu; tu = den; den = t; }
    return { tu: tu, den: den };
  }
  function tienChu(n) {
    if (n === null || n === undefined) return '—';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2).replace('.', ',') + ' tỷ';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' tr';
    return A.so(n) + 'đ';
  }
  function tien(n) { return n === null || n === undefined ? '<span class="muted">—</span>' : A.so(n); }

  /* ---------- Tải ---------- */
  /* Đợt hôm nay chưa chốt: lấy các phần đã Báo xong → gộp, bỏ đơn trùng giữa người → phân loại theo danh mục → nhờ Apps Script tính thử */
  function taiDotMo(ngay) {
    return DM.docGet('action=dot&duLieu=1&id=' + encodeURIComponent(ngay)).then(function (j) {
      if (!j.dot || j.dot.trang_thai === 'da_chot') return null;
      var phan = (j.phan || []).filter(function (p) { return p.dong && p.dong.length; });
      if (!phan.length) return null;
      var phien = phan.map(function (p) { return p.phan_id + '@' + p.phien; }).sort().join(',') + '|' + DM.rev;
      if (tam && tam.ngay === ngay && tam.phien === phien) return tam;
      var g = DG.gopPhan(phan);
      g.files.forEach(function (f) { f.rowsGoc = f.rows; });
      root.DocFile.gopFile(g.files);
      var rows = g.files.reduce(function (a, f) { return a.concat(f.rows || []); }, []);
      if (!rows.length) return null;
      var opt = { maKhac: DM.caiDat.maKhac, plVoNghia: DM.caiDat.plVoNghia };
      var dl = SB.maHoa(PL.classify(rows, DM.catalog, opt), Object.assign({ catalog: DM.catalog }, opt));
      return DM.goi('thongKeTam', { ngay: ngay, dl: dl }).then(function (t) {
        tam = { ngay: ngay, phien: phien, tach: t.tach, nguyen: t.nguyen, soPhan: phan.length };
        return tam;
      });
    });
  }
  function tai(epBuoc) {
    if (!duocXem()) return Promise.resolve();
    var k = khoang(), hn = DG.homNayVN(), khoa = k.tu + '|' + k.den + '|' + V.combo, lan = ++V.lan;
    if (epBuoc) { nho = {}; tam = null; }
    V.dang++; V.loi = ''; veDang();
    var p = nho[khoa] || (nho[khoa] = DM.docGet('action=thongKe&tu=' + k.tu + '&den=' + k.den + '&combo=' + V.combo + (V.kieu === '183' ? '' : '&truoc=1')));
    return p.then(function (kq) {
      var coHomNay = k.den >= hn && k.tu <= hn && kq.dot_hom_nay !== 'da_chot';
      return (coHomNay ? taiDotMo(hn).catch(function () { return null; }) : Promise.resolve(null)).then(function (t) {
        if (lan !== V.lan) return;
        V.kq = SB.gopKq([kq, t ? t[V.combo] : null]);
        V.meta = { tu: kq.tu, den: kq.den, tuTruoc: kq.tu_truoc, denTruoc: kq.den_truoc, ngayMin: kq.ngay_min, dotMo: t ? t.soPhan : 0 };
      });
    }).catch(function (e) { delete nho[khoa]; if (lan === V.lan) { V.loi = e.message; V.kq = null; } })
      .then(function () { V.dang--; veDang(); if (lan === V.lan) veTatCa(); });
  }
  function veDang() { $('sb-dang').hidden = V.dang <= 0; $('man-sanban').classList.toggle('sb-dang-tai', V.dang > 0); }

  /* ---------- Vẽ ---------- */
  function chon(id, ds, v, dau) {
    var el = $(id), co = ds.indexOf(v) >= 0 || !v;
    el.innerHTML = '<option value="">' + dau + '</option>' + (co ? ds : ds.concat([v])).map(function (x) {
      return '<option value="' + A.esc(x) + '"' + (x === v ? ' selected' : '') + '>' + A.esc(id === 'sb-nha' ? x + (PL.TEN_NHA[x] && PL.TEN_NHA[x] !== x ? ' · ' + PL.TEN_NHA[x] : '') : x) + '</option>';
    }).join('');
  }
  function tinh() {
    V.x = V.kq ? SB.xoay(V.kq, { nganh: V.nganh, nha: V.nha, gian: V.gian, tim: V.tim, gopPl: V.gopPl }) : null;
    if (!V.x) return;
    var s = V.sap, d = V.giam ? -1 : 1;
    V.x.hang.sort(function (a, b) {
      var x = a[s], y = b[s];
      if (s === 'pt') { x = a.slTruoc ? a.pt : a.tong ? 1e9 : 0; y = b.slTruoc ? b.pt : b.tong ? 1e9 : 0; }
      if (x === null || x === undefined) x = typeof y === 'string' ? '' : -1;
      if (y === null || y === undefined) y = typeof x === 'string' ? '' : -1;
      var c = typeof x === 'string' ? x.localeCompare(String(y), 'vi', { sensitivity: 'base' }) : x - y;
      return c ? c * d : b.tong - a.tong || a.ten.localeCompare(b.ten, 'vi');
    });
  }
  function veThe() {
    var el = $('sb-the');
    if (!V.x) { el.innerHTML = ''; return; }
    var the = V.x.the, uoc = the.donUocLuong;
    el.innerHTML = SAN.concat(['Tong']).map(function (s) {
      var t = the[s], nha = Object.keys(t.nha).sort(function (a, b) { return t.nha[b].sl - t.nha[a].sl; });
      var don = s === 'Web' ? '<span class="muted" title="File web đã cộng sẵn theo sách, không có mã đơn">—</span>' : (uoc ? '≈ ' : '') + A.so(t.don);
      return '<div class="sb-o sb-o-' + s + '"><div class="sb-o-ten">' + (s === 'Tong' ? 'Tổng' : '<span class="tag tag-' + s + '">' + s + '</span>') + '</div>' +
        '<dl class="sb-o-so"><div><dt>Số đơn</dt><dd>' + don + '</dd></div><div><dt>Số cuốn</dt><dd>' + A.so(t.sl) + '</dd></div>' +
        '<div><dt>Doanh thu</dt><dd title="' + (t.dt === null ? 'File không có cột giá bán' : A.so(t.dt) + ' đ') + '">' + tienChu(t.dt) + '</dd></div></dl>' +
        '<div class="sb-o-nha">' + (nha.slice(0, 8).map(function (n) {
          return '<span class="sb-nha" title="' + A.esc((PL.TEN_NHA[n] || n) + ': ' + A.so(t.nha[n].sl) + ' cuốn' + (t.nha[n].dt !== null ? ' · ' + A.so(t.nha[n].dt) + ' đ' : '')) + '"><b>' + A.esc(n) + '</b> ' + A.so(t.nha[n].sl) + '</span>';
        }).join('') || '<span class="muted">chưa có số liệu</span>') + (nha.length > 8 ? '<span class="sb-nha muted">+' + (nha.length - 8) + '</span>' : '') + '</div></div>';
    }).join('');
  }
  function doiHtml(h) {
    if (!V.meta || !V.meta.tuTruoc) return '<span class="muted">—</span>';
    if (!h.slTruoc) return h.tong ? '<span class="sb-moi" title="Kỳ trước không bán">mới</span>' : '<span class="muted">—</span>';
    if (!h.doi) return '<span class="muted">= ' + A.so(h.slTruoc) + '</span>';
    return '<span class="' + (h.doi > 0 ? 'sb-tang' : 'sb-giam') + '" title="Kỳ trước: ' + A.so(h.slTruoc) + '">' + (h.doi > 0 ? '↑ +' : '↓ −') + A.so(Math.abs(h.doi)) +
      ' <small>(' + (h.pt > 0 ? '+' : '') + h.pt + '%)</small></span>';
  }
  var COT = [['ten', 'Tên SP'], ['pl', 'Phân loại'], ['nganh', 'Ngành'], ['nha', 'Nhà'], ['Shopee', 'Shopee'], ['TikTok', 'TikTok'], ['Web', 'Web'], ['tong', 'Tổng'], ['dt', 'Doanh thu'], ['pt', '↑↓ kỳ trước']];
  function veBang() {
    var el = $('sb-bang'), tr = $('sb-trang');
    if (V.loi) { el.innerHTML = '<div class="trong-bang">😿 ' + A.esc(V.loi) + '</div>'; tr.innerHTML = ''; return; }
    if (!V.x) { el.innerHTML = '<div class="trong-bang">' + (V.dang > 0 ? '⏳ Đang tải số liệu…' : 'Chưa có số liệu.') + '</div>'; tr.innerHTML = ''; return; }
    var ds = V.x.hang, soTrang = Math.max(1, Math.ceil(ds.length / MOI_TRANG));
    if (V.trang >= soTrang) V.trang = soTrang - 1;
    var dau = '<table class="tbl sb-bang"><colgroup><col class="sb-c-ten"><col class="sb-c-pl"><col class="sb-c-nganh"><col class="sb-c-nha"><col class="sb-c-so"><col class="sb-c-so"><col class="sb-c-so"><col class="sb-c-so"><col class="sb-c-dt"><col class="sb-c-doi"></colgroup><thead><tr>' +
      COT.map(function (c, i) {
        var on = V.sap === c[0];
        return '<th' + (i >= 4 ? ' class="so"' : '') + ' aria-sort="' + (on ? (V.giam ? 'descending' : 'ascending') : 'none') + '"><button type="button" class="sb-th' + (on ? ' is-on' : '') + '" data-sb-sap="' + c[0] + '" title="Bấm để sắp xếp">' +
          c[1] + (on ? (V.giam ? ' ▼' : ' ▲') : '') + '</button></th>';
      }).join('') + '</tr></thead><tbody>';
    if (!ds.length) {
      el.innerHTML = dau + '<tr><td colspan="10" class="trong-bang">' + (V.kq && V.kq.d.length ? 'Không có sản phẩm nào khớp bộ lọc.' :
        'Chưa có số liệu trong khoảng này. Số liệu được ghi khi 🔒 Chốt đợt' + (root.NapBu ? ' – Admin có thể bấm “📥 Nạp bù số liệu cũ” để có ngay.' : '.')) + '</td></tr></tbody></table>';
      tr.innerHTML = '';
      return;
    }
    var o = function (n) { return n ? A.so(n) : '<span class="sb-0">0</span>'; };
    el.innerHTML = dau + ds.slice(V.trang * MOI_TRANG, (V.trang + 1) * MOI_TRANG).map(function (h) {
      return '<tr><td class="sb-ten">' + A.esc(h.ten) + (h.laCombo ? ' <span class="nho sb-cb">combo</span>' : '') + (h.barcode ? '<div class="pl">' + A.esc(h.barcode) + '</div>' : '') + '</td>' +
        '<td class="pl sb-pl">' + (V.gopPl ? (h.soPl > 1 ? h.soPl + ' phân loại' : '') : A.esc(h.pl)) + '</td><td>' + A.esc(h.nganh) + '</td><td>' + A.esc(h.nha || '—') + '</td>' +
        '<td class="so">' + o(h.Shopee) + '</td><td class="so">' + o(h.TikTok) + '</td><td class="so">' + o(h.Web) + '</td><td class="so"><b>' + A.so(h.tong) + '</b></td>' +
        '<td class="so">' + tien(h.dt) + '</td><td class="so">' + doiHtml(h) + '</td></tr>';
    }).join('') + '</tbody></table>';
    tr.innerHTML = '<span>' + A.so(ds.length) + ' sản phẩm · trang ' + (V.trang + 1) + '/' + soTrang + '</span>' +
      (soTrang > 1 ? '<span class="actions"><button type="button" class="btn btn-sm" data-sb-trang="-1"' + (V.trang ? '' : ' disabled') + '>← Trước</button>' +
        '<button type="button" class="btn btn-sm" data-sb-trang="1"' + (V.trang < soTrang - 1 ? '' : ' disabled') + '>Sau →</button></span>' : '');
  }
  function veCoHoi() {
    var el = $('sb-cohoi-nd');
    if (!V.x || !V.x.hang.length) { el.innerHTML = '<p class="tk-rong">Chưa có số liệu.</p>'; return; }
    var c = SB.coHoi(V.x.hang, 5, V.x.hangTatCa), coTruoc = V.meta && V.meta.tuTruoc;
    var li = function (ten, phai) { return '<li><span class="tk-ten" title="' + A.esc(ten) + '">' + A.esc(ten) + '</span><span class="tk-phai">' + phai + '</span></li>'; };
    var khung = function (lop, td, mota, ds) {
      return '<section class="tk-the ' + lop + '"><h3>' + td + '</h3><p class="muted tk-mota">' + mota + '</p>' + (ds.length ? '<ul class="tk-ds">' + ds.join('') + '</ul>' : '<p class="tk-rong">Không có.</p>') + '</section>';
    };
    var ten = function (h) { return h.ten + (h.pl ? ' – ' + h.pl : ''); };
    el.innerHTML = khung('', '🎯 Bán ở 1 sàn, sàn khác = 0', 'Bán ≥ 5 ở 1 sàn mà sàn khác chưa có đơn – xem có nên đăng / đẩy ở sàn còn lại.',
        c.lech.slice(0, 15).map(function (x) { return li(ten(x.h), '<b>' + x.san + ' ' + A.so(x.sl) + '</b> <small>· ' + x.thieu.join(', ') + ' = 0</small>'); })) +
      khung('tk-the-tang', '📈 Top 10 tăng mạnh', coTruoc ? 'So với kỳ trước cùng độ dài.' : 'Khoảng này không có kỳ trước để so.',
        coTruoc ? c.tang.map(function (h) { return li(ten(h), '<b class="sb-tang">+' + A.so(h.doi) + '</b> <small>' + A.so(h.slTruoc) + ' → ' + A.so(h.tong) + '</small>'); }) : []) +
      khung('tk-the-thieu', '📉 Top 10 giảm mạnh', coTruoc ? 'So với kỳ trước cùng độ dài.' : 'Khoảng này không có kỳ trước để so.',
        coTruoc ? c.giam.map(function (h) { return li(ten(h), '<b class="sb-giam">−' + A.so(-h.doi) + '</b> <small>' + A.so(h.slTruoc) + ' → ' + A.so(h.tong) + '</small>'); }) : []);
  }
  function veLoc() {
    document.querySelectorAll('#sb-tg .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.v === V.kieu); });
    document.querySelectorAll('#sb-combo .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.v === V.combo); });
    $('sb-tuy').hidden = V.kieu !== 'tuy';
    var x = V.x || { nganh: [], nha: [], gian: [] };
    chon('sb-nganh', x.nganh, V.nganh, 'Mọi ngành');
    chon('sb-nha', x.nha, V.nha, 'Mọi nhà');
    chon('sb-gian', x.gian, V.gian, 'Mọi gian');
    var m = V.meta, n = DG.ngayNgan;
    $('sb-ky').textContent = !m ? '' : 'Kỳ ' + n(m.tu) + (m.den !== m.tu ? ' → ' + n(m.den) : '') + (m.tuTruoc ? ' · so với ' + n(m.tuTruoc) + (m.denTruoc !== m.tuTruoc ? ' → ' + n(m.denTruoc) : '') : '') +
      (m.dotMo ? ' · gồm đợt hôm nay đang mở (' + m.dotMo + ' phần đã báo xong)' : '') + (m.ngayMin ? ' · có số liệu từ ' + n(m.ngayMin) + '/' + m.ngayMin.slice(0, 4) : '');
  }
  function veTatCa() { tinh(); veLoc(); veThe(); veCoHoi(); veBang(); }
  function veLocLai() { V.trang = 0; tinh(); veThe(); veCoHoi(); veBang(); }

  /* ---------- Xuất Excel theo bộ lọc ---------- */
  function xuat() {
    if (!V.x || !V.x.hang.length) { A.toast('Chưa có số liệu để xuất.', 'loi'); return; }
    var X = root.XLSX, wb = X.utils.book_new(), m = V.meta || {}, coTruoc = !!m.tuTruoc;
    var dong = [['Tên SP', 'Phân loại', 'Barcode', 'Ngành', 'Nhà', 'Shopee', 'TikTok', 'Web', 'Tổng', 'Doanh thu'].concat(coTruoc ? ['Kỳ trước', 'Chênh lệch', '% thay đổi'] : [])];
    V.x.hang.forEach(function (h) {
      dong.push([h.ten, V.gopPl ? (h.soPl > 1 ? h.soPl + ' phân loại' : '') : h.pl, h.barcode, h.nganh, h.nha, h.Shopee, h.TikTok, h.Web, h.tong, h.dt === null ? '' : h.dt]
        .concat(coTruoc ? [h.slTruoc, h.doi, h.pt === null ? '' : h.pt] : []));
    });
    var ws = X.utils.aoa_to_sheet(dong);
    ws['!cols'] = [{ wch: 60 }, { wch: 22 }, { wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    X.utils.book_append_sheet(wb, ws, 'San pham');
    var the = V.x.the, tt = [['Sàn', 'Số đơn', 'Số cuốn', 'Doanh thu']];
    SAN.concat(['Tong']).forEach(function (s) { tt.push([s === 'Tong' ? 'Tổng' : s, s === 'Web' ? '' : the[s].don, the[s].sl, the[s].dt === null ? '' : the[s].dt]); });
    tt.push([], ['Sàn', 'Nhà / ngành', 'Số cuốn', 'Doanh thu']);
    SAN.forEach(function (s) { Object.keys(the[s].nha).sort().forEach(function (n) { tt.push([s, n, the[s].nha[n].sl, the[s].nha[n].dt === null ? '' : the[s].nha[n].dt]); }); });
    tt.push([], ['Kỳ', (m.tu || '') + ' → ' + (m.den || '')], ['Bộ lọc', ['Ngành: ' + (V.nganh || 'tất cả'), 'Nhà: ' + (V.nha || 'tất cả'), 'Gian: ' + (V.gian || 'tất cả'), 'Tìm: ' + (V.tim || '—'),
      V.gopPl ? 'Gộp phân loại' : 'Từng phân loại', V.combo === 'tach' ? 'Combo tách từng cuốn' : 'Nguyên combo'].join(' · ')],
      ['Ghi chú', 'Số liệu là đơn đặt (Chờ xác nhận/Chờ giao), chưa trừ hủy/hoàn.' + (the.donUocLuong ? ' Số đơn khi lọc theo sản phẩm là ước lượng (1 đơn nhiều sản phẩm đếm nhiều lần).' : '')]);
    var ws2 = X.utils.aoa_to_sheet(tt);
    ws2['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 16 }];
    X.utils.book_append_sheet(wb, ws2, 'Tom tat');
    var c = SB.coHoi(V.x.hang, 5, V.x.hangTatCa), ch = [['Loại', 'Tên SP', 'Phân loại', 'Sàn đang bán', 'SL', 'Sàn = 0 / kỳ trước']];
    c.lech.forEach(function (x) { ch.push(['Bán 1 sàn', x.h.ten, x.h.pl, x.san, x.sl, x.thieu.join(', ')]); });
    if (coTruoc) {
      c.tang.forEach(function (h) { ch.push(['Tăng mạnh', h.ten, h.pl, '', h.tong, h.slTruoc]); });
      c.giam.forEach(function (h) { ch.push(['Giảm mạnh', h.ten, h.pl, '', h.tong, h.slTruoc]); });
    }
    var ws3 = X.utils.aoa_to_sheet(ch);
    ws3['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 22 }, { wch: 14 }, { wch: 8 }, { wch: 20 }];
    X.utils.book_append_sheet(wb, ws3, 'Co hoi');
    X.writeFile(wb, 'San-ban-gi_' + (m.tu || '') + '_' + (m.den || '') + '.xlsx');
  }

  function ve() {
    veNav();
    if (!duocXem()) { $('sb-bang').innerHTML = '<div class="trong-bang">Cần cập nhật Apps Script (bản api 8) để dùng tab này.</div>'; return; }
    veLoc();
    if (!V.kq) veBang();
    tai(false);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var cho = null;
    $('sb-tg').addEventListener('click', function (e) {
      var b = e.target.closest('.seg-btn');
      if (!b) return;
      V.kieu = b.dataset.v; V.trang = 0;
      if (V.kieu === 'tuy') {
        var k = SB.khoang('7');
        if (!V.tu) { V.tu = k.tu; V.den = k.den; }
        $('sb-tu').value = V.tu; $('sb-den').value = V.den;
      }
      veLoc(); tai(false);
    });
    ['sb-tu', 'sb-den'].forEach(function (id) {
      $(id).addEventListener('change', function () { V.tu = $('sb-tu').value; V.den = $('sb-den').value; V.trang = 0; if (V.tu && V.den) tai(false); });
    });
    $('sb-combo').addEventListener('click', function (e) {
      var b = e.target.closest('.seg-btn');
      if (!b || b.dataset.v === V.combo) return;
      V.combo = b.dataset.v; V.trang = 0; veLoc(); tai(false);
    });
    [['sb-nganh', 'nganh'], ['sb-nha', 'nha'], ['sb-gian', 'gian']].forEach(function (x) {
      $(x[0]).addEventListener('change', function () { V[x[1]] = $(x[0]).value; veLocLai(); });
    });
    $('sb-tim').addEventListener('input', function () {
      clearTimeout(cho);
      cho = setTimeout(function () { V.tim = $('sb-tim').value; veLocLai(); }, 250);
    });
    $('sb-goppl').addEventListener('change', function () { V.gopPl = $('sb-goppl').checked; veLocLai(); });
    $('sb-tailai').addEventListener('click', function () { tai(true); });
    $('sb-xuat').addEventListener('click', xuat);
    $('sb-bang').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sb-sap]');
      if (!b) return;
      var c = b.dataset.sbSap;
      if (V.sap === c) V.giam = !V.giam; else { V.sap = c; V.giam = ['ten', 'pl', 'nganh', 'nha'].indexOf(c) < 0; }
      V.trang = 0; tinh(); veBang();
    });
    $('sb-trang').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sb-trang]');
      if (!b || b.disabled) return;
      V.trang += Number(b.dataset.sbTrang); veBang();
      $('sb-bang').scrollTop = 0;
      $('sb-bang').scrollIntoView({ block: 'nearest' });
    });
    DM.nghe(function (loai) {
      if (loai === 'api' || loai === 'caidat' || loai === 'nguoidung' || loai === 'admin' || loai === 'quyen') {
        veNav();
        if (!duocXem() && !$('man-sanban').hidden) A.diToi('chinh');
      }
    });
    veNav();
  });

  root.ManSanBan = { ve: ve, xoaNho: function (taiLai) { nho = {}; tam = null; if (taiLai && !$('man-sanban').hidden) tai(true); }, V: V };
})(typeof self !== 'undefined' ? self : this);
