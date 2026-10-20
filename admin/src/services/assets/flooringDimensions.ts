export function centimetersToMeters(value: number): number {
  return value / 100;
}

export function metersToCentimeters(value: number): number {
  return Number((value * 100).toFixed(10));
}

export function resolveMeterDimension(
  centimeters: number,
  existingMeters?: number | null
): number {
  if (
    existingMeters != null &&
    Number.isFinite(existingMeters) &&
    metersToCentimeters(existingMeters) === centimeters
  ) {
    return existingMeters;
  }

  return centimetersToMeters(centimeters);
}
