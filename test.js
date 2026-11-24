const P = require('./parser.js'); const fs = require('fs'); const assert = require('assert');
const r = P.parseCSVStatement(fs.readFileSync('sample.csv','utf8'));
console.log(r);
assert.equal(r.length, 3); assert.equal(r[0].date,'2026-11-03'); assert.equal(r[0].amount,54.21); assert.equal(r[1].amount,-2100);
assert.equal(r[0].description,"TRADER JOE'S #123, SALT LAKE");
const d = P.parseCSVStatement('Date,Description,Debit,Credit\n2026-01-02,Coffee,4.50,\n2026-01-03,Refund,,10.00\n');
assert.equal(d[0].amount,4.5); assert.equal(d[1].amount,-10);
const p = P.parseStatementLines(['11/03 AMAZON MKTPLACE 23.99 1,204.55','11/05 PAYROLL 2,100.00 3,304.55','Page 1 of 2'], 'Statement 2026');
console.log(p); assert.equal(p[0].amount,23.99); assert.equal(p[0].date,'2026-11-03');
console.log('ok');

// Chase credit card layout (synthetic), incl. Dec->Jan year rollover and ignored rewards table
const chase = [
 'www.chase.com/amazon','Previous Balance $100.00','New Balance $160.00','Opening/Closing Date 12/08/26 - 01/07/27',
 'ACCOUNT ACCOUNT ACTIVITY ACTIVITY','Date of','Transaction Merchant Name or Transaction Description $ Amount',
 'PAYMENTS AND OTHER CREDITS','12/20 AUTOMATIC PAYMENT - THANK YOU -100.00','PURCHASE',
 '12/30 COSTCO WHSE #1 SAN MARCOS CA 1,234.56','Order Number 111-222','01/02 NETFLIX 15.49',
 'Date of Transaction Merchant Name or Transaction Description $ Amount Rewards','PURCHASES AND REDEMPTIONS','12/30 COSTCO WHSE #1 SAN MARCOS CA 1,234.56 123,456'];
const c = P.parseStatementPDF(chase);
assert.equal(c.format,'Chase credit card'); assert.equal(c.transactions.length,3);
assert.equal(c.transactions[0].date,'2026-12-20'); assert.equal(c.transactions[0].amount,-100);
assert.equal(c.transactions[1].amount,1234.56); assert.deepEqual(c.transactions.map(x=>x.date),c.transactions.map(x=>x.date).sort()); assert.equal(c.transactions[2].date,'2027-01-02');
console.log('chase ok');

// Running-balance bank layout (synthetic): Eff. dates, wrapped lines, deposits negative after flip
const bank = ['Post Date Description Amount Balance','BEGINNING BALANCE $100.00',
 '10-01-2026 ACH Withdrawal PAYPAL - PURCHASE -$25.50 $74.50',
 '10-14-2026 Eff. 10-15 ACH Deposit eBay - PAYMENTS $3.29 $77.79','NTE*ZZZ*P7805182772\ JNMV91',
 '10-31-2026 Credit Interest $1.18 $78.97','ENDING BALANCE $78.97'];
const b = P.parseStatementPDF(bank);
assert.equal(b.transactions.length,3); assert.equal(b.transactions[0].amount,25.5);
assert.equal(b.transactions[1].amount,-3.29); assert.equal(b.transactions[1].date,'2026-10-14');
assert.equal(b.transactions[2].description,'Credit Interest'); assert.ok(b.check.ok);
console.log('bank ok');

// Ally layout (synthetic): two accounts, credits/debits columns, wrapped transfer detail
const ally = ['Date Description Credits Debits Balance','10/16/2026 Beginning Balance $100.00',
 '10/27/2026 NOW Withdrawal $0.00 -$40.00 $60.00','Requested transfer to X','(SOME CREDIT UNION Checking XXXX)',
 '11/15/2026 Interest Paid $1.50 -$0.00 $61.50','11/15/2026 Ending Balance $61.50',
 'Ally Bank Member FDIC STMTCMB100 05/2013','Date Description Credits Debits Balance','10/16/2026 Beginning Balance $10.00',
 '11/15/2026 Interest Paid $0.07 -$0.00 $10.07','11/15/2026 Ending Balance $10.07'];
const a = P.parseStatementPDF(ally);
assert.equal(a.format,'Ally Bank statement'); assert.equal(a.transactions.length,3);
assert.equal(a.transactions[0].amount,40); assert.equal(a.transactions[0].description,'NOW Withdrawal Requested transfer to X (SOME CREDIT UNION Checking XXXX)');
assert.equal(a.transactions[1].amount,-1.5); assert.ok(a.check.ok);
console.log('ally ok');

// Category suggestions: word-boundary regression (SAN MARCOS must not look like ARCO gas) and key merchants
const C = require('./categories.js');
assert.equal(C.suggest('HOBBY SHOP SAN MARCOS CA'), '');
assert.equal(C.suggest('CHEVRON 0388461 ESCONDIDO CA'), 'Gasoline');
assert.equal(C.suggest('TRADER JOE S #105 ESCONDIDO CA'), 'Groceries');
assert.equal(C.suggest('AUTOMATIC PAYMENT - THANK YOU'), 'Transfer / Ignore');
assert.equal(C.suggest('AMAZON MKTPL*593SP7BB0 Amzn.com/bill WA'), '');
console.log('categories ok');
