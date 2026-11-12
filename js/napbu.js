/* 📥 Nạp bù số liệu cũ (quyền Admin, Apps Script api ≥ 8):
 * thả file đơn cũ → chọn ngày (đoán sẵn từ ngày trong file) + gian cho từng file → CHỈ ghi sheet THONG_KE.
 * Không tạo đợt, không đụng danh mục (không tự học, không ghi lịch sử đặt hàng). Dòng đã có (sàn + mã đơn + dòng) bỏ qua. */
(function (root) {
  'use strict';
  var DM = root.DanhMuc, A = root.App, PL = root.PhanLoai, SB = root.SanBan, DG = root.DotGop;
  var $ = function (id) { return document.getElementById(id); };
  var N = { files: [], dang: false };

  function duocNap() { return DM.coThongKe() && (A.coQuyen ? A.coQuyen('qt_napbu') : A.laAdmin()); }
  function veNut() {
    var an = !duocNap();
    document.querySelectorAll('.nut-nap-bu').forEach(function (b) { b.hidden = an; });
  }
  /* Ngày đoán cho 1 file: web = ngày xuất ; sàn = ngày đặt mới nhất trong file ; không có → ngày trong tên file ; không có → trống */
  function doanNgay(p, ten) {
    if (p.ngayXuat) return p.ngayXuat;
    var max = '';
    p.dung.forEach(function (r) { if (r.ngayDat && r.ngayDat > max) max = r.ngayDat; });
    if (max) return max;
    var m = /(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/.exec(ten) || [];
    if (m[1] && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) return m[1] + '-' + m[2] + '-' + m[3];
    m = /(\d{2})[-_.](\d{2})[-_.](20\d{2})/.exec(ten) || [];
    return m[3] ? m[3] + '-' + m[2] + '-' + m[1] : '';
  }
  function nhanFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (!files.length) return;
    $('nb-tt').textContent = '⏳ Đang đọc ' + files.length + ' file…';
    Promise.all(files.map(function (f) {
      if (!/\.xlsx?$/i.test(f.name)) return Promise.resolve({ file: f.name, error: 'Không phải file Excel (.xlsx).' });
      return f.arrayBuffer().then(function (buf) {
        var p = root.DocFile.parseWorkbook(root.XLSX.read(buf, { type: 'array' }), root.XLSX, f.name);
        p.file = f.name;
        if (p.error) return p;
        // Đơn đã hủy không tính; KHÔNG lọc theo trạng thái "chờ giao" (file cũ thường là đơn đã giao)
        var huy = {};
        p.rows.forEach(function (r) { if (r.daHuy && r.orderId) huy[r.orderId] = 1; });
        p.dung = p.rows.filter(function (r) { return !r.daHuy && !(r.orderId && huy[r.orderId]) && Number(r.sl) > 0; });
        p.soHuy = p.rows.length - p.dung.length;
        var ngay = {};
        p.dung.forEach(function (r) { if (r.ngayDat) ngay[r.ngayDat] = 1; });
        var ds = Object.keys(ngay).sort();
        p.tuNgay = ds[0] || ''; p.denNgay = ds[ds.length - 1] || ''; p.soNgay = ds.length;
        p.ngay = doanNgay(p, f.name);
        p.theoDong = p.san !== 'Web' && ds.length > 3; // file gồm nhiều ngày (Order_all cả tháng) → mặc định chia theo ngày đặt của từng đơn
        p.gian = SB.doanGian(f.name, DM.caiDat.gian);
        if (!p.dung.length) p.error = 'Không có dòng nào để nạp (đơn hủy / trống).';
        return p;
      }).catch(function () { return { file: f.name, error: 'Không mở được file.' }; });
    })).then(function (ds) {
      ds.forEach(function (p) {
        if (p.san === 'Web' && N.files.some(function (x) { return x.webKey === p.webKey; })) return;
        N.files = N.files.filter(function (x) { return x.file !== p.file; });
        N.files.push(p);
      });
      $('nb-tt').textContent = '';
      ve();
    });
  }
  function ve() {
    var e = A.esc, homNay = DG.homNayVN(), cuNhat = SB.congNgay(homNay, -183);
    $('nb-bang').innerHTML = !N.files.length ? '' :
      '<table class="tbl nb-tbl"><thead><tr><th>File</th><th>Sàn</th><th class="so">Dòng</th><th>Ngày ghi số liệu</th><th>Gian</th><th>Kết quả</th><th><span class="sr">Bỏ</span></th></tr></thead><tbody>' +
      N.files.map(function (p, i) {
        if (p.error) return '<tr><td>' + e(p.file) + '</td><td colspan="5" class="dot-canh">😿 ' + e(p.error) + '</td><td><button type="button" class="btn btn-icon btn-ghost" data-nb-bo="' + i + '" aria-label="Bỏ file">×</button></td></tr>';
        return '<tr><td>' + e(p.file) + (p.tuNgay ? '<div class="pl">đơn đặt ' + DG.ngayNgan(p.tuNgay) + (p.denNgay !== p.tuNgay ? ' → ' + DG.ngayNgan(p.denNgay) + ' (' + p.soNgay + ' ngày)' : '') + '</div>' : '') + '</td>' +
          '<td><span class="tag tag-' + p.san + '">' + p.san + '</span></td>' +
          '<td class="so">' + A.so(p.dung.length) + (p.soHuy ? '<div class="pl">bỏ ' + A.so(p.soHuy) + ' hủy</div>' : '') + '</td>' +
          '<td><input class="input input-ngay" type="date" data-nb-ngay="' + i + '" value="' + e(p.ngay) + '" min="' + cuNhat + '" max="' + homNay + '"' + (p.theoDong ? ' disabled' : '') + ' aria-label="Ngày của file ' + e(p.file) + '">' +
          (p.san !== 'Web' && p.soNgay > 1 ? '<label class="radio nb-theo"><input type="checkbox" data-nb-theo="' + i + '"' + (p.theoDong ? ' checked' : '') + '> chia theo ngày đặt của từng đơn</label>' : '') + '</td>' +
          '<td><input class="input" data-nb-gian="' + i + '" value="' + e(p.gian || '') + '" placeholder="(để trống)" aria-label="Gian"></td>' +
          '<td>' + (p.kq ? '<span class="' + (p.kq.loi ? 'dot-canh' : 'dot-xong') + '">' + e(p.kq.text) + '</span>' : '<span class="muted">—</span>') + '</td>' +
          '<td><button type="button" class="btn btn-icon btn-ghost" data-nb-bo="' + i + '" aria-label="Bỏ file">×</button></td></tr>';
      }).join('') + '</tbody></table>';
    $('nb-nap').disabled = N.dang || !N.files.some(function (p) { return !p.error && !(p.kq && !p.kq.loi); });
  }
  /* Phân loại theo danh mục hiện tại (chỉ ĐỌC danh mục) rồi gửi từng file */
  function nap() {
    var ds = N.files.filter(function (p) { return !p.error && !(p.kq && !p.kq.loi); });
    var thieu = ds.filter(function (p) { return !p.theoDong && !p.ngay; });
    $('nb-loi').textContent = '';
    if (thieu.length) { $('nb-loi').textContent = 'Chưa chọn ngày cho file: ' + thieu.map(function (p) { return p.file; }).join(', '); return; }
    if (!ds.length) return;
    N.dang = true; ve();
    var opt = { catalog: DM.catalog, maKhac: DM.caiDat.maKhac, plVoNghia: DM.caiDat.plVoNghia }, tong = { moi: 0, trung: 0 };
    var chay = ds.reduce(function (truoc, p, k) {
      return truoc.then(function () {
        $('nb-tt').textContent = '⏳ Đang nạp ' + (k + 1) + '/' + ds.length + ': ' + p.file + '…';
        var wk = p.san === 'Web' && p.webKey ? DG.dauFileWeb(p.webKey) : '';
        var rows = p.dung.map(function (r) {
          var x = Object.assign({}, r, { gian: (p.gian || '').replace(/\s+/g, ' ').trim() });
          if (wk) x.webKey = wk;
          if (p.theoDong) x.ngayTk = r.ngayDat || p.ngay || '';
          return x;
        });
        var kq = PL.classify(rows, DM.catalog, { maKhac: DM.caiDat.maKhac, plVoNghia: DM.caiDat.plVoNghia });
        return DM.goi('napThongKe', { ngay: p.ngay || '', theo_dong: p.theoDong ? 1 : 0, file: p.file, dl: SB.maHoa(kq, opt) }).then(function (j) {
          tong.moi += j.soDongMoi; tong.trung += j.soDongTrung;
          p.kq = { text: '✅ ' + A.so(j.soDongMoi) + ' dòng mới' + (j.soDongTrung ? ', bỏ ' + A.so(j.soDongTrung) + ' đã có' : '') + (j.soDongCu ? ', bỏ ' + A.so(j.soDongCu) + ' quá 183 ngày' : '') };
        }, function (e) {
          p.kq = { loi: true, text: e.daHuy ? 'Đã hủy' : e.message };
          if (e.daHuy) throw e;
        }).then(ve);
      });
    }, Promise.resolve());
    chay.catch(function () { /* hủy nhập mã Admin */ }).then(function () {
      N.dang = false; $('nb-tt').textContent = '';
      ve();
      if (tong.moi || tong.trung) A.toast('📥 Nạp bù xong: ' + A.so(tong.moi) + ' dòng mới' + (tong.trung ? ', bỏ qua ' + A.so(tong.trung) + ' dòng đã có' : '') + '.', 'ok');
      if (tong.moi && root.ManSanBan) root.ManSanBan.xoaNho(true);
    });
  }
  function mo() {
    if (!duocNap()) return;
    N.files = N.files.filter(function (p) { return !p.kq; });
    $('nb-loi').textContent = ''; $('nb-tt').textContent = '';
    ve();
    $('dlg-napbu').showModal();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('click', function (e) { if (e.target.closest('.nut-nap-bu')) mo(); });
    $('nb-chon').addEventListener('click', function () { $('nb-input').click(); });
    $('nb-input').addEventListener('change', function () { nhanFiles($('nb-input').files); $('nb-input').value = ''; });
    $('nb-nap').addEventListener('click', nap);
    $('nb-bang').addEventListener('change', function (e) {
      var t = e.target;
      if (t.dataset.nbNgay !== undefined) N.files[+t.dataset.nbNgay].ngay = t.value;
      else if (t.dataset.nbGian !== undefined) N.files[+t.dataset.nbGian].gian = t.value;
      else if (t.dataset.nbTheo !== undefined) { N.files[+t.dataset.nbTheo].theoDong = t.checked; ve(); }
    });
    $('nb-bang').addEventListener('click', function (e) {
      var b = e.target.closest('[data-nb-bo]');
      if (b && !N.dang) { N.files.splice(+b.dataset.nbBo, 1); ve(); }
    });
    var dlg = $('dlg-napbu');
    dlg.addEventListener('dragover', function (e) { e.preventDefault(); });
    dlg.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer) nhanFiles(e.dataTransfer.files); });
    DM.nghe(function (loai) { if (loai === 'api' || loai === 'admin' || loai === 'nguoidung' || loai === 'caidat' || loai === 'quyen') veNut(); });
    veNut();
  });

  root.NapBu = { mo: mo, veNut: veNut };
})(typeof self !== 'undefined' ? self : this);
