export class InvalidWishCodeNameError extends Error {
  constructor() {
    super("Name must contain letters or numbers for the Wish Code.");
    this.name = "InvalidWishCodeNameError";
  }
}

export const WISH_CODE_MAX_ATTEMPTS = 50;

export function normalizeWishCodeName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!normalized) {
    throw new InvalidWishCodeNameError();
  }

  return normalized;
}

export function formatWishCodeDate(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());

  return `${day}${month}${year}`;
}

export function generateWishCodeBase(
  name: string,
  createdAt: Date = new Date(),
): string {
  return `${normalizeWishCodeName(name)}${formatWishCodeDate(createdAt)}`;
}

export function wishCodeForAttempt(baseCode: string, attempt: number): string {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw new Error("Attempt must be a positive integer.");
  }

  return attempt === 1 ? baseCode : `${baseCode}-${attempt}`;
}
