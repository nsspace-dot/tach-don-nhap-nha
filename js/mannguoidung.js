/* Tab "👥 Người dùng" (Apps Script api ≥ 9): bảng người × quyền tick từng ô, mẫu vai trò, sao chép quyền, tạm khóa, thêm người.
 * Lưu = 1 lần ghi (luuQuyen, cần mã Admin – kiểm tra ở Apps Script); mỗi người đổi quyền 1 dòng LICH_SU; máy khác nhận ở lần đồng bộ 30 giây.
 * Apps Script bản cũ (api 3–8): chỉ có tên + 3 vai trò như trước (lưu bằng luuNguoiDung). */
(function (root) {
  'use strict';
  var DM = root.DanhMuc, A = root.App, Q = root.Quyen;
  var $ = function (id) { return document.getElementById(id); };
  var S = null; // bản đang sửa: { nguoi: [{ ten, mau, quyen: {k:1}, khoa, moi }], mau: [{ ten, quyen: {k:1}, goc, moi }], doi }
  var VT = { san: 'Nhân viên sàn', dat_hang: 'Người đặt hàng', admin: 'Admin' };

  function suaDuoc() { return A.coQuyen('qt_nguoidung'); }
  function tapHop(ds) { var o = {}; (ds || []).forEach(function (k) { o[k] = 1; }); return o; }
  function mang(o) { return Q.DS.filter(function (k) { return o[k]; }); }
  function napTuMay() {
    if (DM.coBangQuyen()) {
      var b = DM.bangQuyen;
      S = { nguoi: b.nguoi.map(function (n) { return { ten: n.ten, mau: n.mau, quyen: tapHop(n.quyen), khoa: n.khoa }; }),
            mau: b.mau.map(function (m) { return { ten: m.ten, quyen: tapHop(m.quyen), goc: m.goc }; }), doi: false };
    } else { // Apps Script chưa có bảng quyền: 3 vai trò cũ
      S = { cu: true, doi: false, mau: Q.MAU_GOC.filter(function (m) { return m.ten !== 'Chỉ xem'; }).map(function (m) { return { ten: m.ten, quyen: tapHop(m.quyen), goc: true }; }),
            nguoi: DM.nguoiDung.map(function (n) { var t = Q.mauTheoVaiTro(n.vai_tro); return { ten: n.ten, mau: t, quyen: tapHop(Q.timMau(null, t).quyen), khoa: false }; }) };
    }
  }
  function mauCua(n) { return Q.mauKhop(S.mau.map(function (m) { return { ten: m.ten, quyen: mang(m.quyen) }; }), mang(n.quyen)); }
  function soAdmin() { return S.nguoi.filter(function (n) { return !n.khoa && n.quyen.qt_nguoidung && n.ten.trim(); }).length; }

  function dauBang(cotDau) {
    var h1 = '<tr>' + cotDau.map(function (c) { return '<th rowspan="2"' + (c[1] ? ' class="' + c[1] + '"' : '') + '>' + c[0] + '</th>'; }).join('');
    var h2 = '<tr>';
    Q.NHOM.forEach(function (g, gi) {
      h1 += '<th colspan="' + g.ds.length + '" class="nd-nhom nd-nhom-' + gi + '">' + A.esc(g.ten) + '</th>';
      g.ds.forEach(function (q, i) { h2 += '<th class="nd-q' + (i === 0 ? ' nd-dau-nhom' : '') + '" title="' + A.esc(q[2] || q[1]) + '"><span>' + A.esc(q[1]) + '</span></th>'; });
    });
    return '<thead>' + h1 + '</tr>' + h2 + '</tr></thead>';
  }
  function oQuyen(loai, i, o, khoa) {
    var h = '';
    Q.NHOM.forEach(function (g) {
      g.ds.forEach(function (q, k) {
        h += '<td class="nd-o' + (k === 0 ? ' nd-dau-nhom' : '') + '"><input type="checkbox" data-nd-' + loai + '="' + i + '" data-k="' + q[0] + '"' + (o[q[0]] ? ' checked' : '') + (khoa ? ' disabled' : '') +
          ' aria-label="' + A.esc(g.ten + ': ' + q[1]) + '"></td>';
      });
    });
    return h;
  }
  function ve() {
    if (!S || (!S.doi && !$('man-nguoidung').contains(document.activeElement))) napTuMay();
    var sua = suaDuoc(), cu = !!S.cu;
    $('nd-nut').hidden = !sua;
    $('nd-them-mau').hidden = cu;
    $('nd-huy').hidden = !S.doi;
    $('nd-luu').disabled = !S.doi;
    $('nd-tom').textContent = S.nguoi.length + ' người · ' + soAdmin() + ' Admin' + (S.doi ? ' · ✏️ có thay đổi chưa lưu' : '') + (sua ? '' : ' · chỉ xem (cần quyền “Quản lý người dùng”)');
    if (cu) $('nd-ghichu').innerHTML = '⚠️ Google Sheets đang chạy Code.gs bản cũ: chỉ đặt được <b>tên + 3 vai trò</b> như trước. Cập nhật Apps Script (HUONG-DAN.md) để tick quyền từng ô.';
    var e = A.esc, dsMau = S.mau.map(function (m) { return m.ten; });
    $('nd-bang').innerHTML = '<table class="tbl nd-tbl">' + dauBang([['Người dùng', 'nd-c-ten'], ['Mẫu vai trò', 'nd-c-mau'], ['Tạm khóa', 'nd-c-khoa'], ['<span class="sr">Thao tác</span>', 'nd-c-nut']]) + '<tbody>' +
      (S.nguoi.map(function (n, i) {
        var khop = mauCua(n), toi = n.ten === DM.caiDat.toiLa;
        return '<tr class="' + (n.khoa ? 'nd-bi-khoa' : '') + '">' +
          '<td class="nd-c-ten">' + (sua ? '<input class="input" data-nd-ten="' + i + '" value="' + e(n.ten) + '" maxlength="40" placeholder="Tên" aria-label="Tên người dùng">' : '<b>' + e(n.ten) + '</b>') + (toi ? '<div class="pl">(bạn)</div>' : '') + '</td>' +
          '<td class="nd-c-mau">' + (sua ? '<select class="select" data-nd-mau="' + i + '" aria-label="Áp mẫu vai trò cho ' + e(n.ten) + '">' + (khop ? '' : '<option value="" selected>✏️ Đã chỉnh riêng' + (n.mau ? ' (từ ' + e(n.mau) + ')' : '') + '</option>') +
            dsMau.map(function (t) { return '<option value="' + e(t) + '"' + (t === khop ? ' selected' : '') + '>' + e(t) + '</option>'; }).join('') + '</select>' : e(khop || 'Quyền riêng')) + '</td>' +
          '<td class="nd-c-khoa"><input type="checkbox" data-nd-khoa="' + i + '"' + (n.khoa ? ' checked' : '') + (sua && !cu ? '' : ' disabled') + ' aria-label="Tạm khóa ' + e(n.ten) + '" title="Tạm khóa: người này không vào được tab nào, không ghi được gì (không xóa quyền)"></td>' +
          '<td class="nd-c-nut">' + (sua ? (cu ? '' : '<select class="select nd-chep" data-nd-chep="' + i + '" aria-label="Sao chép quyền từ người khác" title="Sao chép quyền từ người khác"><option value="">📋 Sao chép từ…</option>' +
            S.nguoi.map(function (m, j) { return j === i || !m.ten.trim() ? '' : '<option value="' + j + '">' + e(m.ten) + '</option>'; }).join('') + '</select> ') +
            '<button type="button" class="btn btn-icon btn-ghost" data-nd-xoa="' + i + '" aria-label="Xóa ' + e(n.ten) + '" title="Xóa người này">🗑</button>' : '') + '</td>' +
          oQuyen('q', i, n.quyen, !sua || cu) + '</tr>';
      }).join('') || '<tr><td colspan="' + (4 + Q.DS.length) + '" class="trong-bang">Chưa có ai – bấm “＋ Thêm người”.</td></tr>') + '</tbody></table>';
    $('nd-bang-mau').innerHTML = '<table class="tbl nd-tbl">' + dauBang([['Mẫu', 'nd-c-ten'], ['Đang dùng', 'nd-c-mau'], ['<span class="sr">Xóa</span>', 'nd-c-nut']]) + '<tbody>' +
      S.mau.map(function (m, i) {
        var dung = S.nguoi.filter(function (n) { return mauCua(n) === m.ten; }).length, khoa = !sua || cu || m.ten === 'Admin';
        return '<tr><td class="nd-c-ten">' + (m.goc || !sua ? '<b>' + e(m.ten) + '</b>' + (m.goc ? '<div class="pl">mẫu gốc' + (m.ten === 'Admin' ? ' · luôn đủ quyền' : '') + '</div>' : '')
            : '<input class="input" data-nd-ten-mau="' + i + '" value="' + e(m.ten) + '" maxlength="40" placeholder="Tên mẫu" aria-label="Tên mẫu">') + '</td>' +
          '<td class="nd-c-mau">' + dung + ' người</td>' +
          '<td class="nd-c-nut">' + (!m.goc && sua ? '<button type="button" class="btn btn-icon btn-ghost" data-nd-xoa-mau="' + i + '" aria-label="Xóa mẫu ' + e(m.ten) + '">🗑</button>' : '') + '</td>' +
          oQuyen('m', i, m.quyen, khoa) + '</tr>';
      }).join('') + '</tbody></table>';
    $('nd-bang-mau').parentNode.hidden = cu; document.querySelector('.nd-td-mau').hidden = cu;
  }
  function doi() { S.doi = true; setTimeout(ve, 0); }

  function luu() {
    var ds = S.nguoi.map(function (n) { return { ten: n.ten.replace(/\s+/g, ' ').trim(), mau: mauCua(n) || n.mau || '', quyen: mang(n.quyen), khoa: !!n.khoa }; }).filter(function (n) { return n.ten; });
    var trung = ds.filter(function (n, i) { return ds.some(function (m, j) { return j < i && m.ten.toLowerCase() === n.ten.toLowerCase(); }); });
    if (trung.length) { A.toast('Tên bị trùng: ' + trung[0].ten, 'loi'); return; }
    if (!ds.some(function (n) { return !n.khoa && n.quyen.indexOf('qt_nguoidung') >= 0; })) { A.toast('Phải còn ít nhất 1 Admin (người có quyền “Quản lý người dùng” và không bị tạm khóa).', 'loi'); return; }
    var mau = S.mau.map(function (m) { return { ten: m.ten.replace(/\s+/g, ' ').trim(), quyen: mang(m.quyen) }; }).filter(function (m) { return m.ten; });
    var trungMau = mau.filter(function (m, i) { return mau.some(function (x, j) { return j < i && x.ten.toLowerCase() === m.ten.toLowerCase(); }); });
    if (trungMau.length) { A.toast('Tên mẫu bị trùng: ' + trungMau[0].ten, 'loi'); return; }
    var toi = ds.filter(function (n) { return n.ten === DM.caiDat.toiLa; })[0];
    var hoi = toi && suaDuoc() && (toi.khoa || toi.quyen.indexOf('qt_nguoidung') < 0)
      ? A.hoi('Bạn đang tự bỏ quyền “Quản lý người dùng” của chính mình (' + toi.ten + '). Lưu xong bạn sẽ không sửa được bảng này nữa. Vẫn lưu?', 'Vẫn lưu', { tieuDe: 'Tự bỏ quyền của mình' })
      : Promise.resolve(true);
    hoi.then(function (ok) {
      if (!ok) return;
      $('nd-luu').disabled = true;
      var goi = S.cu ? DM.goi('luuNguoiDung', { ds: ds.map(function (n) { return { ten: n.ten, vai_tro: n.quyen.indexOf('qt_nguoidung') >= 0 ? 'admin' : n.quyen.indexOf('dot_chot') >= 0 ? 'dat_hang' : 'san' }; }) })
        : DM.goi('luuQuyen', { nguoi: ds, mau: mau });
      return goi.then(function (j) {
        if (j.nguoi_dung) DM.nhanNguoiDung(j.nguoi_dung);
        if (j.quyen) DM.nhanQuyen(j.quyen);
        S = null; ve();
        A.toast('👥 Đã lưu quyền của ' + ds.length + ' người' + (j.soDoi ? ' (' + j.soDoi + ' thay đổi, đã ghi Lịch sử)' : '') + ' – máy khác nhận trong 30 giây.', 'ok');
      }).catch(function (e) { A.baoLoi('Không lưu được', e); $('nd-luu').disabled = false; });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var man = $('man-nguoidung');
    man.addEventListener('input', function (e) {
      var t = e.target;
      if (t.dataset.ndTen !== undefined) { S.nguoi[+t.dataset.ndTen].ten = t.value; S.doi = true; $('nd-luu').disabled = false; $('nd-huy').hidden = false; }
      else if (t.dataset.ndTenMau !== undefined) {
        var m = S.mau[+t.dataset.ndTenMau], cu = m.ten;
        m.ten = t.value; S.doi = true; $('nd-luu').disabled = false; $('nd-huy').hidden = false;
        S.nguoi.forEach(function (n) { if (n.mau === cu) n.mau = m.ten; });
      }
    });
    man.addEventListener('change', function (e) {
      var t = e.target, d = t.dataset;
      if (d.ndQ !== undefined) { var n = S.nguoi[+d.ndQ]; if (t.checked) n.quyen[d.k] = 1; else delete n.quyen[d.k]; doi(); }
      else if (d.ndM !== undefined) {
        // sửa mẫu → người đang dùng đúng mẫu đó đổi theo
        var m = S.mau[+d.ndM], theo = S.nguoi.filter(function (x) { return mauCua(x) === m.ten; });
        if (t.checked) m.quyen[d.k] = 1; else delete m.quyen[d.k];
        theo.forEach(function (x) { x.quyen = Object.assign({}, m.quyen); x.mau = m.ten; });
        doi();
      }
      else if (d.ndMau !== undefined) { var x = S.nguoi[+d.ndMau], mm = S.mau.filter(function (y) { return y.ten === t.value; })[0]; if (mm) { x.quyen = Object.assign({}, mm.quyen); x.mau = mm.ten; doi(); } }
      else if (d.ndKhoa !== undefined) { S.nguoi[+d.ndKhoa].khoa = t.checked; doi(); }
      else if (d.ndChep !== undefined && t.value !== '') { var tu = S.nguoi[+t.value], den = S.nguoi[+d.ndChep]; den.quyen = Object.assign({}, tu.quyen); den.mau = tu.mau; doi(); A.toast('📋 Đã sao chép quyền của ' + tu.ten + ' sang ' + (den.ten || 'người mới') + ' – bấm Lưu quyền.', 'ok'); }
      else if (d.ndTen !== undefined || d.ndTenMau !== undefined) setTimeout(ve, 0); // sự kiện change bắn lúc rời ô: vẽ lại sau, không xóa ô đang rời
    });
    man.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'nd-them') {
        var goc = S.mau[0];
        S.nguoi.push({ ten: '', mau: goc.ten, quyen: Object.assign({}, goc.quyen), khoa: false, moi: true });
        doi();
        var o = $('nd-bang').querySelector('[data-nd-ten="' + (S.nguoi.length - 1) + '"]');
        if (o) o.focus();
      } else if (b.id === 'nd-them-mau') {
        S.mau.push({ ten: 'Mẫu mới ' + (S.mau.filter(function (m) { return !m.goc; }).length + 1), quyen: Object.assign({}, S.mau[0].quyen), goc: false, moi: true });
        doi();
        var om = $('nd-bang-mau').querySelector('[data-nd-ten-mau="' + (S.mau.length - 1) + '"]');
        if (om) { om.focus(); om.select(); }
      } else if (b.id === 'nd-huy') { S = null; ve(); }
      else if (b.id === 'nd-luu') luu();
      else if (b.dataset.ndXoa !== undefined) { S.nguoi.splice(+b.dataset.ndXoa, 1); doi(); }
      else if (b.dataset.ndXoaMau !== undefined) { S.mau.splice(+b.dataset.ndXoaMau, 1); doi(); }
    });
    DM.nghe(function (loai) {
      if ((loai === 'quyen' || loai === 'nguoidung' || loai === 'api' || loai === 'caidat') && !man.hidden && !(S && S.doi)) { S = null; ve(); }
    });
  });

  root.ManNguoiDung = { ve: ve, VT: VT };
})(typeof self !== 'undefined' ? self : this);
