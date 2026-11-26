"use client";
import { createAuthClient } from "better-auth/react";
import { apiKeyClient } from "@better-auth/api-key/client";

// Same origin as the app, so no baseURL is needed.
export const authClient = createAuthClient({
  plugins: [apiKeyClient()],
});
