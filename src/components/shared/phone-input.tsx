"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { validateLocalPhoneForCountry } from "@/app/school/parents/phone-utils";

export const AFRICAN_COUNTRIES = [
  { code: "CD", dialCode: "+243", flag: "🇨🇩", name: "RDC" },
  { code: "CG", dialCode: "+242", flag: "🇨🇬", name: "Congo" },
  { code: "AO", dialCode: "+244", flag: "🇦🇴", name: "Angola" },
  { code: "BI", dialCode: "+257", flag: "🇧🇮", name: "Burundi" },
  { code: "CM", dialCode: "+237", flag: "🇨🇲", name: "Cameroun" },
  { code: "CI", dialCode: "+225", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "GH", dialCode: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "KE", dialCode: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "NG", dialCode: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "RW", dialCode: "+250", flag: "🇷🇼", name: "Rwanda" },
  { code: "SN", dialCode: "+221", flag: "🇸🇳", name: "Sénégal" },
  { code: "ZA", dialCode: "+27", flag: "🇿🇦", name: "Afrique du Sud" },
  { code: "TZ", dialCode: "+255", flag: "🇹🇿", name: "Tanzanie" },
  { code: "UG", dialCode: "+256", flag: "🇺🇬", name: "Ouganda" },
  { code: "ZM", dialCode: "+260", flag: "🇿🇲", name: "Zambie" },
] as const;

export function CountryFlag({ code, name }: { code: string; name: string }) {
  return (
    <img
      src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`}
      alt={name}
      width={20}
      height={14}
      className="h-3.5 w-5 rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(15,23,42,0.12)]"
    />
  );
}

interface PhoneInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  validate?: boolean;
}

export function PhoneInput({
  id,
  value,
  onChange,
  disabled,
  required,
  validate = true,
  placeholder = "81 000 0000",
}: PhoneInputProps) {
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState(
    AFRICAN_COUNTRIES.find((country) => value.startsWith(country.dialCode))?.code || "CD"
  );
  const selectedCountry = AFRICAN_COUNTRIES.find((country) => country.code === phoneCountry) || AFRICAN_COUNTRIES[0];
  const localPhone = value.startsWith(selectedCountry.dialCode) ? value.slice(selectedCountry.dialCode.length) : "";

  const updatePhone = (country: (typeof AFRICAN_COUNTRIES)[number], rawLocalPhone: string) => {
    const digits = rawLocalPhone.replace(/\D/g, "");
    onChange(digits ? `${country.dialCode}${digits}` : "");
  };

  return (
    <div className="relative flex h-11 overflow-visible rounded-xl border border-slate-200 bg-white shadow-xs transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
      <div className="flex items-center border-r border-slate-200 bg-emerald-50/60 px-2">
        <div className="relative">
          <button
            type="button"
            aria-label="Pays et indicatif"
            aria-expanded={countryMenuOpen}
            disabled={disabled}
            onClick={() => setCountryMenuOpen((open) => !open)}
            className="flex h-10 items-center gap-1.5 rounded-lg px-1.5 text-sm font-medium text-slate-700 outline-none hover:bg-emerald-100/70 focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-60"
          >
            <CountryFlag code={selectedCountry.code} name={selectedCountry.name} />
            <span>{selectedCountry.dialCode}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </button>
          {countryMenuOpen && (
            <div role="listbox" aria-label="Pays africains" className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-64 w-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              {AFRICAN_COUNTRIES.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  role="option"
                  aria-selected={selectedCountry.code === country.code}
                  onClick={() => {
                    setPhoneCountry(country.code);
                    updatePhone(country, localPhone);
                    setCountryMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${selectedCountry.code === country.code ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  <CountryFlag code={country.code} name={country.name} />
                  <span>{country.dialCode}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        placeholder={placeholder}
        value={localPhone}
        onChange={(event) => updatePhone(selectedCountry, event.target.value)}
        disabled={disabled}
        required={required}
        aria-invalid={validate && localPhone.length > 0 && !validateLocalPhoneForCountry(selectedCountry.code, localPhone.replace(/\D/g, ""))}
        className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
    </div>
  );
}