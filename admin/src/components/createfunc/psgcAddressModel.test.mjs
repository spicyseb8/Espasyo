import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_PSGC_ADDRESS_SELECTION,
  formatPsgcAddress,
  selectPsgcCity,
  selectPsgcIndependentCity,
  selectPsgcProvince,
  selectPsgcRegion,
} from "./psgcAddressModel.ts";

const region = {
  code: "04",
  name: "CALABARZON",
  regionCode: "IV-A",
};
const province = {
  code: "34",
  name: "Laguna",
};
const city = {
  code: "01",
  name: "Biñan City",
};
const barangay = {
  code: "001",
  name: "Santo Tomas",
};

test("changing a region clears the selected province, city, and barangay", () => {
  assert.deepEqual(selectPsgcRegion({ code: "05", name: "Bicol Region" }), {
    region: { code: "05", name: "Bicol Region" },
    province: null,
    city: null,
    barangay: null,
  });
  assert.deepEqual(selectPsgcRegion(null), EMPTY_PSGC_ADDRESS_SELECTION);
});

test("changing a province clears its dependent city and barangay", () => {
  const selection = {
    region,
    province,
    city,
    barangay,
  };

  assert.deepEqual(selectPsgcProvince(selection, { code: "41", name: "Batangas" }), {
    region,
    province: { code: "41", name: "Batangas" },
    city: null,
    barangay: null,
  });
});

test("changing a city clears the selected barangay", () => {
  const selection = {
    region,
    province,
    city,
    barangay,
  };

  assert.deepEqual(selectPsgcCity(selection, { code: "02", name: "Santa Rosa City" }), {
    region,
    province,
    city: { code: "02", name: "Santa Rosa City" },
    barangay: null,
  });
});

test("selecting a direct-region city clears the province and barangay", () => {
  assert.deepEqual(
    selectPsgcIndependentCity(
      { region, province, city, barangay },
      { code: "133900000", name: "City of Manila" },
    ),
    {
      region,
      province: null,
      city: { code: "133900000", name: "City of Manila" },
      barangay: null,
    },
  );
});

test("address formatting includes every selected level and optional street details", () => {
  const selection = {
    region,
    province,
    city,
    barangay,
  };

  assert.equal(
    formatPsgcAddress(selection, "Unit 5, Sampaguita Street"),
    "Region IV-A (CALABARZON), Laguna, Biñan City, Santo Tomas, Unit 5, Sampaguita Street",
  );
  const ncr = selectPsgcRegion({
    code: "13",
    name: "National Capital Region",
  });
  const manila = selectPsgcIndependentCity(ncr, {
    code: "133900000",
    name: "City of Manila",
  });
  assert.equal(
    formatPsgcAddress({
      ...selectPsgcCity(manila, {
        code: "133900000",
        name: "City of Manila",
      }),
      barangay: { code: "001", name: "Barangay 1" },
    }),
    "National Capital Region, City of Manila, Barangay 1",
  );
  assert.equal(formatPsgcAddress(EMPTY_PSGC_ADDRESS_SELECTION), "");
});
