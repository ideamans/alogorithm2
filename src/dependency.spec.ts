import test from 'ava'

import { resolveDefaultTimeZone } from './dependency.js'

test('time zone defaults to Asia/Tokyo when TZ is unset', (t) => {
  t.is(resolveDefaultTimeZone(undefined), 'Asia/Tokyo')
  t.is(resolveDefaultTimeZone(''), 'Asia/Tokyo')
})

test('time zone follows TZ', (t) => {
  t.is(resolveDefaultTimeZone('America/New_York'), 'America/New_York')
  t.is(resolveDefaultTimeZone('UTC'), 'UTC')
})

test('a TZ that is not an IANA name falls back to the runtime time zone', (t) => {
  t.is(resolveDefaultTimeZone('JST-9'), Intl.DateTimeFormat().resolvedOptions().timeZone)
})
