import { env } from "@/config/env";
import { createAppGraphTokenProvider, deriveTokenUrl } from "./graphAppClient";

// Env-bound, process-wide app-only Graph token provider, so every server action
// shares one cached client-credentials token.
//
// Deliberately isolated from graphAppClient.ts (which stays pure): this module
// imports `@/config/env`, which throws if evaluated in a browser/jsdom context.
// The pure client is re-exported through the `@/features/auth` barrel; this
// singleton is NOT — server actions import it directly by path so the barrel
// never drags `env` into client bundles or jsdom component tests.
//
// Not unit-tested for the same reason auth.ts isn't: it is thin env wiring over
// createAppGraphTokenProvider (which is fully covered). Excluded from coverage
// in vitest.config.ts.
export const getAppGraphToken = createAppGraphTokenProvider({
  tokenUrl: deriveTokenUrl(env.AUTH_MICROSOFT_ENTRA_ID_ISSUER),
  clientId: env.AUTH_MICROSOFT_ENTRA_APPLICATION_ID,
  clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
});
