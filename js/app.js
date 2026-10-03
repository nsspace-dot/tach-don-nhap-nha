/* Màn chính: thả file → phân loại → xem kết quả → tải Excel. Cùng các tiện ích dùng chung. */
(function (root) {
  'use strict';
  var PL = root.PhanLoai, DM = root.DanhMuc, LV = root.LinhVat;
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
  function hoi(noiDung, nutOk) {
    return new Promise(function (resolve) {
      var d = $('dlg-hoi');
      $('hoi-noidung').textContent = noiDung;
      $('hoi-ok').textContent = nutOk || 'Đồng ý';
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
  var S = { files: [], demFile: 0, kq: null, tab: 'HA', hocDaGui: {}, hocDangGui: false };

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
        if (!p.error) { p.rowsGoc = p.rows; p.id = ++S.demFile; }
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
  function gop() { root.DocFile.gopFile(S.files); }

  function veChips() {
    $('chips').innerHTML = S.files.map(function (p, i) {
      if (p.error) {
        return '<li class="chip is-error">😿 <b>' + esc(p.file) + '</b>: ' + esc(p.error) +
          ' <button class="chip-x" data-xoa-file="' + i + '" aria-label="Bỏ file ' + esc(p.file) + '">×</button></li>';
      }
      return '<li class="chip"><span class="tag tag-' + p.san + '">' + p.san + '</span> ' + esc(p.file) +
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
    S.kq = r.length ? PL.classify(r, DM.catalog, { maKhac: DM.caiDat.maKhac }) : null;
    veChips();
    veKetQua(moi);
    tuHoc();
  }

  /* Ghi gom SKU tự học 1 lần (khi đã kết nối Google Sheets) */
  function tuHoc() {
    if (!S.kq || !DM.coTheGhi() || S.hocDangGui) return;
    var ds = S.kq.hoc.filter(function (h) { return !S.hocDaGui[h.key]; });
    if (!ds.length) return;
    S.hocDangGui = true;
    ds.forEach(function (h) { S.hocDaGui[h.key] = true; });
    DM.goi('upsertSkuBatch', { items: ds })
      .then(function () { toast('🐾 Mèo đã ghi nhớ thêm ' + ds.length + ' SKU vào danh mục.', 'ok'); })
      .catch(function (e) {
        ds.forEach(function (h) { delete S.hocDaGui[h.key]; });
        toast('Không lưu được SKU tự học: ' + e.message, 'loi');
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
      var on = S.tab === t.k;
      return '<button class="card" role="tab" data-k="' + t.k + '" aria-selected="' + on + '"' + (on ? ' tabindex="0"' : ' tabindex="-1"') + '>' +
        '<span class="card-emoji" aria-hidden="true">' + t.emoji + '</span>' +
        '<span class="card-ten">' + t.ten + '</span>' +
        '<div class="card-so">' + so(tg.cuon) + ' <small>cuốn</small></div>' +
        '<div class="card-phu">' + so(tg.dong) + ' dòng</div></button>';
    }).join('');
    Array.prototype.forEach.call($('cards').children, function (b) { b.classList.toggle('is-active', b.dataset.k === S.tab); });
    veBang();
    veBoQua();
  }

  function veBang() {
    var t = THE.filter(function (x) { return x.k === S.tab; })[0];
    var list = listTheo(S.tab);
    $('panel').className = 'panel theme-' + S.tab;
    var legend = '';
    if (PL.NHA.indexOf(S.tab) >= 0) {
      legend = '<div class="legend"><span><i style="background:var(--sku-la)"></i>SKU trống / dạng chữ</span>' +
        '<span><i style="background:var(--warn)"></i>Cùng SKU nhưng giá gốc khác</span></div>';
    } else if (S.tab === 'chuaRo') {
      legend = '<div class="legend">Chọn nhà cho từng dòng – mèo sẽ nhớ cho lần sau 🐾</div>';
    } else {
      legend = '<div class="legend">Khai báo 1 lần, lần sau combo tự tách thành từng cuốn 🐾</div>';
    }
    $('panel-head').innerHTML = '<h2>' + t.emoji + ' ' + t.ten + '</h2>' + legend;
    if (!list.length) {
      $('bang').innerHTML = '<div class="trong-bang"><div class="mini-cat">' + LV.meo('ngu') + '</div>Không có dòng nào ở đây.</div>';
      return;
    }
    if (PL.NHA.indexOf(S.tab) >= 0) $('bang').innerHTML = bangNha(list);
    else if (S.tab === 'combo') $('bang').innerHTML = bangCombo(list);
    else $('bang').innerHTML = bangChuaRo(list);
  }

  function oSku(g) {
    if (!g.sku) return '<span class="sku-la sku-trong" title="Không có SKU – nhận diện bằng tên + phân loại">(trống)</span>';
    if (g.skuLa) return '<span class="sku-la" title="SKU không phải mã vạch – nhận diện bằng tên + phân loại">' + esc(g.sku) + '</span>';
    return esc(g.sku);
  }

  function nguonNho(g) {
    var san = {}, combo = {};
    (g.nguon || []).forEach(function (n) {
      if (n.combo) combo[n.combo] = (combo[n.combo] || 0) + 1; else san[n.san] = (san[n.san] || 0) + 1;
    });
    var h = Object.keys(san).map(function (s) { return '<span class="nho">' + s + '</span>'; }).join('');
    h += Object.keys(combo).map(function (c) { return '<span class="nho nho-combo" title="Tách từ combo">🎁 ' + esc(c) + '</span>'; }).join('');
    if (g.canhBaoGia) h += '<span class="nho nho-warn">⚠ giá khác</span>';
    return h;
  }

  function bangNha(list) {
    return '<table class="tbl"><thead><tr><th class="stt">#</th><th>SKU</th><th>Tên sản phẩm</th><th class="so">Giá gốc</th><th class="so">Số lượng</th></tr></thead><tbody>' +
      list.map(function (g, i) {
        return '<tr' + (g.canhBaoGia ? ' class="canh-bao"' : '') + '><td class="stt">' + (i + 1) + '</td><td class="sku">' + oSku(g) +
          '</td><td class="ten">' + esc(g.ten) + '<div>' + nguonNho(g) + '</div></td><td class="so">' + so(g.gia) + '</td><td class="so"><b>' + so(g.sl) + '</b></td></tr>';
      }).join('') + '</tbody></table>';
  }

  function bangCombo(list) {
    return '<table class="tbl"><thead><tr><th>Nhà</th><th>SKU</th><th>Tên sản phẩm / phân loại</th><th class="so">Giá gốc</th><th class="so">SL</th><th>Khai báo</th></tr></thead><tbody>' +
      list.map(function (g, i) {
        return '<tr><td>' + badge(g.nha) + '</td><td class="sku">' + (g.sku ? esc(g.sku) : '<span class="sku-trong">(trống)</span>') + '</td>' +
          '<td class="ten">' + esc(g.ten) + '<div class="pl">' + esc(g.phanLoai) + '</div>' +
          (g.ghiChu ? '<div class="ghi-chu">⚠ ' + esc(g.ghiChu) + '</div>' : '') +
          '<div>' + g.san.map(function (s) { return '<span class="nho">' + s + '</span>'; }).join('') + '</div></td>' +
          '<td class="so">' + so(g.gia) + '</td><td class="so"><b>' + so(g.sl) + '</b></td>' +
          '<td><div class="actions">' +
          nutGhi('🧩 Khai báo thành phần', 'class="btn btn-sm btn-primary" data-khai-bao="' + i + '"') +
          nutGhi('🔗 Đây là combo đã có', 'class="btn btn-sm" data-co-san="' + i + '"') +
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
        return '<tr><td class="sku">' + oSku(g) + '</td><td class="ten">' + esc(g.ten) +
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
        return '<tr><td><span class="ly-do">' + esc(g.lyDo) + '</span></td><td class="sku">' + esc(g.sku) + '</td><td class="ten">' + esc(g.ten) +
          '</td><td class="pl">' + esc(g.phanLoai) + '</td><td class="so">' + so(g.sl) + '</td><td>' +
          (DM.coTheGhi()
            ? '<select class="select" data-gan-bq="' + i + '" aria-label="Gán lại nhà"><option value="">— chọn —</option>' +
              PL.NHA.map(function (n) { return '<option value="' + n + '">' + n + ' · ' + PL.TEN_NHA[n] + '</option>'; }).join('') + '</select>'
            : '<span class="muted" title="Dán URL Apps Script ở màn Cài đặt">🔌</span>') +
          '</td></tr>';
      }).join('') + '</tbody></table>';
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
  function taiExcel() {
    if (!S.kq) return;
    if (!root.ExcelJS) { toast('Thư viện Excel chưa tải xong, thử lại sau 1 giây nha.', 'loi'); return; }
    var btn = $('btn-tai');
    btn.disabled = true;
    root.XuatFile.buildWorkbook(S.kq, root.ExcelJS).xlsx.writeBuffer()
      .then(function (buf) {
        taiVe(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), root.XuatFile.fileName());
        toast('📥 Đã tải file ' + root.XuatFile.fileName(), 'ok');
      })
      .catch(function (e) { toast('Lỗi tạo file Excel: ' + e.message, 'loi'); })
      .then(function () { btn.disabled = false; });
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
    ['chinh', 'danhmuc', 'caidat'].forEach(function (m) {
      $('man-' + m).hidden = m !== man;
    });
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      var on = b.dataset.man === man;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (man === 'danhmuc' && root.ManDanhMuc) root.ManDanhMuc.ve();
    if (man === 'caidat' && root.CaiDat) root.CaiDat.ve();
  }

  function veLai() {
    if (S.files.length) xuLy(false);
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
    });
    $('bang-bo-qua').addEventListener('change', function (e) {
      var s = e.target.closest('[data-gan-bq]');
      if (!s || !s.value) return;
      s.disabled = true;
      ganNha(S.kq.boQua[+s.dataset.ganBq], s.value);
    });

    $('btn-tai').addEventListener('click', taiExcel);
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
      if (loai === 'caidat') veTrangThai();
    });
  }

  function khoiDong() {
    $('brand-cat').innerHTML = LV.meo('om');
    $('drop-cat').innerHTML = LV.meo('om');
    $('empty-cat').innerHTML = LV.meo('ngu');
    ganSuKien();
    veTrangThai();
    DM.taiLai();
  }

  root.App = {
    S: S, esc: esc, so: so, boDau: boDau, toast: toast, hoi: hoi, taiVe: taiVe, nutGhi: nutGhi, badge: badge,
    rows: rows, diToi: diToi
  };
  document.addEventListener('DOMContentLoaded', khoiDong);
})(typeof self !== 'undefined' ? self : this);
