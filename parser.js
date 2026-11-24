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

  // Returns [{date, description, amount}]. Convention everywhere: expenses positive, deposits negative.
  // (Most bank CSVs list money out as negative, so we flip.)
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
      out.push({ date, description: (r[descIdx] || '').replace(/\s+/g, ' ').trim(), amount: -amount });
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

  const money = s => Math.round(parseFloat(s.replace(/,/g, '')) * 100) / 100;

  // Chase credit card layout: MM/DD <description> <amount>, inside "ACCOUNT ACTIVITY" sections.
  // Statement signs already match our convention (charges positive, payments/credits negative).
  // Reconciled against the balance change in the summary box.
  function parseChaseCard(lines) {
    const text = lines.join('\n');
    const cd = text.match(/Opening\/Closing Date\s+(\d{2})\/(\d{2})\/(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{2})/);
    const closeYear = cd ? 2000 + +cd[6] : new Date().getFullYear();
    const closeMonth = cd ? +cd[4] : 12;
    const tx = [];
    let active = false;
    for (const line of lines) {
      if (/ACCOUNT\s+(ACCOUNT\s+)?ACTIVITY/.test(line)) { active = true; continue; }
      if (/Totals Year-to-Date|INTEREST\s+(INTEREST\s+)?CHARGES|\$ Amount\s+Rewards|PURCHASES AND REDEMPTIONS/.test(line)) { active = false; continue; }
      if (!active) continue;
      const m = line.match(/^(\d{2})\/(\d{2})\s+(.*?)\s+(-?\$?\d{1,3}(?:,\d{3})*\.\d{2})$/);
      if (!m) continue;
      const month = +m[1];
      const year = month > closeMonth ? closeYear - 1 : closeYear;
      const stmtAmount = money(m[4].replace('$', ''));
      tx.push({ date: fmt(year, m[1], m[2]), description: m[3].replace(/\s+/g, ' ').trim(), amount: stmtAmount });
    }
    tx.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); // stable: statement lists in posting order
    let check = null;
    const prev = text.match(/^Previous Balance\s+(-?)\$([\d,]+\.\d{2})/m);
    const next = text.match(/^New Balance\s+(-?)\$([\d,]+\.\d{2})/m);
    if (prev && next) {
      const expected = Math.round((money(next[2]) * (next[1] ? -1 : 1) - money(prev[2]) * (prev[1] ? -1 : 1)) * 100) / 100;
      const got = Math.round(tx.reduce((a, t) => a + t.amount, 0) * 100) / 100;
      check = { expected, got, ok: Math.abs(expected - got) < 0.005 };
    }
    return { transactions: tx, check, format: 'Chase credit card' };
  }

  // Bank account layout: "MM-DD-YYYY [Eff. MM-DD] <description> <-$amount> <$balance>", with wrapped detail lines.
  // Statement shows withdrawals negative; we flip so expenses are positive. Reconciled against beginning/ending balances.
  function parseRunningBalance(lines) {
    const rowRe = /^(\d{2})-(\d{2})-(\d{4})\s+(?:Eff\.\s*\d{2}-\d{2}\s+)?(.*?)\s+(-?)\$([\d,]+\.\d{2})\s+(-?)\$[\d,]+\.\d{2}$/;
    const balRe = /^(BEGINNING|ENDING) BALANCE\s+(-?)\$([\d,]+\.\d{2})/;
    const tx = []; let begin = 0, end = 0, sawBal = false;
    for (const line of lines) {
      const b = line.match(balRe);
      if (b) { const v = money(b[3]) * (b[2] ? -1 : 1); if (b[1] === 'BEGINNING') begin += v; else end += v; sawBal = true; continue; }
      const m = line.match(rowRe);
      if (!m) continue;
      const stmt = money(m[6]) * (m[5] ? -1 : 1);
      tx.push({ date: fmt(m[3], m[1], m[2]), description: m[4].replace(/\s+/g, ' ').trim(), amount: -stmt });
    }
    let check = null;
    if (sawBal) {
      const expected = Math.round((end - begin) * 100) / 100;
      const got = Math.round(-tx.reduce((a, t) => a + t.amount, 0) * 100) / 100;
      check = { expected, got, ok: Math.abs(expected - got) < 0.005 };
    }
    return { transactions: tx, check, format: 'Bank account statement' };
  }

  // Ally layout: per-account "Activity" tables with "Date Description Credits Debits Balance".
  // Credits/debits are separate columns; wrapped lines under a row hold transfer details (kept in the description).
  // Several accounts can share one PDF. Reconciled against the sum of beginning/ending balances across accounts.
  function parseCreditsDebits(lines) {
    const rowRe = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.*?)\s+-?\$([\d,]+\.\d{2})\s+(-?)\$([\d,]+\.\d{2})\s+-?\$[\d,]+\.\d{2}$/;
    const balRe = /^\d{2}\/\d{2}\/\d{4}\s+(Beginning|Ending) Balance\s+(-?)\$([\d,]+\.\d{2})$/;
    const stop = /^\d{2}\/\d{2}\/\d{4}\s|Ally Bank Member|^\d{5,}\/|COMBINED CUST|^Activity$|^Date Description/;
    const tx = []; let begin = 0, end = 0, sawBal = false, last = null;
    for (const line of lines) {
      const b = line.match(balRe);
      if (b) { const v = money(b[3]) * (b[2] ? -1 : 1); if (b[1] === 'Beginning') begin += v; else end += v; sawBal = true; last = null; continue; }
      const m = line.match(rowRe);
      if (m) {
        // the row regex captures only the credit/debit sign of the debit column; recompute from the two amounts
        const amts = line.match(/-?\$[\d,]+\.\d{2}/g);
        const credit = money(amts[amts.length - 3].replace(/[-$]/g, ''));
        const debit = money(amts[amts.length - 2].replace(/[-$]/g, ''));
        const net = Math.round((credit - debit) * 100) / 100;
        last = null;
        if (net === 0) continue;
        last = { date: fmt(m[3], m[1], m[2]), description: m[4].replace(/\s+/g, ' ').trim(), amount: -net };
        tx.push(last);
      } else if (last && !stop.test(line)) {
        last.description += ' ' + line.replace(/\s+/g, ' ').trim();
      } else last = null;
    }
    let check = null;
    if (sawBal) {
      const expected = Math.round((end - begin) * 100) / 100;
      const got = Math.round(-tx.reduce((a, t) => a + t.amount, 0) * 100) / 100;
      check = { expected, got, ok: Math.abs(expected - got) < 0.005 };
    }
    tx.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return { transactions: tx, check, format: 'Ally Bank statement' };
  }

  // Entry point for PDFs: pick a bank-specific parser if one matches, else the generic one.
  function parseStatementPDF(lines) {
    if (lines.some(l => /Merchant Name or Transaction Description/.test(l)) && lines.some(l => /chase\.com/i.test(l)))
      return parseChaseCard(lines);
    if (lines.some(l => /^Date Description Credits Debits Balance/.test(l))) return parseCreditsDebits(lines);
    if (lines.some(l => /^Post Date\s+Description\s+Amount\s+Balance/.test(l))) return parseRunningBalance(lines);
    return { transactions: parseStatementLines(lines, lines.join(' ')), check: null, format: 'generic' };
  }

  const api = { parseCSV, parseAmount, normDate, parseCSVStatement, parseStatementLines, parseChaseCard, parseRunningBalance, parseCreditsDebits, parseStatementPDF };
  if (typeof module !== 'undefined') module.exports = api; else root.Parser = api;
})(this);
