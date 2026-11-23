const P = require('./parser.js'); const fs = require('fs'); const assert = require('assert');
const r = P.parseCSVStatement(fs.readFileSync('sample.csv','utf8'));
console.log(r);
assert.equal(r.length, 3); assert.equal(r[0].date,'2026-11-03'); assert.equal(r[0].amount,-54.21);
assert.equal(r[0].description,"TRADER JOE'S #123, SALT LAKE");
const d = P.parseCSVStatement('Date,Description,Debit,Credit\n2026-01-02,Coffee,4.50,\n2026-01-03,Refund,,10.00\n');
assert.equal(d[0].amount,-4.5); assert.equal(d[1].amount,10);
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
assert.equal(c.transactions[0].date,'2026-12-20'); assert.equal(c.transactions[0].amount,100);
assert.equal(c.transactions[1].amount,-1234.56); assert.equal(c.transactions[2].date,'2027-01-02');
console.log('chase ok');
