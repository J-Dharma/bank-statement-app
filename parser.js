// Pure parsing functions (no DOM) so they can be tested in Node.
(function (root) {
  function parseCSV(text) {
    const rows = []; let row = [], f = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); f = ''; rows.push(row); row = [];
      } else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim() !== ''));
  }

  function parseAmount(s) {
    if (s == null) return null;
    s = String(s).trim();
    if (!s) return null;
    let neg = /^\(.*\)$/.test(s) || /-\s*$/.test(s) || /^-/.test(s) || /^\$?-/.test(s);
    const n = parseFloat(s.replace(/[^0-9.]/g, ''));
    if (isNaN(n)) return null;
    return neg ? -n : n;
  }

  function normDate(s, defaultYear) {
    s = String(s || '').trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return fmt(m[1], m[2], m[3]);
    if ((m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/))) {
      let y = m[3]; if (y.length === 2) y = '20' + y;
      return fmt(y, m[1], m[2]); // US order MM/DD/YYYY
    }
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})$/)) && defaultYear) return fmt(defaultYear, m[1], m[2]);
    const d = new Date(s);
    if (!isNaN(d) && /[a-z]/i.test(s)) return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return null;
  }
  function fmt(y, m, d) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }

  // Returns [{date, description, amount}]. Expenses negative, deposits positive.
  function parseCSVStatement(text) {
    const rows = parseCSV(text);
    // find header row: first row with a date-ish column and an amount-ish column
    let h = rows.findIndex(r => {
      const l = r.map(x => x.toLowerCase());
      return l.some(x => /date/.test(x)) && l.some(x => /amount|debit|credit|withdrawal|deposit/.test(x));
    });
    if (h < 0) throw new Error('Could not find a header row with date and amount columns.');
    const head = rows[h].map(x => x.trim().toLowerCase());
    const find = re => head.findIndex(x => re.test(x));
    const iDate = find(/(posting|post|transaction|trans)?\s*date/) >= 0 ? find(/^(transaction|trans|posting|post)?\s*date$/) : -1;
    const dIdx = iDate >= 0 ? iDate : find(/date/);
    let descIdx = find(/description|payee|merchant|memo|details|name/);
    const amtIdx = find(/^amount$/) >= 0 ? find(/^amount$/) : find(/amount/);
    const debIdx = find(/debit|withdrawal|money out|charge/);
    const credIdx = find(/credit|deposit|money in/);
    if (descIdx < 0) descIdx = head.findIndex((_, i) => i !== dIdx && i !== amtIdx);
    const out = [];
    for (const r of rows.slice(h + 1)) {
      const date = normDate(r[dIdx]);
      if (!date) continue;
      let amount = null;
      if (amtIdx >= 0 && parseAmount(r[amtIdx]) != null) amount = parseAmount(r[amtIdx]);
      else {
        const d = debIdx >= 0 ? parseAmount(r[debIdx]) : null;
        const c = credIdx >= 0 ? parseAmount(r[credIdx]) : null;
        if (d != null) amount = -Math.abs(d);
        else if (c != null) amount = Math.abs(c);
      }
      if (amount == null) continue;
      out.push({ date, description: (r[descIdx] || '').replace(/\s+/g, ' ').trim(), amount });
    }
    return out;
  }

  // Parse lines of text (from a PDF) into transactions. Heuristic.
  function parseStatementLines(lines, fullText) {
    const ym = (fullText || lines.join(' ')).match(/\b(20\d{2})\b/);
    const year = ym ? ym[1] : String(new Date().getFullYear());
    const dateRe = /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})\s+/;
    const amtRe = /(\(?-?\$?\d{1,3}(?:,\d{3})*\.\d{2}\)?-?)/g;
    const out = [];
    for (const line of lines) {
      const dm = line.match(dateRe);
      if (!dm) continue;
      const rest = line.slice(dm[0].length);
      const amts = rest.match(amtRe);
      if (!amts) continue;
      // If two amounts trail the line, the last is usually a running balance.
      const amtStr = amts.length >= 2 ? amts[amts.length - 2] : amts[0];
      const amount = parseAmount(amtStr);
      const date = normDate(dm[1], year);
      if (amount == null || !date) continue;
      const desc = rest.slice(0, rest.indexOf(amts[0])).replace(/\s+/g, ' ').trim();
      out.push({ date, description: desc, amount });
    }
    return out;
  }

  const api = { parseCSV, parseAmount, normDate, parseCSVStatement, parseStatementLines };
  if (typeof module !== 'undefined') module.exports = api; else root.Parser = api;
})(this);
