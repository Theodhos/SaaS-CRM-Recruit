import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * Every country libphonenumber knows, as the import's "default country" choice (a national number like 069… gets
 * that country's code). Albania and its neighbours first, then the rest alphabetically — the list is for a
 * recruitment agency in Albania, but a number from anywhere in the world is accepted and stored in E.164.
 */
const PINNED: CountryCode[] = ['AL', 'XK', 'MK', 'ME', 'GR', 'IT', 'DE', 'CH', 'AT', 'GB', 'US', 'TR'];

function countryName(code: CountryCode): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export const DEFAULT_COUNTRIES: { code: CountryCode; name: string; dial: string }[] = [
  ...PINNED,
  ...getCountries()
    .filter((c) => !PINNED.includes(c))
    .sort((a, b) => countryName(a).localeCompare(countryName(b))),
].map((code) => ({ code, name: countryName(code), dial: `+${getCountryCallingCode(code)}` }));

export const DEFAULT_COUNTRY_CODES = DEFAULT_COUNTRIES.map((c) => c.code);

export type NormalizedPhone = { ok: true; e164: string } | { ok: false; reason: string };

/**
 * Canonical E.164 form of whatever the spreadsheet had: spaces, dots, dashes and parentheses go, `00` becomes `+`,
 * a national number (leading 0 or none) gets the default country's code — never blindly, libphonenumber checks the
 * result is a real number for that country. `+355 69 123 4567`, `0691234567` and `00355691234567` all become
 * `+355691234567`; a number with its own country code (`+49 30 …`, `+1 212 …`) keeps it.
 */
export function normalizePhone(raw: string, defaultCountry: CountryCode): NormalizedPhone {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/[\s().\-–—/]/g, '')
    .replace(/^00/, '+');
  if (!cleaned) return { ok: false, reason: 'empty' };
  if (!/^\+?\d{6,17}$/.test(cleaned)) return { ok: false, reason: 'not a phone number' };
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!parsed || !parsed.isValid()) return { ok: false, reason: 'invalid number' };
  return { ok: true, e164: parsed.number };
}
