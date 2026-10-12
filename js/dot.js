/* Đợt đặt hàng (cần Apps Script api ≥ 3):
 * - Thanh trên cùng "Đợt 12/10 · Bạn: Lan"
 * - Nhân viên sàn: phần đang làm lưu nháp trên máy; "✅ Báo xong" gửi danh sách dòng đã chuẩn hóa; "↩️ Mở lại"
 * - Người đặt hàng: màn "📦 Tổng hợp đợt" (trạng thái từng người, xem trước gộp, tải 3 file nhà, chốt / mở lại đợt, đợt cũ) */
(function (root) {
  'use strict';
  var DM = root.DanhMuc, A = root.App, DG = root.DotGop, PL = root.PhanLoai;
  var $ = function (id) { return document.getElementById(id); };
  var LS_NHAP = 'tdn.nhap.v1';
  var esc = function (s) { return A.esc(s); };

  /* ---------- Nháp trên máy ---------- */
  var nhap = docNhap();
  function docNhap() { try { return JSON.parse(localStorage.getItem(LS_NHAP)) || {}; } catch (e) { return {}; } }
  function ghiNhap() {
    try { localStorage.setItem(LS_NHAP, JSON.stringify(nhap)); }
    catch (e) { if (!ghiNhap.daBao) { ghiNhap.daBao = true; A.toast('Không lưu được nháp trên máy (bộ nhớ trình duyệt đầy) – đừng đóng trình duyệt trước khi Báo xong.', 'loi'); } }
  }
  function goiFile(p) {
    return { id: p.id, file: p.file, san: p.san, sheetName: p.sheetName, error: p.error || null, rows: p.rowsTatCa || p.rows || [],
             thoiGianXuat: p.thoiGianXuat, ngayXuat: p.ngayXuat, webKey: p.webKey };
  }
  function luuNhap() {
    if (A.S.gop) return; // đang xem gộp: không đụng nháp của mình
    nhap.cheDoDot = DM.coDot() || (DM.api === null && !!nhap.cheDoDot); // chế độ 1 người: không giữ nháp (như cũ)
    nhap.files = A.S.files.map(goiFile);
    nhap.demFile = A.S.demFile;
    nhap.luc = new Date().toISOString();
    ghiNhap();
  }
  function khoiPhucNhap() {
    if (!nhap.cheDoDot || !nhap.files || !nhap.files.length) return;
    A.S.files = nhap.files.map(function (p) { return Object.assign({}, p); });
    A.S.demFile = nhap.demFile || A.S.files.length;
    A.gop();
    A.xuLy(false);
    A.toast('📝 Đã mở lại phần đang làm dở (' + A.S.files.filter(function (p) { return !p.error; }).length + ' file).', 'ok');
  }
  /* Dấu nội dung phần của mình – để biết đã đổi sau khi Báo xong chưa */
  function dauPhan() {
    var g = DG.dongGui(A.S.files);
    return g.dong.length + '#' + DG.dauFileWeb(JSON.stringify(g.dong));
  }

  /* ---------- Thanh trên cùng ---------- */
  var dotHienTai = { id: DG.homNayVN(), trangThai: '' }; // trạng thái đợt hôm nay (lấy khi Báo xong / Tổng hợp)
  function veNhan() {
    var el = $('dot-nhan'), co = DM.coDot();
    el.hidden = !co;
    var nav = $('nav-dot');
    nav.hidden = !(co && A.laDatHang());
    if (!co) return;
    var homNay = DG.homNayVN();
    if (dotHienTai.id !== homNay) dotHienTai = { id: homNay, trangThai: '' };
    el.innerHTML = '🗓️ Đợt ' + DG.ngayNgan(homNay) + (dotHienTai.trangThai === 'da_chot' ? ' <span class="dot-chot">🔒 đã chốt</span>' : '') +
      ' · Bạn: <b>' + esc(DM.caiDat.toiLa || '(chưa chọn)') + '</b>';
    el.title = DM.caiDat.toiLa ? 'Đổi "Tôi là" ở Cài đặt' : 'Chọn "Tôi là" ở Cài đặt';
  }

  /* ---------- Báo xong (màn Tách đơn) ---------- */
  var gui = { dang: false, loi: '' };
  function veBaoXong() {
    var el = $('bao-xong');
    if (!DM.coDot() || A.S.gop || !A.S.kq) { el.hidden = true; return; }
    el.hidden = false;
    var dg = nhap.daGui, h;
    if (!DM.caiDat.toiLa) {
      el.innerHTML = '👤 Chọn <b>“Tôi là”</b> ở Cài đặt để báo xong phần của bạn. <button class="linkish" data-di="caidat">Vào Cài đặt</button>';
      return;
    }
    if (dg && dg.dot_id < DG.homNayVN() && !dg.moLai) dg = null; // phần đã gửi vào đợt hôm trước → hôm nay là phần mới
    var thayDoi = dg && dg.dau !== dauPhan();
    if (gui.dang) h = '⏳ Đang gửi phần của bạn lên Google Sheets…';
    else if (gui.loi) {
      h = '😿 <b>Chưa gửi được:</b> ' + esc(gui.loi) + ' <button type="button" class="btn btn-sm btn-primary" data-bx="gui">🔁 Thử lại</button>';
    } else if (dg && !dg.moLai && !thayDoi) {
      h = '✅ <b>Đã báo xong</b> lúc ' + esc(DM.gioPhut(dg.luc) || dg.luc) + ' · đợt ' + DG.ngayNgan(dg.dot_id) + ' · ' + A.so(dg.so_dong) + ' dòng' +
        (dg.trung ? ' · <span class="dot-canh">' + esc(dg.trung) + '</span>' : '') +
        ' <button type="button" class="btn btn-sm" data-bx="molai" title="Sửa tiếp phần đã gửi – báo xong lại thì bản mới thay bản cũ">↩️ Mở lại</button>';
    } else {
      h = (dg ? (dg.moLai ? '✏️ Đang sửa lại phần đã gửi lúc ' + esc(DM.gioPhut(dg.luc) || dg.luc) + '. ' : '✏️ Phần của bạn đã đổi sau khi báo xong. ') : '') +
        '<button type="button" class="btn btn-primary" data-bx="gui">✅ ' + (dg ? 'Báo xong lại' : 'Báo xong') + '</button>' +
        ' <span class="muted">Gửi danh sách dòng đã xử lý (không gửi file gốc, không có thông tin khách) cho người đặt hàng.</span>';
    }
    if (!gui.dang && nhap.daGui) h += ' <button type="button" class="btn btn-sm btn-ghost" data-bx="moi" title="Bỏ hết file đang có trên máy để làm phần mới">🧹 Làm phần mới</button>';
    el.innerHTML = h;
  }

  function baoXong() {
    var kq = A.S.kq;
    if (!kq) return;
    var nhac = [];
    if (kq.combo.length) nhac.push(kq.combo.length + ' combo chưa khai báo');
    if (kq.chuaRo.length) nhac.push(kq.chuaRo.length + ' sách chưa rõ nhà');
    var buoc = nhac.length && !gui.loi
      ? A.hoi('Còn ' + nhac.join(', ') + '.\n\nNgười đặt hàng vẫn khai báo tiếp được khi gộp. Vẫn báo xong?', '✅ Vẫn báo xong', { huy: '🔍 Xem lại', nhe: true, tieuDe: 'Còn dòng chưa xử lý' })
      : Promise.resolve(true);
    buoc.then(function (ok) {
      if (!ok) {
        A.S.tab = kq.combo.length ? 'combo' : 'chuaRo';
        A.xuLy(false);
        return;
      }
      var g = DG.dongGui(A.S.files), dau = dauPhan();
      if (!g.dong.length) { A.toast('Không có dòng nào để gửi.', 'loi'); return; }
      gui.dang = true; gui.loi = ''; veBaoXong();
      DM.goi('baoXong', { dot_id: DG.homNayVN(), cot: g.cot, dong: g.dong, nguon: g.nguon, so_don: g.soDon,
                          con_combo: kq.combo.length, con_chua_ro: kq.chuaRo.length })
        .then(function (j) {
          var trung = (j.trung || []).map(function (t) { return t.so_don + ' đơn trùng với phần của ' + t.nguoi; }).join(', ');
          nhap.daGui = { dot_id: j.dot_id, luc: j.phan && j.phan.gui_luc, so_dong: g.dong.length, dau: dau, trung: trung, moLai: false };
          ghiNhap();
          dotHienTai = { id: DG.homNayVN(), trangThai: j.chuyen_dot ? 'da_chot' : 'dang_nhan' };
          if (j.chuyen_dot) A.toast('🔒 Đợt ' + DG.ngayNgan(j.dot_goc) + ' đã chốt – phần này vào đợt ' + DG.ngayNgan(j.dot_id) + ' (ngày mai).', 'loi');
          A.toast('✅ Đã gửi ' + A.so(g.dong.length) + ' dòng' + (j.thay_ban_cu ? ' (thay bản đã gửi trước)' : '') + ' – người đặt hàng đã thấy phần của bạn.', 'ok');
          if (trung) A.toast('⚠️ ' + trung + ' – người đặt hàng chỉ tính 1 lần.', 'loi');
        })
        .catch(function (e) { gui.loi = e.message + ' – kiểm tra mạng rồi bấm Thử lại'; A.toast('Chưa gửi được phần của bạn: ' + e.message, 'loi'); })
        .then(function () { gui.dang = false; veBaoXong(); veNhan(); });
    });
  }
  function moLaiPhan() {
    var dg = nhap.daGui;
    if (!dg) return;
    DM.goi('moLaiPhan', { dot_id: dg.dot_id })
      .then(function (j) {
        dg.moLai = true; ghiNhap();
        A.toast(j.da_chot ? '🔒 Đợt ' + DG.ngayNgan(dg.dot_id) + ' đã chốt – sửa xong báo lại thì phần này vào đợt sau.'
          : '↩️ Đã mở lại – sửa tiếp rồi bấm “Báo xong lại”, bản mới sẽ thay bản cũ.', 'ok');
      })
      .catch(function (e) { A.toast('Không mở lại được: ' + e.message, 'loi'); })
      .then(veBaoXong);
  }

  /* ---------- Màn Tổng hợp đợt ---------- */
  var T = { id: DG.homNayVN(), dot: null, phan: [], nguoiDung: [], ds: [], loi: '', dangTai: false, gop: null, timer: null };
  function tenTrangThai(p) {
    if (p.trang_thai === 'mo_lai') return '✏️ Đang sửa lại';
    return '✅ Đã báo xong ' + (DM.gioPhut(p.gui_luc) || '');
  }
  function taiTongHop() {
    if (!DM.coDot() || T.dangTai) return Promise.resolve();
    T.dangTai = true;
    var id = T.id;
    return Promise.all([DM.docGet('action=dot&id=' + encodeURIComponent(id)), DM.docGet('action=dsDot')])
      .then(function (kq) {
        if (id !== T.id) return;
        var j = kq[0];
        T.dot = j.dot; T.phan = j.phan || []; T.nguoiDung = j.nguoi_dung || []; T.ds = kq[1].dot || []; T.loi = '';
        DM.nhanNguoiDung(T.nguoiDung);
        if (id === DG.homNayVN()) { dotHienTai = { id: id, trangThai: T.dot.trang_thai }; veNhan(); }
      })
      .catch(function (e) { T.loi = e.message; })
      .then(function () { T.dangTai = false; veBangTongHop(); veGopBar(); });
  }
  function veTongHop(vao) {
    if (vao) {
      if (!T.dot) T.id = DG.homNayVN();
      clearInterval(T.timer);
      T.timer = setInterval(function () { if (!$('man-dot').hidden && !document.hidden) taiTongHop(); }, 30000);
    }
    veBangTongHop();
    return taiTongHop();
  }
  function choXong(phan, nguoiDung) {
    // Người trong danh sách chưa gửi gì / đang sửa lại
    var daGui = {};
    phan.forEach(function (p) { daGui[p.nguoi] = p.trang_thai; });
    return nguoiDung.filter(function (n) { return daGui[n.ten] !== 'da_gui' && (n.vai_tro === 'san' || daGui[n.ten]); }).map(function (n) {
      return n.ten + (daGui[n.ten] === 'mo_lai' ? ' (đang sửa lại)' : ' (chưa gửi)');
    });
  }
  function veBangTongHop() {
    var el = $('dot-bang');
    if (!el) return;
    if (!DM.coDot()) { el.innerHTML = '<div class="trong-bang">Cần cập nhật Apps Script để dùng Đợt đặt hàng.</div>'; return; }
    var chon = $('dot-chon'), ds = T.ds.slice();
    if (!ds.some(function (d) { return d.dot_id === T.id; })) ds.unshift({ dot_id: T.id, trang_thai: T.dot ? T.dot.trang_thai : 'dang_nhan' });
    if (!ds.some(function (d) { return d.dot_id === DG.homNayVN(); })) ds.unshift({ dot_id: DG.homNayVN(), trang_thai: 'dang_nhan' });
    chon.innerHTML = ds.map(function (d) {
      return '<option value="' + esc(d.dot_id) + '"' + (d.dot_id === T.id ? ' selected' : '') + '>' + DG.ngayNgan(d.dot_id) + '/' + d.dot_id.slice(0, 4) +
        (d.dot_id === DG.homNayVN() ? ' (hôm nay)' : '') + (d.trang_thai === 'da_chot' ? ' · 🔒' : '') + '</option>';
    }).join('');
    var chot = T.dot && T.dot.trang_thai === 'da_chot';
    $('dot-tt').className = 'dot-tt ' + (chot ? 'da-chot' : 'dang-nhan');
    $('dot-tt').textContent = !T.dot ? '…' : chot ? '🔒 Đã chốt ' + (DM.gioPhut(T.dot.chot_luc) || '') + (T.dot.chot_boi ? ' · ' + T.dot.chot_boi : '') : '🟢 Đang nhận';
    // Mở lại đợt đã chốt / xóa đợt: chỉ Admin (Apps Script cũ chưa có Admin → người đặt hàng mở lại như trước)
    var quanLy = DM.coAdmin() ? A.laAdmin() : true;
    $('dot-chot').hidden = chot;
    $('dot-mo-lai').hidden = !chot || !quanLy;
    $('dot-xoa').hidden = !(DM.coAdmin() && A.laAdmin()) || !T.dot || T.dot.chua_tao;
    if (T.loi) { el.innerHTML = '<div class="trong-bang">😿 ' + esc(T.loi) + '</div>'; return; }
    if (!T.dot) { el.innerHTML = '<div class="trong-bang">Đang tải…</div>'; return; }
    var laQl = DM.coAdmin() && A.laAdmin();
    var hang = T.phan.slice().sort(function (a, b) { return String(a.gui_luc) < String(b.gui_luc) ? -1 : 1; }).map(function (p) {
      var sot = (p.con_combo ? p.con_combo + ' combo' : '') + (p.con_combo && p.con_chua_ro ? ' / ' : '') + (p.con_chua_ro ? p.con_chua_ro + ' chưa rõ' : '');
      return '<tr><td><b>' + esc(p.nguoi) + '</b></td><td>' + esc(p.nguon || '—') + '</td><td class="' + (p.trang_thai === 'mo_lai' ? 'dot-canh' : 'dot-xong') + '">' + tenTrangThai(p) +
        (Number(p.phien) > 1 ? ' <span class="pl">(gửi lần ' + p.phien + ')</span>' : '') + '</td><td class="so">' + A.so(p.so_dong) + '<div class="pl">' + A.so(p.so_don) + ' đơn</div></td>' +
        '<td>' + (sot ? '<span class="dot-canh">⚠ ' + sot + '</span>' : '<span class="muted">—</span>') + '</td>' +
        (laQl ? '<td><button type="button" class="btn btn-sm" data-ql-phan="' + esc(p.nguoi) + '" title="Admin: xem / bỏ file gửi nhầm / mở lại / xóa phần này">🛠️ Quản lý</button></td>' : '') + '</tr>';
    });
    var daCo = {};
    T.phan.forEach(function (p) { daCo[p.nguoi] = 1; });
    T.nguoiDung.filter(function (n) { return !daCo[n.ten]; }).forEach(function (n) {
      hang.push('<tr class="dot-chua"><td><b>' + esc(n.ten) + '</b> <span class="pl">' + ({ dat_hang: 'người đặt hàng', admin: 'admin' }[n.vai_tro] || 'nhân viên sàn') + '</span></td><td>—</td><td>⏳ Chưa gửi</td><td class="so">—</td><td>—</td>' + (laQl ? '<td></td>' : '') + '</tr>');
    });
    var tongDong = T.phan.reduce(function (s, p) { return s + (Number(p.so_dong) || 0); }, 0);
    el.innerHTML = '<table class="tbl"><thead><tr><th>Người</th><th>Nguồn</th><th>Trạng thái</th><th class="so">Số dòng</th><th>Còn sót (combo / chưa rõ)</th>' + (laQl ? '<th><span class="sr">Quản lý</span></th>' : '') + '</tr></thead><tbody>' +
      (hang.join('') || '<tr><td colspan="5" class="trong-bang">Chưa có ai trong danh sách người dùng (thêm ở Cài đặt).</td></tr>') + '</tbody></table>' +
      '<p class="legend" style="padding:10px 16px">Đã gửi ' + T.phan.length + ' phần · ' + A.so(tongDong) + ' dòng. Tự làm mới mỗi 30 giây. ' +
      (T.gop && T.gop.dot_id === T.id && T.gop.phien !== phienTongHop() ? '<b class="dot-canh">Có phần mới gửi sau lần xem gộp – bấm “Xem trước gộp” để tính lại.</b>' : '') + '</p>';
  }
  function phienTongHop() { return T.phan.map(function (p) { return p.phan_id + '@' + p.phien + p.trang_thai; }).sort().join(','); }

  /* Xem trước gộp: lấy mọi phần đã gửi của đợt, tính lại theo danh mục mới nhất, đưa vào màn Tách đơn */
  function xemGop(sauDo) {
    var id = T.id;
    A.toast('⏳ Đang lấy các phần đã gửi của đợt ' + DG.ngayNgan(id) + '…');
    return DM.docGet('action=dot&duLieu=1&id=' + encodeURIComponent(id)).then(function (j) {
      T.dot = j.dot; T.phan = (j.phan || []).map(function (p) { var x = Object.assign({}, p); delete x.dong; delete x.cot; return x; });
      T.nguoiDung = j.nguoi_dung || T.nguoiDung;
      if (!j.phan.length) { A.toast('Đợt ' + DG.ngayNgan(id) + ' chưa có ai báo xong.', 'loi'); veBangTongHop(); return false; }
      var g = DG.gopPhan(j.phan);
      T.gop = { dot_id: id, trung: g.trung, tongTrung: g.tongTrung, choXong: choXong(T.phan, T.nguoiDung), soPhan: j.phan.length, phien: phienTongHop() };
      A.vaoGop({ dot_id: id, files: g.files });
      A.diToi('chinh');
      veGopBar();
      if (g.tongTrung) A.toast('🔁 Đã bỏ ' + A.so(g.tongTrung) + ' đơn trùng giữa các người (' + moTaTrung(g.trung) + ').', 'ok');
      if (T.gop.choXong.length) A.toast('⚠️ Chưa báo xong: ' + T.gop.choXong.join(', ') + ' – vẫn xem / tải được.', 'loi');
      return true;
    }).catch(function (e) { A.toast('Không lấy được dữ liệu đợt: ' + e.message, 'loi'); return false; })
      .then(function (ok) { veBangTongHop(); if (ok && sauDo) return sauDo(); });
  }
  function moTaTrung(ds) { return ds.map(function (t) { return t.nguoi + ' trùng ' + t.voi + ': ' + t.so_don; }).join('; '); }

  function veGopBar() {
    var el = $('gop-bar');
    if (!A.S.gop || !T.gop) { el.hidden = true; return; }
    el.hidden = false;
    var chot = T.dot && T.dot.dot_id === T.gop.dot_id && T.dot.trang_thai === 'da_chot';
    el.innerHTML = '<div>🧺 <b>Đang xem GỘP đợt ' + DG.ngayNgan(T.gop.dot_id) + '</b> ' + (chot ? '<span class="dot-chot">🔒 đã chốt</span>' : '<span class="dot-xong">🟢 đang nhận</span>') +
      ' · ' + T.gop.soPhan + ' phần đã gửi, tính lại theo danh mục mới nhất' +
      (T.gop.tongTrung ? ' · 🔁 đã bỏ <b>' + A.so(T.gop.tongTrung) + '</b> đơn trùng (' + esc(moTaTrung(T.gop.trung)) + ')' : ' · không có đơn trùng') +
      (T.gop.choXong.length ? '<div class="dot-canh">⚠️ Chưa báo xong: ' + esc(T.gop.choXong.join(', ')) + '</div>' : '') + '</div>' +
      '<div class="actions">' +
      A.nutGhi('🔄 Tính lại', 'class="btn btn-sm" data-gb="lai"') +
      '<button type="button" class="btn btn-sm btn-primary" data-gb="tai">⬇️ Tải 3 file nhà</button>' +
      (chot ? (DM.coAdmin() && !A.laAdmin() ? '' : A.nutGhi('🔓 Mở lại đợt', 'class="btn btn-sm" data-gb="molai"')) : A.nutGhi('🔒 Chốt đợt', 'class="btn btn-sm btn-danger" data-gb="chot"')) +
      '<button type="button" class="btn btn-sm" data-gb="ve">↩️ Về phần của tôi</button></div>';
  }
  function veTuGop() { A.thoatGop(); T.gop = null; veGopBar(); }

  function taiBaNha() {
    var lam = function () { A.taiNha(PL.NHA.slice(), null); };
    if (A.S.gop && A.S.gop.dot_id === T.id) { A.diToi('chinh'); lam(); return; }
    xemGop(lam);
  }

  /* Chốt đợt: lấy lại các phần mới nhất → nhắc → ghi lịch sử thống kê (1 lần cho cả đợt) + khóa đợt */
  function chotDot() {
    xemGop(function () {
      var kq = A.S.kq, nhac = [];
      if (T.gop.choXong.length) nhac.push('Chưa báo xong: ' + T.gop.choXong.join(', '));
      if (kq && kq.combo.length) nhac.push(kq.combo.length + ' combo chưa khai báo');
      if (kq && kq.chuaRo.length) nhac.push(kq.chuaRo.length + ' sách chưa rõ nhà');
      return A.hoi('Chốt đợt ' + DG.ngayNgan(T.gop.dot_id) + '?\n\n' + (nhac.length ? '⚠ ' + nhac.join('\n⚠ ') + '\n\n' : '') +
        '· Khóa đợt: ai báo xong sau đó sẽ vào đợt ngày mai\n· Ghi lịch sử thống kê của đợt (1 lần, chốt lại thì ghi đè)\n· Mở lại đợt được nếu cần', '🔒 Chốt đợt', { huy: 'Chưa', tieuDe: 'Chốt đợt' })
        .then(function (ok) {
          if (!ok) return;
          var bg = kq ? root.ThongKe.banGhiNgay(kq, PL.NHA.slice(), T.gop.dot_id) : null;
          return DM.goi('chotDot', { dot_id: T.gop.dot_id, lich_su: bg }).then(function (j) {
            T.dot = j.dot;
            A.toast(j.da_chot_truoc ? '🔒 Đợt này đã được chốt trước đó.' : '🔒 Đã chốt đợt ' + DG.ngayNgan(T.gop.dot_id) +
              (j.lichSu ? ' – ghi lịch sử ' + A.so(j.lichSu.soDong) + ' đầu sách.' : '.'), 'ok');
            if (j.lichSu) A.taiLichSu(undefined, true);
            taiTongHop();
          });
        })
        .catch(function (e) { A.toast('Không chốt được: ' + e.message, 'loi'); })
        .then(veGopBar);
    });
  }
  function moLaiDot() {
    var id = A.S.gop ? A.S.gop.dot_id : T.id;
    A.hoi('Mở lại đợt ' + DG.ngayNgan(id) + '?\n\nNhân viên báo xong sẽ lại vào đợt này. Chốt lại sau đó thì lịch sử thống kê được ghi đè (không cộng 2 lần).', '🔓 Mở lại đợt', { nhe: true, tieuDe: 'Mở lại đợt' })
      .then(function (ok) {
        if (!ok) return;
        return DM.goi('moLaiDot', { dot_id: id }).then(function (j) { T.dot = j.dot; A.toast('🔓 Đã mở lại đợt ' + DG.ngayNgan(id) + '.', 'ok'); taiTongHop(); });
      })
      .catch(function (e) { A.baoLoi('Không mở lại được', e); })
      .then(veGopBar);
  }

  /* ---------- Admin: xóa đợt, quản lý phần gửi của bất kỳ ai ---------- */
  function xoaDot() {
    var id = T.id;
    A.hoi('Xóa đợt ' + DG.ngayNgan(id) + '/' + id.slice(0, 4) + '?\n\nXóa mọi phần đã gửi của đợt này trên Google Sheets (không hoàn tác được). Lịch sử thống kê đã ghi khi chốt vẫn giữ.', '🗑 Xóa đợt', { tieuDe: 'Admin – Xóa đợt' })
      .then(function (ok) {
        if (!ok) return;
        return DM.goi('xoaDot', { dot_id: id }).then(function (j) {
          A.toast('🗑 Đã xóa đợt ' + DG.ngayNgan(id) + ' (' + j.so_phan + ' phần).', 'ok');
          if (A.S.gop && A.S.gop.dot_id === id) veTuGop();
          T.dot = null; T.phan = []; taiTongHop();
        });
      })
      .catch(function (e) { A.baoLoi('Không xóa được', e); });
  }
  var qlPhan = null; // { nguoi, dot_id }
  function moQuanLyPhan(nguoi) {
    qlPhan = { nguoi: nguoi, dot_id: T.id };
    $('dlg-phan-title').textContent = '🛠️ Phần gửi của ' + nguoi + ' – đợt ' + DG.ngayNgan(T.id);
    $('phan-mota').textContent = 'Đang tải…';
    $('phan-bang').innerHTML = ''; $('phan-loi').textContent = '';
    $('dlg-phan').showModal();
    DM.docGet('action=dot&duLieu=1&id=' + encodeURIComponent(T.id)).then(function (j) {
      var p = (j.phan || []).filter(function (x) { return x.nguoi === nguoi; })[0];
      if (!p) { $('phan-mota').textContent = 'Phần này không còn (có thể vừa bị xóa).'; return; }
      var iFile = p.cot.indexOf('file'), iSan = p.cot.indexOf('san'), theoFile = {};
      p.dong.forEach(function (r) {
        var f = String(r[iFile] || '(không tên)'), x = theoFile[f] || (theoFile[f] = { file: f, san: r[iSan], dong: 0, sl: 0 });
        x.dong++; x.sl += Number(r[p.cot.indexOf('sl')]) || 0;
      });
      $('phan-mota').textContent = tenTrangThai(p) + ' · ' + A.so(p.so_dong) + ' dòng · ' + A.so(p.so_don) + ' đơn' + (p.ghi_chu ? ' · ' + p.ghi_chu : '') + '. Tick file gửi nhầm rồi bấm “Bỏ các file đã chọn”.';
      $('phan-bang').innerHTML = '<table class="tbl"><thead><tr><th>Bỏ</th><th>File</th><th>Nguồn</th><th class="so">Số dòng</th><th class="so">Số cuốn</th></tr></thead><tbody>' +
        Object.keys(theoFile).map(function (f) {
          var x = theoFile[f];
          return '<tr><td><input type="checkbox" data-bo-file="' + esc(f) + '" aria-label="Bỏ file ' + esc(f) + '"></td><td>' + esc(f) + '</td><td>' + esc(x.san) + '</td><td class="so">' + A.so(x.dong) + '</td><td class="so">' + A.so(x.sl) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }).catch(function (e) { $('phan-loi').textContent = e.message; });
  }
  function xongQl(msg) { $('dlg-phan').close(); A.toast(msg, 'ok'); taiTongHop(); if (A.S.gop && A.S.gop.dot_id === qlPhan.dot_id) A.toast('Bấm “🔄 Tính lại” ở thanh gộp để cập nhật kết quả gộp.'); }

  /* ---------- Gắn sự kiện ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    $('bao-xong').addEventListener('click', function (e) {
      var b = e.target.closest('[data-bx]');
      if (!b || b.disabled) return;
      if (b.dataset.bx === 'gui') baoXong();
      else if (b.dataset.bx === 'molai') moLaiPhan();
      else if (b.dataset.bx === 'moi') {
        A.hoi('Bỏ hết file đang có trên máy để làm phần mới?\n\nPhần đã báo xong vẫn nằm trên Google Sheets, không mất.', '🧹 Làm phần mới', { nhe: true, tieuDe: 'Làm phần mới' })
          .then(function (ok) {
            if (!ok) return;
            nhap.daGui = null; gui.loi = '';
            A.S.files = []; A.S.demFile = 0;
            A.gop(); A.xuLy(false);
          });
      }
    });
    $('gop-bar').addEventListener('click', function (e) {
      var b = e.target.closest('[data-gb]');
      if (!b || b.disabled) return;
      var v = b.dataset.gb;
      if (v === 've') veTuGop();
      else if (v === 'lai') { T.id = A.S.gop.dot_id; xemGop(); }
      else if (v === 'tai') A.taiNha(PL.NHA.slice(), b);
      else if (v === 'chot') { T.id = A.S.gop.dot_id; chotDot(); }
      else if (v === 'molai') moLaiDot();
    });
    $('dot-chon').addEventListener('change', function () { T.id = $('dot-chon').value; T.dot = null; T.phan = []; veTongHop(false); });
    $('dot-lam-moi').addEventListener('click', function () { taiTongHop(); });
    $('dot-xem').addEventListener('click', function () { xemGop(); });
    $('dot-tai').addEventListener('click', taiBaNha);
    $('dot-chot').addEventListener('click', chotDot);
    $('dot-mo-lai').addEventListener('click', moLaiDot);
    $('dot-xoa').addEventListener('click', xoaDot);
    $('dot-bang').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ql-phan]');
      if (b) moQuanLyPhan(b.dataset.qlPhan);
    });
    $('phan-bo').addEventListener('click', function () {
      var bo = Array.prototype.map.call($('phan-bang').querySelectorAll('[data-bo-file]:checked'), function (c) { return c.dataset.boFile; });
      if (!bo.length) { $('phan-loi').textContent = 'Chưa tick file nào.'; return; }
      DM.goi('suaPhan', { dot_id: qlPhan.dot_id, nguoi: qlPhan.nguoi, bo_file: bo })
        .then(function (j) { xongQl('✂️ Đã bỏ ' + A.so(j.so_bo) + ' dòng (' + bo.join(', ') + ') khỏi phần của ' + qlPhan.nguoi + '.'); })
        .catch(function (e) { if (!e.daHuy) $('phan-loi').textContent = e.message; });
    });
    $('phan-molai').addEventListener('click', function () {
      DM.goi('moLaiPhan', { dot_id: qlPhan.dot_id, nguoi: qlPhan.nguoi }, { admin: true })
        .then(function () { xongQl('↩️ Đã mở lại phần của ' + qlPhan.nguoi + ' – người đó sửa rồi báo xong lại.'); })
        .catch(function (e) { if (!e.daHuy) $('phan-loi').textContent = e.message; });
    });
    $('phan-xoa').addEventListener('click', function () {
      A.hoi('Xóa cả phần gửi của ' + qlPhan.nguoi + ' trong đợt ' + DG.ngayNgan(qlPhan.dot_id) + '?', '🗑 Xóa phần', { tieuDe: 'Admin – Xóa phần gửi' }).then(function (ok) {
        if (!ok) return;
        DM.goi('xoaPhan', { dot_id: qlPhan.dot_id, nguoi: qlPhan.nguoi })
          .then(function () { xongQl('🗑 Đã xóa phần của ' + qlPhan.nguoi + '.'); })
          .catch(function (e) { if (!e.daHuy) $('phan-loi').textContent = e.message; });
      });
    });
    $('dot-nhan').addEventListener('click', function () { A.diToi(A.laDatHang() ? 'dot' : 'caidat'); });
    DM.nghe(function (loai) {
      if (loai === 'api' || loai === 'caidat' || loai === 'nguoidung' || loai === 'admin') { veNhan(); veBaoXong(); A.veBanner(); if (!$('man-dot').hidden) veBangTongHop(); }
    });
    veNhan();
  });

  root.ManDot = {
    sauXuLy: function () { luuNhap(); veBaoXong(); veGopBar(); },
    khoiPhucNhap: khoiPhucNhap,
    veTongHop: veTongHop,
    veNhan: veNhan,
    T: T
  };
})(typeof self !== 'undefined' ? self : this);
