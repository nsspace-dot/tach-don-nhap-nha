/* Màn Thống kê: bộ lọc, top sách, biểu đồ (SVG tự vẽ), sách đang tăng / lâu không có đơn / hay bị thiếu,
 * xuất Excel, nạp lịch sử từ file đơn cũ. Dữ liệu lấy từ sheet LS_DAT_HANG (không có thông tin khách). */
(function (root) {
  'use strict';
  var A = root.App, DM = root.DanhMuc, PL = root.PhanLoai, TK = root.ThongKe, LV = root.LinhVat;
  var $ = function (id) { return document.getElementById(id); };
  var esc = A.esc, so = A.so;

  var LOC = { nha: '', tg: '30', nguon: '', tu: '', den: '' };
  var TEN = { HA: 'Hồng Ân', KV: 'Khang Việt', ML: 'Minh Long' };
  var MAU = { HA: 'var(--ha-deep)', KV: 'var(--kv-deep)', ML: 'var(--ml-deep)' };
  var kqHienTai = null, xemHetTop = false;

  function ngayVN(s) { var p = String(s).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : s; }
  function ngayDu(s) { var p = String(s).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }

  function khoang() {
    var homNay = TK.homNay();
    if (LOC.tg === 'tuy') {
      var tu = LOC.tu || TK.congNgay(homNay, -29), den = LOC.den || homNay;
      return tu <= den ? { tu: tu, den: den } : { tu: den, den: tu };
    }
    return { tu: TK.congNgay(homNay, -(Number(LOC.tg) - 1)), den: homNay };
  }

  /* ---------- Vẽ ---------- */
  function ve() {
    if ($('man-thongke').hidden) return;
    var hop = $('tk-noidung');
    document.querySelectorAll('#man-thongke .can-write').forEach(function (b) {
      b.disabled = !DM.coTheGhi();
      b.title = DM.coTheGhi() ? b.title : 'Dán URL Apps Script ở màn Cài đặt trước nha';
    });
    if (!DM.coTheGhi()) {
      hop.innerHTML = trong('ngu', 'Chưa kết nối Google Sheets nên chưa có lịch sử để thống kê.',
        '<button class="btn btn-primary" data-di="caidat" type="button">⚙️ Vào Cài đặt</button>');
      return;
    }
    var k = khoang(), LS = A.LS;
    if (!LS.rows || LS.tu > k.tu) {
      if (LS.loi && !LS.dangTai) { hop.innerHTML = trong('buon', 'Không tải được lịch sử: ' + LS.loi, '<button class="btn" data-tk-thu type="button">🔄 Thử lại</button>'); return; }
      hop.innerHTML = trong('om', 'Mèo đang lấy sổ lịch sử về… ⏳', '');
      if (!LS.dangTai || LS.dangTu > k.tu) A.taiLichSu(k.tu < TK.congNgay(TK.homNay(), -150) ? k.tu : null);
      return;
    }
    if (!LS.rows.length) {
      hop.innerHTML = trong('ngu', 'Chưa có lịch sử đặt hàng nào. Mỗi lần bấm “Tải file” ở màn Tách đơn, mèo sẽ ghi lại. ' +
        'Muốn có số liệu ngay thì nạp các file đơn cũ nha.', '<button class="btn btn-primary" data-tk-nap type="button">📥 Nạp lịch sử từ file đơn cũ</button>');
      return;
    }
    var kq = kqHienTai = TK.tinhThongKe(LS.rows, { tu: k.tu, den: k.den, nha: LOC.nha, nguon: LOC.nguon });
    var soNgay = TK.cachNgay(k.tu, k.den) + 1;
    hop.innerHTML =
      (LS.canhBaoLon ? '<div class="dp-khung">📦 Lịch sử đã khá lớn (' + so(LS.tongDong) + ' dòng). Khi vượt 40.000 dòng, mèo tự gom các tháng cũ hơn 6 tháng thành từng tháng.</div>' : '') +
      '<div class="tk-tong">' +
        oTong('📚', so(kq.tongCuon), 'cuốn đã đặt') +
        oTong('🏷️', so(kq.top.length), 'đầu sách') +
        oTong('📅', (kq.tongCuon / soNgay).toFixed(1).replace('.', ','), 'cuốn / ngày') +
        oTong('🗓️', ngayDu(k.tu) + ' → ' + ngayDu(k.den), LS.ngayCuNhat ? 'lịch sử có từ ' + ngayDu(LS.ngayCuNhat) : '') +
      '</div>' +
      '<div class="tk-luoi">' +
        '<div class="panel tk-the"><h3>📦 Tổng theo tuần</h3>' + bieuDoCot(kq.theoTuan) + '</div>' +
        '<div class="panel tk-the"><h3>📈 Số cuốn theo ngày</h3>' + bieuDoDuong(kq.theoNgay) + '</div>' +
      '</div>' +
      '<div class="tk-luoi tk-luoi-3">' +
        theNho('📈 Đang tăng', 'tang', '7 ngày gần nhất so với 7 ngày trước (tăng ≥ 50% và ≥ 5 cuốn)', kq.dangTang, function (x) {
          return '<b class="tk-so tk-tang">' + so(x.truoc) + ' → ' + so(x.nay) + '</b>' + (x.tang !== null ? ' <small>+' + x.tang + '%</small>' : ' <small>mới</small>');
        }) +
        theNho('💤 Lâu không có đơn', 'ngu', 'Từng có đơn nhưng ≥ 30 ngày nay không thấy', kq.lauKhong, function (x) {
          return '<b class="tk-so">' + x.soNgay + ' ngày</b> <small>từ ' + ngayVN(x.cuoi) + '</small>';
        }) +
        theNho('⚠️ Hay bị thiếu', 'thieu', 'Có đơn treo từ ngày trước ≥ 3 lần trong 30 ngày', kq.hayThieu, function (x) {
          return '<b class="tk-so tk-thieu">' + x.soLan + ' lần</b> <small>' + so(x.slTreo) + ' cuốn treo</small>';
        }) +
      '</div>' +
      '<div class="panel tk-the"><h3>🏆 Top sách <small class="muted">(' + ngayDu(k.tu) + ' → ' + ngayDu(k.den) + ')</small></h3>' + bangTop(kq.top) + '</div>';
  }

  function trong(meo, chu, nut) {
    return '<div class="panel tk-trong"><div class="mini-cat tk-meo">' + LV.meo(meo) + '</div><p>' + esc(chu) + '</p>' + nut + '</div>';
  }
  function oTong(icon, so_, nhan) {
    return '<div class="tk-o"><span class="tk-o-icon" aria-hidden="true">' + icon + '</span><b>' + so_ + '</b><small>' + esc(nhan) + '</small></div>';
  }
  function badge(n) { return A.badge(n); }

  function theNho(tieuDe, loai, moTa, ds, oPhai) {
    return '<div class="panel tk-the tk-the-' + loai + '"><h3>' + tieuDe + ' <span class="dem">' + ds.length + '</span></h3><p class="muted tk-mota">' + moTa + '</p>' +
      (ds.length ? '<ul class="tk-ds">' + ds.slice(0, 12).map(function (x) {
        return '<li>' + badge(x.nha) + '<span class="tk-ten" title="' + esc(x.ten + ' · ' + hienMa(x.barcode)) + '">' + esc(x.ten) + '</span><span class="tk-phai">' + oPhai(x) + '</span></li>';
      }).join('') + '</ul>' + (ds.length > 12 ? '<p class="muted tk-mota">… và ' + (ds.length - 12) + ' cuốn nữa (xem trong file Excel)</p>' : '')
        : '<p class="tk-rong">' + (loai === 'tang' ? 'Chưa thấy cuốn nào tăng vọt 🐢' : loai === 'ngu' ? 'Cuốn nào cũng có đơn đều 🎉' : 'Không cuốn nào hay bị thiếu 👍') + '</p>') +
      '</div>';
  }
  function hienMa(b) { return /^ten:/.test(b) ? '(không có barcode)' : b; }

  function bangTop(top) {
    if (!top.length) return '<p class="tk-rong">Không có đơn trong khoảng này.</p>';
    var ds = xemHetTop ? top : top.slice(0, 30), max = top[0].sl || 1;
    return '<div class="table-wrap"><table class="tbl"><thead><tr><th class="stt">#</th><th>Nhà</th><th>Barcode</th><th>Tên sách</th><th class="so">Giá bìa</th><th class="so">Số ngày có đơn</th><th class="so">Số cuốn</th></tr></thead><tbody>' +
      ds.map(function (x, i) {
        return '<tr><td class="stt">' + (i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1) + '</td><td>' + badge(x.nha) + '</td><td class="sku">' + esc(hienMa(x.barcode)) + '</td>' +
          '<td class="ten">' + esc(x.ten) + '<div class="tk-thanh"><i style="width:' + Math.max(2, Math.round(x.sl / max * 100)) + '%;background:' + (MAU[x.nha] || 'var(--brand)') + '"></i></div></td>' +
          '<td class="so">' + so(x.gia) + '</td><td class="so">' + x.soNgay + '</td><td class="so"><b>' + so(x.sl) + '</b></td></tr>';
      }).join('') + '</tbody></table></div>' +
      (top.length > 30 ? '<p class="tk-xemthem"><button class="btn btn-sm" type="button" data-tk-hettop>' + (xemHetTop ? 'Thu gọn' : 'Xem tất cả ' + top.length + ' cuốn') + '</button></p>' : '');
  }

  /* Làm tròn trục: 1, 2, 5 × 10^n */
  function tronTruc(v) {
    if (v <= 5) return 5;
    var m = Math.pow(10, Math.floor(Math.log10(v))), x = v / m;
    return (x <= 1 ? 1 : x <= 2 ? 2 : x <= 5 ? 5 : 10) * m;
  }
  function luoiY(W, H, l, r, t, b, max) {
    var h = '';
    for (var i = 0; i <= 4; i++) {
      var y = t + (H - t - b) * (1 - i / 4);
      h += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + y + '" y2="' + y + '" class="tk-luoi-y"/>' +
        '<text x="' + (l - 6) + '" y="' + (y + 4) + '" text-anchor="end" class="tk-chu">' + so(max * i / 4) + '</text>';
    }
    return h;
  }

  function bieuDoCot(tuan) {
    var nhas = LOC.nha ? [LOC.nha] : TK.NHA;
    if (!tuan.length) return '<p class="tk-rong">Không có dữ liệu.</p>';
    var W = 600, H = 250, l = 46, r = 10, t = 14, b = 44;
    var max = tronTruc(tuan.reduce(function (m, w) { return Math.max(m, nhas.reduce(function (s, n) { return Math.max(s, w[n]); }, 0)); }, 0));
    var bw = (W - l - r) / tuan.length, cot = Math.min(26, bw * 0.8 / nhas.length);
    var svg = luoiY(W, H, l, r, t, b, max);
    tuan.forEach(function (w, i) {
      var x0 = l + i * bw + (bw - cot * nhas.length) / 2;
      nhas.forEach(function (n, j) {
        var h = (H - t - b) * w[n] / max, x = x0 + j * cot, y = H - b - h;
        svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, cot * 0.85).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) +
          '" rx="5" style="fill:' + MAU[n] + '"><title>' + TEN[n] + ' · tuần từ ' + ngayDu(w.tuan) + ': ' + so(w[n]) + ' cuốn</title></rect>';
      });
      if (tuan.length <= 14 || i % Math.ceil(tuan.length / 14) === 0) {
        svg += '<text x="' + (l + i * bw + bw / 2).toFixed(1) + '" y="' + (H - b + 18) + '" text-anchor="middle" class="tk-chu">' + ngayVN(w.tuan) + '</text>';
      }
    });
    var chuThich = nhas.map(function (n) { return '<span><i style="background:' + MAU[n] + '"></i>' + TEN[n] + '</span>'; }).join('');
    return '<svg class="tk-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Biểu đồ cột tổng số cuốn theo tuần">' + svg +
      '<text x="' + (W / 2) + '" y="' + (H - 6) + '" text-anchor="middle" class="tk-chu">tuần bắt đầu từ thứ Hai</text></svg>' +
      '<div class="legend tk-chuthich">' + chuThich + '</div>';
  }

  function bieuDoDuong(ngay) {
    if (!ngay.length) return '<p class="tk-rong">Không có dữ liệu.</p>';
    var W = 600, H = 250, l = 46, r = 14, t = 14, b = 44;
    var max = tronTruc(ngay.reduce(function (m, d) { return Math.max(m, d.sl); }, 0));
    var n = ngay.length, buoc = n > 1 ? (W - l - r) / (n - 1) : 0;
    var diem = ngay.map(function (d, i) { return [l + (n > 1 ? i * buoc : (W - l - r) / 2), H - b - (H - t - b) * d.sl / max]; });
    var duong = diem.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var svg = luoiY(W, H, l, r, t, b, max) +
      '<polygon class="tk-vung" points="' + diem[0][0].toFixed(1) + ',' + (H - b) + ' ' + duong + ' ' + diem[n - 1][0].toFixed(1) + ',' + (H - b) + '"/>' +
      '<polyline class="tk-duong" points="' + duong + '"/>';
    var nhan = Math.ceil(n / 10);
    ngay.forEach(function (d, i) {
      if (n <= 45) svg += '<circle cx="' + diem[i][0].toFixed(1) + '" cy="' + diem[i][1].toFixed(1) + '" r="3.5" class="tk-diem"><title>' + ngayDu(d.ngay) + ': ' + so(d.sl) + ' cuốn</title></circle>';
      else svg += '<rect x="' + (diem[i][0] - buoc / 2).toFixed(1) + '" y="' + t + '" width="' + Math.max(1, buoc).toFixed(1) + '" height="' + (H - t - b) + '" fill="transparent"><title>' + ngayDu(d.ngay) + ': ' + so(d.sl) + ' cuốn</title></rect>';
      if (i % nhan === 0 || i === n - 1 && n <= 10) svg += '<text x="' + diem[i][0].toFixed(1) + '" y="' + (H - b + 18) + '" text-anchor="middle" class="tk-chu">' + ngayVN(d.ngay) + '</text>';
    });
    return '<svg class="tk-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Biểu đồ đường số cuốn theo ngày">' + svg + '</svg>' +
      '<p class="muted tk-mota">Số cuốn = số đặt trong ngày (không tính lại đơn treo từ ngày trước).' + (LOC.nguon ? ' Chỉ nguồn ' + LOC.nguon + '.' : '') + '</p>';
  }

  /* ---------- Xuất Excel ---------- */
  function xuatExcel() {
    var kq = kqHienTai;
    if (!kq) { A.toast('Chưa có số liệu để xuất.', 'loi'); return; }
    var X = root.XLSX, wb = X.utils.book_new();
    var them = function (ten, aoa, cols) {
      var ws = X.utils.aoa_to_sheet(aoa);
      ws['!cols'] = cols.map(function (w) { return { wch: w }; });
      X.utils.book_append_sheet(wb, ws, ten);
    };
    var loc = 'Từ ' + ngayDu(kq.tu) + ' đến ' + ngayDu(kq.den) + ' · ' + (LOC.nha ? TEN[LOC.nha] : 'Cả 3 nhà') + ' · ' + (LOC.nguon || 'Tất cả nguồn');
    them('Top sach', [[loc], ['STT', 'Nhà', 'Barcode', 'Tên sách', 'Giá bìa', 'Số ngày có đơn', 'Số cuốn']].concat(kq.top.map(function (x, i) {
      return [i + 1, x.nha, hienMa(x.barcode), x.ten, x.gia, x.soNgay, x.sl];
    })), [6, 6, 16, 60, 10, 14, 10]);
    them('Theo tuan', [[loc], ['Tuần từ (thứ Hai)', 'Hồng Ân', 'Khang Việt', 'Minh Long', 'Tổng']].concat(kq.theoTuan.map(function (w) {
      return [ngayDu(w.tuan), w.HA, w.KV, w.ML, w.HA + w.KV + w.ML];
    })), [18, 10, 12, 12, 10]);
    them('Theo ngay', [[loc], ['Ngày', 'Số cuốn']].concat(kq.theoNgay.map(function (d) { return [ngayDu(d.ngay), d.sl]; })), [12, 10]);
    them('Dang tang', [['7 ngày gần nhất so với 7 ngày trước (đến ' + ngayDu(kq.den) + ')'], ['Nhà', 'Barcode', 'Tên sách', '7 ngày trước', '7 ngày gần nhất', 'Tăng %']].concat(kq.dangTang.map(function (x) {
      return [x.nha, hienMa(x.barcode), x.ten, x.truoc, x.nay, x.tang === null ? 'mới' : x.tang];
    })), [6, 16, 60, 12, 14, 8]);
    them('Lau khong co don', [['Từng có đơn nhưng ≥ 30 ngày không có (tính đến ' + ngayDu(kq.den) + ')'], ['Nhà', 'Barcode', 'Tên sách', 'Đơn gần nhất', 'Số ngày']].concat(kq.lauKhong.map(function (x) {
      return [x.nha, hienMa(x.barcode), x.ten, ngayDu(x.cuoi), x.soNgay];
    })), [6, 16, 60, 14, 10]);
    them('Hay bi thieu', [['Đơn treo từ ngày trước ≥ 3 lần trong 30 ngày (đến ' + ngayDu(kq.den) + ')'], ['Nhà', 'Barcode', 'Tên sách', 'Số lần treo', 'Tổng cuốn treo']].concat(kq.hayThieu.map(function (x) {
      return [x.nha, hienMa(x.barcode), x.ten, x.soLan, x.slTreo];
    })), [6, 16, 60, 12, 14]);
    var p = kq.den.split('-');
    X.writeFile(wb, 'Thong-ke-dat-hang_' + p[2] + '-' + p[1] + '-' + p[0] + '.xlsx');
  }

  /* ---------- Nạp lịch sử từ file đơn cũ ---------- */
  var LO = 2000; // số dòng mỗi lần gửi (không cắt ngang 1 đơn)
  function napLichSu(files) {
    var btn = $('tk-nap');
    btn.disabled = true;
    Promise.all(files.map(function (f) {
      return f.arrayBuffer().then(function (buf) {
        var p = root.DocFile.parseWorkbook(root.XLSX.read(buf, { type: 'array' }), root.XLSX, f.name);
        p.file = f.name;
        return p;
      }).catch(function () { return { file: f.name, error: 'Không mở được file' }; });
    })).then(function (ds) {
      var hong = ds.filter(function (p) { return p.error; });
      var dung = ds.filter(function (p) { return !p.error; });
      var huy = {}, khongNgay = 0, webDaCo = {};
      dung = dung.filter(function (p) {
        if (p.san !== 'Web') return true;
        if (webDaCo[p.webKey]) return false;
        webDaCo[p.webKey] = 1;
        return true;
      });
      dung.forEach(function (p) {
        p.rowsGoc = p.rows.filter(function (r) {
          if (r.daHuy) { huy[r.san + ':' + r.orderId] = 1; return false; }
          if (!r.ngayDat && !r.ngayXuat) { khongNgay++; return false; }
          return true;
        });
      });
      root.DocFile.gopFile(dung); // bỏ đơn trùng mã giữa các file
      var rows = dung.reduce(function (a, p) { return a.concat(p.rows); }, []);
      var donTrungFile = dung.reduce(function (s, p) { return s + (p.soDonTrung || 0); }, 0);
      if (!rows.length) {
        A.toast('Không có dòng nào để nạp' + (hong.length ? ' (' + hong.length + ' file không đọc được)' : '') + '.', 'loi');
        return;
      }
      var kq = PL.classify(rows, DM.catalog, { maKhac: DM.caiDat.maKhac, plVoNghia: DM.caiDat.plVoNghia });
      var dong = TK.dongNapLichSu(kq);
      var chuaTinh = kq.combo.reduce(function (s, g) { return s + g.sl; }, 0) + kq.chuaRo.reduce(function (s, g) { return s + g.sl; }, 0);
      var ngay = dong.map(function (d) { return d.ngay; }).sort();
      var soDon = {};
      dong.forEach(function (d) { if (d.ma_don) soDon[d.ma_don] = 1; });
      var cuon = dong.reduce(function (s, d) { return s + d.sl; }, 0);
      var noiDung = 'Nạp ' + so(cuon) + ' cuốn của 3 nhà từ ' + dung.length + ' file' +
        (ngay.length ? ' (ngày đặt ' + ngayDu(ngay[0]) + ' → ' + ngayDu(ngay[ngay.length - 1]) + ')' : '') + ' vào lịch sử?\n\n' +
        '· Đơn đã hủy bỏ qua: ' + so(Object.keys(huy).length) + '\n' +
        '· Đơn trùng giữa các file bỏ qua: ' + so(donTrungFile) + '\n' +
        '· Đơn đã có trong lịch sử sẽ được bỏ qua (không cộng 2 lần)' +
        (chuaTinh ? '\n· ' + so(chuaTinh) + ' cuốn là combo chưa khai báo / chưa rõ nhà – không tính' : '') +
        (khongNgay ? '\n· ' + so(khongNgay) + ' dòng không có ngày đặt – bỏ qua' : '') +
        (hong.length ? '\n· ' + hong.length + ' file không đọc được: ' + hong.map(function (p) { return p.file; }).join(', ') : '');
      if (!dong.length) { A.toast('Không có dòng nào thuộc 3 nhà để nạp.', 'loi'); return; }
      return A.hoi(noiDung, '📥 Nạp', { nhe: true, tieuDe: 'Nạp lịch sử từ file đơn cũ' }).then(function (ok) {
        if (!ok) return;
        return guiTheoLo(dong).then(function (t) {
          A.toast('📥 Đã nạp lịch sử: ' + so(t.soDonMoi) + ' đơn mới' + (t.soDonTrung ? ', bỏ qua ' + so(t.soDonTrung) + ' đơn đã có' : '') + '.', 'ok');
          A.nhacLichSuLon(t);
          return A.taiLichSu(A.LS.tu || null, true);
        });
      });
    }).catch(function (e) { A.toast('Không nạp được: ' + e.message, 'loi'); })
      .then(function () { btn.disabled = !DM.coTheGhi(); });
  }

  /* Chia lô theo đơn: các dòng cùng mã đơn luôn đi chung 1 lần gửi */
  function chiaLo(dong) {
    var theoDon = {}, thuTu = [];
    dong.forEach(function (d, i) {
      var k = d.ma_don || '#' + i;
      if (!theoDon[k]) { theoDon[k] = []; thuTu.push(k); }
      theoDon[k].push(d);
    });
    var lo = [], cur = [];
    thuTu.forEach(function (k) {
      if (cur.length && cur.length + theoDon[k].length > LO) { lo.push(cur); cur = []; }
      cur = cur.concat(theoDon[k]);
    });
    if (cur.length) lo.push(cur);
    return lo;
  }
  function guiTheoLo(dong) {
    var tong = { soDonMoi: 0, soDonTrung: 0, soDong: 0, gomThang: 0, canhBaoLon: false, tongDong: 0 };
    var ds = chiaLo(dong);
    return ds.reduce(function (p, lo, i) {
      return p.then(function () {
        if (ds.length > 1) A.toast('📥 Đang nạp phần ' + (i + 1) + '/' + ds.length + '…');
        return DM.goi('napLichSuDatHang', { dong: lo }).then(function (j) {
          tong.soDonMoi += j.soDonMoi || 0; tong.soDonTrung += j.soDonTrung || 0; tong.soDong += j.soDong || 0;
          tong.gomThang += j.gomThang || 0; tong.canhBaoLon = !!j.canhBaoLon; tong.tongDong = j.tongDong || 0;
        });
      });
    }, Promise.resolve()).then(function () { return tong; });
  }

  /* ---------- Sự kiện ---------- */
  function chonSeg(id, v) {
    document.querySelectorAll('#' + id + ' .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.v === v); });
  }
  document.addEventListener('DOMContentLoaded', function () {
    [['tk-nha', 'nha'], ['tk-tg', 'tg'], ['tk-nguon', 'nguon']].forEach(function (x) {
      $(x[0]).addEventListener('click', function (e) {
        var b = e.target.closest('.seg-btn');
        if (!b) return;
        LOC[x[1]] = b.dataset.v;
        chonSeg(x[0], b.dataset.v);
        if (x[1] === 'tg') {
          $('tk-tuy').hidden = b.dataset.v !== 'tuy';
          if (b.dataset.v === 'tuy' && !$('tk-tu').value) {
            var k = khoang();
            $('tk-tu').value = LOC.tu = k.tu;
            $('tk-den').value = LOC.den = k.den;
          }
        }
        ve();
      });
    });
    ['tk-tu', 'tk-den'].forEach(function (id) {
      $(id).addEventListener('change', function () { LOC.tu = $('tk-tu').value; LOC.den = $('tk-den').value; ve(); });
    });
    $('tk-tailai').addEventListener('click', function () { A.taiLichSu(A.LS.tu || null, true); ve(); });
    $('tk-xuat').addEventListener('click', xuatExcel);
    $('tk-nap').addEventListener('click', function () { $('tk-nap-input').click(); });
    $('tk-nap-input').addEventListener('change', function () {
      var f = Array.prototype.slice.call(this.files || []);
      this.value = '';
      if (f.length) napLichSu(f);
    });
    $('tk-noidung').addEventListener('click', function (e) {
      if (e.target.closest('[data-tk-nap]')) $('tk-nap-input').click();
      else if (e.target.closest('[data-tk-thu]')) { A.taiLichSu(null, true); ve(); }
      else if (e.target.closest('[data-tk-hettop]')) { xemHetTop = !xemHetTop; ve(); }
    });
    A.LS.nghe.push(ve);
    DM.nghe(function (loai) { if (loai === 'caidat') ve(); });
  });

  root.ManThongKe = { ve: ve, chiaLo: chiaLo, LOC: LOC };
})(typeof self !== 'undefined' ? self : this);
