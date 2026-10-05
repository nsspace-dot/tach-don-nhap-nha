/* Quy tắc phân loại đơn nhập nhà: HA (Hồng Ân), KV (Khang Việt), ML (Minh Long).
 * Đầu vào: các dòng đọc từ DocFile + danh mục (SKU → nhà, combo) + cài đặt.
 * Đầu ra: dữ liệu cho 5 sheet + danh sách bỏ qua + danh sách SKU tự học. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PhanLoai = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NHA = ['HA', 'KV', 'ML'];
  var TEN_NHA = { HA: 'Hồng Ân', KV: 'Khang Việt', ML: 'Minh Long' };
  var KHONG_NHAP = 'KHONG_NHAP';
  var MA_KHAC_MAC_DINH = ['MEGA', 'VT', 'HH', 'NS', 'QB', 'TN', 'HT'];

  function clean(v) {
    if (v === null || v === undefined) return '';
    return String(v).normalize('NFC').replace(/\s+/g, ' ').trim();
  }
  function norm(v) { return clean(v).toLowerCase(); }
  function isBarcode(sku) { return /^\d{7,}$/.test(clean(sku)); }

  /* ---------- Khóa nhận diện ---------- */
  function skuKey(sku) { return 'sku:' + clean(sku).toUpperCase(); }
  function tenKey(ten, phanLoai) { return 'ten:' + norm(ten) + '|' + norm(phanLoai); }
  /* Combo có SKU là mã vạch (mã của 1 cuốn lẻ) → khóa kèm phân loại: "sku:8935092825724|combo.ha" */
  function skuPlKey(sku, phanLoai) { return skuKey(sku) + '|' + norm(phanLoai); }
  /* Khóa chính của 1 dòng:
   * - combo: SKU mã vạch → sku:<mã>|<phân loại> ; SKU khác → sku:<SKU> ; không SKU → tên|phân loại
   * - sách lẻ: SKU mã vạch thì theo SKU, SKU trống / dạng chữ thì theo tên|phân loại */
  function rowKey(row, isCombo) {
    if (isCombo === undefined) isCombo = !!comboReason(row);
    if (isCombo) {
      if (isBarcode(row.sku)) return skuPlKey(row.sku, row.phanLoai);
      return clean(row.sku) ? skuKey(row.sku) : tenKey(row.ten, row.phanLoai);
    }
    return isBarcode(row.sku) ? skuKey(row.sku) : tenKey(row.ten, row.phanLoai);
  }
  function rowKeys(row, isCombo) {
    var k = [rowKey(row, isCombo)];
    var t = tenKey(row.ten, row.phanLoai);
    if (k[0] !== t) k.push(t);
    return k;
  }

  /* ---------- Nhận diện mã nhà ---------- */
  function codeRegex(codes) {
    var list = codes.map(function (c) { return clean(c).toUpperCase(); })
      .filter(Boolean)
      .map(function (c) { return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    if (!list.length) return null;
    return new RegExp('(?<![\\p{L}\\p{N}])(' + list.join('|') + ')(?![\\p{L}\\p{N}])', 'gu');
  }
  var RE_NHA = codeRegex(NHA);

  function findCodes(text, re) {
    if (!re) return [];
    var out = [];
    re.lastIndex = 0;
    var m;
    while ((m = re.exec(text))) if (out.indexOf(m[1]) < 0) out.push(m[1]);
    return out;
  }

  /* ---------- Làm gọn tên sách (chỉ để hiển thị / xuất Excel) ----------
   * "Sách Tham Khảo - Hướng Dẫn … (Dùng Kèm SGK) - HA - Newshop" → "Hướng Dẫn … (Dùng Kèm SGK)"
   * 1. Bỏ tiền tố: đoạn trước " - " đầu tiên bắt đầu bằng Sách/Vở và ≤ 4 từ.
   * 2. Bỏ hậu tố: từ mã nhà đứng riêng (HA/KV/ML/mã nhà khác) trở về sau.
   * 3. Không có mã nhà: bỏ "Newshop" ở cuối.  Gạch nối giữa tên giữ nguyên. Rỗng thì trả tên gốc. */
  var RE_DAU_THUA = /^[\s\-_,.:;|]+|[\s\-_,.:;|(\[]+$/gu;
  function tenGon(ten, maKhac) {
    var goc = clean(ten), s = goc;
    var i = s.indexOf(' - ');
    if (i > 0) {
      var dau = s.slice(0, i);
      if (/^(sách|vở)(?![\p{L}\p{N}])/iu.test(dau) && dau.split(' ').length <= 4) s = s.slice(i + 3);
    }
    var re = codeRegex(NHA.concat(maKhac || MA_KHAC_MAC_DINH));
    re.lastIndex = 0;
    var m = re.exec(s);
    if (m && m.index > 0) s = s.slice(0, m.index);
    else s = s.replace(/[\s\-_]*newshop\s*$/iu, '');
    s = s.replace(RE_DAU_THUA, '').replace(/\s+/g, ' ').trim();
    return s || goc;
  }

  /* ---------- Không phải sách ---------- */
  var RE_KHONG_PHAI_SACH = /lịch(?!\s*sử)|bloc|tranh|khung|trà |thời khóa biểu|bài vị|decal/u;

  /* ---------- Nhà cung cấp (cột "Nhà cung cấp" của đơn web) ---------- */
  function boDau(s) { return clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  /* "Nhà Sách Hồng Ân" → HA, "Nhà Sách Khang Việt" → KV, "Minh Long Book" → ML ; NCC khác → 'KHAC' ; trống → '' */
  function nhaTheoNcc(ncc) {
    var t = boDau(ncc).replace(/\s+/g, ' ');
    if (!t) return '';
    if (/hong an/.test(t)) return 'HA';
    if (/khang viet/.test(t)) return 'KV';
    if (/minh long/.test(t)) return 'ML';
    return 'KHAC';
  }
  function isNotBook(ten) {
    var t = norm(ten);
    if (/^(sách|vở|truyện)/u.test(t)) return false;
    return RE_KHONG_PHAI_SACH.test(t);
  }

  /* ---------- Sách lẻ hay combo ---------- */
  /* Chỉ dựa vào tên + phân loại (không dựa vào SKU). "COMBO.HA" cũng là combo. */
  function comboReason(row) {
    var t = norm(row.ten + ' ' + row.phanLoai);
    if (/combo/u.test(t)) return 'Có chữ "combo"';
    // "N tập" / "N cuốn" đứng trơn KHÔNG tính (dễ nhầm số lớp: "Toán 9 Tập 2", "Vật Lí 10 Tập 1")
    var m, re = /(?:^|[^\p{L}])bộ\s*(\d+)\s*(cuốn|tập|quyển)/gu; // "bộ 2 cuốn", "trọn bộ 3 tập"
    while ((m = re.exec(t))) if (parseInt(m[1], 10) >= 2) return 'Bộ nhiều cuốn (' + m[0].trim() + ')';
    re = /\(\s*(\d+)\s*(cuốn|tập|quyển)\s*\)/gu;       // "(2 cuốn)", "(3 tập)" trong ngoặc
    while ((m = re.exec(t))) if (parseInt(m[1], 10) >= 2) return 'Nhiều cuốn (' + m[0] + ')';
    if (/(tập|quyển)\s*\d+\s*\+\s*((tập|quyển)\s*)?\d+/u.test(t)) return 'Nhiều tập (Tập 1 + 2)';
    return '';
  }

  /* ---------- Danh mục ---------- */
  function buildIndex(catalog) {
    catalog = catalog || {};
    var sku = new Map(), combo = new Map();
    (catalog.skus || []).forEach(function (e) {
      var key = clean(e.key) || (clean(e.sku) ? skuKey(e.sku) : '');
      if (!key) return;
      var old = sku.get(key);
      if (!old || e.nguon === 'tay' || old.nguon !== 'tay') sku.set(key, e);
    });
    (catalog.combos || []).forEach(function (c) {
      (c.khoa || []).forEach(function (k) { if (clean(k)) combo.set(clean(k), c); });
    });
    // Mã tái bản: "sku:X" có ma_moi = Y → X là mã phụ trỏ về Y
    // "ten:…" có ma_moi = Y → listing không có barcode (SKU trống / dạng chữ) đã được quy về mã Y
    var maMoi = new Map(), maMoiTen = new Map();
    sku.forEach(function (e, k) {
      if (!clean(e.ma_moi)) return;
      if (/^sku:/.test(k)) maMoi.set(k.slice(4), clean(e.ma_moi).toUpperCase());
      else maMoiTen.set(k, clean(e.ma_moi).toUpperCase());
    });
    return { sku: sku, combo: combo, maMoi: maMoi, maMoiTen: maMoiTen };
  }

  /* Độ giống 2 tên (0..1) theo khoảng cách Levenshtein */
  function giongTen(a, b) {
    if (a === b) return 1;
    var n = a.length, m = b.length;
    if (!n || !m || Math.min(n, m) / Math.max(n, m) < 0.85) return 0;
    var truoc = new Array(m + 1), nay = new Array(m + 1), i, j;
    for (j = 0; j <= m; j++) truoc[j] = j;
    for (i = 1; i <= n; i++) {
      nay[0] = i;
      for (j = 1; j <= m; j++) nay[j] = Math.min(truoc[j] + 1, nay[j - 1] + 1, truoc[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1));
      var t = truoc; truoc = nay; nay = t;
    }
    return 1 - truoc[m] / Math.max(n, m);
  }

  /* Mã EAN-13 có đúng số kiểm tra không */
  function ean13HopLe(s) {
    if (!/^\d{13}$/.test(s)) return true;
    var tong = 0;
    for (var i = 0; i < 12; i++) tong += Number(s[i]) * (i % 2 ? 3 : 1);
    return (10 - tong % 10) % 10 === Number(s[12]);
  }
  function homNayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /* Đi theo chuỗi tái bản X → Y → Z tới mã mới nhất (chặn vòng lặp) */
  function maMoiNhat(idx, sku) {
    var cur = clean(sku).toUpperCase(), seen = {};
    while (idx.maMoi.has(cur) && !seen[cur]) { seen[cur] = 1; cur = idx.maMoi.get(cur); }
    return cur;
  }
  function soGia(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }
  /* Tên để so tái bản: tên làm gọn, bỏ dấu, chữ thường, gộp khoảng trắng */
  function tenSoSanh(ten, maKhac) {
    return tenGon(ten, maKhac).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /* ---------- Phân loại có nghĩa & tên tạm ----------
   * Phân loại vô nghĩa (trống, "Not Specified", "Default", "Mặc định", "Lẻ"…) hoặc đã có trong tên → không ghép vào tên. */
  var PL_VO_NGHIA_MAC_DINH = ['Not Specified', 'Default', 'Mặc định', 'Lẻ', '1 cuốn'];
  function plCoNghia(pl, ten, dsVoNghia) {
    var p = boDau(pl);
    if (!p) return '';
    var vn = (dsVoNghia && dsVoNghia.length ? dsVoNghia : PL_VO_NGHIA_MAC_DINH).map(boDau);
    if (vn.indexOf(p) >= 0) return '';
    if (boDau(ten).replace(/\s+/g, ' ').indexOf(p.replace(/\s+/g, ' ')) >= 0) return '';
    return clean(pl);
  }
  /* Tên tạm khi chưa có tên khai báo: tên sàn đã làm gọn + " – " + phân loại (nếu có nghĩa) */
  function tenTam(ten, pl, maKhac, dsVoNghia) {
    var gon = tenGon(ten, maKhac), p = plCoNghia(pl, gon, dsVoNghia);
    return p ? gon + ' – ' + p : gon;
  }
  /* Tên để so với sổ mã chuẩn web: TÊN SÀN + PHÂN LOẠI (có nghĩa), bỏ dấu, chữ thường */
  function tenSoSanhDayDu(ten, pl, maKhac, dsVoNghia) {
    var gon = tenGon(ten, maKhac), p = plCoNghia(pl, gon, dsVoNghia);
    return (tenSoSanh(gon, maKhac) + (p ? ' ' + boDau(p) : '')).replace(/\s+/g, ' ').trim();
  }
  /* Các con số trong tên (lớp, tập…) – 2 tên có số khác nhau thì không phải cùng 1 cuốn */
  function cacSo(t) { return (String(t).match(/\d+/g) || []).map(Number).sort(function (a, b) { return a - b; }).join(','); }

  /* Giá dùng cho 1 thành phần combo: (a) giá sách lẻ trong file hôm nay → (b) giá gần nhất trong danh mục → (c) giá khai báo */
  function giaThanhPhan(idx, giaFile, tp) {
    var s = maMoiNhat(idx, tp.sku);
    if (s && giaFile[s]) return { gia: giaFile[s], nguon: 'file' };
    var e = s && idx.sku.get(skuKey(s));
    if (e && soGia(e.gia_gan_nhat)) return { gia: soGia(e.gia_gan_nhat), nguon: 'danh_muc' };
    return { gia: Number(tp.gia_goc) || 0, nguon: 'khai_bao' };
  }

  /* Combo "Tách" có giá khai báo khác giá đang dùng → [{combo_id, ten_combo, ds:[{sku, ten, cu, moi}]}] */
  function lechGiaCombo(catalog, giaFile) {
    var idx = catalog && catalog.sku instanceof Map ? catalog : buildIndex(catalog);
    var ds = [];
    var combos = catalog.combos || Array.from(new Set(idx.combo.values()));
    combos.forEach(function (c) {
      if (c.cach_xuat === 'nguyen') return;
      var lech = [];
      (c.thanh_phan || []).forEach(function (tp) {
        if (!clean(tp.sku) || NHA.indexOf(tp.nha) < 0) return;
        var g = giaThanhPhan(idx, giaFile || {}, tp);
        if (g.nguon !== 'khai_bao' && g.gia !== (Number(tp.gia_goc) || 0)) lech.push({ sku: tp.sku, ten: tp.ten, cu: Number(tp.gia_goc) || 0, moi: g.gia });
      });
      if (lech.length) ds.push({ combo_id: c.combo_id, ten_combo: c.ten_combo, ds: lech });
    });
    return ds;
  }
  function lookup(map, row, isCombo) {
    var keys = rowKeys(row, isCombo);
    for (var i = 0; i < keys.length; i++) if (map.has(keys[i])) return map.get(keys[i]);
    return null;
  }

  /* ---------- Phân loại 1 dòng ---------- */
  /* kết quả: { loai: 'nha'|'combo'|'tach_combo'|'chua_ro'|'bo_qua', nha, combo, ghiChu, lyDo, nguonNha, hocSku } */
  function classifyRow(row, idx, reKhac) {
    var text = row.ten + ' ' + row.phanLoai;
    var cr = comboReason(row);
    var res = { row: row, key: rowKey(row, !!cr), isCombo: !!cr, comboLyDo: cr, nha: '', ghiChu: '', lyDo: '' };
    res.tronNha = findCodes(text, reKhac).length > 0;

    // Bước 0: đơn web có cột "Nhà cung cấp" → theo nhà cung cấp (ưu tiên hơn mọi quy tắc khác). Mỗi dòng web = 1 cuốn sách.
    var ncc = row.san === 'Web' ? nhaTheoNcc(row.ncc) : '';
    if (ncc) {
      res.isCombo = false; res.comboLyDo = ''; res.tronNha = false; res.key = rowKey(row, false);
      if (ncc === 'KHAC') { res.loai = 'bo_qua'; res.lyDo = 'Nhà khác (' + clean(row.ncc) + ')'; return res; }
      res.loai = 'nha'; res.nha = ncc; res.nguonNha = 'nhà cung cấp (web)';
      if (isBarcode(row.sku)) res.hocWeb = true;
      return res;
    }

    // Bước 1: combo đã khai báo (chỉ xét dòng có dấu hiệu combo)
    var combo = res.isCombo ? lookup(idx.combo, row, true) : null;
    // Khóa cũ "sku:<mã vạch>" trơn → vẫn nhận, và ghi nhận để đổi sang khóa mới
    if (!combo && res.isCombo && isBarcode(row.sku) && idx.combo.has(skuKey(row.sku))) {
      combo = idx.combo.get(skuKey(row.sku));
      res.doiKhoa = { combo_id: combo.combo_id, khoa_cu: skuKey(row.sku), khoa_moi: res.key };
    }
    if (combo) {
      res.combo = combo; res.nguonNha = 'combo đã khai báo';
      if (combo.cach_xuat === 'nguyen' && NHA.indexOf(combo.nha) >= 0) { res.loai = 'nguyen_combo'; res.nha = combo.nha; }
      else res.loai = 'tach_combo';
      return res;
    }

    // Bước 2: gán tay trong danh mục → coi là 1 cuốn sách của nhà đó
    var e = lookup(idx.sku, row, res.isCombo);
    if (e && e.nguon === 'tay') {
      if (e.nha === KHONG_NHAP) { res.loai = 'bo_qua'; res.lyDo = 'Đã đánh dấu "Không nhập"'; return res; }
      if (NHA.indexOf(e.nha) >= 0) {
        res.loai = 'nha'; res.nha = e.nha; res.isCombo = false; res.key = rowKey(row, false);
        res.nguonNha = 'danh mục (gán tay)';
        return res;
      }
    }

    // Bước 3: không phải sách
    if (isNotBook(row.ten)) { res.loai = 'bo_qua'; res.lyDo = 'Không phải sách'; return res; }

    // Bước 4: mã nhà trong tên / phân loại
    var codes = findCodes(text, RE_NHA);
    var khac = findCodes(text, reKhac);
    if (codes.length === 1) {
      res.nha = codes[0]; res.nguonNha = 'mã trong tên';
      if (khac.length) res.ghiChu = 'Combo trộn nhà – chỉ nhập phần ' + codes[0] + ' (có ' + khac.join(', ') + ')';
      else if (!res.isCombo && isBarcode(row.sku)) res.hocSku = true;
    } else if (codes.length > 1) {
      res.nha = codes.join('+'); res.nguonNha = 'mã trong tên';
      res.ghiChu = 'Có nhiều mã nhà: ' + codes.join(', ');
    } else if (e && NHA.indexOf(e.nha) >= 0) {
      // Bước 5: không có mã nhưng SKU có trong danh mục (tự học)
      res.nha = e.nha; res.nguonNha = 'danh mục (tự học)';
    } else if (e && e.nha === KHONG_NHAP) {
      res.loai = 'bo_qua'; res.lyDo = 'Đã đánh dấu "Không nhập"'; return res;
    } else if (khac.length) {
      // Bước 6: mã nhà khác
      res.loai = 'bo_qua'; res.lyDo = 'Nhà khác (' + khac.join(', ') + ')'; return res;
    }

    if (NHA.indexOf(res.nha) >= 0) { res.loai = res.isCombo ? 'combo' : 'nha'; return res; }
    if (res.nha && res.isCombo) { res.loai = 'combo'; return res; } // nhiều mã nhà, là combo
    // Bước 7: chưa rõ
    res.loai = 'chua_ro';
    return res;
  }

  /* ---------- Gộp kết quả ---------- */
  var SAN_RANK = { TikTok: 0, combo: 1, Shopee: 2 }; // ưu tiên tên TikTok (cho tên tạm)

  /* Gộp 1 dòng vào nhà. CHỈ gộp khi:
   *  (a) cùng barcode (đã quy mã phụ / tái bản / mã web) + cùng giá  (khác giá → 2 dòng, tô vàng cảnh báo)
   *  (b) SKU trống / dạng chữ: cùng tên sàn đã làm gọn + cùng phân loại + cùng giá
   * KHÔNG gộp 2 barcode khác nhau chỉ vì tên giống.
   * Tên xuất: item.tenKB (tên đã khai báo – danh mục / sổ mã chuẩn web / thành phần combo), không có thì tên tạm. */
  function addToHouse(map, item, opt) {
    var pl = clean(item.phanLoai);
    var skuLa = item.nhom ? !clean(item.sku) : !isBarcode(item.sku);
    var tam = item.tenXuat || (item.nhom ? tenGon(item.ten, opt.maKhac) : tenTam(item.ten, pl, opt.maKhac, opt.plVN));
    var nhom = item.nhom || (skuLa ? 'ten:' + norm(tenGon(item.ten, opt.maKhac)) + '|' + norm(plCoNghia(pl, item.ten, opt.plVN)) : skuKey(item.sku));
    var id = nhom + '|' + (item.gia || 0);
    var g = map.get(id);
    if (!g) {
      g = { sku: clean(item.sku), ten: item.ten + (pl ? ' (' + pl + ')' : ''), phanLoai: pl, tenGon: item.tenKB || tam, gia: item.gia || 0, sl: 0, rank: 9, nhom: nhom,
            skuLa: skuLa, key: item.nhom ? '' : (skuLa ? tenKey(item.ten, pl) : skuKey(item.sku)), nguon: [], canhBaoGia: false, tenSan: item.ten,
            // Khóa để khai báo tên sách: barcode, hoặc tên|phân loại của listing không có barcode (thành phần combo không mã → sửa trong combo)
            khoaTen: item.nhom ? '' : !skuLa ? skuKey(item.sku) : item.laTp ? '' : tenKey(item.ten, pl),
            nguonTen: item.tenKB ? item.nguonTen : (item.nhom ? 'combo' : 'tam'), chuaCoTen: !item.tenKB && !item.nhom };
      map.set(id, g);
    }
    var rank = SAN_RANK[item.rankSan];
    if (rank < g.rank) {
      g.rank = rank; g.ten = item.ten + (pl ? ' (' + pl + ')' : ''); g.phanLoai = pl; g.tenSan = item.ten;
      if (!item.tenKB && g.chuaCoTen) g.tenGon = tam;
      if (item.nhom && !item.skuCoDinh) { g.sku = clean(item.sku); g.skuLa = !g.sku; }
    }
    if (item.tenKB && g.chuaCoTen) { g.tenGon = item.tenKB; g.nguonTen = item.nguonTen; g.chuaCoTen = false; }
    g.sl += item.sl;
    g.nguon.push(Object.assign({ sl: item.sl }, item.src)); // sl: số cuốn dòng này góp vào (dùng cho lịch sử đặt hàng)
    if (item.maCu && (g.maCu = g.maCu || []).indexOf(item.maCu) < 0) g.maCu.push(item.maCu);
    if (item.quyVeWeb) g.quyVeWeb = true;
  }

  function addToList(map, line, maKhac) {
    var r = line.row;
    var id = [skuKey(r.sku), norm(r.ten), norm(r.phanLoai)].join('|');
    var g = map.get(id);
    if (!g) {
      g = { sku: r.sku, ten: r.ten, phanLoai: r.phanLoai, gia: r.gia, sl: 0, nha: line.nha || '',
            ghiChu: line.ghiChu || '', lyDo: line.lyDo || '', comboLyDo: line.comboLyDo || '',
            isCombo: line.isCombo, key: line.key, keys: rowKeys(r, line.isCombo), skuLa: !isBarcode(r.sku),
            tronNha: !!line.tronNha, tenGon: tenGon(r.ten, maKhac), san: [], lines: [] };
      map.set(id, g);
    }
    g.sl += r.sl;
    if (g.san.indexOf(r.san) < 0) g.san.push(r.san);
    g.lines.push(line);
  }

  function sortVi(a, b) { return (a.tenGon || a.ten).localeCompare(b.tenGon || b.ten, 'vi', { sensitivity: 'base' }); }

  /* rows: mảng dòng đọc từ file ; catalog: {skus, combos} ; settings: {maKhac: [...]} */
  function classify(rows, catalog, settings) {
    settings = settings || {};
    var idx = buildIndex(catalog);
    var reKhac = codeRegex(settings.maKhac || MA_KHAC_MAC_DINH);
    var houses = { HA: new Map(), KV: new Map(), ML: new Map() };
    var comboMap = new Map(), chuaRoMap = new Map(), boQuaMap = new Map();
    var dongTheoNha = { HA: 0, KV: 0, ML: 0 };
    var hoc = new Map(), hocXungDot = {}, doiKhoa = {};
    var maKhac = settings.maKhac || MA_KHAC_MAC_DINH;
    var plVN = settings.plVoNghia;
    var giaFile = {}, listing = new Map(), taiBan = new Map(), maTaiBan = {};

    // Tên làm gọn của các SKU mã vạch đang dùng (chưa bị thay mã) → để phát hiện tái bản
    var theoTen = new Map();
    idx.sku.forEach(function (e, k) {
      if (!/^sku:/.test(k) || !isBarcode(k.slice(4)) || clean(e.ma_moi) || !clean(e.ten)) return;
      var t = tenSoSanhDayDu(e.ten, e.phan_loai, maKhac, plVN);
      if (!theoTen.has(t)) theoTen.set(t, []);
      theoTen.get(t).push(e);
    });

    // ---------- Sổ mã chuẩn (barcode web) = danh mục MA_CHUAN + các dòng web trong file hôm nay ----------
    var soChuan = new Map(), maChuanGhi = new Map();
    function themChuan(e) {
      var bc = clean(e.barcode).toUpperCase();
      if (!isBarcode(bc)) return null;
      var cu = soChuan.get(bc);
      var kp = (cu ? cu.khongPhai : []).concat(clean(e.khong_phai) ? clean(e.khong_phai).split(/\s*;;\s*/) : []);
      var moi = { barcode: bc, ten: clean(e.ten_gon || e.ten), gia: soGia(e.gia_bia), nha: clean(e.nha), ncc: clean(e.ncc),
                  ngay: clean(e.ngay_thay), khongPhai: kp };
      moi.tenSS = tenSoSanh(moi.ten, maKhac);
      soChuan.set(bc, moi);
      return cu;
    }
    ((catalog && catalog.ma_chuan) || []).forEach(themChuan);
    rows.forEach(function (row) {
      if (row.san !== 'Web' || !isBarcode(row.sku)) return;
      var n = nhaTheoNcc(row.ncc);
      var it = { barcode: clean(row.sku).toUpperCase(), ten_gon: tenGon(row.ten, maKhac), gia_bia: soGia(row.gia), ncc: clean(row.ncc),
                 nha: NHA.indexOf(n) >= 0 ? n : '', ngay_thay: row.ngayXuat || homNayISO() };
      var cu = themChuan(it);
      if (!cu || cu.ten !== it.ten_gon || cu.gia !== it.gia_bia || cu.ncc !== it.ncc || cu.ngay < it.ngay_thay) maChuanGhi.set(it.barcode, it);
    });
    var soTheoTen = new Map();
    soChuan.forEach(function (e) { if (!soTheoTen.has(e.tenSS)) soTheoTen.set(e.tenSS, []); soTheoTen.get(e.tenSS).push(e); });

    var maPhuGhi = new Map(), cungCuon = new Map();
    var LY_DO_MA = { web_tu_khop: 'khớp chắc', xac_nhan: 'tôi xác nhận' };
    function themListing(row, maCu, maMoiX, lyDo) {
      var lk = row.san + '|' + maCu + '|' + norm(row.ten) + '|' + lyDo;
      var l = listing.get(lk) || { san: row.san, ten: row.ten, phanLoai: row.phanLoai, maCu: maCu, maMoi: maMoiX, lyDo: lyDo, soDong: 0 };
      l.soDong++;
      listing.set(lk, l);
    }
    function nhaGoiY(row) {
      var c = findCodes(row.ten + ' ' + row.phanLoai, RE_NHA);
      if (c.length === 1) return c[0];
      var e = lookup(idx.sku, row, false);
      return e && NHA.indexOf(e.nha) >= 0 ? e.nha : '';
    }

    rows = rows.map(function (row) {
      if (comboReason(row) && !(row.san === 'Web' && nhaTheoNcc(row.ncc))) return row;
      var r = row, sku = clean(row.sku).toUpperCase(), maVach = isBarcode(sku);
      if (row.san !== 'Web') {
        var khoa = rowKey(row, false), eX = idx.sku.get(khoa);
        // a. Mã phụ đã lưu (tái bản / tự khớp / tôi xác nhận) → tính như mã mới nhất
        var dau = maVach ? sku : idx.maMoiTen.get(khoa) || '';
        var moi = dau ? maMoiNhat(idx, dau) : '';
        if (moi && moi !== sku) {
          var lyDo = (eX && LY_DO_MA[eX.nguon_ma]) || 'tái bản';
          r = Object.assign({}, row, { sku: moi, skuCu: sku || '(trống)', lyDoMa: lyDo, quyVeWeb: lyDo !== 'tái bản' });
          themListing(row, sku || '(trống)', moi, lyDo);
        } else if (!(maVach && soChuan.has(sku))) {
          // b. Chưa có trong sổ mã chuẩn → so tên đã làm gọn với sổ
          var tss = tenSoSanhDayDu(row.ten, row.phanLoai, maKhac, plVN), giaRow = soGia(row.gia);
          var trungTen = (soTheoTen.get(tss) || []).filter(function (e) { return e.barcode !== sku && e.khongPhai.indexOf(khoa) < 0; });
          var chac = trungTen.filter(function (e) { return e.gia && e.gia === giaRow; })[0];
          if (chac && !(eX && eX.nguon === 'tay')) {
            // KHỚP CHẮC: tên trùng hẳn + cùng giá → tự quy về barcode web (không bao giờ đè dữ liệu gán tay)
            r = Object.assign({}, row, { sku: chac.barcode, skuCu: sku || '(trống)', lyDoMa: 'khớp chắc', quyVeWeb: true });
            if (!maPhuGhi.has(khoa)) maPhuGhi.set(khoa, { key: khoa, sku: sku, ten: row.ten, ma_moi: chac.barcode, nha: chac.nha, nguon_ma: 'web_tu_khop' });
            themListing(row, sku || '(trống)', chac.barcode, 'khớp chắc');
          } else {
            // KHỚP VỪA: tên trùng hẳn nhưng khác giá, hoặc tên giống ≥ 90% + cùng nhà + giá chênh ≤ 15% → hỏi
            var ung = trungTen.filter(function (e) { return e !== chac; }).map(function (e) {
              return { e: e, lyDo: 'Tên trùng, khác giá (' + giaRow + ' / ' + e.gia + ')' };
            });
            var nhaRow = nhaGoiY(row);
            if (!ung.length && nhaRow && giaRow) {
              soChuan.forEach(function (e) {
                if (e.nha !== nhaRow || !e.gia || e.barcode === sku || e.khongPhai.indexOf(khoa) >= 0) return;
                if (Math.abs(e.gia - giaRow) / Math.max(e.gia, giaRow) > 0.15) return;
                if (cacSo(tss) !== cacSo(e.tenSS)) return; // "Lớp 1" ≠ "Lớp 3"
                var sim = giongTen(tss, e.tenSS);
                if (sim >= 0.9) ung.push({ e: e, lyDo: 'Tên giống ' + Math.floor(sim * 100) + '%' + (e.gia !== giaRow ? ', giá ' + giaRow + ' / ' + e.gia : '') });
              });
            }
            ung.forEach(function (u) {
              var ck = khoa + '>' + u.e.barcode;
              var c = cungCuon.get(ck) || { khoa: khoa, sku: sku, ten: row.ten, phanLoai: row.phanLoai, san: row.san, gia: giaRow,
                maChuan: u.e.barcode, tenChuan: u.e.ten, giaChuan: u.e.gia, nhaChuan: u.e.nha, lyDo: u.lyDo, soDong: 0 };
              c.soDong++;
              cungCuon.set(ck, c);
            });
          }
        }
        // c. Barcode trên sàn sai số kiểm tra (EAN-13)
        if (maVach && !ean13HopLe(sku)) themListing(row, sku, r.sku !== sku ? r.sku : '', 'mã sai số kiểm tra');
      }
      if (!isBarcode(r.sku)) return r;
      // Sách có trong sổ mã chuẩn → dùng tên đã làm gọn của bản web
      if (soChuan.has(r.sku) && soChuan.get(r.sku).ten) {
        if (r === row) r = Object.assign({}, row);
        r.tenChuan = soChuan.get(r.sku).ten;
      }
      // Giá sách lẻ trong file hôm nay (nhiều giá → lấy cao nhất)
      if (soGia(r.gia) && soGia(r.gia) > (giaFile[r.sku] || 0)) giaFile[r.sku] = soGia(r.gia);
      // Mã vạch MỚI, tên trùng 1 SKU đã có → có thể là bản tái bản
      if (!idx.sku.has(skuKey(r.sku)) && !r.quyVeWeb) {
        (theoTen.get(tenSoSanhDayDu(row.ten, row.phanLoai, maKhac, plVN)) || []).forEach(function (e) {
          var x = clean(e.sku).toUpperCase();
          if (x === r.sku) return;
          var boQua = clean(e.khong_tai_ban).toUpperCase().split(/\s*;;?\s*/);
          if (boQua.indexOf(r.sku) >= 0) return;
          var tk = x + '>' + r.sku;
          var tb = taiBan.get(tk) || { maCu: x, maMoi: r.sku, ten: row.ten, tenCu: e.ten, nha: e.nha, giaCu: soGia(e.gia_gan_nhat), giaMoi: 0, soDong: 0 };
          tb.giaMoi = Math.max(tb.giaMoi, soGia(r.gia));
          tb.soDong++;
          taiBan.set(tk, tb);
          maTaiBan[r.sku] = true;
        });
      }
      return r;
    });
    var lines = rows.map(function (row) { return classifyRow(row, idx, reKhac); });

    /* Tên đã khai báo: (1) cột "Tên sách" trong danh mục SKU → nhà ; (2) tên trong sổ mã chuẩn web. null = chưa có */
    var optTen = { maKhac: maKhac, plVN: plVN };
    function tenKB(sku, khoaKhac) {
      var ma = clean(sku).toUpperCase();
      var e = isBarcode(ma) ? idx.sku.get(skuKey(ma)) : khoaKhac ? idx.sku.get(khoaKhac) : null;
      if (e && clean(e.ten_sach)) return { ten: clean(e.ten_sach), nguon: 'tay' };
      var c = isBarcode(ma) && soChuan.get(ma);
      if (c && c.ten) return { ten: c.ten, nguon: 'web' };
      return null;
    }

    lines.forEach(function (ln) {
      var r = ln.row;
      if (NHA.indexOf(ln.nha) >= 0 && (ln.loai === 'nha' || ln.loai === 'combo')) dongTheoNha[ln.nha]++;
      if (ln.loai === 'nguyen_combo') dongTheoNha[ln.nha]++;
      if (ln.doiKhoa) {
        var dk = doiKhoa[ln.doiKhoa.combo_id + '\u0000' + ln.doiKhoa.khoa_cu] = doiKhoa[ln.doiKhoa.combo_id + '\u0000' + ln.doiKhoa.khoa_cu] ||
          { combo_id: ln.doiKhoa.combo_id, khoa_cu: ln.doiKhoa.khoa_cu, khoa_moi: [] };
        if (dk.khoa_moi.indexOf(ln.doiKhoa.khoa_moi) < 0) dk.khoa_moi.push(ln.doiKhoa.khoa_moi);
      }
      if (ln.loai === 'tach_combo') NHA.forEach(function (n) {
        if ((ln.combo.thanh_phan || []).some(function (tp) { return tp.nha === n; })) dongTheoNha[n]++;
      });
      switch (ln.loai) {
        case 'tach_combo':
          (ln.combo.thanh_phan || []).forEach(function (tp) {
            if (NHA.indexOf(tp.nha) < 0) return; // KHAC → bỏ qua
            var skuTp = clean(tp.sku) ? maMoiNhat(idx, tp.sku) : '';
            // Tên: danh mục (khai báo tay) → sổ mã chuẩn web → tên đã khai báo trong combo
            var kbTp = tenKB(skuTp, '') || (clean(tp.ten) ? { ten: tenGon(tp.ten, maKhac), nguon: 'combo' } : null);
            addToHouse(houses[tp.nha], {
              sku: skuTp, ten: clean(tp.ten), phanLoai: '', gia: giaThanhPhan(idx, giaFile, tp).gia,
              sl: r.sl * (Number(tp.so_luong) || 1), rankSan: 'combo', laTp: true, tenKB: kbTp && kbTp.ten, nguonTen: kbTp && kbTp.nguon,
              src: { san: r.san, combo: ln.combo.ten_combo, row: r }
            }, optTen);
          });
          break;
        case 'nguyen_combo':
          // Xuất nguyên combo: 1 dòng / combo, gộp mọi đơn của combo (mọi sàn, mọi khóa)
          var cb = ln.combo, maHT = clean(cb.ma_he_thong);
          addToHouse(houses[ln.nha], {
            nhom: 'combo:' + cb.combo_id, sku: maHT || r.sku, skuCoDinh: !!maHT, ten: r.ten, tenXuat: clean(cb.ten_xuat),
            phanLoai: '', gia: r.gia, sl: r.sl, rankSan: r.san,
            src: { san: r.san, nguyen: cb.ten_combo, row: r }
          }, optTen);
          break;
        case 'nha':
          var kb = tenKB(r.sku, rowKey(r, false));
          addToHouse(houses[ln.nha], { sku: r.sku, ten: r.ten, phanLoai: r.phanLoai, gia: r.gia, sl: r.sl, rankSan: r.san, maCu: r.skuCu,
            tenKB: kb && kb.ten, nguonTen: kb && kb.nguon, quyVeWeb: r.quyVeWeb, src: { san: r.san, row: r } }, optTen);
          if (ln.hocWeb) {
            // Đơn web: nhà theo nhà cung cấp → nguồn "web" (mạnh hơn tự học, không đè gán tay)
            var kw = skuKey(r.sku), cw = hoc.get(kw);
            if (cw && cw.nguon === 'web' && cw.nha !== ln.nha) hocXungDot[kw] = true;
            else hoc.set(kw, { key: kw, sku: r.sku, ten: (cw && cw.nguon !== 'web' && cw.ten) || r.ten, nha: ln.nha, nguon: 'web', san: r.san, gia_gan_nhat: giaFile[r.sku] || '' });
          } else if (ln.hocSku && !maTaiBan[r.sku]) {
            var k = skuKey(r.sku), old = hoc.get(k);
            if (old && old.nguon === 'web') { /* web đã có → bỏ qua tự học */ }
            else if (old && old.nha !== ln.nha) hocXungDot[k] = true;
            else if (!old || (r.san === 'TikTok' && old.san !== 'TikTok'))
              hoc.set(k, { key: k, sku: r.sku, ten: r.ten, phan_loai: plCoNghia(r.phanLoai, r.ten, plVN), nha: ln.nha, nguon: 'tu_hoc', san: r.san, gia_gan_nhat: giaFile[r.sku] || '' });
          }
          break;
        case 'combo': addToList(comboMap, ln, maKhac); break;
        case 'chua_ro': addToList(chuaRoMap, ln, maKhac); break;
        default: addToList(boQuaMap, ln, maKhac);
      }
    });

    // Danh sách tự học: bỏ SKU xung đột, bỏ SKU đã có đúng nhà, không đè nguồn mạnh hơn (tay > web > tự học)
    var HANG = { tu_hoc: 1, web: 2, tay: 3 };
    var hocList = [];
    hoc.forEach(function (h, k) {
      if (hocXungDot[k]) return;
      var e = idx.sku.get(k);
      if (e && (e.nguon === 'tay' || (HANG[e.nguon] || 3) > HANG[h.nguon] || (e.nha === h.nha && (HANG[e.nguon] || 3) >= HANG[h.nguon]))) return;
      delete h.san;
      hocList.push(h);
    });

    // Cập nhật giá gần nhất: SKU mã vạch đã có trong danh mục, giá trong file khác giá đang lưu
    var capNhatGia = [];
    Object.keys(giaFile).forEach(function (s) {
      var e = idx.sku.get(skuKey(s));
      if (e && soGia(e.gia_gan_nhat) !== giaFile[s]) capNhatGia.push({ key: skuKey(s), sku: s, ten: e.ten, cu: soGia(e.gia_gan_nhat), gia: giaFile[s] });
    });
    // Combo "Tách" bị lệch giá (chỉ combo có đơn hôm nay)
    var comboHomNay = {};
    lines.forEach(function (ln) { if (ln.loai === 'tach_combo') comboHomNay[ln.combo.combo_id] = true; });
    var lechGia = lechGiaCombo(Object.assign({}, idx, { combos: catalog ? catalog.combos || [] : [] }), giaFile);

    var out = { nha: {}, combo: [], chuaRo: [], boQua: [], hoc: hocList, lines: lines, dongTheoNha: dongTheoNha, tongDong: rows.length,
                maKhac: maKhac, doiKhoa: Object.keys(doiKhoa).map(function (k) { return doiKhoa[k]; }),
                giaFile: giaFile, capNhatGia: capNhatGia, lechGia: lechGia,
                lechGiaHomNay: lechGia.filter(function (l) { return comboHomNay[l.combo_id]; }),
                taiBan: Array.from(taiBan.values()), listingCanSua: Array.from(listing.values()),
                cungCuon: Array.from(cungCuon.values()), maPhu: Array.from(maPhuGhi.values()), maChuan: Array.from(maChuanGhi.values()) };
    NHA.forEach(function (n) {
      var list = Array.from(houses[n].values());
      var dem = {};
      list.forEach(function (g) { dem[g.nhom] = (dem[g.nhom] || 0) + 1; });
      list.forEach(function (g) { g.canhBaoGia = dem[g.nhom] > 1; delete g.rank; delete g.nhom; });
      out.nha[n] = list.sort(sortVi);
    });
    out.combo = Array.from(comboMap.values()).sort(sortVi);
    out.chuaRo = Array.from(chuaRoMap.values()).sort(sortVi);
    out.boQua = Array.from(boQuaMap.values()).sort(function (a, b) {
      return a.lyDo.localeCompare(b.lyDo, 'vi') || sortVi(a, b);
    });
    return out;
  }

  /* Tổng số dòng & tổng số cuốn của 1 danh sách đã gộp */
  function tong(list) {
    return list.reduce(function (s, g) { s.dong++; s.cuon += g.sl; return s; }, { dong: 0, cuon: 0 });
  }

  return {
    NHA: NHA, TEN_NHA: TEN_NHA, KHONG_NHAP: KHONG_NHAP, MA_KHAC_MAC_DINH: MA_KHAC_MAC_DINH,
    classify: classify, classifyRow: classifyRow, buildIndex: buildIndex,
    comboReason: comboReason, isNotBook: isNotBook, isBarcode: isBarcode,
    findCodes: findCodes, codeRegex: codeRegex, RE_NHA: RE_NHA,
    maMoiNhat: maMoiNhat, nhaTheoNcc: nhaTheoNcc, giongTen: giongTen, ean13HopLe: ean13HopLe, homNayISO: homNayISO, giaThanhPhan: giaThanhPhan, lechGiaCombo: lechGiaCombo, tenSoSanh: tenSoSanh,
    plCoNghia: plCoNghia, tenTam: tenTam, tenSoSanhDayDu: tenSoSanhDayDu, PL_VO_NGHIA_MAC_DINH: PL_VO_NGHIA_MAC_DINH,
    skuKey: skuKey, skuPlKey: skuPlKey, tenKey: tenKey, rowKey: rowKey, rowKeys: rowKeys, tenGon: tenGon,
    clean: clean, norm: norm, tong: tong
  };
});
