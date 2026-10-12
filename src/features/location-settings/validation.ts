// ISO 3166-1 alpha-2 codes from the IANA tzdata iso3166.tab list.
const COUNTRY_CODES = new Set(
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" "),
);

export type LocationSettingsInput = {
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  phone: string | null;
};

export type LocationSaveStatus = "saved" | "invalid" | "unavailable" | "failure";

export function classifyLocationSaveResult(
  data: boolean | null,
  error: { code: string } | null,
): LocationSaveStatus {
  if (error) return error.code === "22023" ? "invalid" : "failure";
  return data === true ? "saved" : "unavailable";
}

const MAX_LENGTH = {
  name: 160,
  addressLine1: 320,
  addressLine2: 320,
  city: 160,
  region: 160,
  postalCode: 32,
  phone: 40,
};

export function parseLocationSettings(formData: FormData): { input: LocationSettingsInput; valid: boolean } {
  let validTypes = true;
  const value = (key: string) => {
    const entry = formData.get(key);
    if (entry === null) return "";
    if (typeof entry !== "string") {
      validTypes = false;
      return "";
    }
    return entry.trim();
  };
  const optional = (key: string) => value(key) || null;
  const countryCode = value("countryCode").toUpperCase() || null;
  const input: LocationSettingsInput = {
    name: value("name"),
    addressLine1: optional("addressLine1"),
    addressLine2: optional("addressLine2"),
    city: optional("city"),
    region: optional("region"),
    postalCode: optional("postalCode"),
    countryCode,
    phone: optional("phone"),
  };
  const valid = validTypes && Boolean(input.name)
    && Object.entries(MAX_LENGTH).every(([key, max]) => {
      const field = input[key as keyof LocationSettingsInput];
      return !field || field.length <= max;
    })
    && (!countryCode || COUNTRY_CODES.has(countryCode));
  return { input, valid };
}
