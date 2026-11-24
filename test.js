// node test.js
'use strict';
const assert = require('assert');
const { parseCsv, parseDate, fallsOn, findToday, message } = require('./index.js');

const rows = parseCsv('Name,Birthday,Start date,Team,Notes\r\n"Avery, Q.",1991-02-14,2022-03-07,Design,"Says ""no cake"""\nBram T.,05-30,,Support,\nCleo M.,2000-02-29,2024-02-14,Eng,\nDee,notadate,2020-02-14,,\n\n');
assert.strictEqual(rows.length, 5);
assert.strictEqual(rows[1][0], 'Avery, Q.');
assert.strictEqual(rows[1][4], 'Says "no cake"');

assert.deepStrictEqual(parseDate('1991-02-14'), { y: 1991, m: 2, d: 14 });
assert.deepStrictEqual(parseDate('--05-30'), { y: null, m: 5, d: 30 });
assert.deepStrictEqual(parseDate('2/14/1991'), { y: 1991, m: 2, d: 14 });
assert.deepStrictEqual(parseDate('14.02.1991'), { y: 1991, m: 2, d: 14 });
assert.strictEqual(parseDate('soon'), null);

assert.ok(fallsOn({ m: 2, d: 29 }, { y: 2027, m: 2, d: 28 }));
assert.ok(!fallsOn({ m: 2, d: 29 }, { y: 2028, m: 2, d: 28 }));
assert.ok(fallsOn({ m: 2, d: 29 }, { y: 2028, m: 2, d: 29 }));

const feb14 = findToday(rows, { y: 2027, m: 2, d: 14 });
assert.deepStrictEqual(feb14.birthdays, ['Avery, Q.']);
assert.deepStrictEqual(feb14.anniversaries, [{ name: 'Cleo M.', years: 3 }, { name: 'Dee', years: 7 }]);
assert.strictEqual(feb14.skipped.length, 1);
assert.strictEqual(message(feb14, 0), ':birthday: Birthday today: Avery, Q.\n:tada: Cleo M.: 3 years on the team today\n:tada: Dee: 7 years on the team today');

const feb28 = findToday(rows, { y: 2027, m: 2, d: 28 });
assert.deepStrictEqual(feb28.birthdays, ['Cleo M.']);
assert.strictEqual(message(findToday(rows, { y: 2027, m: 5, d: 30 }), 1), ':birthday: Birthday tomorrow: Bram T.');
assert.strictEqual(message(findToday(rows, { y: 2027, m: 1, d: 1 }), 0), '');
// a start date this year is not an anniversary
assert.deepStrictEqual(findToday(rows, { y: 2024, m: 2, d: 14 }).anniversaries.map(a => a.name), ['Dee']);
console.log('all tests pass');
