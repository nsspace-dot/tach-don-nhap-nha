/* Màn "📈 Dự báo nhập kho" (người đặt hàng + Admin) và "📝 Chờ khai báo" (mọi người). Cần Apps Script api ≥ 5.
 * Số liệu lấy từ lịch sử bán đã lưu (60 ngày) và TÍNH LẠI theo danh mục mới nhất mỗi lần danh mục đổi. */
(function (root) {
  'use strict';
  var DM = root.DanhMuc, A = root.App, PL = root.PhanLoai, BH = root.BanHang, DG = root.DotGop;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return A.esc(s); };
  var LS_DB = 'tdn.dubao.v1';
  var SO_NGAY_TAI = 60;

  var H = { khoi: null, luc: 0, dangTai: null, loi: '', th: null, db: null, ck: null, henTinh: null };
  var luu = docLuu();
  function docLuu() { try { var x = JSON.parse(localStorage.getItem(LS_DB)) || {}; return x.ngay === DG.homNayVN() ? x : { nha: x.nha || '' }; } catch (e) { return {}; } }
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
    if (!H.db) H.db = BH.duBao(H.th, DG.homNayVN(), soNgayTheoNha());
    if (!H.ck) {
      var bo = DM.deSau;
      H.ck = BH.choKhaiBao(H.th, bo).filter(function (x) { return !bo['bo:' + idMuc(x)]; });
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
    $('db-bang').innerHTML = '<table class="tbl tbl-ghim2"><thead><tr><th><input type="checkbox" id="db-tatca" aria-label="Chọn tất cả cuốn đang hiện"></th><th>Tên sách</th>' +
      '<th class="so">Giá bìa</th><th class="so">Bán 7 ngày</th><th class="so">Bán 30 ngày</th><th class="so">TB/ngày</th><th>Xu hướng</th><th class="so">Gợi ý đặt</th></tr></thead><tbody>' +
      ds.map(function (c, i) {
        return '<tr><td><input type="checkbox" data-db-chon="' + i + '"' + (daChon(c, st) ? ' checked' : '') + ' aria-label="Chọn ' + esc(c.ten) + '"></td>' +
          '<td class="ten">' + esc(c.ten) + (c.sku ? '<div class="pl">' + esc(c.sku) + '</div>' : '') + '</td><td class="so">' + A.so(c.gia) + '</td>' +
          '<td class="so">' + A.so(c.b7) + '</td><td class="so"><b>' + A.so(c.b30) + '</b></td><td class="so">' + c.tb.toFixed(1).replace('.', ',') + '</td>' +
          '<td>' + XH[c.xuHuong] + '</td><td class="so"><input class="input db-sl" type="number" min="0" step="1" data-db-sl="' + i + '" value="' + slDat(c, st) + '" aria-label="Số lượng đặt"></td></tr>';
      }).join('') + '</tbody></table><div class="db-tong" id="db-tong"></div>';
    veTong();
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
  function idMuc(x) {
    var g = x.g || {};
    if (x.loai === 'combo_thieu') return x.loai + '|' + g.combo_id;
    if (x.loai === 'ten' || x.loai === 'barcode') return x.loai + '|' + x.nha + '|' + BH.khoaCuon(g);
    if (x.loai === 'barcode_sai') return x.loai + '|' + g.san + '|' + g.maCu + '|' + PL.norm(g.ten);
    return x.loai + '|' + g.key;
  }
  function nutMuc(x, i) {
    var n = function (html, attr) { return A.nutGhi(html, 'class="btn btn-sm" data-kb="' + attr + '" data-i="' + i + '"'); };
    var h = '';
    if (x.loai === 'combo_khac') h = n('🧩 Khai báo thành phần', 'khaibao') + n('🔗 Combo đã có', 'cosan');
    else if (x.loai === 'combo_thieu') h = n('✏️ Sửa combo', 'suacombo');
    else if (x.loai === 'de_sau') h = PL.NHA.map(function (m) { return n(m, 'nha:' + m); }).join('') + n('Không nhập', 'nha:' + PL.KHONG_NHAP) +
      (DM.coNha() ? A.chonNhaHtml('data-kb-sel="' + i + '" aria-label="Nhà khác / nhà mới"', '', { dau: 'Nhà khác…', khongNhap: false }) : '') +
      (x.g.isCombo ? n('🧩 Khai báo combo', 'khaibao') : '') + n('↩️ Đưa lại màn sáng', 'botdesau');
    else if (x.loai === 'ten') h = n('✏️ Đặt tên sách', 'ten');
    else h = n('🏷️ Sửa barcode', 'barcode');
    return h + A.nutGhi('🙈 Bỏ qua', 'class="btn btn-sm btn-ghost" data-kb="boqua" data-i="' + i + '" title="Không cần khai báo – ẩn khỏi danh sách"');
  }
  function veChoKb() {
    veNav();
    if (!DM.coBanHang()) { $('kb-bang').innerHTML = '<div class="trong-bang">Cần cập nhật Apps Script (bản có lịch sử bán) để dùng tab Chờ khai báo.</div>'; return; }
    if (!H.khoi) {
      $('kb-bang').innerHTML = '<div class="trong-bang">' + (H.loi ? '😿 ' + esc(H.loi) : 'Đang tải lịch sử bán…') + '</div>';
      if (!H.loi) taiLichSu().then(function () { veChoKb(); });
      return;
    }
    tinh();
    veNav();
    var loc = $('kb-loc').value || '', dem = {};
    H.ck.forEach(function (x) { dem[x.loai] = (dem[x.loai] || 0) + 1; });
    $('kb-loc').innerHTML = '<option value="">Tất cả (' + H.ck.length + ')</option>' + Object.keys(TEN_LOAI).filter(function (k) { return dem[k]; }).map(function (k) {
      return '<option value="' + k + '"' + (k === loc ? ' selected' : '') + '>' + TEN_LOAI[k] + ' (' + dem[k] + ')</option>';
    }).join('');
    var ds = H.ck.filter(function (x) { return !loc || x.loai === loc; });
    H.kbHien = ds;
    $('kb-tom').textContent = H.ck.length ? H.ck.length + ' việc' : '';
    if (!ds.length) { $('kb-bang').innerHTML = '<div class="trong-bang"><div class="mini-cat">' + root.LinhVat.meo('ngu') + '</div>Không còn gì chờ khai báo 🎉</div>'; return; }
    $('kb-bang').innerHTML = '<table class="tbl tbl-ghim2 kb-bang"><thead><tr><th>Việc</th><th>Tên</th><th>Nhà</th><th class="so">Số lần</th><th>Lần cuối</th><th>Nguồn</th><th>Khai báo</th></tr></thead><tbody>' +
      ds.slice(0, 300).map(function (x, i) {
        var g = x.g || {};
        return '<tr><td class="kb-loai">' + TEN_LOAI[x.loai] + '</td><td class="ten">' + esc(x.ten) +
          (g.phanLoai ? '<div class="pl">' + esc(g.phanLoai) + '</div>' : '') + (g.sku && x.loai !== 'combo_thieu' ? '<div class="pl">' + esc(g.sku) + '</div>' : '') +
          (x.ghiChu ? '<div class="ghi-chu">' + esc(x.ghiChu) + '</div>' : '') + '</td>' +
          '<td>' + esc(x.nha || g.nha || '') + '</td><td class="so"><b>' + A.so(x.soLan) + '</b></td><td class="pl">' + (x.lanCuoi ? DG.ngayNgan(x.lanCuoi) : '—') + '</td>' +
          '<td>' + x.nguon.map(function (s) { return '<span class="nho">' + esc(s) + '</span>'; }).join('') + '</td>' +
          '<td><div class="actions">' + nutMuc(x, i) + '</div></td></tr>';
      }).join('') + '</tbody></table>' + (ds.length > 300 ? '<p class="trong-bang">Đang hiện 300/' + ds.length + ' việc.</p>' : '');
  }
  function lamMuc(b) {
    var x = H.kbHien[+b.dataset.i], g = x.g, v = b.dataset.kb;
    var dongSan = function () { return (g.lines ? g.lines.map(function (l) { return l.row; }) : (g.nguon || []).map(function (s) { return s.row; })).filter(function (r) { return r && r.san !== 'Web'; }); };
    if (v === 'khaibao') root.KhaiBao.moKhaiBao(g);
    else if (v === 'cosan') root.KhaiBao.moCoSan(g);
    else if (v === 'suacombo') root.KhaiBao.moSua(DM.timCombo(g.combo_id) || g);
    else if (v.indexOf('nha:') === 0) { b.disabled = true; A.ganNha(g, v.slice(4)); }
    else if (v === 'botdesau') {
      b.disabled = true;
      DM.goi('deSau', { khoa: g.key, bo: true }).then(function (j) { DM.nhanDeSau(j.de_sau); A.toast('↩️ Dòng này lại hiện ở màn Tách đơn.', 'ok'); })
        .catch(function (e) { b.disabled = false; A.baoLoi('Không lưu được', e); });
    } else if (v === 'ten') A.moSuaTen(g, PL.KHONG_NHAP);
    else if (v === 'barcode') {
      var rs = x.loai === 'barcode_sai'
        ? H.th.rows.filter(function (r) { return r.san === g.san && PL.clean(r.sku).toUpperCase() === g.maCu && r.ten === g.ten; })
        : dongSan();
      if (!rs.length) { A.toast('Không còn dòng sàn nào để sửa barcode.', 'loi'); return; }
      A.moBarcodeDong(rs, PL.KHONG_NHAP, x.ten);
    } else if (v === 'boqua') {
      b.disabled = true;
      DM.goi('deSau', { khoa: 'bo:' + idMuc(x), ten: x.ten }).then(function (j) { DM.nhanDeSau(j.de_sau); A.toast('🙈 Đã ẩn: ' + x.ten.slice(0, 40), 'ok'); })
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
    $('db-bang').addEventListener('input', function (e) {
      var t = e.target;
      if (!t.dataset.dbSl) return;
      var st = trangThaiNha($('db-nha').value), c = H.dsHien[+t.dataset.dbSl];
      st.sua[c.khoa] = Math.max(0, Math.round(Number(t.value) || 0));
      ghiLuu(); veTong();
    });
    $('kb-bang').addEventListener('change', function (e) {
      var s = e.target.closest('[data-kb-sel]');
      if (!s || !s.value) return;
      var x = H.kbHien[+s.dataset.kbSel];
      A.chonNha(s).then(function (ma) { if (ma) { s.disabled = true; A.ganNha(x.g, ma); } });
    });
    $('kb-bang').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kb]');
      if (b && !b.disabled) lamMuc(b);
    });
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
