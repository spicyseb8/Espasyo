import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPsgcBarangays,
  getPsgcCitiesMunicipalities,
  getPsgcProvinces,
  getPsgcRegions,
  type PsgcAddressOption,
} from "@/services/psgcAddress";
import {
  EMPTY_PSGC_ADDRESS_SELECTION,
  formatPsgcAddress,
  getPsgcMunicipalityLabel,
  getPsgcParentProvinceCode,
  getPsgcRegionLabel,
  selectPsgcBarangay,
  selectPsgcCity,
  selectPsgcIndependentCity,
  selectPsgcProvince,
  selectPsgcRegion,
  type PsgcAddressSelection,
} from "./psgcAddressModel";

interface PsgcAddressSelectorProps {
  enabled: boolean;
  disabled?: boolean;
  onChange: (address: string) => void;
}

function optionValue(kind: "province" | "city", code: string) {
  return `${kind}:${code}`;
}

export default function PsgcAddressSelector({
  enabled,
  disabled = false,
  onChange,
}: PsgcAddressSelectorProps) {
  const [regions, setRegions] = useState<PsgcAddressOption[]>([]);
  const [provinces, setProvinces] = useState<PsgcAddressOption[]>([]);
  const [regionalCities, setRegionalCities] = useState<PsgcAddressOption[]>([]);
  const [cities, setCities] = useState<PsgcAddressOption[]>([]);
  const [barangays, setBarangays] = useState<PsgcAddressOption[]>([]);
  const [geography, setGeography] = useState<PsgcAddressSelection>(
    EMPTY_PSGC_ADDRESS_SELECTION,
  );
  const [addressDetails, setAddressDetails] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const requestId = useRef(0);

  const directRegionalCities = useMemo(
    () => regionalCities.filter((city) => !getPsgcParentProvinceCode(city)),
    [regionalCities],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    setLoading((current) => ({ ...current, regions: true }));
    setErrors((current) => ({ ...current, regions: "" }));
    void getPsgcRegions()
      .then((items) => {
        if (!cancelled) {
          setRegions(items);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrors((current) => ({
            ...current,
            regions: error instanceof Error
              ? error.message
              : "Could not load regions.",
          }));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading((current) => ({ ...current, regions: false }));
        }
      });

    return () => {
      cancelled = true;
      requestId.current += 1;
    };
  }, [enabled]);

  const publishAddress = (
    next: PsgcAddressSelection,
    details = addressDetails,
  ) => {
    onChange(formatPsgcAddress(next, details));
  };

  const handleRegionChange = async (code: string) => {
    const region = regions.find((item) => item.code === code) ?? null;
    const currentRequestId = ++requestId.current;
    const next = selectPsgcRegion(region);
    setGeography(next);
    setProvinces([]);
    setRegionalCities([]);
    setCities([]);
    setBarangays([]);
    setAddressDetails("");
    onChange("");
    setErrors((current) => ({ ...current, children: "" }));

    if (!region) {
      return;
    }

    setLoading((current) => ({ ...current, children: true }));
    try {
      const [nextProvinces, nextCities] = await Promise.all([
        getPsgcProvinces(region.code),
        getPsgcCitiesMunicipalities(region.code),
      ]);
      if (requestId.current !== currentRequestId) {
        return;
      }
      setProvinces(nextProvinces);
      setRegionalCities(nextCities);
    } catch (error) {
      if (requestId.current === currentRequestId) {
        setErrors((current) => ({
          ...current,
          children: error instanceof Error
            ? error.message
            : "Could not load provinces and cities.",
        }));
      }
    } finally {
      if (requestId.current === currentRequestId) {
        setLoading((current) => ({ ...current, children: false }));
      }
    }
  };

  const handleProvinceOrCityChange = async (value: string) => {
    const [kind, code] = value.split(":", 2);
    const currentRequestId = ++requestId.current;
    const province = kind === "province"
      ? provinces.find((item) => item.code === code) ?? null
      : null;
    const directCityOptions = provinces.length === 0
      ? regionalCities
      : directRegionalCities;
    const directCity = kind === "city"
      ? directCityOptions.find((item) => item.code === code) ?? null
      : null;
    const next = directCity
      ? selectPsgcIndependentCity(geography, directCity)
      : selectPsgcProvince(geography, province);
    setGeography(next);
    setCities([]);
    setBarangays([]);
    setAddressDetails("");
    onChange("");
    setErrors((current) => ({ ...current, cities: "", barangays: "" }));

    if (directCity && geography.region) {
      await loadBarangays(next, directCity, currentRequestId);
      return;
    }
    if (!province || !geography.region) {
      return;
    }

    setLoading((current) => ({ ...current, cities: true }));
    try {
      const nextCities = await getPsgcCitiesMunicipalities(
        geography.region.code,
        province.code,
      );
      if (requestId.current === currentRequestId) {
        setCities(nextCities);
      }
    } catch (error) {
      if (requestId.current === currentRequestId) {
        setErrors((current) => ({
          ...current,
          cities: error instanceof Error
            ? error.message
            : "Could not load cities and municipalities.",
        }));
      }
    } finally {
      if (requestId.current === currentRequestId) {
        setLoading((current) => ({ ...current, cities: false }));
      }
    }
  };

  const loadBarangays = async (
    parent: PsgcAddressSelection,
    city: PsgcAddressOption,
    currentRequestId: number,
  ) => {
    if (!parent.region) {
      return;
    }

    setLoading((current) => ({ ...current, barangays: true }));
    setErrors((current) => ({ ...current, barangays: "" }));
    try {
      const nextBarangays = await getPsgcBarangays(
        parent.region.code,
        city.code,
        parent.province?.code ?? getPsgcParentProvinceCode(city),
      );
      if (requestId.current !== currentRequestId) {
        return;
      }
      setBarangays(nextBarangays);
    } catch (error) {
      if (requestId.current === currentRequestId) {
        setErrors((current) => ({
          ...current,
          barangays: error instanceof Error
            ? error.message
            : "Could not load barangays.",
        }));
      }
    } finally {
      if (requestId.current === currentRequestId) {
        setLoading((current) => ({ ...current, barangays: false }));
      }
    }
  };

  const handleCityChange = async (code: string) => {
    const city = cities.find((item) => item.code === code) ?? null;
    const currentRequestId = ++requestId.current;
    const next = selectPsgcCity(geography, city);
    setGeography(next);
    setBarangays([]);
    setAddressDetails("");
    onChange("");
    if (city) {
      await loadBarangays(next, city, currentRequestId);
    }
  };

  const handleBarangayChange = (code: string) => {
    const barangay = barangays.find((item) => item.code === code) ?? null;
    const next = selectPsgcBarangay(geography, barangay);
    setGeography(next);
    setAddressDetails("");
    publishAddress(next, "");
  };

  const handleDetailsChange = (value: string) => {
    setAddressDetails(value);
    publishAddress(geography, value);
  };

  const regionLabel = geography.region
    ? getPsgcRegionLabel(geography.region)
    : "";
  const hasRegionChildren =
    provinces.length > 0 || directRegionalCities.length > 0;
  const hasIndependentCities =
    provinces.length > 0 && directRegionalCities.length > 0;
  const provinceOrCityValue = geography.province
    ? optionValue("province", geography.province.code)
    : geography.city && !geography.province
      ? optionValue("city", geography.city.code)
      : "";

  const selectClassName =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="account-address-region">Region</Label>
        <select
          id="account-address-region"
          className={selectClassName}
          value={geography.region?.code ?? ""}
          onChange={(event) => void handleRegionChange(event.target.value)}
          disabled={disabled || !enabled || loading.regions}
          required
          aria-describedby={errors.regions ? "account-address-error" : undefined}
        >
          <option value="">
            {loading.regions ? "Loading regions..." : "Select a region"}
          </option>
          {regions.map((region) => (
            <option key={region.code} value={region.code}>
              {getPsgcRegionLabel(region)}
            </option>
          ))}
        </select>
        {errors.regions && (
          <p id="account-address-error" className="text-xs text-destructive" role="alert">
            {errors.regions}
          </p>
        )}
      </div>

      {geography.region && (
        <div className="space-y-1.5">
          <Label htmlFor="account-address-province">
            {provinces.length === 0 ? "City / municipality" : hasIndependentCities ? "Province or independent city" : "Province"}
          </Label>
          <select
            id="account-address-province"
            className={selectClassName}
            value={provinceOrCityValue}
            onChange={(event) => void handleProvinceOrCityChange(event.target.value)}
            disabled={disabled || loading.children || !hasRegionChildren}
          >
            <option value="">
              {loading.children
                ? "Loading provinces and cities..."
                : provinces.length === 0
                  ? "Select a city or municipality"
                  : hasIndependentCities
                    ? "Select a province or independent city"
                    : "Select a province"}
            </option>
            {provinces.map((province) => (
              <option
                key={province.code}
                value={optionValue("province", province.code)}
              >
                {regionLabel}, {province.name}
              </option>
            ))}
            {provinces.length === 0
              ? regionalCities.map((city) => (
                  <option
                    key={city.code}
                    value={optionValue("city", city.code)}
                  >
                    {regionLabel}, {getPsgcMunicipalityLabel(city)}
                  </option>
                ))
              : directRegionalCities.map((city) => (
                  <option
                    key={city.code}
                    value={optionValue("city", city.code)}
                  >
                    {regionLabel}, {getPsgcMunicipalityLabel(city)} (independent city)
                  </option>
                ))}
          </select>
          {errors.children && (
            <p className="text-xs text-destructive" role="alert">
              {errors.children}
            </p>
          )}
        </div>
      )}

      {geography.province && (
        <div className="space-y-1.5">
          <Label htmlFor="account-address-city">City / municipality</Label>
          <select
            id="account-address-city"
            className={selectClassName}
            value={geography.city?.code ?? ""}
            onChange={(event) => void handleCityChange(event.target.value)}
            disabled={disabled || loading.cities}
          >
            <option value="">
              {loading.cities ? "Loading cities and municipalities..." : "Select a city or municipality"}
            </option>
            {cities.map((city) => (
              <option key={city.code} value={city.code}>
              {regionLabel}, {geography.province?.name}, {getPsgcMunicipalityLabel(city)}
              </option>
            ))}
          </select>
          {errors.cities && (
            <p className="text-xs text-destructive" role="alert">
              {errors.cities}
            </p>
          )}
        </div>
      )}

      {geography.city && (
        <div className="space-y-1.5">
          <Label htmlFor="account-address-barangay">Barangay</Label>
          <select
            id="account-address-barangay"
            className={selectClassName}
            value={geography.barangay?.code ?? ""}
            onChange={(event) => handleBarangayChange(event.target.value)}
            disabled={disabled || loading.barangays}
            required
          >
            <option value="">
              {loading.barangays ? "Loading barangays..." : "Select a barangay"}
            </option>
            {barangays.map((barangay) => (
              <option key={barangay.code} value={barangay.code}>
                {[
                  regionLabel,
                  geography.province?.name,
                  geography.city
                    ? getPsgcMunicipalityLabel(geography.city)
                    : "",
                  barangay.name,
                ].filter(Boolean).join(", ")}
              </option>
            ))}
          </select>
          {errors.barangays && (
            <p className="text-xs text-destructive" role="alert">
              {errors.barangays}
            </p>
          )}
        </div>
      )}

      {geography.barangay && (
        <div className="space-y-1.5">
          <Label htmlFor="account-address-details">
            House number, street, subdivision, building, or other details
          </Label>
          <div className="relative">
            <MapPin
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="account-address-details"
              value={addressDetails}
              onChange={(event) => handleDetailsChange(event.target.value)}
              placeholder="Enter additional address details (optional)"
              className="pl-9"
              disabled={disabled}
              autoComplete="street-address"
            />
          </div>
        </div>
      )}
    </div>
  );
}
