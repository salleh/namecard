# Microsoft Entra ID App Registration — e-Namecard

Complete, admin-ready steps to register the app in Microsoft 365 / Entra ID for
OIDC sign-in + Microsoft Graph access, and to collect every Entra object the
project needs. Hand this to whoever holds the required directory roles.

> Consumed by **Step 5** of `docs/plan/implementation-plan.md` (Auth.js Entra OIDC + Graph prefill + admin group claim).

---

## 0. Prerequisites

**Who can do this**

| Task                                                                                   | Minimum role                                                         |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Create the app registration, secret, redirect URIs, token config                       | **Application Administrator** or **Cloud Application Administrator** |
| Create the admin security group + assign members                                       | **Groups Administrator** (or User Administrator)                     |
| Grant tenant-wide admin consent (only if using the Graph-query admin gate, Approach B) | **Privileged Role Administrator** or **Global Administrator**        |

**Portals** — either works; navigation below uses the Entra admin center:

- Entra admin center: <https://entra.microsoft.com>
- Azure portal: <https://portal.azure.com> → _Microsoft Entra ID_ → _App registrations_

**Recommendation:** create **two** registrations — one for **dev** (localhost) and one
for **production** — so secrets and redirect URIs never mix. The steps are identical;
only the redirect URI and the resulting env values differ.

---

## 1. Create the app registration

1. Entra admin center → **Identity → Applications → App registrations → + New registration**.
2. **Name:** `e-Namecard (Prod)` (use `… (Dev)` for the dev app).
3. **Supported account types:** **Accounts in this organizational directory only — Single tenant.**
   (Never multi-tenant / `common`; the OIDC issuer must be tenant-specific.)
4. **Redirect URI:** Platform = **Web**, URI =
   `https://namecard.example.com/api/auth/callback/microsoft-entra-id`
   (Dev app: `http://localhost:3000/api/auth/callback/microsoft-entra-id`)
5. Click **Register**.

> The callback path `/api/auth/callback/microsoft-entra-id` is fixed by the Auth.js
> provider id `microsoft-entra-id`. It must match exactly, including scheme and host.

---

## 2. Record the core IDs

On the registration's **Overview** page, copy:

- **Application (client) ID** → `AUTH_MICROSOFT_ENTRA_APPLICATION_ID`
- **Directory (tenant) ID** → used to build the issuer URL (Section 9)

---

## 3. Authentication settings

**Authentication** blade:

- Confirm the **Web** redirect URI(s) from Section 1. Add the localhost URI here too if
  you are (against recommendation) using one registration for both dev and prod.
- **Implicit grant / hybrid flows:** leave **Access tokens** and **ID tokens** _unchecked_.
  The app uses the OIDC **authorization-code flow** (confidential client with a secret,
  PKCE via Auth.js) — no implicit grant is needed.
- **Front-channel logout URL (REQUIRED for federated sign-out):**
  `https://namecard.example.com`. The app's "Sign out of Microsoft too" option
  hits Entra's `end_session_endpoint` with `post_logout_redirect_uri=<AUTH_URL>`;
  Entra only redirects the user back after logout if that origin is registered here
  (or as an additional **Web** redirect URI). Without it the M365 session still ends,
  but the user lands on Microsoft's generic "signed out" page. _Registered and verified
  in production (2026-08-04)._
- **Allow public client flows:** No.

> **Sign-in prompt.** The app requests `prompt=select_account`, so Entra always shows
> the account chooser instead of silently reusing a live SSO session — deliberate on
> shared machines. No Entra-side config is needed for this; it's set in `src/auth.ts`.

---

## 4. Create a client secret

**Certificates & secrets → Client secrets → + New client secret**:

1. **Description:** `namecard-app-secret`.
2. **Expires:** 24 months (per tenant policy). Add a calendar reminder to rotate before expiry.
3. **Add**, then **immediately copy the `Value`** (shown once only) → `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
   - Do _not_ copy the "Secret ID"; the app needs the **Value**.

> Production hardening (optional): use a **certificate** credential instead of a secret
> (Certificates & secrets → Certificates). Secrets are fine for v1.

---

## 5. API permissions (Microsoft Graph — delegated)

**API permissions** blade. The registration starts with **Microsoft Graph → User.Read
(Delegated)** — keep it. It authorizes the delegated calls the app makes on first login:

- `GET /me` — profile prefill (display name, job title, department, etc.)
- `GET /me/photo/$value` — the staff photo

`User.Read` needs **no admin consent** (user consent covers it).

**Only if you choose the Graph-query admin gate (Approach B, Section 7):**

1. **+ Add a permission → Microsoft Graph → Delegated permissions →** search **`GroupMember.Read.All`** → Add.
2. Click **Grant admin consent for &lt;tenant&gt;** (requires a Privileged Role / Global Admin).

If you use the **groups-claim** gate (Approach A, recommended), **skip GroupMember.Read.All entirely** — no extra Graph permission or admin consent is required.

---

## 6. Create the admin security group

The admin console is gated by membership of a dedicated M365 security group.

1. Entra admin center → **Identity → Groups → All groups → + New group**.
2. **Group type:** Security. **Name:** `eNamecard Admins`. **Membership type:** Assigned.
3. Create, open the group, and **add the admin members**.
4. Copy the group's **Object ID** → `ADMIN_GROUP_ID`.

---

## 7. Emit the admin group to the token

Pick **one** approach. **Approach A is recommended** (least privilege, no overage).

### Approach A — Groups optional claim (recommended)

Emit only the app-assigned group(s) in the token so the app can check membership with
zero extra Graph permissions, and without the 200-group token-overage problem.

1. **Assign the admin group to the application** (this controls _claim emission_, not sign-in):
   - **Identity → Applications → Enterprise applications →** `e-Namecard` **→ Users and groups → + Add user/group →** select **`eNamecard Admins`** → Assign.
2. **Keep sign-in open to all staff:**
   - Same Enterprise application → **Properties → Assignment required? = No** (the default).
   - With this **No**, assigning the group above does **not** restrict who can log in — every
     staff member can still authenticate; the group is used _only_ to decide whose token carries the claim.
   - ⚠️ If you set Assignment required = **Yes**, only assigned users/groups could sign in — that would **lock out normal staff**. Leave it **No**.
3. **Add the groups claim** (**App registration → Token configuration → + Add groups claim**):
   - Under "Select group types", check **Groups assigned to the application**.
   - The blade then shows expandable **ID**, **Access**, and **SAML** sections. These only
     _customize the format per token type_ — selecting the group type above already emits the
     claim to the ID and Access tokens. Expand **ID** (and optionally **Access**) and keep the
     defaults:
     - Identifier = **Group ID** (emits the group's Object ID, which the app compares to `ADMIN_GROUP_ID`).
     - **Leave "Emit groups as role claims" UNCHECKED.** Ticking it sends a `roles` claim
       instead of the `groups` claim this app reads — do not tick it for either token type.
   - Click **Add**.
4. Result: a member's ID token contains `"groups": ["<ADMIN_GROUP_ID>", …]` (only app-assigned groups); non-members have no admin group in the claim. The app authorizes admin routes by checking whether `ADMIN_GROUP_ID` is present in the ID token's `groups` claim.

### Approach B — Query Graph at login (fallback)

Use if you prefer not to configure group claims, or need to check arbitrary groups.

1. Add delegated **`GroupMember.Read.All`** + grant admin consent (Section 5).
2. After sign-in, the app calls Graph to confirm membership, e.g.
   `POST /me/checkMemberGroups` with `{ "groupIds": ["<ADMIN_GROUP_ID>"] }`, or
   `GET /me/memberOf`.
3. Works regardless of how many groups a user belongs to; costs one extra Graph call per login and a broader permission.

---

## 8. Verify (recommended)

Sign in with the dev app using an **admin** account and a **non-admin** account, decode the
ID token (e.g. jwt.ms), and confirm:

- `iss` = `https://login.microsoftonline.com/<tenant-id>/v2.0`
- `oid` present (the stable Entra object id the app keys rows on)
- Admin user: `groups` contains `ADMIN_GROUP_ID`; non-admin: it does not.

---

## 9. Entra objects to hand to the project → env mapping

Collect these and place them in the app's `.env` (prod: `/home/encard/data/.env`; never commit real values — commit only `.env.example`):

| Entra object                        | Where to find it                                                   | Env var                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Application (client) ID             | App registration → Overview                                        | `AUTH_MICROSOFT_ENTRA_APPLICATION_ID`                                                   |
| Client secret **Value**             | Certificates & secrets (Section 4)                                 | `AUTH_MICROSOFT_ENTRA_ID_SECRET`                                                        |
| Directory (tenant) ID               | App registration → Overview                                        | _(used to build the issuer below)_                                                      |
| OIDC issuer (tenant-specific, v2.0) | Constructed                                                        | `AUTH_MICROSOFT_ENTRA_ID_ISSUER` = `https://login.microsoftonline.com/<tenant-id>/v2.0` |
| Admin group Object ID               | Groups → eNamecard Admins (Section 6)                              | `ADMIN_GROUP_ID`                                                                        |
| Public app origin                   | Fixed                                                              | `AUTH_URL` = `https://namecard.example.com`                                             |
| Auth.js session secret              | Generate locally: `openssl rand -base64 32` (or `npx auth secret`) | `AUTH_SECRET`                                                                           |

> **Auth.js naming note:** `AUTH_MICROSOFT_ENTRA_APPLICATION_ID` is a project-specific name
> (clearer than Auth.js's auto-inferred `AUTH_MICROSOFT_ENTRA_ID_ID`, which doubles "ID").
> Because it no longer matches the auto-inference convention, the Step 5 provider config must
> pass it explicitly rather than relying on Auth.js to read it:
> `MicrosoftEntraID({ clientId: process.env.AUTH_MICROSOFT_ENTRA_APPLICATION_ID, clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET, issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER })`.
> (`_SECRET`/`_ISSUER` keep the Auth.js convention names — passing them explicitly too just keeps the config symmetric.)

`.env` block (values are placeholders):

```dotenv
# --- Entra / Auth.js ---
AUTH_MICROSOFT_ENTRA_APPLICATION_ID=00000000-0000-0000-0000-000000000000
AUTH_MICROSOFT_ENTRA_ID_SECRET=REPLACE_WITH_SECRET_VALUE
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
AUTH_URL=https://namecard.example.com
AUTH_SECRET=REPLACE_WITH_OPENSSL_RAND
# --- Admin gate ---
ADMIN_GROUP_ID=00000000-0000-0000-0000-000000000000
```

> `ADMIN_GROUP_ID` is a project addition (not in the original `CLAUDE.md` env list) required by
> the M365-group-gated admin console. Add it to `.env.example` and the env-schema validation in Step 1.

---

## 10. Security & operations notes

- **Single-tenant only.** The issuer must contain the tenant id — never `common` / `organizations`.
- **Least privilege.** Prefer Approach A; it avoids `GroupMember.Read.All` and tenant-wide admin consent.
- **No write-back.** Graph is read-only here (`User.Read`); the app never writes to Entra.
- **Separate dev & prod registrations** with separate secrets and redirect URIs.
- **Secret rotation.** Track the expiry from Section 4; rotate before it lapses (or move to a certificate credential).
- **Secret storage.** Production secrets live only in `/home/encard/data/.env`, outside the git repo.
- **Redirect URI exactness.** Any mismatch (scheme, host, trailing path) breaks the OIDC callback with `AADSTS50011`.
- **Forwarded headers.** Because TLS terminates at the DMZ nginx, the app trusts `X-Forwarded-Proto/Host` and `AUTH_URL` is the public HTTPS origin so redirect URIs and Secure cookies are generated correctly.
