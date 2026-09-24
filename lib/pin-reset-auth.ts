import { cookies } from "next/headers";

import {
  PIN_RESET_SESSION_COOKIE,
  verifyPinResetSessionValue,
  type PinResetSession,
} from "./pin-reset-session";

export async function getCurrentPinResetSession(): Promise<PinResetSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(PIN_RESET_SESSION_COOKIE)?.value;

  return value ? verifyPinResetSessionValue(value) : null;
}
