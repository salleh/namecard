"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { env } from "@/config/env";

// Sign out of THIS app only: clears our session cookie and returns to the public
// landing page. The Microsoft/Entra SSO session stays alive, so a later sign-in
// can be silent — convenient on a personal device.
export async function signOutApp(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

// Full (federated) sign-out: clear our session AND end the Microsoft session via
// Entra's end_session_endpoint, so the next sign-in requires a fresh Entra login
// — the safer choice on a shared device. Derives the logout endpoint from the
// configured issuer (…/<tenant>/v2.0 → …/<tenant>/oauth2/v2.0/logout).
//
// NOTE (Entra config): `post_logout_redirect_uri` must be registered on the app
// registration (add AUTH_URL as a Web redirect URI / front-channel logout URL),
// otherwise Entra ends the session but won't redirect back here.
export async function signOutMicrosoft(): Promise<void> {
  await signOut({ redirect: false });
  const logoutUrl = new URL(
    env.AUTH_MICROSOFT_ENTRA_ID_ISSUER.replace(/\/v2\.0\/?$/, "/oauth2/v2.0/logout"),
  );
  logoutUrl.searchParams.set("post_logout_redirect_uri", env.AUTH_URL);
  redirect(logoutUrl.toString());
}
