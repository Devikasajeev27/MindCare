export function sanitizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizePhone(value: string) {
  return value.replace(/[^\d+\-()\s]/g, "").trim();
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
