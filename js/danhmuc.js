/* Danh mục dùng chung (Google Sheets qua Apps Script) + cài đặt lưu trên máy.
 * - Đọc: GET <url>  → { ok, skus, combos }
 * - Ghi: POST <url> body {action, data} (Content-Type text/plain để tránh CORS preflight)
 * - Lịch sử: GET <url>?action=lichSu → { ok, lich_su }
 * URL chỉ lưu trong localStorage của từng máy, không bao giờ nằm trong code.
 *        → { ok, catalog } hoặc { ok:false, error } */
(function (root) {
  'use strict';

  var LS_CAIDAT = 'tdn.caidat.v1';
  var LS_DANHMUC = 'tdn.danhmuc.v1';

  function docLS(k, macDinh) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : macDinh; } catch (e) { return macDinh; }
  }
  function ghiLS(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* hết chỗ / chế độ riêng tư */ }
  }

  var caiDat = Object.assign({ url: '', maKhac: root.PhanLoai.MA_KHAC_MAC_DINH.slice() }, docLS(LS_CAIDAT, {}));
  if ('pin' in caiDat) { delete caiDat.pin; ghiLS(LS_CAIDAT, caiDat); } // bản cũ có PIN – không dùng nữa
  var cache = docLS(LS_DANHMUC, null);
  var catalog = chuanHoa(cache && cache.catalog);
  var trangThai = { state: caiDat.url ? 'idle' : 'none', luc: cache ? cache.luc : null, loi: '' };
  var nghe = [];

  function chuanHoa(c) {
    c = c || {};
    var skus = (c.skus || []).map(function (e) {
      return { key: String(e.key || ''), sku: String(e.sku || ''), ten: String(e.ten || ''), nha: String(e.nha || ''),
               nguon: String(e.nguon || 'tay'), cap_nhat: e.cap_nhat || '' };
    }).filter(function (e) { return e.key; });
    var combos = (c.combos || []).map(function (x) {
      var khoa = Array.isArray(x.khoa) ? x.khoa : String(x.khoa || '').split(' ;; ');
      return {
        combo_id: String(x.combo_id || ''), ten_combo: String(x.ten_combo || ''), cap_nhat: x.cap_nhat || '',
        khoa: khoa.map(function (k) { return String(k).trim(); }).filter(Boolean),
        thanh_phan: (x.thanh_phan || []).map(function (t) {
          return { sku: String(t.sku || ''), ten: String(t.ten || ''), nha: String(t.nha || 'KHAC'),
                   gia_goc: Number(t.gia_goc) || 0, so_luong: Number(t.so_luong) || 1 };
        })
      };
    }).filter(function (x) { return x.combo_id; });
    return { skus: skus, combos: combos };
  }

  function phat(loai) { nghe.forEach(function (f) { f(loai); }); }
  function datTrangThai(state, loi) {
    trangThai.state = state; trangThai.loi = loi || '';
    if (state === 'ok') trangThai.luc = new Date().toISOString();
    phat('trangthai');
  }
  function nhanCatalog(c) {
    catalog = chuanHoa(c);
    ghiLS(LS_DANHMUC, { catalog: catalog, luc: new Date().toISOString() });
    phat('catalog');
  }

  function taiLai() {
    if (!caiDat.url) { datTrangThai('none'); return Promise.resolve(false); }
    datTrangThai('syncing');
    return fetch(caiDat.url, { method: 'GET', redirect: 'follow', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || j.ok === false) throw new Error((j && j.error) || 'Dữ liệu trả về không hợp lệ');
        nhanCatalog(j);
        datTrangThai('ok');
        return true;
      })
      .catch(function (e) { datTrangThai('error', moTaLoi(e)); return false; });
  }

  function moTaLoi(e) {
    var m = (e && e.message) || String(e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Không kết nối được tới Apps Script (kiểm tra mạng hoặc URL).';
    if (/Unexpected token|JSON/i.test(m)) return 'URL không trả về dữ liệu danh mục (có thể dán sai link, hoặc Web App chưa để quyền "Anyone").';
    return m;
  }

  /* Gửi 1 thao tác ghi. Trả về Promise kết quả (đã cập nhật catalog nếu server trả về). */
  function goi(action, data) {
    if (!caiDat.url) return Promise.reject(new Error('Chưa dán URL Apps Script ở màn Cài đặt.'));
    datTrangThai('syncing');
    return fetch(caiDat.url, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: data || {} })
    })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || 'Lỗi không rõ');
        if (j.catalog) nhanCatalog(j.catalog);
        datTrangThai('ok');
        return j;
      })
      .catch(function (e) {
        var msg = moTaLoi(e);
        datTrangThai('error', msg);
        throw new Error(msg);
      });
  }

  /* 100 thay đổi gần nhất (sheet LICH_SU) */
  function lichSu() {
    if (!caiDat.url) return Promise.reject(new Error('Chưa dán URL Apps Script ở màn Cài đặt.'));
    var u = caiDat.url + (caiDat.url.indexOf('?') >= 0 ? '&' : '?') + 'action=lichSu';
    return fetch(u, { method: 'GET', redirect: 'follow', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || 'Lỗi không rõ');
        return j.lich_su || [];
      })
      .catch(function (e) { throw new Error(moTaLoi(e)); });
  }

  function luuCaiDat(moi) {
    var doiUrl = moi.url !== undefined && moi.url !== caiDat.url;
    Object.assign(caiDat, moi);
    ghiLS(LS_CAIDAT, caiDat);
    phat('caidat');
    if (doiUrl) taiLai();
  }

  root.DanhMuc = {
    get catalog() { return catalog; },
    get caiDat() { return caiDat; },
    get trangThai() { return trangThai; },
    coTheGhi: function () { return !!caiDat.url; },
    lichSu: lichSu,
    taiLai: taiLai,
    goi: goi,
    luuCaiDat: luuCaiDat,
    chuanHoa: chuanHoa,
    nghe: function (f) { nghe.push(f); }
  };
})(typeof self !== 'undefined' ? self : this);
