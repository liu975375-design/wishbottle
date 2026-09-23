import { cookies } from "next/headers";

import {
  RETURN_SESSION_COOKIE,
  verifyReturnSessionValue,
  type ReturnSession,
} from "./return-session";

export async function getCurrentReturnSession(): Promise<ReturnSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(RETURN_SESSION_COOKIE)?.value;

  return value ? verifyReturnSessionValue(value) : null;
}
