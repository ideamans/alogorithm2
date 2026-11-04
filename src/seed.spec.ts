import test from 'ava'

import { assertTimeZone, expandSeedVariables, formatYmd } from './seed.js'

// 2026-11-03 20:00 UTC = 2026-11-04 05:00 in Tokyo, 2026-11-03 10:00 in Honolulu
const now = new Date('2026-11-03T20:00:00Z')

test('formatYmd formats the date in the given time zone', (t) => {
  t.is(formatYmd(now, 'UTC'), '20261103')
  t.is(formatYmd(now, 'Asia/Tokyo'), '20261104')
  t.is(formatYmd(now, 'Pacific/Honolulu'), '20261103')
})

test('formatYmd zero-pads month and day', (t) => {
  t.is(formatYmd(new Date('2026-01-05T00:00:00Z'), 'UTC'), '20260105')
})

test('{today} expands to YYYYMMDD in the time zone', (t) => {
  t.is(expandSeedVariables('{today}', { timeZone: 'Asia/Tokyo', now }), '20261104')
  t.is(expandSeedVariables('{today}', { timeZone: 'Pacific/Honolulu', now }), '20261103')
})

test('{today} can be embedded and repeated', (t) => {
  t.is(expandSeedVariables('logo-{today}-{today}', { timeZone: 'Asia/Tokyo', now }), 'logo-20261104-20261104')
})

test('unknown variables are left as is', (t) => {
  t.is(expandSeedVariables('{foo}-{today}', { timeZone: 'Asia/Tokyo', now }), '{foo}-20261104')
})

test('seeds without variables are unchanged', (t) => {
  t.is(expandSeedVariables('alogorithm2', { timeZone: 'Asia/Tokyo', now }), 'alogorithm2')
  t.is(expandSeedVariables('{ today }', { timeZone: 'Asia/Tokyo', now }), '{ today }')
})

test('now defaults to the current time', (t) => {
  t.is(expandSeedVariables('{today}', { timeZone: 'UTC' }), formatYmd(new Date(), 'UTC'))
})

test('assertTimeZone accepts IANA names and rejects others', (t) => {
  t.notThrows(() => assertTimeZone('Asia/Tokyo'))
  t.notThrows(() => assertTimeZone('UTC'))
  t.throws(() => assertTimeZone('Nope/Zone'), { instanceOf: RangeError })
})
