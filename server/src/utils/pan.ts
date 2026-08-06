export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function normalizePan(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function isValidPan(value: unknown): boolean {
  return PAN_PATTERN.test(normalizePan(value));
}

export function maskPan(value: unknown): string {
  const pan = normalizePan(value);
  return PAN_PATTERN.test(pan) ? `${pan.slice(0, 5)}****${pan.slice(-1)}` : "";
}
