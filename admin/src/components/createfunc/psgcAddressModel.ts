import type { PsgcAddressOption } from "@/services/psgcAddress";

export interface PsgcAddressSelection {
  region: PsgcAddressOption | null;
  province: PsgcAddressOption | null;
  city: PsgcAddressOption | null;
  barangay: PsgcAddressOption | null;
}

export const EMPTY_PSGC_ADDRESS_SELECTION: PsgcAddressSelection = {
  region: null,
  province: null,
  city: null,
  barangay: null,
};

export function selectPsgcRegion(
  region: PsgcAddressOption | null,
): PsgcAddressSelection {
  return {
    region,
    province: null,
    city: null,
    barangay: null,
  };
}

export function selectPsgcProvince(
  selection: PsgcAddressSelection,
  province: PsgcAddressOption | null,
): PsgcAddressSelection {
  return {
    region: selection.region,
    province,
    city: null,
    barangay: null,
  };
}

export function selectPsgcIndependentCity(
  selection: PsgcAddressSelection,
  city: PsgcAddressOption | null,
): PsgcAddressSelection {
  return {
    region: selection.region,
    province: null,
    city,
    barangay: null,
  };
}

export function selectPsgcCity(
  selection: PsgcAddressSelection,
  city: PsgcAddressOption | null,
): PsgcAddressSelection {
  return {
    ...selection,
    city,
    barangay: null,
  };
}

export function selectPsgcBarangay(
  selection: PsgcAddressSelection,
  barangay: PsgcAddressOption | null,
): PsgcAddressSelection {
  return { ...selection, barangay };
}

export function getPsgcRegionLabel(region: PsgcAddressOption) {
  const regionName = region.name.trim();
  const regionNumber = region.regionCode?.trim();
  if (!regionNumber || regionName.toLowerCase().includes("region")) {
    return regionName;
  }

  return `Region ${regionNumber} (${regionName})`;
}

export function getPsgcMunicipalityLabel(city: PsgcAddressOption) {
  return city.name;
}

export function getPsgcParentProvinceCode(city: PsgcAddressOption) {
  return city.provinceCode && city.provinceCode !== "0"
    ? city.provinceCode
    : undefined;
}

export function formatPsgcAddress(
  selection: PsgcAddressSelection,
  details = "",
) {
  if (!selection.region || !selection.city || !selection.barangay) {
    return "";
  }

  return [
    getPsgcRegionLabel(selection.region),
    selection.province?.name,
    getPsgcMunicipalityLabel(selection.city),
    selection.barangay.name,
    details.trim(),
  ].filter((part): part is string => Boolean(part?.trim())).join(", ");
}
