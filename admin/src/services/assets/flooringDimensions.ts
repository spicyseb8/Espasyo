import {
  floorDimensionToMeters,
} from "../../../../shared/flooring/patterns.ts";
import type {
  FloorDimensionUnit,
} from "../../../../shared/flooring/patterns";

export function centimetersToMeters(value: number): number {
  return value / 100;
}

export function metersToCentimeters(value: number): number {
  return Number((value * 100).toFixed(10));
}

export function resolveMeterDimension(
  value: number,
  existingMeters?: number | null,
  unit: FloorDimensionUnit = "cm"
): number {
  const meters = floorDimensionToMeters(value, unit);

  if (
    existingMeters != null &&
    Number.isFinite(existingMeters) &&
    metersToCentimeters(existingMeters) === metersToCentimeters(meters)
  ) {
    return existingMeters;
  }

  return meters;
}
