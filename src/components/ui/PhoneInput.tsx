import React from "react";
import PhoneInputWithCountrySelect from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getCountryCallingCode } from "react-phone-number-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
}

export function isValidPhoneNumber(phoneNumber: string): boolean {
  if (!phoneNumber) return false;
  try {
    const cleanNumber = phoneNumber.replace(/\s+/g, "");
    const parsed = parsePhoneNumberFromString(cleanNumber, "IN");
    if (parsed && parsed.isValid()) return true;
    return /^\+?[0-9\s\-\(\)]{7,20}$/.test(phoneNumber);
  } catch {
    return /^\+?[0-9\s\-\(\)]{7,20}$/.test(phoneNumber);
  }
}

export function getPhoneDetails(phoneNumber: string) {
  if (!phoneNumber) return null;
  try {
    const cleanNumber = phoneNumber.replace(/\s+/g, "");
    const parsed = parsePhoneNumberFromString(cleanNumber, "IN");
    if (!parsed) return null;
    return {
      countryCode: parsed.country,
      dialCode: `+${parsed.countryCallingCode}`,
      nationalNumber: parsed.nationalNumber,
      internationalFormat: parsed.formatInternational(),
      nationalFormat: parsed.formatNational()
    };
  } catch {
    return null;
  }
}

function getUnicodeFlagIcon(countryCode: string): string {
  if (!countryCode) return "";
  return countryCode
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
}

interface CountrySelectProps {
  name?: string;
  value?: string;
  onChange: (value: string) => void;
  options: { value?: string; label: string }[];
  disabled?: boolean;
}

function SearchableCountrySelect({
  value,
  onChange,
  options,
  disabled
}: CountrySelectProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className="flex items-center gap-1.5 h-11 px-3 rounded-l-lg border-r border-gray-200 bg-gray-50/50 text-sm font-medium hover:bg-gray-100 transition-colors shrink-0 outline-none"
        >
          <span className="text-base leading-none">{value ? getUnicodeFlagIcon(value) : "🌐"}</span>
          <span className="text-gray-600 text-xs font-semibold">
            {value ? `+${getCountryCallingCode(value as any)}` : ""}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country..." className="h-9" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {options
                .filter((o) => o.value)
                .map((o) => {
                  const countryCode = o.value!;
                  const flag = getUnicodeFlagIcon(countryCode);
                  const dial = getCountryCallingCode(countryCode as any);
                  return (
                    <CommandItem
                      key={countryCode}
                      value={`${o.label} ${countryCode} +${dial}`}
                      onSelect={() => {
                        onChange(countryCode);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between text-sm py-2 cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">{flag}</span>
                        <span className="font-medium text-gray-800">{o.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-400">
                        +{dial}
                      </span>
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "Enter phone number",
  className = "",
  error = false,
  disabled = false
}: PhoneInputProps) {
  const cleanValue = value ? value.replace(/\s+/g, "") : "";

  return (
    <div className={`phone-input-container ${className}`}>
      <PhoneInputWithCountrySelect
        value={cleanValue}
        onChange={(val) => onChange(val || "")}
        placeholder={placeholder}
        disabled={disabled}
        defaultCountry="IN"
        countrySelectComponent={SearchableCountrySelect}
        className={`flex h-11 w-full rounded-lg border bg-gray-50 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-destructive focus-within:border-destructive" : "border-gray-200 focus-within:border-primary focus-within:bg-white"
        }`}
        numberInputProps={{
          className: "w-full bg-transparent border-none outline-none focus:ring-0 focus:outline-none px-3 h-full text-gray-800"
        }}
      />
    </div>
  );
}
export default PhoneInput;
