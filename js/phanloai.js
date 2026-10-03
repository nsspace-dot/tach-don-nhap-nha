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
  /* Khóa chính của 1 dòng:
   * - combo: có SKU thì theo SKU, không thì theo tên|phân loại
   * - sách lẻ: SKU mã vạch thì theo SKU, SKU trống / dạng chữ thì theo tên|phân loại */
  function rowKey(row, isCombo) {
    if (isCombo === undefined) isCombo = !!comboReason(row);
    var dungSku = isCombo ? !!clean(row.sku) : isBarcode(row.sku);
    return dungSku ? skuKey(row.sku) : tenKey(row.ten, row.phanLoai);
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

  /* ---------- Không phải sách ---------- */
  var RE_KHONG_PHAI_SACH = /lịch(?!\s*sử)|bloc|tranh|khung|trà |thời khóa biểu|bài vị/u;
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
    var re = /(\d+)\s*(cuốn|tập|quyển)/gu, m;
    while ((m = re.exec(t))) if (parseInt(m[1], 10) >= 2) return 'Nhiều cuốn (' + m[0] + ')';
    if (/tập\s*\d+\s*\+\s*(tập\s*)?\d+/u.test(t)) return 'Nhiều tập (Tập 1 + 2)';
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
    return { sku: sku, combo: combo };
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

    // Bước 1: combo đã khai báo (chỉ xét dòng có dấu hiệu combo)
    var combo = res.isCombo ? lookup(idx.combo, row, true) : null;
    if (combo) { res.loai = 'tach_combo'; res.combo = combo; res.nguonNha = 'combo đã khai báo'; return res; }

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
  var SAN_RANK = { TikTok: 0, combo: 1, Shopee: 2 }; // ưu tiên tên TikTok

  /* Phân loại chung chung, không cần ghép vào tên */
  var PL_CHUNG = /^(|lẻ|le|mặc định|not specified|default|1 cuốn)$/u;

  /* SKU mã vạch → gộp theo SKU ; SKU trống / dạng chữ → gộp theo tên + phân loại */
  function addToHouse(map, item) {
    var pl = clean(item.phanLoai);
    var skuLa = !isBarcode(item.sku);
    var hienPL = skuLa && !PL_CHUNG.test(norm(pl));
    var ten = hienPL ? item.ten + ' (' + pl + ')' : item.ten;
    var nhom = skuLa ? tenKey(item.ten, hienPL ? pl : '') : skuKey(item.sku);
    var id = nhom + '|' + (item.gia || 0);
    var g = map.get(id);
    if (!g) {
      g = { sku: clean(item.sku), ten: ten, gia: item.gia || 0, sl: 0, rank: 9, nhom: nhom,
            skuLa: skuLa, key: skuLa ? tenKey(item.ten, pl) : skuKey(item.sku), nguon: [], canhBaoGia: false };
      map.set(id, g);
    }
    var rank = SAN_RANK[item.rankSan];
    if (rank < g.rank) { g.rank = rank; g.ten = ten; }
    g.sl += item.sl;
    g.nguon.push(item.src);
  }

  function addToList(map, line, extra) {
    var r = line.row;
    var id = [skuKey(r.sku), norm(r.ten), norm(r.phanLoai)].join('|');
    var g = map.get(id);
    if (!g) {
      g = { sku: r.sku, ten: r.ten, phanLoai: r.phanLoai, gia: r.gia, sl: 0, nha: line.nha || '',
            ghiChu: line.ghiChu || '', lyDo: line.lyDo || '', comboLyDo: line.comboLyDo || '',
            isCombo: line.isCombo, key: line.key, keys: rowKeys(r, line.isCombo), skuLa: !isBarcode(r.sku),
            san: [], lines: [] };
      map.set(id, g);
    }
    g.sl += r.sl;
    if (g.san.indexOf(r.san) < 0) g.san.push(r.san);
    g.lines.push(line);
    if (extra) extra(g);
  }

  function sortVi(a, b) { return a.ten.localeCompare(b.ten, 'vi', { sensitivity: 'base' }); }

  /* rows: mảng dòng đọc từ file ; catalog: {skus, combos} ; settings: {maKhac: [...]} */
  function classify(rows, catalog, settings) {
    settings = settings || {};
    var idx = buildIndex(catalog);
    var reKhac = codeRegex(settings.maKhac || MA_KHAC_MAC_DINH);
    var houses = { HA: new Map(), KV: new Map(), ML: new Map() };
    var comboMap = new Map(), chuaRoMap = new Map(), boQuaMap = new Map();
    var dongTheoNha = { HA: 0, KV: 0, ML: 0 };
    var hoc = new Map(), hocXungDot = {};
    var lines = rows.map(function (row) { return classifyRow(row, idx, reKhac); });

    lines.forEach(function (ln) {
      var r = ln.row;
      if (NHA.indexOf(ln.nha) >= 0 && (ln.loai === 'nha' || ln.loai === 'combo')) dongTheoNha[ln.nha]++;
      switch (ln.loai) {
        case 'tach_combo':
          (ln.combo.thanh_phan || []).forEach(function (tp) {
            if (NHA.indexOf(tp.nha) < 0) return; // KHAC → bỏ qua
            addToHouse(houses[tp.nha], {
              sku: tp.sku, ten: clean(tp.ten), phanLoai: '', gia: Number(tp.gia_goc) || 0,
              sl: r.sl * (Number(tp.so_luong) || 1), rankSan: 'combo',
              src: { san: r.san, combo: ln.combo.ten_combo, row: r }
            });
          });
          break;
        case 'nha':
          addToHouse(houses[ln.nha], { sku: r.sku, ten: r.ten, phanLoai: r.phanLoai, gia: r.gia, sl: r.sl, rankSan: r.san, src: { san: r.san, row: r } });
          if (ln.hocSku) {
            var k = skuKey(r.sku), old = hoc.get(k);
            if (old && old.nha !== ln.nha) hocXungDot[k] = true;
            else if (!old || (r.san === 'TikTok' && old.san !== 'TikTok'))
              hoc.set(k, { key: k, sku: r.sku, ten: r.ten, nha: ln.nha, nguon: 'tu_hoc', san: r.san });
          }
          break;
        case 'combo': addToList(comboMap, ln); break;
        case 'chua_ro': addToList(chuaRoMap, ln); break;
        default: addToList(boQuaMap, ln);
      }
    });

    // Danh sách tự học: bỏ SKU xung đột, bỏ SKU đã có đúng nhà, không đè gán tay
    var hocList = [];
    hoc.forEach(function (h, k) {
      if (hocXungDot[k]) return;
      var e = idx.sku.get(k);
      if (e && (e.nguon === 'tay' || e.nha === h.nha)) return;
      delete h.san;
      hocList.push(h);
    });

    var out = { nha: {}, combo: [], chuaRo: [], boQua: [], hoc: hocList, lines: lines, dongTheoNha: dongTheoNha, tongDong: rows.length };
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
    skuKey: skuKey, tenKey: tenKey, rowKey: rowKey, rowKeys: rowKeys,
    clean: clean, norm: norm, tong: tong
  };
});
