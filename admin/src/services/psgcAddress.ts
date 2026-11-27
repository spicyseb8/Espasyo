import { API_BASE_URL } from "@/services/assets/projectApi";

export interface PsgcAddressOption {
  code: string;
  name: string;
  regionCode?: string;
  provinceCode?: string;
}

interface PsgcAddressResponse {
  success?: boolean;
  version?: string;
  data?: unknown;
  message?: string;
}

async function fetchPsgcOptions(path: string): Promise<PsgcAddressOption[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/psgc/${path}`);
  } catch (error) {
    console.error("Could not reach the Espasyo PSGC endpoint:", error);
    throw new Error(
      "Address options could not be reached. Check your connection and try again.",
      { cause: error },
    );
  }

  let result: PsgcAddressResponse;
  try {
    result = await response.json() as PsgcAddressResponse;
  } catch {
    throw new Error("The address service returned an invalid response.");
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message || "Could not load address options from the PSA PSGC service.",
    );
  }
  if (
    !Array.isArray(result.data) ||
    !result.data.every((option) =>
      option &&
      typeof option === "object" &&
      typeof option.code === "string" &&
      typeof option.name === "string"
    )
  ) {
    throw new Error("The address service returned an invalid PSGC option list.");
  }

  return result.data as PsgcAddressOption[];
}

export function getPsgcRegions() {
  return fetchPsgcOptions("regions");
}

export function getPsgcProvinces(regionCode: string) {
  const query = new URLSearchParams({ regionCode });
  return fetchPsgcOptions(`provinces?${query}`);
}

export function getPsgcCitiesMunicipalities(
  regionCode: string,
  provinceCode?: string,
) {
  const query = new URLSearchParams({ regionCode });
  if (provinceCode) {
    query.set("provinceCode", provinceCode);
  }
  return fetchPsgcOptions(`cities-municipalities?${query}`);
}

export function getPsgcBarangays(
  regionCode: string,
  cityMunicipalityCode: string,
  provinceCode?: string,
) {
  const query = new URLSearchParams({
    regionCode,
    cityMunicipalityCode,
  });
  if (provinceCode) {
    query.set("provinceCode", provinceCode);
  }
  return fetchPsgcOptions(`barangays?${query}`);
}
