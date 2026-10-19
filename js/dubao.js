/* Màn "📈 Dự báo nhập kho" (người đặt hàng + Admin) và "📝 Chờ khai báo" (mọi người). Cần Apps Script api ≥ 5.
 * Số liệu lấy từ lịch sử bán đã lưu (60 ngày) và TÍNH LẠI theo danh mục mới nhất mỗi lần danh mục đổi. */
(function (root) {
  'use strict';
  var DM = root.DanhMuc, A = root.App, PL = root.PhanLoai, BH = root.BanHang, DG = root.DotGop, BD = root.BieuDo;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return A.esc(s); };
  var LS_DB = 'tdn.dubao.v1';
  var SO_NGAY_TAI = 60;

  var H = { khoi: null, luc: 0, dangTai: null, loi: '', th: null, db: null, ck: null, henTinh: null };
  var luu = docLuu();
  function docLuu() { try { var x = JSON.parse(localStorage.getItem(LS_DB)) || {}; return x.ngay === DG.homNayVN() ? x : { nha: x.nha || '', anDuong: x.anDuong, anBd: x.anBd }; } catch (e) { return {}; } }
  function ghiLuu() { luu.ngay = DG.homNayVN(); try { localStorage.setItem(LS_DB, JSON.stringify(luu)); } catch (e) { /* bỏ qua */ } }

  /* ---------- Dữ liệu ---------- */
  function taiLichSu(ep) {
    if (!DM.coBanHang()) return Promise.resolve(false);
    if (!ep && H.khoi && Date.now() - H.luc < 120000) return Promise.resolve(true);
    if (H.dangTai) return H.dangTai;
    H.loi = '';
    var tu = BH.congNgay(DG.homNayVN(), -SO_NGAY_TAI);
    var p = H.dangTai = DM.docGet('action=banHang&tu=' + tu).then(function (j) {
      H.khoi = j.khoi || []; H.luc = Date.now(); H.th = null;
      return true;
    }).catch(function (e) { H.loi = e.message; return false; })
      .then(function (x) { H.dangTai = null; return x; });
    return p;
  }
  /* Dòng đang mở trên máy (chưa chốt) – để tab Chờ khai báo thấy luôn */
  function dongTrenMay() {
    var out = [];
    A.S.files.forEach(function (p) {
      if (p.error || !p.rows) return;
      var wk = p.webKey ? (p.webKey.length === 16 ? p.webKey : DG.dauFileWeb(p.webKey)) : '';
      p.rows.forEach(function (r) { out.push(r.san === 'Web' && !r.webKey ? Object.assign({}, r, { webKey: wk }) : r); });
    });
    return out;
  }
  function tinh() {
    if (!H.khoi) return null;
    if (!H.th) {
      H.th = BH.tongHop(H.khoi, DM.catalog, { maKhac: DM.caiDat.maKhac, plVoNghia: DM.caiDat.plVoNghia }, dongTrenMay());
      H.db = null; H.ck = null;
    }
    if (!H.db) { H.db = BH.duBao(H.th, DG.homNayVN(), soNgayTheoNha()); H.dbSo = (H.dbSo || 0) + 1; }
    if (!H.ck) {
      var bo = DM.deSau, tatCa = BH.choKhaiBao(H.th, bo);
      H.ck = tatCa.filter(function (x) { return !bo['bo:' + idMuc(x)]; });
      H.ckAn = tatCa.filter(function (x) { return bo['bo:' + idMuc(x)]; });
    }
    return H.th;
  }
  function soNgayTheoNha() { return (DM.caiDatChung && DM.caiDatChung.duBaoNgay) || {}; }
  /* Danh mục / để sau / file trên máy đổi → tính lại (chờ 0,4 giây nếu đang xem, 4 giây nếu chỉ cập nhật số đếm) */
  function danhDau() {
    H.th = null;
    clearTimeout(H.henTinh);
    if (!H.khoi) return;
    var dangXem = !$('man-dubao').hidden || !$('man-chokb').hidden;
    H.henTinh = setTimeout(function () {
      if (!$('man-dubao').hidden) veDuBao();
      else if (!$('man-chokb').hidden) veChoKb();
      else { tinh(); veNav(); }
    }, dangXem ? 400 : 4000);
  }

  function veNav() {
    var co = DM.coBanHang();
    $('nav-dubao').hidden = !(co && A.laDatHang());
    $('nav-chokb').hidden = !co;
    $('dem-chokb').textContent = co && H.ck ? '(' + H.ck.length + ')' : '';
  }

  /* ---------- Dự báo nhập kho ---------- */
  var TEN_NHA = PL.TEN_NHA;
  var XH = { tang: '<span class="xh-tang" title="7 ngày gần nhất bán nhiều hơn 7 ngày trước đó">📈 tăng</span>',
             giam: '<span class="xh-giam" title="7 ngày gần nhất bán ít hơn 7 ngày trước đó">📉 giảm</span>', deu: '<span class="xh-deu">➖</span>' };
  function nhaDangChon() {
    var ds = Object.keys(H.db.nha);
    if (luu.nha && H.db.nha[luu.nha]) return luu.nha;
    // Mặc định: nhà khác bán nhiều nhất (HA/KV/ML chỉ để tham khảo)
    var khac = ds.filter(function (n) { return PL.NHA.indexOf(n) < 0; });
    var tong = function (n) { return H.db.nha[n].ds.reduce(function (s, c) { return s + c.b30; }, 0); };
    khac.sort(function (a, b) { return tong(b) - tong(a); });
    return khac[0] || ds[0] || '';
  }
  function trangThaiNha(nha) {
    luu.chon = luu.chon || {}; luu.sua = luu.sua || {};
    luu.chon[nha] = luu.chon[nha] || {}; luu.sua[nha] = luu.sua[nha] || {};
    return { chon: luu.chon[nha], sua: luu.sua[nha] };
  }
  function slDat(c, st) { return st.sua[c.khoa] !== undefined ? st.sua[c.khoa] : c.goiY; }
  function daChon(c, st) { return st.chon[c.khoa] !== undefined ? st.chon[c.khoa] : c.goiY > 0; }

  function veDuBao() {
    veNav();
    if (!DM.coBanHang()) { $('db-bang').innerHTML = '<div class="trong-bang">Cần cập nhật Apps Script (bản có lịch sử bán) để dùng Dự báo nhập kho.</div>'; return; }
    if (!H.khoi) {
      $('db-bang').innerHTML = '<div class="trong-bang">' + (H.loi ? '😿 ' + esc(H.loi) : 'Đang tải lịch sử bán…') + '</div>';
      if (!H.loi) taiLichSu().then(function (ok) { if (ok) veDuBao(); else veDuBao(); });
      return;
    }
    tinh();
    var db = H.db, nhas = Object.keys(db.nha);
    if (!nhas.length) {
      $('db-nha').innerHTML = '';
      $('db-ghichu').textContent = '';
      $('db-bang').innerHTML = '<div class="trong-bang">Chưa có lịch sử bán. Lịch sử được lưu khi 🔒 Chốt đợt, hoặc nạp từ file đơn cũ ở tab 📊 Thống kê.</div>';
      $('db-bieudo').innerHTML = bdTrong(); $('db-ct').hidden = true; H.bdKhoa = null;
      return;
    }
    var nha = nhaDangChon();
    var tong = function (n) { return db.nha[n].ds.reduce(function (s, c) { return s + c.b30; }, 0); };
    var thuTu = nhas.filter(function (n) { return PL.NHA.indexOf(n) < 0; }).sort(function (a, b) { return tong(b) - tong(a); })
      .concat(PL.NHA.filter(function (n) { return db.nha[n]; }));
    $('db-nha').innerHTML = thuTu.map(function (n) {
      return '<option value="' + esc(n) + '"' + (n === nha ? ' selected' : '') + '>' + esc(n + (TEN_NHA[n] && TEN_NHA[n] !== n ? ' · ' + TEN_NHA[n] : '') + (PL.NHA.indexOf(n) >= 0 ? ' (đặt hằng ngày – tham khảo)' : '')) + ' – ' + db.nha[n].ds.length + ' cuốn</option>';
    }).join('');
    var x = db.nha[nha], st = trangThaiNha(nha);
    if (document.activeElement !== $('db-songay')) $('db-songay').value = x.soNgay;
    $('db-ghichu').innerHTML = 'Lịch sử bán ' + (db.soNgayDuLieu ? db.soNgayDuLieu + ' ngày (đến ' + DG.ngayNgan(db.ngayCuoi) + ')' : '') + ', ' + A.so(H.th.soDong) + ' dòng đơn, tính theo danh mục mới nhất. ' +
      'TB/ngày = trung bình có trọng số 28 ngày (ngày gần nặng hơn). Gợi ý = làm tròn lên (TB/ngày × ' + x.soNgay + ' ngày); không tính tồn kho.' +
      (db.duDuLieu ? '' : ' <b class="dot-canh">⚠ Chưa đủ dữ liệu (cần ít nhất 14 ngày) – số liệu chỉ để tham khảo.</b>');
    var q = A.boDau($('db-tim').value).trim(), chiGoiY = $('db-co-goiy').checked, sap = $('db-sap').value;
    var ds = x.ds.filter(function (c) { return (!q || A.boDau(c.ten).indexOf(q) >= 0) && (!chiGoiY || slDat(c, st) > 0); });
    ds.sort(sap === 'tang' ? function (a, b) { return (b.b7 - b.truoc7) - (a.b7 - a.truoc7) || b.b30 - a.b30; }
      : sap === 'goiy' ? function (a, b) { return slDat(b, st) - slDat(a, st) || b.b30 - a.b30; }
        : function (a, b) { return b.b30 - a.b30 || b.b7 - a.b7; });
    H.dsHien = ds;
    veBieuDo(nha);
    $('db-bang').innerHTML = '<table class="tbl tbl-ghim2"><thead><tr><th><input type="checkbox" id="db-tatca" aria-label="Chọn tất cả cuốn đang hiện"></th><th>Tên sách</th>' +
      '<th class="so">Giá bìa</th><th class="so">Bán 7 ngày</th><th class="so">Bán 30 ngày</th><th class="so">TB/ngày</th><th>Xu hướng</th><th>14 ngày</th><th class="so">Gợi ý đặt</th></tr></thead><tbody>' +
      ds.map(function (c, i) {
        return '<tr' + (c.khoa === H.ctKhoa ? ' class="bd-dang-xem"' : '') + '><td><input type="checkbox" data-db-chon="' + i + '"' + (daChon(c, st) ? ' checked' : '') + ' aria-label="Chọn ' + esc(c.ten) + '"></td>' +
          '<td class="ten"><button type="button" class="bd-ten" data-db-ct="' + i + '" title="Xem biểu đồ cuốn này">' + esc(c.ten) + '</button>' + (c.sku ? '<div class="pl">' + esc(c.sku) + '</div>' : '') + '</td><td class="so">' + A.so(c.gia) + '</td>' +
          '<td class="so">' + A.so(c.b7) + '</td><td class="so"><b>' + A.so(c.b30) + '</b></td><td class="so">' + c.tb.toFixed(1).replace('.', ',') + '</td>' +
          '<td>' + XH[c.xuHuong] + '</td><td class="bd-tia-o" data-db-ct="' + i + '">' + BD.tiaNho(chuoi(c.ngay, db.ngayCuoi, 14)) + '</td><td class="so"><input class="input db-sl" type="number" min="0" step="1" data-db-sl="' + i + '" value="' + slDat(c, st) + '" aria-label="Số lượng đặt"></td></tr>';
      }).join('') + '</tbody></table><div class="db-tong" id="db-tong"></div>';
    veTong();
    veChiTiet();
  }

  /* ---------- Biểu đồ ---------- */
  function chuoi(map, cuoi, n) { var out = []; for (var i = n - 1; i >= 0; i--) out.push((map || {})[BH.congNgay(cuoi, -i)] || 0); return out; }
  function dsNgay(cuoi, n) { var out = []; for (var i = n - 1; i >= 0; i--) out.push(BH.congNgay(cuoi, -i)); return out; }
  function tongDs(a) { return a.reduce(function (s, v) { return s + v; }, 0); }
  /* So 30 ngày gần nhất với 30 ngày trước đó (TB/ngày; kỳ trước có thể ngắn hơn 30 ngày nếu lịch sử chưa đủ) */
  function soSanh(n) {
    var db = H.db, x = db.nha[n], soTruoc = Math.min(30, db.soNgayDuLieu - 30);
    var nay = tongDs(chuoi(x.ngay, db.ngayCuoi, 30));
    if (soTruoc < 7) return { nay: nay, pct: null, soTruoc: Math.max(0, soTruoc) };
    var truoc = tongDs(chuoi(x.ngay, BH.congNgay(db.ngayCuoi, -30), soTruoc));
    return { nay: nay, truoc: truoc, soTruoc: soTruoc, pct: truoc > 0 ? ((nay / 30) / (truoc / soTruoc) - 1) * 100 : null };
  }
  function mauNha(n) { var i = PL.DS_NHA.indexOf(PL.timNha(n)); return BD.MAU[(i < 0 ? PL.DS_NHA.length : i) % BD.MAU.length]; }
  function bdTrong() {
    return '<div class="panel bd-trong"><div class="mini-cat">' + root.LinhVat.meo('ngu') + '</div><p>Chưa đủ dữ liệu, hãy nạp file đơn cũ ở tab 📊 Thống kê.</p></div>';
  }
  function pctHtml(p) {
    if (p === null || p === undefined) return '<span class="xh-deu">—</span>';
    var r = Math.round(p);
    return r > 0 ? '<span class="xh-tang">▲ ' + r + '%</span>' : r < 0 ? '<span class="xh-giam">▼ ' + (-r) + '%</span>' : '<span class="xh-deu">0%</span>';
  }
  function veBieuDo(nha) {
    var el = $('db-bieudo'), db = H.db;
    luu.anDuong = luu.anDuong || {};
    var rong = el.clientWidth || 900;
    var khoa = [H.dbSo, nha, JSON.stringify(luu.anDuong), !!luu.anBd, rong].join('|');
    if (khoa === H.bdKhoa) return;
    H.bdKhoa = khoa;
    if (!db.duDuLieu) { el.innerHTML = bdTrong(); return; }
    var nut = '<button type="button" class="btn btn-sm btn-ghost bd-an-nut" id="db-an-bd">' + (luu.anBd ? '📊 Hiện biểu đồ' : '🙈 Ẩn biểu đồ') + '</button>';
    if (luu.anBd) { el.innerHTML = '<div class="bd-dau">' + nut + '</div>'; return; }
    var x = db.nha[nha], ss = soSanh(nha), nhas = Object.keys(db.nha);
    var manh = null;
    nhas.forEach(function (n) { var z = soSanh(n); if (z.pct !== null && z.truoc >= 5 && (!manh || z.pct > manh.pct)) manh = { ma: n, pct: z.pct }; });
    var ten = function (n) { return n + (TEN_NHA[n] && TEN_NHA[n] !== n ? ' · ' + TEN_NHA[n] : ''); };
    var o = function (nhan, gt, phu, tip) { return '<div class="bd-o" data-tip="' + esc(tip) + '"><div class="bd-o-nhan">' + nhan + '</div><div class="bd-o-so">' + gt + '</div><div class="bd-o-phu">' + phu + '</div></div>'; };
    var kpi = '<div class="bd-kpi">' +
      o('Bán 30 ngày · ' + esc(nha), A.so(Math.round(ss.nay)), 'cuốn', 'Tổng số cuốn ' + ten(nha) + ' bán trong 30 ngày đến ' + DG.ngayNgan(db.ngayCuoi)) +
      o('Đầu sách có bán', A.so(x.ds.length), 'trong 30 ngày', 'Số đầu sách ' + nha + ' bán ít nhất 1 cuốn trong 30 ngày') +
      o('So 30 ngày trước', pctHtml(ss.pct), ss.pct === null ? (ss.soTruoc < 7 ? 'cần thêm lịch sử' : 'kỳ trước không bán') : 'TB/ngày ' + BD.so(ss.nay / 30) + ' so với ' + BD.so(ss.truoc / ss.soTruoc),
        ss.pct === null ? 'Cần ít nhất 37 ngày lịch sử để so sánh' : 'So TB/ngày 30 ngày gần nhất với ' + ss.soTruoc + ' ngày trước đó') +
      o('Nhà tăng mạnh nhất', manh ? esc(manh.ma) + ' ' + pctHtml(manh.pct) : '—', manh ? esc(TEN_NHA[manh.ma] && TEN_NHA[manh.ma] !== manh.ma ? TEN_NHA[manh.ma] : '30 ngày gần nhất') : 'chưa đủ lịch sử',
        'Nhà có TB/ngày tăng nhiều nhất so với kỳ trước (kỳ trước bán ≥ 5 cuốn)') + '</div>';
    var thuTu = nhas.slice().sort(function (a, b) { return (a === nha ? -1 : b === nha ? 1 : 0) || tongDs(chuoi(db.nha[b].ngay, db.ngayCuoi, 30)) - tongDs(chuoi(db.nha[a].ngay, db.ngayCuoi, 30)); });
    var chuGiai = thuTu.map(function (n) {
      var an = !!luu.anDuong[n];
      return '<button type="button" class="bd-cg' + (an ? ' bd-cg-an' : '') + (n === nha ? ' bd-cg-chon' : '') + '" data-bd-an="' + esc(n) + '" aria-pressed="' + !an + '" title="' + (an ? 'Bấm để hiện ' : 'Bấm để ẩn ') + esc(ten(n)) + '">' +
        '<i style="background:' + mauNha(n) + '"></i>' + esc(n) + '</button>';
    }).join('');
    var top = x.ds.slice().sort(function (a, b) { return b.b30 - a.b30 || b.b7 - a.b7; }).slice(0, 10);
    el.innerHTML = '<div class="bd-dau"><span class="muted">Biểu đồ 30 ngày đến ' + DG.ngayNgan(db.ngayCuoi) + ' · rê chuột để xem số</span>' + nut + '</div>' + kpi +
      '<div class="bd-luoi2"><div class="panel bd-the"><h3>Bán mỗi ngày theo nhà</h3><div class="bd-cg-ds">' + chuGiai + '</div><div class="bd-ve" id="bd-duong"></div></div>' +
      '<div class="panel bd-the"><h3>Top 10 bán chạy · ' + esc(nha) + '</h3><div class="bd-ve" id="bd-top"></div><p class="muted bd-goi">Bấm vào 1 cuốn để xem chi tiết.</p></div></div>';
    var w1 = $('bd-duong').clientWidth, w2 = $('bd-top').clientWidth;
    $('bd-duong').innerHTML = BD.duong({ rong: w1, cao: 240, ngay: dsNgay(db.ngayCuoi, 30), nhan: 'Số cuốn bán mỗi ngày theo nhà',
      loat: thuTu.filter(function (n) { return !luu.anDuong[n]; }).map(function (n) { return { ma: n, mau: mauNha(n), dam: n === nha, gt: chuoi(db.nha[n].ngay, db.ngayCuoi, 30) }; }) });
    $('bd-top').innerHTML = BD.thanhNgang({ rong: w2, mau: mauNha(nha), nhan: 'Top 10 bán chạy 30 ngày',
      muc: top.map(function (c) { return { nhan: c.ten, gt: c.b30, tip: c.ten + '\nBán 30 ngày: ' + A.so(c.b30) + ' · 7 ngày: ' + A.so(c.b7) + '\nGợi ý đặt: ' + A.so(c.goiY), attr: 'data-db-ctk="' + esc(c.khoa) + '"' }; }) });
  }
  function veChiTiet() {
    var el = $('db-ct'), nha = $('db-nha').value, x = H.db && H.db.nha[nha];
    var c = x && H.ctKhoa && x.ds.filter(function (z) { return z.khoa === H.ctKhoa; })[0];
    if (!c) { el.hidden = true; el.innerHTML = ''; return; }
    var st = trangThaiNha(nha), dat = slDat(c, st);
    el.hidden = false;
    el.innerHTML = '<div class="bd-ct-dau"><h3>📖 ' + esc(c.ten) + '</h3><button type="button" class="btn btn-sm btn-ghost" id="db-ct-dong" aria-label="Đóng chi tiết">✕ Đóng</button></div>' +
      '<p class="bd-ct-so">' + (c.sku ? '<span class="pl">' + esc(c.sku) + '</span> · ' : '') + 'Bán 7 ngày <b>' + A.so(c.b7) + '</b> · 30 ngày <b>' + A.so(c.b30) + '</b> · TB/ngày <b>' + BD.so(c.tb) + '</b> · ' + XH[c.xuHuong] +
      ' · Gợi ý đặt đủ bán ' + x.soNgay + ' ngày: <b class="bd-goiy">' + A.so(c.goiY) + ' cuốn</b>' + (dat !== c.goiY ? ' (bạn đang để ' + A.so(dat) + ')' : '') + '</p>' +
      '<div class="bd-ve" id="bd-ct-ve"></div>';
    $('bd-ct-ve').innerHTML = BD.chiTiet({ rong: $('bd-ct-ve').clientWidth, cao: 220, ngay: dsNgay(H.db.ngayCuoi, 30), gt: chuoi(c.ngay, H.db.ngayCuoi, 30), tb: c.tb, soNgay: x.soNgay, goiY: c.goiY });
  }
  function moChiTiet(khoa) {
    H.ctKhoa = khoa;
    veDuBao();
    var el = $('db-ct');
    if (!el.hidden && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function veTong() {
    var nha = $('db-nha').value, x = H.db && H.db.nha[nha];
    if (!x) return;
    var st = trangThaiNha(nha), dau = 0, cuon = 0;
    x.ds.forEach(function (c) { if (daChon(c, st) && slDat(c, st) > 0) { dau++; cuon += slDat(c, st); } });
    var el = $('db-tong');
    if (el) el.textContent = 'Đã chọn ' + dau + ' đầu sách · ' + A.so(cuon) + ' cuốn để xuất file.';
  }
  function tenFile(nha) {
    var slug = (root.XuatFile.TEN_FILE[nha] || A.boDau(nha).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase() || 'Nha');
    return 'Du-kien-nhap_' + slug + '_' + root.XuatFile.ngayChu(new Date(), '-') + '.xlsx';
  }
  function xuatExcel() {
    var nha = $('db-nha').value, x = H.db && H.db.nha[nha];
    if (!x) return;
    if (!root.ExcelJS) { A.toast('Thư viện Excel chưa tải xong, thử lại sau 1 giây nha.', 'loi'); return; }
    var st = trangThaiNha(nha);
    var ds = x.ds.filter(function (c) { return daChon(c, st) && slDat(c, st) > 0; })
      .map(function (c) { return { ten: c.ten, gia: c.gia, sl: slDat(c, st) }; })
      .sort(function (a, b) { return a.ten.localeCompare(b.ten, 'vi', { sensitivity: 'base' }); });
    if (!ds.length) { A.toast('Chưa tick cuốn nào (hoặc số lượng = 0).', 'loi'); return; }
    root.XuatFile.buildBang(ds, TEN_NHA[nha] || nha, root.ExcelJS, new Date()).xlsx.writeBuffer().then(function (buf) {
      A.taiVe(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), tenFile(nha));
      A.toast('📥 Đã xuất ' + ds.length + ' đầu sách dự kiến nhập ' + nha + '.', 'ok');
    }).catch(function (e) { A.toast('Lỗi tạo file Excel: ' + e.message, 'loi'); });
  }

  /* ---------- Chờ khai báo ---------- */
  var TEN_LOAI = { combo_khac: '🎁 Combo nhà khác chưa khai báo', combo_thieu: '🧩 Combo trộn – thiếu phần nhà khác', de_sau: '⏭ Để sau (chưa rõ nhà)',
                   ten: '✏️ Chưa có tên khai báo', barcode: '🏷️ Thiếu barcode', barcode_sai: '🏷️ Barcode sai' };
  var NHAN_LOAI = { combo_khac: '🎁 Combo', combo_thieu: '🧩 Thiếu phần', de_sau: '⏭ Để sau', ten: '✏️ Tên', barcode: '🏷️ Thiếu mã', barcode_sai: '🏷️ Mã sai' };
  var LOC_AN = '__an';
  var GHI_AN = 'Chỉ ẩn khỏi danh sách này, không thay đổi dữ liệu. Combo ẩn sẽ không được tách khi tính dự báo.';
  H.kbChon = {}; H.kbTen = {}; H.kbNha = {};
  function idMuc(x) {
    var g = x.g || {};
    if (x.loai === 'combo_thieu') return x.loai + '|' + g.combo_id;
    if (x.loai === 'ten' || x.loai === 'barcode') return x.loai + '|' + x.nha + '|' + BH.khoaCuon(g);
    if (x.loai === 'barcode_sai') return x.loai + '|' + g.san + '|' + g.maCu + '|' + PL.norm(g.ten);
    return x.loai + '|' + g.key;
  }
  function laCombo(x) { return x.loai === 'combo_khac' || (x.loai === 'de_sau' && !!x.g.isCombo); }
  /* Dòng sàn / web là SÁCH LẺ của mục (không tính cuốn tách từ combo) */
  function dongLe(x) {
    var g = x.g || {};
    if (x.loai === 'barcode_sai') return H.th.rows.filter(function (r) { return r.san === g.san && PL.clean(r.sku).toUpperCase() === g.maCu && r.ten === g.ten; });
    if (g.lines) return g.lines.map(function (l) { return l.row; }).filter(Boolean);
    return (g.nguon || []).filter(function (s) { return s.row && !s.combo; }).map(function (s) { return s.row; });
  }
  /* Đổi nhà lưu ngay được: sách lẻ có dòng đơn. Combo: nhà chỉ là nhà dự kiến cho "📖 Là sách lẻ" (gán nhà cho combo sẽ biến nó thành 1 cuốn) */
  function coDoiNha(x) { return x.loai !== 'combo_thieu' && !laCombo(x) && dongLe(x).length > 0; }
  function nhaMuc(x) {
    var id = idMuc(x);
    if (H.kbNha[id] !== undefined) return H.kbNha[id];
    if (x.loai === 'barcode_sai') { var r = dongLe(x)[0], e = r && DM.timSku(PL.rowKey(r, false)); if (e && PL.laNha(e.nha)) return e.nha; } // đã gán nhà trong danh mục
    return x.nha || '';
  }
  function tenGoiY(x) {
    var g = x.g || {};
    return PL.tenGoiY(g.tenSan || g.ten || x.ten, g.phanLoai || '', DM.caiDat.maKhac, DM.caiDat.plVoNghia);
  }
  function tenMuc(x) { var id = idMuc(x); return H.kbTen[id] !== undefined ? H.kbTen[id] : tenGoiY(x); }

  /* Việc gửi lên danh mục (khaiBaoLo) */
  function viecNha(x, ma) {
    var r = dongLe(x)[0], g = x.g;
    return { viec: 'nha', key: (x.loai === 'ten' && g.khoaTen) || PL.rowKey(r, false), sku: r.sku, ten: r.ten, phan_loai: r.phanLoai || '', nha: ma, _ten: x.ten };
  }
  function viecTen(x, ten, ma) {
    var g = x.g;
    return { viec: 'ten', key: g.khoaTen, sku: PL.isBarcode(g.sku) ? g.sku : '', ten: g.tenSan || g.ten, phan_loai: g.phanLoai || '', nha: ma, ten_sach: ten, _ten: ten };
  }
  function viecLe(x, ten, ma) {
    var da = {}, out = [];
    dongLe(x).forEach(function (r) {
      if (r.san === 'Web') return;
      var kl = PL.khoaKhongCombo(r);
      if (da[kl]) return;
      da[kl] = 1;
      out.push({ viec: 'le', key_le: kl, key: PL.rowKey(r, false), sku: r.sku, ten: r.ten, phan_loai: r.phanLoai || '', nha: ma, ten_sach: ten, _ten: ten });
    });
    return out;
  }
  /* Gửi nhiều việc 1 lần (Apps Script api ≥ 7); bản cũ: gửi lần lượt bằng thao tác có sẵn */
  function goiLo(items) {
    items = items.filter(function (it) { return it.key || it.key_le; });
    if (!items.length) return Promise.reject(new Error('Không có dòng nào lưu được.'));
    var sach = items.map(function (it) { var o = Object.assign({}, it); delete o._ten; return o; });
    if (DM.coKhaiBaoLo()) {
      return DM.goi('khaiBaoLo', { items: sach }).then(function (j) {
        if (j.loi && j.loi.length) A.toast('⚠ ' + j.loi.length + ' dòng chưa lưu được: ' + j.loi[0], 'loi');
        return j;
      });
    }
    return sach.reduce(function (p, it) {
      return p.then(function () {
        var s = { key: it.key, sku: it.sku, ten: it.ten, nha: it.nha, nguon: 'tay', phan_loai: it.phan_loai };
        if (it.viec !== 'nha' && it.ten_sach) s.ten_sach = it.ten_sach;
        var dau = it.viec === 'le' ? DM.goi('khongPhaiCombo', { key: it.key_le, sku: it.sku, ten: it.ten, phan_loai: it.phan_loai, nha: it.nha }) : Promise.resolve();
        return dau.then(function () { return it.viec !== 'le' || s.ten_sach || it.key !== it.key_le ? DM.goi('upsertSku', s) : null; });
      });
    }, Promise.resolve());
  }
  function luuLo(items, loiChao, nut) {
    if (nut) nut.disabled = true;
    return goiLo(items).then(function () { A.toast(loiChao, 'ok'); return true; })
      .catch(function (e) { if (nut) nut.disabled = false; A.baoLoi('Không lưu được', e); return false; });
  }

  function nutMuc(x, i, an) {
    var n = function (html, attr, them) { return A.nutGhi(html, 'class="btn btn-sm' + (them || '') + '" data-kb="' + attr + '" data-i="' + i + '"'); };
    if (an) return n('👁 Bỏ ẩn', 'boan');
    var h = '';
    if (x.loai === 'ten') h = n('✅ Xác nhận', 'xacnhan', ' btn-primary');
    else if (x.loai === 'combo_thieu') h = n('✏️ Sửa combo', 'suacombo');
    else if (x.loai === 'barcode' || x.loai === 'barcode_sai') h = n('🏷️ Sửa barcode', 'barcode');
    if (laCombo(x)) h += n('🧩 Khai báo thành phần', 'khaibao', ' btn-primary') + n('🔗 Combo đã có', 'cosan') + n('📖 Là sách lẻ', 'le');
    if (x.loai === 'de_sau') h += n('↩️ Đưa lại màn sáng', 'botdesau');
    return h + A.nutGhi('🙈 Ẩn (không cần khai)', 'class="btn btn-sm btn-ghost kb-nut-an" data-kb="an" data-i="' + i + '" title="' + GHI_AN + '"');
  }
  function oNha(x, i, an) {
    if (x.loai === 'combo_thieu') return '<span class="muted" title="Combo đã khai báo – nhà theo từng thành phần">theo thành phần</span>';
    var doi = coDoiNha(x), combo = laCombo(x), khoa = an || !DM.coTheGhi() || (!doi && !combo);
    var tip = combo ? 'Nhà dự kiến – dùng khi bấm 📖 Là sách lẻ' : doi ? 'Đổi nhà là lưu ngay vào danh mục (gán tay)' : 'Sách tách từ combo – đổi nhà trong combo';
    return '<select class="select select-sm kb-nha" data-kb-nha="' + i + '" title="' + tip + '" aria-label="Nhà"' + (khoa ? ' disabled' : '') + '>' +
      A.nhaOptions(nhaMuc(x), { dau: '— chọn nhà —', moi: !khoa && DM.coNha() }) + '</select>';
  }
  function veChoKb() {
    veNav();
    if (!DM.coBanHang()) { $('kb-bang').innerHTML = '<div class="trong-bang">Cần cập nhật Apps Script (bản có lịch sử bán) để dùng tab Chờ khai báo.</div>'; $('kb-lo').hidden = true; return; }
    if (!H.khoi) {
      $('kb-bang').innerHTML = '<div class="trong-bang">' + (H.loi ? '😿 ' + esc(H.loi) : 'Đang tải lịch sử bán…') + '</div>';
      if (!H.loi) taiLichSu().then(function () { veChoKb(); });
      return;
    }
    tinh();
    veNav();
    var loc = $('kb-loc').value || '', dem = {}, an = loc === LOC_AN;
    H.ck.forEach(function (x) { dem[x.loai] = (dem[x.loai] || 0) + 1; });
    $('kb-loc').innerHTML = '<option value="">Tất cả (' + H.ck.length + ')</option>' + Object.keys(TEN_LOAI).filter(function (k) { return dem[k]; }).map(function (k) {
      return '<option value="' + k + '"' + (k === loc ? ' selected' : '') + '>' + TEN_LOAI[k] + ' (' + dem[k] + ')</option>';
    }).join('') + '<option value="' + LOC_AN + '"' + (an ? ' selected' : '') + '>🙈 Đã ẩn (' + H.ckAn.length + ')</option>';
    var ds = an ? H.ckAn : H.ck.filter(function (x) { return !loc || x.loai === loc; });
    H.kbHien = ds; H.kbAn = an;
    // Bỏ chọn dòng đã biến mất
    var con = {};
    ds.forEach(function (x) { con[idMuc(x)] = 1; });
    Object.keys(H.kbChon).forEach(function (k) { if (!con[k]) delete H.kbChon[k]; });
    $('kb-tom').textContent = H.ck.length ? H.ck.length + ' việc' + (H.ckAn.length ? ' · ' + H.ckAn.length + ' đã ẩn' : '') : '';
    veLo();
    if (!ds.length) {
      $('kb-bang').innerHTML = '<div class="trong-bang"><div class="mini-cat">' + root.LinhVat.meo('ngu') + '</div>' + (an ? 'Chưa ẩn dòng nào.' : 'Không còn gì chờ khai báo 🎉') + '</div>';
      return;
    }
    var hien = ds.slice(0, 300);
    $('kb-bang').innerHTML = '<table class="tbl kb-bang' + (an ? ' kb-an' : '') + '"><colgroup>' + (an ? '' : '<col class="kb-c-chon">') +
      '<col><col class="kb-c-nha"><col class="kb-c-so"><col class="kb-c-ngay"><col class="kb-c-nguon"><col class="kb-c-nut"></colgroup><thead><tr>' +
      (an ? '' : '<th><input type="checkbox" id="kb-tatca" aria-label="Chọn tất cả dòng đang hiện"' + (hien.every(function (x) { return H.kbChon[idMuc(x)]; }) ? ' checked' : '') + '></th>') +
      '<th>Sản phẩm</th><th>Nhà</th><th class="so">Số lần</th><th>Lần cuối</th><th>Nguồn</th><th>Khai báo</th></tr></thead><tbody>' +
      hien.map(function (x, i) {
        var g = x.g || {}, id = idMuc(x);
        var ten = x.loai === 'ten' && !an
          ? '<textarea class="input kb-ten" rows="1" data-kb-ten="' + i + '" aria-label="Tên sách (sửa được)">' + esc(tenMuc(x)) + '</textarea>' +
            '<div class="pl">Trên sàn: ' + esc(g.tenSan || g.ten || '') + (g.phanLoai ? ' – ' + esc(g.phanLoai) : '') + '</div>'
          : '<div class="kb-ten-chu">' + esc(x.ten) + '</div>' + (g.phanLoai ? '<div class="pl">' + esc(g.phanLoai) + '</div>' : '');
        return '<tr' + (H.kbChon[id] ? ' class="kb-chon"' : '') + '>' + (an ? '' : '<td class="kb-o-chon"><input type="checkbox" data-kb-chon="' + i + '"' + (H.kbChon[id] ? ' checked' : '') + ' aria-label="Chọn dòng"></td>') +
          '<td class="kb-sp"><span class="kb-nhan kb-nhan-' + x.loai + '" title="' + TEN_LOAI[x.loai] + '">' + NHAN_LOAI[x.loai] + '</span>' + ten +
          (g.sku && x.loai !== 'combo_thieu' ? '<div class="pl kb-sku">' + esc(g.sku) + '</div>' : '') +
          (x.ghiChu ? '<div class="ghi-chu">' + esc(x.ghiChu) + '</div>' : '') + '</td>' +
          '<td data-nhan="Nhà">' + oNha(x, i, an) + '</td><td class="so" data-nhan="Số lần"><b>' + A.so(x.soLan) + '</b></td>' +
          '<td class="pl" data-nhan="Lần cuối">' + (x.lanCuoi ? DG.ngayNgan(x.lanCuoi) : '—') + '</td>' +
          '<td class="kb-nguon" data-nhan="Nguồn">' + x.nguon.map(function (s) { return '<span class="nho">' + esc(s) + '</span>'; }).join('') + '</td>' +
          '<td class="kb-o-nut"><div class="actions">' + nutMuc(x, i, an) + '</div></td></tr>';
      }).join('') + '</tbody></table>' + (ds.length > 300 ? '<p class="trong-bang">Đang hiện 300/' + ds.length + ' việc.</p>' : '');
    $('kb-bang').querySelectorAll('.kb-ten').forEach(gianO);
  }
  /* Ô tên tự cao lên theo nội dung */
  function gianO(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }
  /* Thanh làm hàng loạt */
  function dsChon() { return (H.kbHien || []).filter(function (x) { return H.kbChon[idMuc(x)]; }); }
  function veLo() {
    var el = $('kb-lo'), n = dsChon().length;
    if (H.kbAn || !DM.coTheGhi() || !(H.kbHien || []).length) { el.hidden = true; return; }
    el.hidden = false;
    var giuNha = $('kb-lo-nha') ? $('kb-lo-nha').value : '';
    el.innerHTML = '<span>Đã chọn <b>' + n + '</b> dòng</span>' +
      '<button type="button" class="btn btn-sm btn-primary" data-kb-lo="ten"' + (n ? '' : ' disabled') + '>✅ Xác nhận tên gợi ý cho các dòng đã chọn</button>' +
      '<span class="kb-lo-nha"><select class="select select-sm" id="kb-lo-nha" aria-label="Nhà để gán hàng loạt">' + A.nhaOptions(giuNha === '__moi__' ? '' : giuNha, { dau: '— chọn nhà —', moi: DM.coNha() }) + '</select>' +
      '<button type="button" class="btn btn-sm" data-kb-lo="nha"' + (n ? '' : ' disabled') + '>🏠 Gán nhà cho các dòng đã chọn</button></span>';
  }
  function loTen(nut) {
    var ds = dsChon(), ok = ds.filter(function (x) { return x.loai === 'ten' && nhaMuc(x) && PL.clean(tenMuc(x)); });
    if (!ok.length) { A.toast('Trong các dòng đã chọn không có dòng "Chưa có tên khai báo" nào (có tên + nhà).', 'loi'); return; }
    luuLo(ok.map(function (x) { return viecTen(x, PL.clean(tenMuc(x)), nhaMuc(x)); }), '✏️ Đã lưu tên ' + ok.length + ' sách' + (ds.length > ok.length ? ' (bỏ qua ' + (ds.length - ok.length) + ' dòng không phải "chưa có tên")' : '') + '.', nut)
      .then(function (x) { if (x) ok.forEach(function (m) { delete H.kbChon[idMuc(m)]; }); });
  }
  function loNha(nut) {
    var sel = $('kb-lo-nha');
    A.chonNha(sel).then(function (ma) {
      if (!ma) { if (!sel.value) A.toast('Chọn nhà trước nha.', 'loi'); return; }
      var ds = dsChon(), ok = ds.filter(coDoiNha);
      if (!ok.length) { A.toast('Các dòng đã chọn là combo / sách tách từ combo – dùng 📖 Là sách lẻ hoặc Khai báo thành phần.', 'loi'); return; }
      luuLo(ok.map(function (x) { return viecNha(x, ma); }), '🏠 Đã gán ' + ok.length + ' dòng → ' + (PL.TEN_NHA[ma] || ma) + (ds.length > ok.length ? ' (bỏ qua ' + (ds.length - ok.length) + ' combo)' : '') + '.', nut);
    });
  }

  /* 📖 Là sách lẻ: hỏi nhà + tên */
  var dangLe = null;
  function moLe(x) {
    dangLe = x;
    var g = x.g || {};
    $('le-goc').textContent = 'Trên sàn: ' + (g.ten || x.ten) + (g.phanLoai ? ' – ' + g.phanLoai : '') + (g.sku ? ' · ' + g.sku : '');
    $('le-ten').value = tenMuc(x).replace(/^\s*(combo|bộ)\s+/iu, ''); // sách lẻ: bỏ chữ "Combo" / "Bộ" ở đầu
    $('le-nha').innerHTML = A.nhaOptions(nhaMuc(x), { dau: '— chọn nhà —', moi: DM.coNha() });
    $('le-loi').textContent = '';
    $('dlg-le').showModal();
    $('le-ten').select();
  }
  function luuLe() {
    var x = dangLe, ten = PL.clean($('le-ten').value);
    A.chonNha($('le-nha')).then(function (ma) {
      if (!ma) { $('le-loi').textContent = 'Chọn nhà cho sách lẻ này.'; return; }
      if (!ten) { $('le-loi').textContent = 'Tên sách không được để trống.'; return; }
      var it = viecLe(x, ten, ma);
      if (!it.length) { $('le-loi').textContent = 'Dòng này chỉ có đơn web – không cần ghi nhớ.'; return; }
      $('le-luu').disabled = true;
      goiLo(it).then(function () { $('dlg-le').close(); A.toast('📖 Đã lưu: "' + ten + '" là sách lẻ ' + (PL.TEN_NHA[ma] || ma) + '.', 'ok'); })
        .catch(function (e) { $('le-loi').textContent = e.message; })
        .then(function () { $('le-luu').disabled = false; });
    });
  }

  function lamMuc(b) {
    var x = H.kbHien[+b.dataset.i], g = x.g, v = b.dataset.kb, id = idMuc(x);
    var dongSan = function () { return dongLe(x).filter(function (r) { return r.san !== 'Web'; }); };
    if (v === 'khaibao') root.KhaiBao.moKhaiBao(g);
    else if (v === 'cosan') root.KhaiBao.moCoSan(g);
    else if (v === 'suacombo') root.KhaiBao.moSua(DM.timCombo(g.combo_id) || g);
    else if (v === 'le') moLe(x);
    else if (v === 'xacnhan') {
      var ten = PL.clean(tenMuc(x)), ma = nhaMuc(x);
      if (!ten) { A.toast('Tên sách không được để trống.', 'loi'); return; }
      if (!ma) { A.toast('Chọn nhà trước nha.', 'loi'); return; }
      luuLo([viecTen(x, ten, ma)], '✏️ Đã lưu: ' + ten + ' (' + (PL.TEN_NHA[ma] || ma) + ').', b);
    } else if (v === 'botdesau') {
      b.disabled = true;
      DM.goi('deSau', { khoa: g.key, ten: x.ten, bo: true }).then(function (j) { DM.nhanDeSau(j.de_sau); A.toast('↩️ Dòng này lại hiện ở màn Tách đơn.', 'ok'); })
        .catch(function (e) { b.disabled = false; A.baoLoi('Không lưu được', e); });
    } else if (v === 'barcode') {
      var rs = dongSan();
      if (!rs.length) { A.toast('Không còn dòng sàn nào để sửa barcode.', 'loi'); return; }
      A.moBarcodeDong(rs, PL.KHONG_NHAP, x.ten);
    } else if (v === 'an') {
      A.hoi('Ẩn "' + x.ten.slice(0, 80) + '" khỏi Chờ khai báo?\n\n' + GHI_AN + '\nXem lại / bỏ ẩn ở bộ lọc "🙈 Đã ẩn".', '🙈 Ẩn', { nhe: true, tieuDe: 'Ẩn dòng này?' }).then(function (ok) {
        if (!ok) return;
        b.disabled = true;
        DM.goi('deSau', { khoa: 'bo:' + id, ten: x.ten }).then(function (j) { DM.nhanDeSau(j.de_sau); A.toast('🙈 Đã ẩn: ' + x.ten.slice(0, 40), 'ok'); })
          .catch(function (e) { b.disabled = false; A.baoLoi('Không lưu được', e); });
      });
    } else if (v === 'boan') {
      b.disabled = true;
      DM.goi('deSau', { khoa: 'bo:' + id, ten: x.ten, bo: true }).then(function (j) { DM.nhanDeSau(j.de_sau); A.toast('👁 Đã bỏ ẩn: ' + x.ten.slice(0, 40), 'ok'); })
        .catch(function (e) { b.disabled = false; A.baoLoi('Không lưu được', e); });
    }
  }

  /* ---------- Sự kiện ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    $('db-nha').addEventListener('change', function () { luu.nha = $('db-nha').value; ghiLuu(); veDuBao(); });
    $('db-sap').addEventListener('change', veDuBao);
    $('db-co-goiy').addEventListener('change', veDuBao);
    var hen = null;
    $('db-tim').addEventListener('input', function () { clearTimeout(hen); hen = setTimeout(veDuBao, 200); });
    $('db-lai').addEventListener('click', function () { taiLichSu(true).then(veDuBao); });
    $('kb-lai').addEventListener('click', function () { taiLichSu(true).then(veChoKb); });
    $('kb-loc').addEventListener('change', veChoKb);
    $('db-xuat').addEventListener('click', xuatExcel);
    $('db-songay').addEventListener('change', function () {
      var nha = $('db-nha').value, so = Math.max(1, Math.min(90, Math.round(Number($('db-songay').value) || 7)));
      DM.goi('luuDuBaoNgay', { nha: nha, so_ngay: so })
        .then(function (j) { DM.nhanCaiDatChung(j.cai_dat_chung); H.db = null; veDuBao(); A.toast('Đã lưu: ' + nha + ' đặt đủ bán ' + so + ' ngày (dùng chung mọi máy).', 'ok'); })
        .catch(function (e) { A.baoLoi('Không lưu được', e); });
    });
    $('db-bang').addEventListener('change', function (e) {
      var nha = $('db-nha').value, st = trangThaiNha(nha), t = e.target;
      if (t.id === 'db-tatca') { H.dsHien.forEach(function (c) { st.chon[c.khoa] = t.checked; }); ghiLuu(); veDuBao(); return; }
      if (t.dataset.dbChon) { st.chon[H.dsHien[+t.dataset.dbChon].khoa] = t.checked; ghiLuu(); veTong(); }
    });
    $('db-bang').addEventListener('click', function (e) {
      var t = e.target.closest('[data-db-ct]');
      if (t) moChiTiet(H.dsHien[+t.dataset.dbCt].khoa);
    });
    $('db-bieudo').addEventListener('click', function (e) {
      var t = e.target.closest('[data-bd-an],[data-db-ctk],#db-an-bd');
      if (!t) return;
      if (t.id === 'db-an-bd') { luu.anBd = !luu.anBd; ghiLuu(); veDuBao(); return; }
      if (t.dataset.dbCtk) { moChiTiet(t.dataset.dbCtk); return; }
      var n = t.dataset.bdAn;
      luu.anDuong = luu.anDuong || {};
      if (luu.anDuong[n]) delete luu.anDuong[n]; else luu.anDuong[n] = 1;
      ghiLuu(); veDuBao();
    });
    $('db-ct').addEventListener('click', function (e) { if (e.target.id === 'db-ct-dong') { H.ctKhoa = null; veDuBao(); } });
    var henCo = null;
    window.addEventListener('resize', function () {
      if (!$('man-chokb').hidden) $('kb-bang').querySelectorAll('.kb-ten').forEach(gianO);
      clearTimeout(henCo);
      henCo = setTimeout(function () { if (!$('man-dubao').hidden && H.db) { H.bdKhoa = null; veDuBao(); } }, 250);
    });
    $('db-bang').addEventListener('input', function (e) {
      var t = e.target;
      if (!t.dataset.dbSl) return;
      var st = trangThaiNha($('db-nha').value), c = H.dsHien[+t.dataset.dbSl];
      st.sua[c.khoa] = Math.max(0, Math.round(Number(t.value) || 0));
      ghiLuu(); veTong();
    });
    $('kb-bang').addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'kb-tatca') { H.kbHien.slice(0, 300).forEach(function (x) { if (t.checked) H.kbChon[idMuc(x)] = 1; else delete H.kbChon[idMuc(x)]; }); veChoKb(); return; }
      if (t.dataset.kbChon) {
        var xc = H.kbHien[+t.dataset.kbChon];
        if (t.checked) H.kbChon[idMuc(xc)] = 1; else delete H.kbChon[idMuc(xc)];
        t.closest('tr').classList.toggle('kb-chon', t.checked); veLo(); return;
      }
      if (!t.dataset.kbNha) return;
      var x = H.kbHien[+t.dataset.kbNha];
      A.chonNha(t).then(function (ma) {
        if (!ma) { t.value = nhaMuc(x); return; }
        H.kbNha[idMuc(x)] = ma;
        if (!coDoiNha(x)) return; // combo: chỉ là nhà dự kiến
        t.disabled = true;
        luuLo([viecNha(x, ma)], '🏠 Đã lưu: ' + x.ten.slice(0, 40) + ' → ' + (PL.TEN_NHA[ma] || ma) + '.').then(function () { t.disabled = false; });
      });
    });
    $('kb-bang').addEventListener('input', function (e) {
      var t = e.target;
      if (t.dataset.kbTen) { H.kbTen[idMuc(H.kbHien[+t.dataset.kbTen])] = t.value; gianO(t); }
    });
    $('kb-bang').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.dataset.kbTen) return;
      e.preventDefault(); // ô tên 1 dòng: Enter = Xác nhận
      var b = e.target.closest('tr').querySelector('[data-kb="xacnhan"]');
      if (b && !b.disabled) lamMuc(b);
    });
    $('kb-bang').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kb]');
      if (b && !b.disabled) lamMuc(b);
    });
    $('kb-lo').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kb-lo]');
      if (!b || b.disabled) return;
      if (b.dataset.kbLo === 'ten') loTen(b); else loNha(b);
    });
    $('le-luu').addEventListener('click', luuLe);
    DM.nghe(function (loai) {
      if (loai === 'catalog' || loai === 'desau' || loai === 'caidat') danhDau();
      if (loai === 'api' || loai === 'nguoidung') { veNav(); if (DM.coBanHang() && !H.khoi) taiLichSu().then(function () { tinh(); veNav(); }); }
    });
  });

  root.ManDuBao = {
    ve: function (man) { if (man === 'dubao') veDuBao(); else veChoKb(); taiLichSu().then(function (moi) { if (moi && H.th === null) { if (man === 'dubao') veDuBao(); else veChoKb(); } }); },
    taiLai: function () { return taiLichSu(true).then(function () { tinh(); veNav(); }); },
    filesDoi: danhDau,
    veNav: veNav,
    H: H
  };
})(typeof self !== 'undefined' ? self : this);
