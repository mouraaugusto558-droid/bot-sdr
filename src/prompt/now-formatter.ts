/**
 * Reproduz o formato de `$now.toString()` do n8n (Luxon `DateTime#toISO()`):
 * `YYYY-MM-DDTHH:mm:ss.sss±HH:mm`, no timezone configurado (ver config/constants.ts TIMEZONE).
 */
export function formatAsN8nNow(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  const offset = formatOffset(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${milliseconds}${offset}`;
}

function formatOffset(date: Date, timeZone: string): string {
  const timeZoneName = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

  const match = timeZoneName ? /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(timeZoneName) : null;
  if (!match?.[1] || !match[2]) return '+00:00';

  const [, sign, hours, minutes] = match;
  return `${sign}${hours.padStart(2, '0')}:${minutes ?? '00'}`;
}
