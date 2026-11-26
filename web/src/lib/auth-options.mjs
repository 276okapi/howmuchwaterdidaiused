// Better Auth configuration shared by the Next.js app (src/lib/auth.ts) and by
// scripts/migrate.mjs. Plain JS on purpose, so the migration script can import it
// with bare Node (no TypeScript build step on the hosting).
import { apiKey } from "@better-auth/api-key";
import { getPool } from "./db.mjs";

/** Prefix for every table of this project, so it can share an existing database. */
export const TABLE_PREFIX = "cw_";

/** OAuth providers are enabled only when their credentials are set in .env. */
function socialProviders() {
  const p = {};
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    p.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    p.github = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }
  return p;
}

export const enabledSocialProviders = () => Object.keys(socialProviders());

/** Personal API keys for the local agent (x-api-key header -> user).
 *  Better Auth stores only a hash of the key, never the key itself. */
export function apiKeyPlugin() {
  return apiKey({
    defaultPrefix: "cw_",
    apiKeyHeaders: ["x-api-key"],
    enableMetadata: true,
    schema: { apikey: { modelName: `${TABLE_PREFIX}apikey` } },
    rateLimit: { enabled: true, timeWindow: 60 * 1000, maxRequests: 60 },
  });
}

/** Everything except plugins (plugins are added where their types are needed).
 * @returns {import("better-auth").BetterAuthOptions} */
export function baseOptions() {
  return {
    appName: "Claude Water Tracker",
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: getPool(),

    user: { modelName: `${TABLE_PREFIX}user` },
    session: { modelName: `${TABLE_PREFIX}session` },
    account: {
      modelName: `${TABLE_PREFIX}account`,
      // one person = one account, whichever way they sign in (same verified e-mail)
      accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
    },
    verification: { modelName: `${TABLE_PREFIX}verification` },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      // TODO: turn on once SMTP is configured (sendVerificationEmail / sendResetPassword)
      requireEmailVerification: false,
    },
    socialProviders: socialProviders(),

    rateLimit: { enabled: true, storage: "database", modelName: `${TABLE_PREFIX}rate_limit` },

  };
}

/** Full options, used by scripts/migrate.mjs. Keep the plugin list in sync with src/lib/auth.ts. */
export function authOptions() {
  return { ...baseOptions(), plugins: [apiKeyPlugin()] };
}
