/* Giả lập tối thiểu môi trường Google Apps Script (SpreadsheetApp, LockService…) để chạy Code.gs bằng Node.
 * Chỉ dùng cho kiểm thử. */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

function pad(n) { return (n < 10 ? '0' : '') + n; }
function formatDate(d, tz, fmt) {
  return fmt.replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate()))
    .replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())).replace('ss', pad(d.getSeconds()));
}

function Sheet(name) { this.name = name; this.data = []; this.frozen = 0; }
Sheet.prototype.getName = function () { return this.name; };
Sheet.prototype.setName = function (n) { this.name = n; return this; };
Sheet.prototype.setFrozenRows = function (n) { this.frozen = n; };
Sheet.prototype.getLastRow = function () {
  for (var i = this.data.length - 1; i >= 0; i--) {
    if ((this.data[i] || []).some(function (x) { return x !== '' && x !== undefined && x !== null; })) return i + 1;
  }
  return 0;
};
Sheet.prototype.getLastColumn = function () {
  return this.data.reduce(function (m, r) { return Math.max(m, (r || []).length); }, 0);
};
Sheet.prototype.getRange = function (r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); };
Sheet.prototype.getDataRange = function () { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); };
Sheet.prototype.copyTo = function (ss) {
  var s = ss.insertSheet('Copy of ' + this.name);
  s.data = JSON.parse(JSON.stringify(this.data));
  return s;
};

function Range(sheet, r, c, nr, nc) { this.s = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
Range.prototype.getValues = function () {
  var out = [];
  for (var i = 0; i < this.nr; i++) {
    var row = [];
    for (var j = 0; j < this.nc; j++) {
      var v = (this.s.data[this.r - 1 + i] || [])[this.c - 1 + j];
      row.push(v === undefined ? '' : v);
    }
    out.push(row);
  }
  return out;
};
Range.prototype.setValues = function (vals) {
  if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error('setValues: sai kích thước');
  for (var i = 0; i < this.nr; i++) {
    var rr = this.r - 1 + i;
    while (this.s.data.length <= rr) this.s.data.push([]);
    for (var j = 0; j < this.nc; j++) this.s.data[rr][this.c - 1 + j] = vals[i][j];
  }
  return this;
};
Range.prototype.clearContent = function () {
  for (var i = 0; i < this.nr; i++) {
    var row = this.s.data[this.r - 1 + i];
    if (row) for (var j = 0; j < this.nc; j++) row[this.c - 1 + j] = '';
  }
  return this;
};
Range.prototype.setNumberFormat = function () { return this; };
Range.prototype.setFontWeight = function () { return this; };

var demId = 0;
function Spreadsheet(name) { this.name = name; this.sheets = [new Sheet('Sheet1')]; this.id = 'ss' + (++demId); }
Spreadsheet.prototype.getSheetByName = function (n) { return this.sheets.filter(function (s) { return s.name === n; })[0] || null; };
Spreadsheet.prototype.insertSheet = function (n) {
  if (this.getSheetByName(n)) throw new Error('Trùng tên sheet ' + n);
  var s = new Sheet(n); this.sheets.push(s); return s;
};
Spreadsheet.prototype.getSheets = function () { return this.sheets.slice(); };
Spreadsheet.prototype.deleteSheet = function (s) { this.sheets = this.sheets.filter(function (x) { return x !== s; }); };
Spreadsheet.prototype.getSpreadsheetTimeZone = function () { return 'Asia/Ho_Chi_Minh'; };
Spreadsheet.prototype.getId = function () { return this.id; };
Spreadsheet.prototype.getUrl = function () { return 'https://docs.google.com/spreadsheets/d/' + this.id; };

/* Tạo 1 môi trường mới: trả về { ctx, ss, files, triggers, get(), post() } */
function taoMoiTruong() {
  var ss = new Spreadsheet('Danh mục');
  var files = {};
  files[ss.id] = ss;
  var props = {}, triggers = [];
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Object: Object, Array: Array, RegExp: RegExp, Error: Error,
    SpreadsheetApp: {
      getActiveSpreadsheet: function () { return ss; },
      create: function (n) { var x = new Spreadsheet(n); files[x.id] = x; return x; },
      openById: function (id) { if (!files[id]) throw new Error('Không mở được file'); return files[id]; }
    },
    LockService: { getScriptLock: function () { return { tryLock: function () { return true; }, waitLock: function () {}, releaseLock: function () {} }; } },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: function (s) { return { body: s, setMimeType: function () { return this; } }; }
    },
    Utilities: { formatDate: formatDate },
    PropertiesService: { getScriptProperties: function () {
      return { getProperty: function (k) { return props[k] || null; }, setProperty: function (k, v) { props[k] = v; } };
    } },
    ScriptApp: {
      getProjectTriggers: function () { return triggers.slice(); },
      deleteTrigger: function (t) { triggers = triggers.filter(function (x) { return x !== t; }); },
      newTrigger: function (fn) {
        var t = { fn: fn, getHandlerFunction: function () { return fn; } };
        var b = { timeBased: function () { return b; }, everyDays: function (n) { t.days = n; return b; },
                  atHour: function (h) { t.hour = h; return b; }, create: function () { triggers.push(t); return t; } };
        return b;
      }
    },
    Logger: { log: function () {} }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  return {
    ctx: ctx, ss: ss, files: files, props: props,
    triggers: function () { return triggers; },
    get: function (params) { return JSON.parse(ctx.doGet({ parameter: params || {} }).body); },
    post: function (action, data) {
      return JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ action: action, data: data }) } }).body);
    }
  };
}

module.exports = { taoMoiTruong: taoMoiTruong };
