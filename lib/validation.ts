export const PIN_PATTERN = /^\d{4}$/;
export const MAX_ORIGINAL_WISH_LENGTH = 80;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type CreateWishInput = {
  wishContent: string;
  pin?: string;
};

export type FindWishInput = {
  wishCode: string;
  pin: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeWishCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidPin(value: string): boolean {
  return PIN_PATTERN.test(value);
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export function validateCreateWishInput(
  input: unknown,
): ValidationResult<CreateWishInput> {
  if (!isRecord(input)) {
    return { ok: false, error: "Please check the form and try again." };
  }

  if (typeof input.wishContent !== "string") {
    return { ok: false, error: "Wish cannot be empty." };
  }

  const wishContent = input.wishContent.trim();

  if (!wishContent) {
    return { ok: false, error: "Wish cannot be empty." };
  }

  if (input.wishContent.length > MAX_ORIGINAL_WISH_LENGTH) {
    return {
      ok: false,
      error: `Wish must be ${MAX_ORIGINAL_WISH_LENGTH} characters or fewer.`,
    };
  }

  const hasPin = input.pin !== undefined;
  const hasConfirmPin = input.confirmPin !== undefined;

  if (!hasPin && !hasConfirmPin) {
    return {
      ok: true,
      data: {
        wishContent,
      },
    };
  }

  if (typeof input.pin !== "string" || !isValidPin(input.pin)) {
    return { ok: false, error: "PIN must be exactly 4 digits." };
  }

  if (typeof input.confirmPin !== "string" || input.confirmPin !== input.pin) {
    return { ok: false, error: "PIN and Confirm PIN must match." };
  }

  return {
    ok: true,
    data: {
      wishContent,
      pin: input.pin,
    },
  };
}

export function validateFindWishInput(
  input: unknown,
): ValidationResult<FindWishInput> {
  if (!isRecord(input)) {
    return { ok: false, error: "Wish Code or PIN is incorrect." };
  }

  if (typeof input.wishCode !== "string") {
    return { ok: false, error: "Wish Code or PIN is incorrect." };
  }

  const wishCode = normalizeWishCode(input.wishCode);

  if (!wishCode || typeof input.pin !== "string" || !isValidPin(input.pin)) {
    return { ok: false, error: "Wish Code or PIN is incorrect." };
  }

  return {
    ok: true,
    data: {
      wishCode,
      pin: input.pin,
    },
  };
}
