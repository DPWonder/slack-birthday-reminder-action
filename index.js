// Team birthday and work anniversary reminder for Slack or Discord.
// No dependencies. Runs as a GitHub Action (node20) or from the command line:
//   CSV=team.csv WEBHOOK_URL=... TIMEZONE=Europe/London node index.js
'use strict';
const fs = require('fs');

function input(name, fallback = '') {
  const v = process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] ?? process.env[name.toUpperCase().replace(/-/g, '_')];
  return v === undefined || v === '' ? fallback : String(v).trim();
}

// RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

// Accepts 1991-02-14, 02-14, --02-14, 2/14/1991 (US) or 14.02.1991 (day first).
function parseDate(raw) {
  const s = (raw || '').trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return { y: +m[1], m: +m[2], d: +m[3] };
  if ((m = s.match(/^-{0,2}(\d{1,2})-(\d{1,2})$/))) return { y: null, m: +m[1], d: +m[2] };
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/))) return { y: m[3] ? +m[3] : null, m: +m[1], d: +m[2] };
  if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/))) return { y: m[3] ? +m[3] : null, m: +m[2], d: +m[1] };
  return null;
}

function todayIn(timeZone, plusDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(Date.now() + plusDays * 86400000));
  const get = t => +parts.find(p => p.type === t).value;
  return { y: get('year'), m: get('month'), d: get('day') };
}

const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// A Feb 29 date is remembered on Feb 28 in other years.
function fallsOn(date, day) {
  if (!date || date.m < 1 || date.m > 12 || date.d < 1 || date.d > 31) return false;
  if (date.m === 2 && date.d === 29 && !isLeap(day.y)) return day.m === 2 && day.d === 28;
  return date.m === day.m && date.d === day.d;
}

function column(header, names) {
  const h = header.map(x => x.trim().toLowerCase());
  for (const n of names) { const i = h.indexOf(n); if (i !== -1) return i; }
  return -1;
}

function findToday(rows, day) {
  const [header, ...people] = rows;
  const nameCol = column(header, ['name', 'full name', 'employee']);
  const bdayCol = column(header, ['birthday', 'birth date', 'date of birth', 'dob']);
  const startCol = column(header, ['start date', 'work anniversary', 'hire date', 'joined']);
  if (nameCol === -1) throw new Error(`No "Name" column in the CSV header: ${header.join(', ')}`);
  const birthdays = [], anniversaries = [], skipped = [];
  for (const r of people) {
    const name = (r[nameCol] || '').trim();
    if (!name) continue;
    if (bdayCol !== -1 && r[bdayCol] && r[bdayCol].trim()) {
      const b = parseDate(r[bdayCol]);
      if (!b) skipped.push(`${name} (birthday "${r[bdayCol]}")`);
      else if (fallsOn(b, day)) birthdays.push(name);
    }
    if (startCol !== -1 && r[startCol] && r[startCol].trim()) {
      const s = parseDate(r[startCol]);
      if (!s) skipped.push(`${name} (start date "${r[startCol]}")`);
      else if (s.y && s.y < day.y && fallsOn(s, day)) anniversaries.push({ name, years: day.y - s.y });
    }
  }
  return { birthdays, anniversaries, skipped };
}

function list(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function message({ birthdays, anniversaries }, ahead) {
  const when = ahead === 0 ? 'today' : ahead === 1 ? 'tomorrow' : `in ${ahead} days`;
  const lines = [];
  if (birthdays.length) lines.push(`:birthday: Birthday ${when}: ${list(birthdays)}`);
  for (const a of anniversaries) lines.push(`:tada: ${a.name}: ${a.years} year${a.years === 1 ? '' : 's'} on the team ${when}`);
  return lines.join('\n');
}

async function post(url, format, text) {
  const body = format === 'discord' ? { content: text.replace(/:birthday:/g, '🎂').replace(/:tada:/g, '🎉') } : { text };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Webhook answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function main() {
  const csvPath = input('csv', 'team.csv');
  const webhook = input('webhook-url');
  const timeZone = input('timezone', 'UTC');
  const ahead = parseInt(input('days-ahead', '0'), 10) || 0;
  const format = input('format', 'slack').toLowerCase();
  const dryRun = /^(true|1|yes)$/i.test(input('dry-run', 'false'));

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  if (!rows.length) throw new Error(`${csvPath} is empty`);
  const day = todayIn(timeZone, ahead);
  const found = findToday(rows, day);
  for (const s of found.skipped) console.log(`::warning::Could not read the date for ${s}`);
  const text = message(found, ahead);
  const stamp = `${day.y}-${String(day.m).padStart(2, '0')}-${String(day.d).padStart(2, '0')} (${timeZone})`;
  if (!text) { console.log(`Nothing on ${stamp}.`); return; }
  console.log(`On ${stamp}:\n${text}`);
  if (dryRun) { console.log('Dry run: nothing posted.'); return; }
  if (!webhook) throw new Error('webhook-url is empty. Add your webhook as a repository secret and pass it in.');
  await post(webhook, format, text);
  console.log('Posted.');
}

if (require.main === module) {
  main().catch(err => { console.log(`::error::${err.message}`); process.exitCode = 1; });
}

module.exports = { parseCsv, parseDate, fallsOn, findToday, message };
