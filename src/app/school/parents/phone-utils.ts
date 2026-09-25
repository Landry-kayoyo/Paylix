export const PHONE_LENGTH_BY_COUNTRY: Record<string, number> = {
  CD: 9,
  CG: 9,
  AO: 9,
  BI: 8,
  CM: 9,
  CI: 10,
  GH: 9,
  KE: 9,
  NG: 10,
  RW: 9,
  SN: 9,
  ZA: 9,
  TZ: 9,
  UG: 9,
  ZM: 9,
};

export function validateLocalPhoneForCountry(countryCode: string, localPhone: string) {
  const country = countryCode || "CD";
  const expectedLength = PHONE_LENGTH_BY_COUNTRY[country] ?? 9;
  return new RegExp(`^\\d{${expectedLength}}$`).test(localPhone);
}

export function validatePhoneNumber(phone: string) {
  if (!phone || !phone.startsWith("+")) return false;

  const countryDialCodes = Object.entries({
    CD: "+243",
    CG: "+242",
    AO: "+244",
    BI: "+257",
    CM: "+237",
    CI: "+225",
    GH: "+233",
    KE: "+254",
    NG: "+234",
    RW: "+250",
    SN: "+221",
    ZA: "+27",
    TZ: "+255",
    UG: "+256",
    ZM: "+260",
  });
  const country = countryDialCodes
    .sort(([, firstDialCode], [, secondDialCode]) => secondDialCode.length - firstDialCode.length)
    .find(([, dialCode]) => phone.startsWith(dialCode));

  if (!country) return false;

  const localNumber = phone.slice(country[1].length);
  const expectedLength = PHONE_LENGTH_BY_COUNTRY[country[0]] ?? 9;
  return /^\d+$/.test(localNumber) && localNumber.length === expectedLength;
}
