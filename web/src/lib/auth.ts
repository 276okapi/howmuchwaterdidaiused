import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { apiKeyPlugin, baseOptions } from "./auth-options.mjs";

export const auth = betterAuth({
  ...baseOptions(),
  // keep in sync with authOptions() in auth-options.mjs (used by migrations);
  // nextCookies must be last: lets server actions set the session cookie
  plugins: [apiKeyPlugin(), nextCookies()],
});

/** Session of the current request, or null when not signed in. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
