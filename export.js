// Builds the Excel workbook (ExcelJS is passed in so this runs in the browser and in Node tests).
(function (root) {
  const COLS = ['Amount', 'Description', 'Date', 'Account', 'Category'];

  function buildWorkbook(ExcelJS, rows, categories) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Expenses', { views: [{ state: 'frozen', ySplit: 1 }] });
    const lists = wb.addWorksheet('Lists');
    categories.forEach((c, i) => { lists.getCell(i + 1, 1).value = c; });
    lists.state = 'hidden';

    ws.columns = [
      { header: 'Amount', key: 'amount', width: 12, style: { numFmt: '#,##0.00;-#,##0.00' } },
      { header: 'Description', key: 'description', width: 52 },
      { header: 'Date', key: 'date', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
      { header: 'Account', key: 'account', width: 12 },
      { header: 'Category', key: 'category', width: 26 },
    ];
    ws.getRow(1).font = { bold: true };
    const rule = { type: 'list', allowBlank: true, formulae: ['Lists!$A$1:$A$' + categories.length] };
    rows.forEach(r => {
      const [y, m, d] = r.date.split('-').map(Number);
      const row = ws.addRow({ date: new Date(Date.UTC(y, m - 1, d)), description: r.description, amount: r.amount, account: r.account, category: r.category || '' });
      row.getCell(5).dataValidation = rule;
    });
    // Also allow categorizing rows added below later.
    for (let n = rows.length + 2; n <= rows.length + 200; n++) ws.getCell(n, 5).dataValidation = rule;
    ws.autoFilter = { from: 'A1', to: 'E1' };
    return wb;
  }

  function toTSV(rows, withHeader) {
    const clean = s => String(s).replace(/[\t\r\n]+/g, ' ');
    const out = withHeader ? [COLS.join('\t')] : [];
    for (const r of rows) out.push([r.amount.toFixed(2), clean(r.description), r.date, r.account, r.category || ''].join('\t'));
    return out.join('\n');
  }

  function toCSV(rows) {
    const q = s => /[",\n]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s);
    return [COLS.join(','), ...rows.map(r => [r.amount.toFixed(2), q(r.description), r.date, q(r.account), q(r.category || '')].join(','))].join('\n');
  }

  const api = { COLS, buildWorkbook, toTSV, toCSV };
  if (typeof module !== 'undefined') module.exports = api; else root.Export = api;
})(this);
