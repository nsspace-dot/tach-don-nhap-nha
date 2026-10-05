/* Màn chính: thả file → phân loại → xem kết quả → tải Excel. Cùng các tiện ích dùng chung. */
(function (root) {
  'use strict';
  var PL = root.PhanLoai, DM = root.DanhMuc, LV = root.LinhVat, TK = root.ThongKe;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Tiện ích ---------- */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var soVN = new Intl.NumberFormat('vi-VN');
  function so(n) { return soVN.format(Number(n) || 0); }
  function boDau(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }
  function toast(msg, loai) {
    var t = document.createElement('div');
    t.className = 'toast ' + (loai || '');
    t.textContent = msg;
    $('toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, loai === 'loi' ? 7000 : 4000);
  }
  /* Hộp xác nhận. opt.huy: chữ nút hủy ; opt.nhe: nút đồng ý màu chính (không phải màu đỏ) */
  function hoi(noiDung, nutOk, opt) {
    opt = opt || {};
    return new Promise(function (resolve) {
      var d = $('dlg-hoi');
      $('hoi-noidung').textContent = noiDung;
      $('hoi-ok').textContent = nutOk || 'Đồng ý';
      $('hoi-ok').className = 'btn ' + (opt.nhe ? 'btn-primary' : 'btn-danger');
      $('hoi-huy').textContent = opt.huy || 'Thôi';
      $('dlg-hoi-title').textContent = opt.tieuDe || 'Chắc chưa nè?';
      d.returnValue = '';
      d.addEventListener('close', function f() { d.removeEventListener('close', f); resolve(d.returnValue === 'yes'); });
      d.showModal();
    });
  }
  function taiVe(blob, ten) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ten;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function nutGhi(html, attrs) {
    var khoa = !DM.coTheGhi();
    return '<button type="button" ' + (attrs || '') + (khoa ? ' disabled title="Dán URL Apps Script ở màn Cài đặt để dùng nút này"' : '') + '>' + html + '</button>';
  }

  /* ---------- Trạng thái ---------- */
  var S = { files: [], demFile: 0, kq: null, tab: 'HA', hocDaGui: {}, hocDangGui: false,
            duPhong: { HA: {}, KV: {}, ML: {} }, dpGoiY: [] }; // duPhong: số dự phòng ĐÃ BẤM thêm (theo nhà → khóa sách)

  /* ---------- Lịch sử đặt hàng (dùng chung cho gợi ý dự phòng + tab Thống kê) ---------- */
  var LS = { rows: null, tu: '', url: '', dangTai: null, loi: '', tongDong: 0, canhBaoLon: false, ngayCuNhat: '', nghe: [] };
  function phatLS() { LS.nghe.forEach(function (f) { f(); }); if (S.kq && PL.NHA.indexOf(S.tab) >= 0) veBang(); }
  /* tu: ngày bắt đầu cần (mặc định 150 ngày gần nhất). epBuoc: tải lại kể cả đã có */
  function taiLichSu(tu, epBuoc) {
    if (!DM.coTheGhi()) { LS.rows = null; return Promise.resolve(null); }
    tu = tu || TK.congNgay(TK.homNay(), -150);
    if (LS.url !== DM.caiDat.url) { LS.rows = null; epBuoc = true; }
    if (!epBuoc && LS.rows && LS.tu <= tu) return Promise.resolve(LS.rows);
    if (LS.dangTai && !epBuoc && LS.dangTu <= tu) return LS.dangTai;
    LS.loi = '';
    LS.dangTu = tu;
    var url = DM.caiDat.url;
    var p = LS.dangTai = DM.lichSuDatHang(tu).then(function (j) {
      if (url !== DM.caiDat.url) return null;
      LS.rows = TK.chuanHoa(j); LS.tu = tu; LS.url = url;
      LS.tongDong = j.tongDong || 0; LS.canhBaoLon = !!j.canhBaoLon; LS.ngayCuNhat = j.ngayCuNhat || '';
      return LS.rows;
    }).catch(function (e) { LS.loi = e.message; return null; })
      .then(function (r) { if (LS.dangTai === p) LS.dangTai = null; phatLS(); return r; });
    phatLS();
    return p;
  }
  /* Vừa ghi (ngày, nhà) lên Sheets → sửa luôn bản trên máy, khỏi tải lại */
  function capNhatLichSuCucBo(bg) {
    if (!LS.rows) return;
    LS.rows = LS.rows.filter(function (r) { return !(r.ngay === bg.ngay && bg.nhas.indexOf(r.nha) >= 0); }).concat(TK.chuanHoa(bg.dong));
    phatLS();
  }
  function dpBat() { return DM.caiDat.duPhongBat !== false && Number(DM.caiDat.soNgayDuPhong) > 0; }

  var THE = [
    { k: 'HA', ten: 'Hồng Ân', emoji: '🌸' },
    { k: 'KV', ten: 'Khang Việt', emoji: '🌿' },
    { k: 'ML', ten: 'Minh Long', emoji: '🧈' },
    { k: 'combo', ten: 'Combo', emoji: '🎁' },
    { k: 'chuaRo', ten: 'Chưa rõ nhà', emoji: '🤔' }
  ];

  /* ---------- Đọc file ---------- */
  function nhanFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (!files.length) return;
    var viec = files.map(function (f) {
      if (!/\.xlsx?$/i.test(f.name)) {
        return Promise.resolve({ file: f.name, error: 'Mèo chỉ đọc được file Excel (.xlsx) thôi nha.' });
      }
      return f.arrayBuffer().then(function (buf) {
        var wb = root.XLSX.read(buf, { type: 'array' });
        var p = root.DocFile.parseWorkbook(wb, root.XLSX, f.name);
        p.file = f.name;
        if (!p.error && !p.rows.length) p.error = 'File ' + p.san + ' này không có dòng sản phẩm nào.';
        return p;
      }).catch(function () {
        return { file: f.name, error: 'Không mở được file – có thể file bị hỏng hoặc đang được Excel khóa.' };
      });
    });
    Promise.all(viec).then(function (ds) {
      ds.forEach(function (p) {
        // Nhiều file cùng sàn (mỗi gian hàng 1 file) → cộng thêm, không thay file cũ
        S.files = S.files.filter(function (x) { return !(x.error && x.file === p.file); });
        // File web không có mã đơn: thả lại đúng file cũ (cùng thời gian xuất + nội dung) thì bỏ qua
        if (p.san === 'Web' && S.files.some(function (x) { return x.webKey === p.webKey; })) {
          toast('🌐 File web "' + p.file + '" này đã được thả rồi – bỏ qua để không cộng 2 lần.', 'loi');
          return;
        }
        if (!p.error) p.id = ++S.demFile;
        S.files.push(p);
      });
      gop();
      var trung = ds.reduce(function (s, p) { return s + (p.soDonTrung || 0); }, 0);
      if (trung) toast('🔁 Đã bỏ qua ' + trung + ' đơn trùng (đã có trong file thả trước).');
      var loi = ds.filter(function (p) { return p.error; });
      if (loi.length) setMeoLoi();
      xuLy(true);
    });
  }

  function setMeoLoi() {
    $('drop-cat').innerHTML = LV.meo('buon');
    clearTimeout(setMeoLoi.t);
    setMeoLoi.t = setTimeout(function () { $('drop-cat').innerHTML = LV.meo('om'); }, 3500);
  }

  /* Tính lại chống trùng đơn giữa các file (theo thứ tự thả) */
  function gop() {
    // Shopee: chỉ lấy các trạng thái trong Cài đặt (mặc định "Chờ giao hàng", "Chờ xác nhận")
    S.files.forEach(function (p) { if (!p.error) root.DocFile.locTrangThai(p, DM.caiDat.trangThaiShopee); });
    root.DocFile.gopFile(S.files);
  }

  function veChips() {
    $('chips').innerHTML = S.files.map(function (p, i) {
      if (p.error) {
        return '<li class="chip is-error">😿 <b>' + esc(p.file) + '</b>: ' + esc(p.error) +
          ' <button class="chip-x" data-xoa-file="' + i + '" aria-label="Bỏ file ' + esc(p.file) + '">×</button></li>';
      }
      var dau = '<li class="chip"><span class="tag tag-' + p.san + '">' + p.san + '</span> ' + esc(p.file);
      if (p.san === 'Web') {
        return dau + ' · <b>' + so(p.rows.length) + '</b> dòng sách' + (p.thoiGianXuat ? ' <span class="muted">(xuất ' + esc(p.thoiGianXuat) + ')</span>' : '') +
          ' <button class="chip-x" data-xoa-file="' + i + '" aria-label="Bỏ file ' + esc(p.file) + '">×</button></li>';
      }
      return dau +
        (p.coCotTrangThai ? ' · <b>' + so(p.soDongLay) + '</b> dòng cần lấy / <span title="Đơn đang giao, đã giao, đã hủy… – không lấy">' + so(p.soDongBoQuaTrangThai) + ' dòng bỏ qua (trạng thái khác)</span>' : '') +
        ' · <b>' + so(p.soDonMoi) + '</b> đơn mới (' + so(p.rows.length) + ' dòng)' +
        (p.soDonTrung ? ' · <span class="chip-trung" title="Các đơn này đã có trong file thả trước nên không cộng lại">bỏ qua ' + so(p.soDonTrung) + ' đơn trùng</span>' : '') +
        ' <button class="chip-x" data-xoa-file="' + i + '" aria-label="Bỏ file ' + esc(p.file) + '">×</button></li>';
    }).join('');
  }

  /* ---------- Phân loại ---------- */
  function rows() {
    return S.files.filter(function (p) { return !p.error; }).reduce(function (a, p) { return a.concat(p.rows); }, []);
  }

  function xuLy(moi) {
    var r = rows();
    S.kq = r.length ? PL.classify(r, DM.catalog, { maKhac: DM.caiDat.maKhac, plVoNghia: DM.caiDat.plVoNghia }) : null;
    if (!S.kq) S.duPhong = { HA: {}, KV: {}, ML: {} };
    veChips();
    veKetQua(moi);
    tuHoc();
    doiKhoaCu();
  }

  /* Combo khai báo bằng khóa mã vạch trơn ("sku:<mã vạch>") → đổi sang "sku:<mã vạch>|<phân loại>" (ghi LICH_SU) */
  var daDoiKhoa = {};
  function doiKhoaCu() {
    if (!S.kq || !DM.coTheGhi()) return;
    S.kq.doiKhoa.forEach(function (d) {
      var id = d.combo_id + '|' + d.khoa_cu;
      if (daDoiKhoa[id]) return;
      daDoiKhoa[id] = true;
      DM.goi('doiKhoaCombo', d)
        .then(function () { toast('🔑 Đã đổi khóa combo ' + d.khoa_cu + ' → ' + d.khoa_moi.join(', ') + ' (an toàn hơn cho mã vạch).', 'ok'); })
        .catch(function (e) { delete daDoiKhoa[id]; toast('Không đổi được khóa combo: ' + e.message, 'loi'); });
    });
  }

  /* Ghi gom SKU tự học 1 lần (khi đã kết nối Google Sheets) */
  function tuHoc() {
    if (!S.kq || !DM.coTheGhi() || S.hocDangGui) return;
    var ds = S.kq.hoc.filter(function (h) { return !S.hocDaGui[h.key]; });
    // Giá gần nhất của SKU đã có trong danh mục – gom chung vào 1 lần ghi
    var gia = S.kq.capNhatGia.filter(function (g) { return !S.hocDaGui[g.key + '@' + g.gia]; });
    // Sổ mã chuẩn (barcode web) + mã phụ tự khớp – cũng gom chung
    var mc = S.kq.maChuan.filter(function (x) { return !S.hocDaGui['mc:' + x.barcode + '@' + x.ngay_thay + '@' + x.gia_bia]; });
    var mp = S.kq.maPhu.filter(function (x) { return !S.hocDaGui['mp:' + x.key + '>' + x.ma_moi]; });
    var dau = [].concat(ds.map(function (h) { return h.key; }), gia.map(function (g) { return g.key + '@' + g.gia; }),
      mc.map(function (x) { return 'mc:' + x.barcode + '@' + x.ngay_thay + '@' + x.gia_bia; }), mp.map(function (x) { return 'mp:' + x.key + '>' + x.ma_moi; }));
    if (!dau.length) return;
    S.hocDangGui = true;
    dau.forEach(function (k) { S.hocDaGui[k] = true; });
    DM.goi('upsertSkuBatch', { items: ds, gia: gia.map(function (g) { return { key: g.key, gia: g.gia }; }), maChuan: mc, maPhu: mp })
      .then(function () {
        var tin = [];
        if (ds.length) tin.push('ghi nhớ thêm ' + ds.length + ' SKU');
        if (gia.length) tin.push('cập nhật giá ' + gia.length + ' SKU');
        if (mc.length) tin.push('lưu ' + mc.length + ' barcode web vào sổ mã chuẩn');
        if (mp.length) tin.push('quy ' + mp.length + ' listing về mã web');
        toast('🐾 Mèo đã ' + tin.join(' và ') + '.', 'ok');
      })
      .catch(function (e) {
        dau.forEach(function (k) { delete S.hocDaGui[k]; });
        toast('Không lưu được SKU tự học / giá: ' + e.message, 'loi');
      })
      .then(function () { S.hocDangGui = false; });
  }

  /* ---------- Vẽ kết quả ---------- */
  function listTheo(k) {
    if (!S.kq) return [];
    return PL.NHA.indexOf(k) >= 0 ? S.kq.nha[k] : S.kq[k];
  }

  function veKetQua(moi) {
    var co = !!S.kq;
    $('ket-qua').hidden = !co;
    $('trong').hidden = co;
    if (!co) return;
    var kq = S.kq;
    var soFile = S.files.filter(function (p) { return !p.error; }).length;
    var tongNha = kq.dongTheoNha.HA + kq.dongTheoNha.KV + kq.dongTheoNha.ML;
    $('xong-text').innerHTML = '<b>Xong rồi nè! 🎉</b>Đã phân loại <b style="display:inline;font-size:inherit">' + so(kq.tongDong) +
      '</b> dòng từ ' + soFile + ' file · ' + so(tongNha) + ' dòng thuộc 3 nhà' +
      (kq.chuaRo.length ? ' · <span style="color:var(--cr-ink)">' + kq.chuaRo.length + ' dòng chưa rõ nhà cần xem</span>' : '');
    if (moi) {
      $('xong-cat').innerHTML = LV.meo('vay');
      LV.confetti($('confetti'));
    }
    $('cards').innerHTML = THE.map(function (t) {
      var tg = PL.tong(listTheo(t.k));
      var on = S.tab === t.k, laNha = PL.NHA.indexOf(t.k) >= 0;
      return '<div class="card-o"><button class="card" role="tab" data-k="' + t.k + '" aria-selected="' + on + '"' + (on ? ' tabindex="0"' : ' tabindex="-1"') + '>' +
        '<span class="card-emoji" aria-hidden="true">' + t.emoji + '</span>' +
        '<span class="card-ten">' + t.ten + '</span>' +
        '<div class="card-so">' + so(tg.cuon) + ' <small>cuốn</small></div>' +
        '<div class="card-phu">' + so(tg.dong) + ' dòng' + (laNha && dpBat() && soDuPhong(t.k) ? ' · <span class="dp-cong">+' + so(soDuPhong(t.k)) + ' dự phòng</span>' : '') + '</div></button>' +
        (laNha ? '<button type="button" class="btn btn-sm tai-nha" data-tai-nha="' + t.k + '"' +
          (tg.cuon ? ' title="Tải đơn đặt hàng ' + t.ten + '"' : ' disabled title="' + t.ten + ' không có cuốn nào"') + '>⬇️ Tải file</button>' : '') +
        '</div>';
    }).join('');
    $('btn-tai').disabled = !root.XuatFile.nhaCoHang(kq).length;
    veTaiBan();
    veListing();
    $('cards').querySelectorAll('.card').forEach(function (b) { b.classList.toggle('is-active', b.dataset.k === S.tab); });
    veBang();
    veBoQua();
  }

  function veBang() {
    var t = THE.filter(function (x) { return x.k === S.tab; })[0];
    var list = listTheo(S.tab);
    $('panel').className = 'panel theme-' + S.tab;
    var legend = '';
    var dp = '';
    if (PL.NHA.indexOf(S.tab) >= 0) {
      dp = khungDuPhong(S.tab, list);
      legend = '<div class="legend"><span><i style="background:var(--sku-la)"></i>SKU trống / dạng chữ</span>' +
        '<span><i style="background:#cfe5ff"></i>Có đơn dùng mã cũ (tái bản) – nên sửa listing</span>' +
        '<span><i style="background:var(--warn)"></i>Cùng SKU nhưng giá gốc khác</span></div>';
    } else if (S.tab === 'chuaRo') {
      legend = '<div class="legend">Chọn nhà cho từng dòng – mèo sẽ nhớ cho lần sau 🐾</div>';
    } else {
      legend = '<div class="legend">Khai báo 1 lần, lần sau combo tự tách thành từng cuốn 🐾</div>';
    }
    $('panel-head').innerHTML = '<h2>' + t.emoji + ' ' + t.ten + '</h2>' + legend + dp;
    if (!list.length) {
      $('bang').innerHTML = (S.tab === 'combo' ? khungLechGia(S.kq.lechGiaHomNay, 'kq') : '') + '<div class="trong-bang"><div class="mini-cat">' + LV.meo('ngu') + '</div>Không có dòng nào ở đây.</div>';
      return;
    }
    if (PL.NHA.indexOf(S.tab) >= 0) $('bang').innerHTML = bangNha(list, S.tab);
    else if (S.tab === 'combo') $('bang').innerHTML = khungLechGia(S.kq.lechGiaHomNay, 'kq') + bangCombo(list);
    else $('bang').innerHTML = bangChuaRo(list);
  }

  function oSku(g) {
    if (g.maCu && g.maCu.length) {
      return '<span class="ma-cu" title="Có đơn còn dùng mã cũ ' + esc(g.maCu.join(', ')) + ' – đã tính vào mã mới">' + esc(g.sku) + '</span>' +
        '<div><span class="nho nho-macu">' + (g.quyVeWeb ? 'Barcode sàn khác web' : 'Mã cũ trên sàn') + ' – nên sửa listing</span></div>';
    }
    if (!g.sku) return '<span class="sku-la sku-trong" title="Không có SKU – nhận diện bằng tên + phân loại">(trống)</span>';
    if (g.skuLa) return '<span class="sku-la" title="SKU không phải mã vạch – nhận diện bằng tên + phân loại">' + esc(g.sku) + '</span>';
    return esc(g.sku);
  }

  /* Tên gọn trên giao diện, rê chuột thấy tên gốc */
  function tenHien(g) {
    var gon = g.tenGon || g.ten;
    return gon === g.ten ? esc(gon) : '<span title="Tên gốc: ' + esc(g.ten) + '">' + esc(gon) + '</span>';
  }

  /* Ô tên trong bảng nhà: tên đã khai báo (hoặc tên tạm + nhãn), nút ✏️ sửa tên → lưu vào danh mục */
  function tenNha(g, i) {
    var h = '<span title="Tên trên sàn: ' + esc(g.ten) + '">' + esc(g.tenGon) + '</span>';
    if (g.chuaCoTen) h += ' <span class="nho nho-chuaten" title="Đang dùng tên tạm = tên sàn + phân loại. Bấm ✏️ để khai báo tên sách.">chưa có tên khai báo</span>';
    else if (g.nguonTen === 'web') h += ' <span class="nho nguon-web" title="Tên lấy theo sổ mã chuẩn web">🌐 tên web</span>';
    if (g.khoaTen && DM.coTheGhi()) h += ' <button type="button" class="btn-sua-ten" data-sua-ten="' + i + '" title="Sửa tên sách (lưu vào danh mục)" aria-label="Sửa tên sách">✏️</button>';
    return h;
  }
  var dangSuaTen = null;
  function moSuaTen(g, nha) {
    dangSuaTen = { g: g, nha: nha };
    $('ten-goc').innerHTML = (g.sku ? '<b>' + esc(g.sku) + '</b> · ' : '') + 'Tên trên sàn: ' + esc(g.ten);
    $('ten-moi').value = g.tenGon;
    $('ten-loi').textContent = '';
    $('dlg-ten').showModal();
    $('ten-moi').select();
  }
  function luuSuaTen() {
    var x = dangSuaTen, ten = PL.clean($('ten-moi').value);
    if (!ten) { $('ten-loi').textContent = 'Tên sách không được để trống.'; return; }
    var btn = $('ten-luu');
    btn.disabled = true;
    DM.goi('luuTenSach', { key: x.g.khoaTen, sku: PL.isBarcode(x.g.sku) ? x.g.sku : '', ten: x.g.tenSan || x.g.ten, nha: x.nha, ten_sach: ten, phan_loai: x.g.phanLoai || '' })
      .then(function () { $('dlg-ten').close(); toast('✏️ Đã lưu tên sách: ' + ten, 'ok'); })
      .catch(function (e) { $('ten-loi').textContent = e.message; })
      .then(function () { btn.disabled = false; });
  }

  function nguonNho(g) {
    var san = {}, combo = {}, nguyen = false;
    (g.nguon || []).forEach(function (n) {
      if (n.combo) combo[n.combo] = (combo[n.combo] || 0) + 1; else san[n.san] = (san[n.san] || 0) + 1;
      if (n.nguyen) nguyen = true;
    });
    var h = Object.keys(san).map(function (s) { return '<span class="nho">' + s + '</span>'; }).join('');
    h += Object.keys(combo).map(function (c) { return '<span class="nho nho-combo" title="Tách từ combo">🎁 ' + esc(PL.tenGon(c, DM.caiDat.maKhac)) + '</span>'; }).join('');
    if (nguyen) h += '<span class="nho nho-combo" title="Xuất nguyên combo, không tách thành từng cuốn">📦 nguyên combo</span>';
    if (g.quyVeWeb) h += '<span class="nho nho-macu" title="Barcode trên sàn khác barcode web – đã quy về mã web">🌐 đã quy về mã web</span>';
    if (g.canhBaoGia) h += '<span class="nho nho-warn">⚠ giá khác</span>';
    return h;
  }

  /* ---------- Gợi ý đặt dự phòng (chỉ gợi ý – chỉ cộng vào file khi bấm "Thêm") ---------- */
  function soDuPhong(nha) {
    var m = S.duPhong[nha] || {};
    return Object.keys(m).reduce(function (s, k) { return s + m[k]; }, 0);
  }
  /* Danh sách gợi ý của 1 nhà (mỗi cuốn 1 lần, theo thứ tự bảng). null = không hiện cột */
  function goiYNha(nha, list) {
    if (!dpBat() || !LS.rows) return null;
    var db = TK.duBao(LS.rows, Number(DM.caiDat.soNgayDuPhong) || 0);
    if (!db.duDuLieu) return { duDuLieu: false, ngayDuLieu: db.ngayDuLieu, ds: [] };
    var thay = {}, ds = [];
    list.forEach(function (g, i) {
      var k = TK.khoaSach(g);
      if (thay[k]) return;
      thay[k] = 1;
      var x = db.theoSach[nha + '|' + k];
      if (x && x.goiY > 0) ds.push({ i: i, k: k, goiY: x.goiY, tb: x.tb, soNgayCo: x.soNgayCo });
    });
    return { duDuLieu: true, ds: ds };
  }
  function khungDuPhong(nha, list) {
    if (!DM.coTheGhi() || !dpBat()) return '';
    if (!LS.rows) {
      return '<div class="dp-khung">' + (LS.loi ? '🔮 Chưa tải được lịch sử để gợi ý dự phòng: ' + esc(LS.loi)
        : '🔮 Đang tải lịch sử để gợi ý dự phòng…') + '</div>';
    }
    var gy = goiYNha(nha, list);
    S.dpGoiY = gy.ds;
    if (!gy.duDuLieu) {
      return '<div class="dp-khung">🔮 Chưa đủ dữ liệu để dự báo <span class="muted">(cần ít nhất 14 ngày lịch sử, hiện có ' + gy.ngayDuLieu +
        ' ngày – có thể nạp từ file đơn cũ ở tab 📊 Thống kê)</span></div>';
    }
    var chua = gy.ds.filter(function (x) { return !S.duPhong[nha][x.k]; });
    var tongChua = chua.reduce(function (s, x) { return s + x.goiY; }, 0);
    return '<div class="dp-khung">🔮 <b>Gợi ý đặt dự phòng ' + DM.caiDat.soNgayDuPhong + ' ngày</b> <span class="muted">– chỉ là gợi ý, bấm “Thêm” mới cộng vào file</span>' +
      (gy.ds.length ? '' : ' · <span class="muted">Không có sách nào bán đều để gợi ý.</span>') +
      (chua.length ? ' <button type="button" class="btn btn-sm btn-primary" data-dp-tatca="1">➕ Thêm tất cả (' + chua.length + ' đầu sách · ' + so(tongChua) + ' cuốn)</button>' : '') +
      (soDuPhong(nha) ? ' <button type="button" class="btn btn-sm" data-dp-bohet="1">↩️ Bỏ hết dự phòng (' + so(soDuPhong(nha)) + ' cuốn)</button>' : '') + '</div>';
  }
  function oDuPhong(nha, x) {
    if (!x) return '<td class="so dp"><span class="muted">—</span></td>';
    var tip = 'Trung bình ' + x.tb.toFixed(2).replace('.', ',') + ' cuốn/ngày · có đơn ' + x.soNgayCo + '/28 ngày gần nhất';
    var da = S.duPhong[nha][x.k];
    if (da) return '<td class="so dp"><span class="dp-da" title="' + tip + '">✅ +' + so(da) + ' đã thêm</span> ' +
      '<button type="button" class="btn btn-sm btn-ghost" data-dp-bo="' + x.i + '">Bỏ</button></td>';
    return '<td class="so dp"><span title="' + tip + '">' + so(x.goiY) + ' cuốn</span> ' +
      '<button type="button" class="btn btn-sm" data-dp-them="' + x.i + '">➕ Thêm vào đơn</button></td>';
  }

  function bangNha(list, nha) {
    var gy = DM.coTheGhi() && dpBat() && LS.rows ? goiYNha(nha, list) : null;
    var cot = gy && gy.duDuLieu, theoDong = {};
    if (cot) gy.ds.forEach(function (x) { theoDong[x.i] = x; });
    return '<table class="tbl"><thead><tr><th class="stt">#</th><th>SKU</th><th>Tên sản phẩm</th><th class="so">Giá gốc</th><th class="so">Số lượng</th>' +
      (cot ? '<th class="so">Gợi ý dự phòng</th>' : '') + '</tr></thead><tbody>' +
      list.map(function (g, i) {
        var x = theoDong[i], da = x && S.duPhong[nha][x.k];
        return '<tr' + (g.canhBaoGia ? ' class="canh-bao"' : '') + '><td class="stt">' + (i + 1) + '</td><td class="sku">' + oSku(g) +
          '</td><td class="ten">' + tenNha(g, i) + '<div>' + nguonNho(g) + '</div></td><td class="so">' + so(g.gia) + '</td><td class="so"><b>' + so(g.sl) + '</b>' +
          (da ? '<div class="dp-cong">+' + so(da) + ' dự phòng</div>' : '') + '</td>' + (cot ? oDuPhong(nha, x) : '') + '</tr>';
      }).join('') + '</tbody></table>';
  }

  function bangCombo(list) {
    return '<table class="tbl"><thead><tr><th>Nhà</th><th>SKU</th><th>Tên sản phẩm / phân loại</th><th class="so">Giá gốc</th><th class="so">SL</th><th>Khai báo</th></tr></thead><tbody>' +
      list.map(function (g, i) {
        return '<tr><td>' + badge(g.nha) + '</td><td class="sku">' + (g.sku ? esc(g.sku) : '<span class="sku-trong">(trống)</span>') + '</td>' +
          '<td class="ten">' + tenHien(g) + '<div class="pl">' + esc(g.phanLoai) + '</div>' +
          (g.ghiChu ? '<div class="ghi-chu">⚠ ' + esc(g.ghiChu) + '</div>' : '') +
          '<div>' + g.san.map(function (s) { return '<span class="nho">' + s + '</span>'; }).join('') + '</div></td>' +
          '<td class="so">' + so(g.gia) + '</td><td class="so"><b>' + so(g.sl) + '</b></td>' +
          '<td><div class="actions">' +
          nutGhi('🧩 Khai báo thành phần', 'class="btn btn-sm btn-primary" data-khai-bao="' + i + '"') +
          nutGhi('🔗 Đây là combo đã có', 'class="btn btn-sm" data-co-san="' + i + '"') +
          (g.tronNha
            ? '<button type="button" class="btn btn-sm" disabled title="Combo có sách nhà khác nên không xuất nguyên được – hãy tách để lấy phần ' + esc(g.nha) + '">📦 Xuất nguyên combo</button>'
            : nutGhi('📦 Xuất nguyên combo', 'class="btn btn-sm" data-nguyen="' + i + '"')) +
          '</div></td></tr>';
      }).join('') + '</tbody></table>';
  }

  function nutNha(nguon, i) {
    return '<div class="actions" role="group" aria-label="Chọn nhà">' +
      ['HA', 'KV', 'ML'].map(function (n) {
        return nutGhi(n, 'class="pick pick-' + n + '" data-gan="' + n + '" data-nguon="' + nguon + '" data-i="' + i + '" title="' + PL.TEN_NHA[n] + '"');
      }).join('') +
      nutGhi('Không nhập', 'class="pick pick-KHONG" data-gan="' + PL.KHONG_NHAP + '" data-nguon="' + nguon + '" data-i="' + i + '"') +
      '</div>';
  }

  function bangChuaRo(list) {
    return '<table class="tbl"><thead><tr><th>SKU</th><th>Tên sản phẩm</th><th>Phân loại</th><th class="so">Giá gốc</th><th class="so">SL</th><th>Chọn nhà</th></tr></thead><tbody>' +
      list.map(function (g, i) {
        return '<tr><td class="sku">' + oSku(g) + '</td><td class="ten">' + tenHien(g) +
          (g.ghiChu ? '<div class="ghi-chu">⚠ ' + esc(g.ghiChu) + '</div>' : '') +
          '<div>' + g.san.map(function (s) { return '<span class="nho">' + s + '</span>'; }).join('') + '</div></td>' +
          '<td class="pl">' + esc(g.phanLoai) + '</td><td class="so">' + so(g.gia) + '</td><td class="so"><b>' + so(g.sl) + '</b></td>' +
          '<td>' + nutNha('chuaRo', i) +
          (g.isCombo ? '<div class="actions" style="margin-top:6px">' + nutGhi('🧩 Khai báo combo', 'class="btn btn-sm" data-khai-bao-cr="' + i + '"') + '</div>' : '') +
          '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function badge(nha) {
    var cls = PL.NHA.indexOf(nha) >= 0 ? nha : 'x';
    return '<span class="badge-nha badge-' + cls + '">' + esc(nha || '?') + '</span>';
  }

  function veBoQua() {
    var list = S.kq.boQua;
    var soDong = list.reduce(function (s, g) { return s + g.lines.length; }, 0);
    $('bo-qua-tieu-de').textContent = '🙈 Đã bỏ qua (' + so(soDong) + ' dòng) – hàng có sẵn trong kho / nhà khác';
    if (!list.length) { $('bang-bo-qua').innerHTML = '<div class="trong-bang">Không có dòng nào bị bỏ qua.</div>'; return; }
    var dem = {};
    list.forEach(function (g) { dem[g.lyDo] = (dem[g.lyDo] || 0) + g.lines.length; });
    $('bang-bo-qua').innerHTML =
      '<div class="legend" style="padding:12px 16px">' + Object.keys(dem).map(function (k) {
        return '<span class="ly-do">' + esc(k) + ': ' + dem[k] + '</span>';
      }).join(' ') + '<span class="muted">Bỏ nhầm? Chọn lại nhà ở cột cuối.</span></div>' +
      '<table class="tbl"><thead><tr><th>Lý do</th><th>SKU</th><th>Tên sản phẩm</th><th>Phân loại</th><th class="so">SL</th><th>Gán lại nhà</th></tr></thead><tbody>' +
      list.map(function (g, i) {
        return '<tr><td><span class="ly-do">' + esc(g.lyDo) + '</span></td><td class="sku">' + esc(g.sku) + '</td><td class="ten">' + tenHien(g) +
          '</td><td class="pl">' + esc(g.phanLoai) + '</td><td class="so">' + so(g.sl) + '</td><td>' +
          (DM.coTheGhi()
            ? '<select class="select" data-gan-bq="' + i + '" aria-label="Gán lại nhà"><option value="">— chọn —</option>' +
              PL.NHA.map(function (n) { return '<option value="' + n + '">' + n + ' · ' + PL.TEN_NHA[n] + '</option>'; }).join('') + '</select>'
            : '<span class="muted" title="Dán URL Apps Script ở màn Cài đặt">🔌</span>') +
          '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- Tái bản: khung nhắc + listing cần sửa ---------- */
  function giaChu(n) { return n ? so(n) + 'đ' : 'chưa rõ giá'; }
  function veTaiBan() {
    var ds = S.kq.taiBan;
    $('tai-ban').hidden = !ds.length;
    $('tai-ban').innerHTML = ds.map(function (t, i) {
      return '<div class="tai-ban-item" role="status"><div class="tb-text">🔁 <b>Có thể là bản tái bản:</b> ' + esc(PL.tenGon(t.ten, DM.caiDat.maKhac)) +
        ' — mã cũ <b>' + esc(t.maCu) + '</b> (' + giaChu(t.giaCu) + ') → mã mới <b>' + esc(t.maMoi) + '</b> (' + giaChu(t.giaMoi) + ')</div>' +
        nutGhi('✅ Đúng, thay mã', 'class="btn btn-sm btn-primary" data-tb-dung="' + i + '"') +
        nutGhi('Không phải', 'class="btn btn-sm" data-tb-khong="' + i + '"') + '</div>';
    }).join('') + (S.kq.cungCuon || []).map(function (c, i) {
      return '<div class="tai-ban-item cung-cuon" role="status"><div class="tb-text">🔁 <b>Có thể cùng 1 cuốn:</b> [' + c.san + '] ' + esc(PL.tenGon(c.ten, DM.caiDat.maKhac)) +
        ' (' + esc(c.sku || 'SKU trống') + ', ' + giaChu(c.gia) + ') ↔ web <b>' + esc(c.maChuan) + '</b> ' + esc(c.tenChuan) + ' (' + giaChu(c.giaChuan) + ')' +
        '<div class="pl">' + esc(c.lyDo) + '</div></div>' +
        nutGhi('✅ Đúng, cùng cuốn', 'class="btn btn-sm btn-primary" data-cc-dung="' + i + '"') +
        nutGhi('Không phải', 'class="btn btn-sm" data-cc-khong="' + i + '"') + '</div>';
    }).join('');
    $('tai-ban').hidden = !$('tai-ban').innerHTML;
  }
  function veListing() {
    var ds = S.kq.listingCanSua;
    $('listing').hidden = !ds.length;
    if (!ds.length) return;
    $('listing-tieu-de').textContent = '🏷️ Listing cần sửa barcode (' + ds.length + ')';
    $('bang-listing').innerHTML = '<div class="legend" style="padding:12px 16px">Barcode trên sàn khác barcode chuẩn (web / mã mới) hoặc sai số kiểm tra. ' +
      'App đã tự tính đúng; nhân viên nên sửa SKU trên sàn cho khớp. <button class="btn btn-sm" id="listing-xuat" type="button">📤 Xuất Excel</button></div>' +
      '<table class="tbl"><thead><tr><th>Sàn</th><th>Tên sản phẩm trên sàn</th><th>Phân loại</th><th>Barcode trên sàn</th><th>Barcode web (chuẩn)</th><th>Lý do</th><th class="so">Số dòng</th></tr></thead><tbody>' +
      ds.map(function (l) {
        return '<tr><td><span class="tag tag-' + l.san + '">' + l.san + '</span></td><td class="ten">' + esc(l.ten) + '</td><td class="pl">' + esc(l.phanLoai) +
          '</td><td class="sku">' + esc(l.maCu) + '</td><td class="sku"><b>' + esc(l.maMoi || '—') + '</b></td><td><span class="ly-do">' + esc(l.lyDo || 'tái bản') +
          '</span></td><td class="so">' + l.soDong + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function xuatListing() {
    var ds = S.kq.listingCanSua;
    var aoa = [['Sàn', 'Tên sản phẩm trên sàn', 'Phân loại', 'Barcode trên sàn', 'Barcode web (chuẩn)', 'Lý do']].concat(ds.map(function (l) {
      return [l.san, l.ten, l.phanLoai, l.maCu, l.maMoi || '', l.lyDo || 'tái bản'];
    }));
    var ws = root.XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 8 }, { wch: 70 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 20 }];
    var wb = root.XLSX.utils.book_new();
    root.XLSX.utils.book_append_sheet(wb, ws, 'Listing can sua');
    var d = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    root.XLSX.writeFile(wb, 'Listing-can-sua-barcode_' + p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + '-' + d.getFullYear() + '.xlsx');
  }
  function thayMa(t) {
    return DM.goi('thayMaTaiBan', { ma_cu: t.maCu, ma_moi: t.maMoi, gia: t.giaMoi || '', ten: t.tenMoi || '' })
      .then(function () { toast('🔁 Đã thay mã ' + t.maCu + ' → ' + t.maMoi + '. Combo và đơn mã cũ sẽ tính theo mã mới.', 'ok'); })
      .catch(function (e) { toast('Không thay mã được: ' + e.message, 'loi'); throw e; });
  }

  /* ---------- Lệch giá combo ---------- */
  function khungLechGia(ds, nguon) {
    if (!ds || !ds.length) return '';
    return '<div class="lech-gia">💸 <b>' + ds.length + ' combo có giá thành phần đã đổi</b> (giá khai báo khác giá mới nhất):<ul>' +
      ds.map(function (c, i) {
        return '<li><b>' + esc(PL.tenGon(c.ten_combo, DM.caiDat.maKhac)) + '</b> ' + c.ds.map(function (x) {
          return '<span class="nhan-lech" title="' + esc(x.ten) + '">💸 Giá đã đổi: ' + so(x.cu) + ' → ' + so(x.moi) + '</span>';
        }).join('') + ' ' + nutGhi('Cập nhật giá', 'class="btn btn-sm" data-gia-combo="' + i + '" data-gia-nguon="' + nguon + '"') + '</li>';
      }).join('') + '</ul>' + nutGhi('💸 Cập nhật giá tất cả combo', 'class="btn btn-sm btn-primary" data-gia-tatca="' + nguon + '"') + '</div>';
  }
  function capNhatGiaCombo(ds) {
    if (!ds.length) return Promise.resolve();
    return DM.goi('capNhatGiaCombo', { items: ds.map(function (c) {
      var gia = {};
      c.ds.forEach(function (x) { gia[x.sku] = x.moi; });
      return { combo_id: c.combo_id, gia: gia };
    }) })
      .then(function () { toast('💸 Đã cập nhật giá cho ' + ds.length + ' combo.', 'ok'); })
      .catch(function (e) { toast('Không cập nhật giá được: ' + e.message, 'loi'); });
  }

  /* ---------- Gán nhà (lưu danh mục, nguồn = tay) ---------- */
  function ganNha(g, nha) {
    var r = g.lines[0].row;
    var entry = { key: PL.rowKey(r, false), sku: r.sku, ten: r.ten, nha: nha, nguon: 'tay' };
    var ten = nha === PL.KHONG_NHAP ? '"Không nhập"' : PL.TEN_NHA[nha];
    return DM.goi('upsertSku', entry)
      .then(function () { toast('✅ Đã lưu: "' + r.ten.slice(0, 50) + '…" → ' + ten, 'ok'); })
      .catch(function (e) { toast('Không lưu được: ' + e.message, 'loi'); });
  }

  /* ---------- Xuất Excel ---------- */
  /* ---------- Tải đơn đặt hàng (mỗi nhà 1 file) ---------- */
  var XF = function () { return root.XuatFile; };
  function cho(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* Nội dung nhắc trước khi tải; rỗng = không có vấn đề */
  function noiDungNhac(kt) {
    var dong = [];
    var conLai = [];
    if (kt.combo.length) conLai.push(kt.combo.length + ' combo chưa khai báo');
    if (kt.chuaRo.length) conLai.push(kt.chuaRo.length + ' sách chưa rõ nhà');
    if (conLai.length) dong.push('Còn ' + conLai.join(', ') + ' — các dòng này sẽ KHÔNG có trong file.');
    var liet = function (ds, f) { return ds.slice(0, 6).map(f).join('\n') + (ds.length > 6 ? '\n  … và ' + (ds.length - 6) + ' dòng nữa' : ''); };
    if (kt.giaKhac.length) {
      dong.push('Cùng SKU nhưng giá khác nhau (' + kt.giaKhac.length + '):\n' + liet(kt.giaKhac, function (x) {
        return '  · [' + x.nha + '] ' + x.ten + ' (' + x.sku + '): ' + x.gia.map(so).join(' / ');
      }));
    }
    if (kt.thieuSku.length) {
      dong.push('Dòng thiếu SKU (' + kt.thieuSku.length + '):\n' + liet(kt.thieuSku, function (x) { return '  · [' + x.nha + '] ' + x.ten + ' × ' + x.sl; }));
    }
    return dong.length ? dong.join('\n\n') + '\n\nVẫn tải?' : '';
  }

  function taiNha(nhas, btn) {
    if (!S.kq) return;
    if (!root.ExcelJS) { toast('Thư viện Excel chưa tải xong, thử lại sau 1 giây nha.', 'loi'); return; }
    var kqXuat = dpBat() ? TK.apDungDuPhong(S.kq, S.duPhong) : S.kq; // chỉ cộng số dự phòng đã bấm "Thêm"
    var coHang = XF().nhaCoHang(kqXuat);
    nhas = nhas.filter(function (n) { return coHang.indexOf(n) >= 0; });
    if (!nhas.length) { toast('Không có nhà nào có hàng để tải.', 'loi'); return; }
    var kt = XF().kiemTraTruocKhiTai(S.kq, nhas.length === 1 ? nhas : XF().NHA);
    var msg = noiDungNhac(kt);
    var buoc = msg ? hoi(msg, '⬇️ Vẫn tải', { huy: '🔍 Xem lại', nhe: true, tieuDe: 'Kiểm tra trước khi tải' }) : Promise.resolve(true);
    buoc.then(function (ok) {
      if (!ok) {
        // Xem lại: mở tab có vấn đề đầu tiên
        S.tab = kt.combo.length ? 'combo' : kt.chuaRo.length ? 'chuaRo'
          : (kt.giaKhac[0] || kt.thieuSku[0] || { nha: nhas[0] }).nha;
        veKetQua(false);
        $('panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (btn) btn.disabled = true;
      var info = { tenShop: DM.caiDat.tenShop, sdt: DM.caiDat.sdt, diaChi: DM.caiDat.diaChi, ghiChu: DM.caiDat.ghiChu };
      var ngay = new Date();
      // Tải lần lượt từng nhà (cách nhau một chút để trình duyệt không chặn)
      return nhas.reduce(function (p, n, i) {
        return p.then(function () {
          return XF().buildDonDatHang(kqXuat, n, info, root.ExcelJS, ngay).xlsx.writeBuffer().then(function (buf) {
            taiVe(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), XF().fileName(n, ngay));
            return i < nhas.length - 1 ? cho(600) : null;
          });
        });
      }, Promise.resolve())
        .then(function () {
          toast('📥 Đã tải ' + nhas.length + ' đơn đặt hàng: ' + nhas.map(function (n) { return PL.TEN_NHA[n]; }).join(', '), 'ok');
          ghiLichSu(nhas);
        })
        .catch(function (e) { toast('Lỗi tạo file Excel: ' + e.message, 'loi'); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }

  /* Ghi lịch sử đặt hàng của hôm nay (1 lần ghi cho các nhà vừa tải; tải lại trong ngày thì ghi đè).
   * Dùng kết quả GỐC – số dự phòng không tính vào lịch sử. Không lưu thông tin khách. */
  function ghiLichSu(nhas) {
    if (!DM.coTheGhi()) return;
    var bg = TK.banGhiNgay(S.kq, nhas);
    DM.goi('ghiLichSuDatHang', bg).then(function (j) {
      capNhatLichSuCucBo(bg);
      toast('📊 Đã ghi lịch sử đặt hàng hôm nay (' + so(j.soDong) + ' đầu sách) để làm thống kê.', 'ok');
      nhacLichSuLon(j);
    }).catch(function (e) { toast('Không ghi được lịch sử đặt hàng: ' + e.message, 'loi'); });
  }
  function nhacLichSuLon(j) {
    if (j.gomThang) toast('🗜️ Lịch sử đã nhiều – mèo đã gom ' + so(j.gomThang) + ' dòng cũ hơn 6 tháng thành từng tháng cho nhẹ.');
    else if (j.canhBaoLon) toast('📦 Lịch sử đặt hàng đã khá lớn (' + so(j.tongDong) + ' dòng). Khi vượt 40.000 dòng, mèo sẽ tự gom các tháng cũ.');
  }

  /* ---------- Thanh trạng thái, banner, điều hướng ---------- */
  function veTrangThai() {
    var t = DM.trangThai, el = $('sync');
    el.dataset.state = t.state;
    var gio = t.luc ? new Date(t.luc).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
    $('sync-text').textContent = {
      none: 'Chưa kết nối', idle: 'Danh mục trên máy', syncing: 'Đang đồng bộ…',
      ok: 'Đã đồng bộ' + (gio ? ' ' + gio : ''), error: 'Lỗi kết nối'
    }[t.state] || '';
    el.title = t.state === 'error' ? t.loi + ' – đang dùng danh mục đã lưu trên máy. Bấm để thử lại.' : 'Bấm để tải lại danh mục';
    veBanner();
  }

  function veBanner() {
    var b = $('banner'), c = DM.caiDat;
    if (!c.url) {
      b.innerHTML = '🔌 Chưa kết nối danh mục Google Sheets – vẫn tách đơn được, nhưng chưa nhớ được SKU/combo. <button class="linkish" data-di="caidat">Vào Cài đặt</button>';
      b.hidden = false;
    } else b.hidden = true;
  }

  function diToi(man) {
    ['chinh', 'thongke', 'danhmuc', 'caidat'].forEach(function (m) {
      $('man-' + m).hidden = m !== man;
    });
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      var on = b.dataset.man === man;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (man === 'danhmuc' && root.ManDanhMuc) root.ManDanhMuc.ve();
    if (man === 'caidat' && root.CaiDat) root.CaiDat.ve();
    if (man === 'thongke' && root.ManThongKe) root.ManThongKe.ve();
  }

  function veLai() {
    if (S.files.length) { gop(); xuLy(false); }
    if (root.ManDanhMuc && !$('man-danhmuc').hidden) root.ManDanhMuc.ve();
  }

  /* ---------- Sự kiện ---------- */
  function ganSuKien() {
    var drop = $('drop'), input = $('file-input');
    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', function () { nhanFiles(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (e) { nhanFiles(e.dataTransfer.files); });
    // Thả nhầm ra ngoài ô thì cũng nhận, không để trình duyệt mở file
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) {
      e.preventDefault();
      if (!$('man-chinh').hidden && e.dataTransfer && e.dataTransfer.files.length) nhanFiles(e.dataTransfer.files);
    });

    $('chips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-xoa-file]');
      if (!b) return;
      S.files.splice(+b.dataset.xoaFile, 1);
      gop();
      xuLy(false);
    });

    $('cards').addEventListener('click', function (e) {
      var t = e.target.closest('[data-tai-nha]');
      if (t) { if (!t.disabled) taiNha([t.dataset.taiNha], t); return; }
      var b = e.target.closest('.card');
      if (!b) return;
      S.tab = b.dataset.k;
      veKetQua(false);
      var moi = $('cards').querySelector('[data-k="' + S.tab + '"]');
      if (moi) moi.focus();
    });
    $('cards').addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var i = THE.findIndex(function (t) { return t.k === S.tab; });
      i = (i + (e.key === 'ArrowRight' ? 1 : THE.length - 1)) % THE.length;
      S.tab = THE[i].k;
      veKetQua(false);
      $('cards').querySelector('[data-k="' + S.tab + '"]').focus();
    });

    $('bang').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.gan) {
        b.disabled = true;
        ganNha(S.kq.chuaRo[+b.dataset.i], b.dataset.gan);
      } else if (b.dataset.khaiBao) root.KhaiBao.moKhaiBao(S.kq.combo[+b.dataset.khaiBao]);
      else if (b.dataset.khaiBaoCr) root.KhaiBao.moKhaiBao(S.kq.chuaRo[+b.dataset.khaiBaoCr]);
      else if (b.dataset.coSan) root.KhaiBao.moCoSan(S.kq.combo[+b.dataset.coSan]);
      else if (b.dataset.nguyen) root.KhaiBao.moKhaiBao(S.kq.combo[+b.dataset.nguyen], 'nguyen');
      else if (b.dataset.giaCombo) { b.disabled = true; capNhatGiaCombo([S.kq.lechGiaHomNay[+b.dataset.giaCombo]]); }
      else if (b.dataset.giaTatca) { b.disabled = true; capNhatGiaCombo(S.kq.lechGiaHomNay); }
      else if (b.dataset.suaTen) moSuaTen(S.kq.nha[S.tab][+b.dataset.suaTen], S.tab);
      else if (b.dataset.dpThem || b.dataset.dpBo) {
        var x = S.dpGoiY.filter(function (y) { return y.i === +(b.dataset.dpThem || b.dataset.dpBo); })[0];
        if (!x) return;
        if (b.dataset.dpThem) S.duPhong[S.tab][x.k] = x.goiY; else delete S.duPhong[S.tab][x.k];
        veKetQua(false);
      }
    });
    $('panel-head').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.dpTatca) {
        S.dpGoiY.forEach(function (x) { if (!S.duPhong[S.tab][x.k]) S.duPhong[S.tab][x.k] = x.goiY; });
        toast('➕ Đã thêm số dự phòng vào đơn ' + PL.TEN_NHA[S.tab] + '.', 'ok');
        veKetQua(false);
      } else if (b.dataset.dpBohet) {
        S.duPhong[S.tab] = {};
        veKetQua(false);
      }
    });
    $('bang-bo-qua').addEventListener('change', function (e) {
      var s = e.target.closest('[data-gan-bq]');
      if (!s || !s.value) return;
      s.disabled = true;
      ganNha(S.kq.boQua[+s.dataset.ganBq], s.value);
    });

    $('ten-luu').addEventListener('click', luuSuaTen);
    $('ten-moi').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); luuSuaTen(); } });
    $('btn-tai').addEventListener('click', function () { taiNha(PL.NHA.slice(), $('btn-tai')); });
    $('bang-listing').addEventListener('click', function (e) { if (e.target.id === 'listing-xuat') xuatListing(); });
    $('tai-ban').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.ccDung || b.dataset.ccKhong) {
        var c = S.kq.cungCuon[+(b.dataset.ccDung || b.dataset.ccKhong)];
        b.disabled = true;
        var viec = b.dataset.ccDung
          ? DM.goi('luuMaPhu', { key: c.khoa, sku: c.sku, ten: c.ten, ma_moi: c.maChuan, nha: c.nhaChuan })
            .then(function () { toast('✅ Đã quy "' + PL.tenGon(c.ten, DM.caiDat.maKhac).slice(0, 40) + '" về mã web ' + c.maChuan + '.', 'ok'); })
          : DM.goi('boQuaCungCuon', { barcode: c.maChuan, khoa: c.khoa, ten_gon: c.tenChuan, gia_bia: c.giaChuan, nha: c.nhaChuan })
            .then(function () { toast('👌 Đã ghi nhớ: không phải cùng cuốn – sẽ không hỏi lại.', 'ok'); });
        viec.catch(function (er) { b.disabled = false; toast('Không lưu được: ' + er.message, 'loi'); });
        return;
      }
      if (b.dataset.tbDung) {
        var t = S.kq.taiBan[+b.dataset.tbDung];
        hoi('Thay mã ' + t.maCu + ' → ' + t.maMoi + ' cho "' + PL.tenGon(t.ten, DM.caiDat.maKhac) + '"?\n\n' +
          '· Mã mới ' + t.maMoi + ' thuộc nhà ' + (PL.TEN_NHA[t.nha] || t.nha) + ', giá ' + giaChu(t.giaMoi) + '\n' +
          '· Combo có cuốn này sẽ tách ra mã mới\n· Đơn còn dùng mã cũ vẫn tính vào mã mới\n\nCó thể hoàn tác trong tab Lịch sử.', 'Thay mã')
          .then(function (ok) { if (ok) { b.disabled = true; thayMa(t).catch(function () { b.disabled = false; }); } });
      } else if (b.dataset.tbKhong) {
        var k = S.kq.taiBan[+b.dataset.tbKhong];
        b.disabled = true;
        DM.goi('boQuaTaiBan', { ma_cu: k.maCu, ma_moi: k.maMoi })
          .then(function () { toast('👌 Đã ghi nhớ: ' + k.maMoi + ' không phải tái bản của ' + k.maCu + '.', 'ok'); })
          .catch(function (e) { b.disabled = false; toast('Không lưu được: ' + e.message, 'loi'); });
      }
    });
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.addEventListener('click', function () { diToi(b.dataset.man); });
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-di]');
      if (b) diToi(b.dataset.di);
    });
    $('sync').addEventListener('click', function () { DM.taiLai(); });

    DM.nghe(function (loai) {
      if (loai === 'trangthai') veTrangThai();
      if (loai === 'catalog' || loai === 'caidat') veLai();
      if (loai === 'caidat') { veTrangThai(); taiLichSu(); }
    });
  }

  function khoiDong() {
    $('brand-cat').innerHTML = LV.meo('om');
    $('drop-cat').innerHTML = LV.meo('om');
    $('empty-cat').innerHTML = LV.meo('ngu');
    ganSuKien();
    veTrangThai();
    DM.taiLai();
    taiLichSu();
  }

  root.App = {
    S: S, esc: esc, so: so, boDau: boDau, toast: toast, hoi: hoi, taiVe: taiVe, nutGhi: nutGhi, badge: badge,
    rows: rows, diToi: diToi, khungLechGia: khungLechGia, capNhatGiaCombo: capNhatGiaCombo, thayMa: thayMa,
    LS: LS, taiLichSu: taiLichSu, nhacLichSuLon: nhacLichSuLon
  };
  document.addEventListener('DOMContentLoaded', khoiDong);
})(typeof self !== 'undefined' ? self : this);
