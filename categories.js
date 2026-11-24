// Category list and merchant-keyword suggestions. Edit CATEGORIES to match the spreadsheet.
(function (root) {
  const CATEGORIES = [
    // Variable spending (the ten blocks)
    'Groceries', 'House supplies', 'Kids', 'Eating Out', 'Personal/Entertainment',
    'Clothing', 'Gasoline', 'Car Expenses', 'Medical', 'Reimbursable expenses',
    // Recurring bills
    'Mortgage', 'Home Insurance', 'Property Tax', 'SDGE (Gas/Electric)', 'San Diego Water',
    'Internet', 'Car Insurance', 'Renters Insurance', 'Cell phones',
    // Giving, saving, income
    'Tithing / Donations', '529 Savings', 'Savings', 'Income', 'Interest',
    // Not spending
    'Transfer / Ignore',
  ];

  // First match wins. Keep these conservative: a blank is better than a wrong guess.
  const RULES = [
    [/AUTOMATIC PAYMENT - THANK YOU|CREDIT CRD - AUTOPAY|JPMORGAN CHASE.*ACH|Requested transfer|JOSEPH R NIELSO|VENMO - PAYMENT/i, 'Transfer / Ignore'],
    [/PAYROLL/i, 'Income'],
    [/^(Credit )?Interest( Paid)?$|^Interest Paid/i, 'Interest'],
    [/DONATION|TITHING|FAST OFFERING/i, 'Tithing / Donations'],
    [/MY529|\b529\b/i, '529 Savings'],
    [/\bSDG&?E\b/i, 'SDGE (Gas/Electric)'],
    [/SAN DIEGO WATER|CITY OF SAN DIEGO/i, 'San Diego Water'],
    [/SPECTRUM|COX COMM/i, 'Internet'],
    [/VERIZON WIRELESS|AT&T/i, 'Cell phones'],
    [/PROGRESSIVE/i, 'Car Insurance'],
    [/COSTCO GAS|CHEVRON|EXXON|\b76 - |SHELL OIL|\bARCO\b/i, 'Gasoline'],
    [/TRADER JOE|SPROUTS|JIMBO|COSTCO WHSE|GROCERY|THRIVE MARKET|SAVEMART|\bVONS\b|ALBERTSONS|WHOLE FOODS/i, 'Groceries'],
    [/^TST\*|CHIPOTLE|TACO BELL|IN-N-OUT|JACK IN THE BOX|CHICK-FIL-A|ROBEKS|GRUBHUB|DOORDASH|^DD \*|BAGELS|COOKIES|PIZZA|SPAGHETTI|FOSTERS FREEZE|RUBIOS|JUICE|JUICERY|STARBUCKS|MCDONALD/i, 'Eating Out'],
    [/PARKING|SPOTHERO/i, 'Car Expenses'],
    [/ENDODONT|ORTHO|DENTAL|PHARMACY|\bCVS\b|WALGREENS|URGENT CARE/i, 'Medical'],
    [/NETFLIX|DISNEY PLUS|SPOTIFY|GOOGLE ONE|YOUTUBE|NINTENDO|APPLE\.COM\/BILL|MICROSOFT\*|ANTHROPIC/i, 'Personal/Entertainment'],
    [/HOME DEPOT|HOBBY-LOBBY|FIVE BELOW|CRATEANDBARREL/i, 'House supplies'],
  ];

  function suggest(description) {
    for (const [re, cat] of RULES) if (re.test(description || '')) return cat;
    return '';
  }

  const api = { CATEGORIES, RULES, suggest };
  if (typeof module !== 'undefined') module.exports = api; else root.Categories = api;
})(this);
