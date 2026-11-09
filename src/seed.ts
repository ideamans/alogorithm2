export interface SeedVariableContext {
  timeZone: string
  now?: Date
}

// Format a date as YYYYMMDD in the given IANA time zone
export function formatYmd(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}${get('month')}${get('day')}`
}

// Throws RangeError if the time zone is not a valid IANA name
export function assertTimeZone(timeZone: string) {
  new Intl.DateTimeFormat('en-US', { timeZone })
}

// Expand {variable} placeholders in seed. Unknown variables are left as is.
export function expandSeedVariables(seed: string, ctx: SeedVariableContext): string {
  const now = ctx.now ?? new Date()
  const variables: Record<string, () => string> = {
    today: () => formatYmd(now, ctx.timeZone),
  }

  return seed.replace(/\{(\w+)\}/g, (match, name: string) => {
    const resolve = variables[name]
    return resolve ? resolve() : match
  })
}
