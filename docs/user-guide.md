# e-Namecard — User Guide

This guide covers the two ways people use the e‑Namecard system:

- **[Part 1 — For staff (card owners)](#part-1--for-staff-card-owners)** — sign in, fill in and save your namecard, and show your QR code for others to scan.
- **[Part 2 — For administrators](#part-2--for-administrators)** — manage staff cards and control who can administer the system.

**Live site:** <https://namecard.example.com>

---

## Part 1 — For staff (card owners)

Your e‑Namecard is a digital business card. It shows your contact details and a **QR code** that anyone can scan with a phone camera to add you straight to their contacts — no app required on their side.

### 1. Sign in for the first time

You sign in with your **company Microsoft 365 account** (the same login you use for Outlook/Teams). There is no separate password to create.

1. Open <https://namecard.example.com/me> (or go to the home page and choose **Sign in to manage your card**).
2. Click **Sign in with Microsoft 365**.
3. Pick your work account in the Microsoft sign‑in screen and complete any usual multi‑factor prompt.
4. You are returned to **My card**.

**What happens on first login:** the system reads your profile from the company directory (Microsoft 365) once and pre‑fills your card — name, job title, department, company, email, office and mobile phone, office location, and your profile photo if you have one.

> After that first login, **your card is stored separately** and becomes the source of truth. Anything you change here affects **only your namecard** — nothing is ever written back to Microsoft 365 or your official directory profile.

> If you ever land on "We couldn't find your card yet", simply sign out and sign in again to finish setting it up.

### 2. View, edit and save your details

On the **My card** page (`/me`) you'll see a form on the left and a **live preview** (with your QR code) on the right.

**Editable fields:**

| Field        | Field           | Field        |
| ------------ | --------------- | ------------ |
| Display name | First name      | Last name    |
| Job title    | Department      | Company      |
| Email        | Office phone    | Mobile phone |
| Fax          | Office location | Address      |
| Website      |                 |              |

To edit:

1. Change any field, or fill in ones that are blank. You can **override** any value that was pre‑filled from the directory.
2. The **Live preview** panel updates as you type, so you can see how your card and QR code will look.
3. Click **Save changes**. A green **"Your card has been updated"** message confirms the save.

**Add or change your photo:**

- Under **Photo**, choose an image file (PNG, JPEG or GIF).
- To take your photo down completely, tick **Remove current photo**, then **Save changes**.
- A card with no photo simply shows no picture — that's fine.

> **Tip:** Leave a field blank if you don't want it to appear. Empty fields are simply left off your public card.

### 3. Show your QR code for others to scan

There are two easy ways to display your QR code.

**A. From the preview (fastest):** the **Live preview** panel on the _My card_ page already shows your QR code. Turn your screen toward the other person and let them scan it.

**B. From your public card page (recommended for sharing):**

1. On the _My card_ page, click **View public card** (top right). This opens your public page at:

   `https://namecard.example.com/<your-email-name>`

   where `<your-email-name>` is the part of your email **before** `@example.com`.

2. That page shows your photo, your details, and a large QR code with your organization’s logo in the centre.
3. The other person points their **phone camera** at the QR code. Their phone offers **"Add to Contacts"** — you're saved in one tap.

**Other ways to share:**

- **Send the link.** Anyone with your public card link can open it and scan or download your card — no login needed on their side.
- **Download button.** Your public page has a **Download contact (.vcf)** button that saves a standard contact file (handy when someone wants the file rather than a scan).

> Your public card is only reachable by people who know your link — there is no public staff directory or search. Your internal staff ID is never shown anywhere.

### 4. Install it on your phone (optional)

The site is a Progressive Web App, so you can add it to your home screen for quick access:

- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** menu (⋮) → **Install app** / **Add to Home screen**.

Once installed, your own card is cached so your QR code still displays even with a poor connection.

### 5. Sign out (especially on shared computers)

Click **Sign out**. You'll be asked whether to also sign out of Microsoft:

- **Yes, sign out of Microsoft too** — recommended on shared or public computers, so no one can sign back in as you.
- **No, just this app** — leaves your Microsoft session active on your own device.

---

## Part 2 — For administrators

Admins keep the directory of cards tidy — chiefly by **disabling** cards for people who have left, and **re‑enabling** them if needed. Admins do **not** edit other people's card content; each person edits their own card.

### 1. Who can be an admin

Admin access is controlled entirely by **membership of a Microsoft 365 security group** (the **`eNamecard Admins`** group in Entra ID). There is no separate admin password or in‑app role to assign.

- If you are in that group, an **Admin** button appears in the header of your **My card** page after you sign in.
- Non‑members don't see the admin area at all — visiting `/admin` returns a plain **404** (the system deliberately doesn't reveal that an admin area exists).

**To grant or revoke admin rights** (done by an IT/Entra administrator):

1. In the Microsoft Entra admin centre, add (or remove) the person in the **`eNamecard Admins`** group.
2. The change takes effect the **next time that person signs in** (admin status is read from their login token). Ask them to sign out and sign back in.

> Full setup of the group and token claim is documented in [`docs/deploy/entra-app-registration.md`](deploy/entra-app-registration.md) §7. Being an admin does **not** change how you log in — you still sign in with your normal M365 account.

### 2. Open the admin area

1. Sign in normally at <https://namecard.example.com/me>.
2. Click **Admin** in the top‑right of the _My card_ page (visible only to admins), or go directly to <https://namecard.example.com/admin>.

### 3. Find a staff card

The **Staff cards** page lists staff cards in a table with **Staff** (name + email), **Department**, **Status**, and an **Action** button.

- Use the **search box** to filter by name, email, or department, then click **Search**.
- Click a person's name to open their **public card** in a new tab (useful for confirming you have the right person before acting).

### 4. Disable or enable a card

Each row shows a status badge and a matching button:

| Status             | Meaning                                                                              | Button      |
| ------------------ | ------------------------------------------------------------------------------------ | ----------- |
| **Active** (green) | The card's public page resolves normally and can be scanned/shared.                  | **Disable** |
| **Disabled** (red) | The public page, `.vcf` download, and photo **stop resolving** (visitors get a 404). | **Enable**  |

- **When someone leaves the company:** find their card and click **Disable**. Their public link immediately stops working.
- **To bring a card back:** click **Enable** on a disabled row.

> Disabling only affects the **public** card. It does not delete the person's data, and it does not touch anything in Microsoft 365.

### 5. What is (and isn't) an admin task

**Admins can:**

- Search all staff cards.
- Disable a card (e.g. staff departure) and re‑enable it.

**Admins cannot / don't need to:**

- **Edit another person's card content** — each staff member manages their own fields and photo on their own _My card_ page.
- **Create cards manually** — a card is created automatically the first time a staff member signs in (their directory profile is pre‑filled then).
- **Manage passwords** — all authentication is handled by Microsoft 365.

### 6. Audit trail

For accountability, the system writes a server‑side log line for security‑relevant admin activity:

- Every time a card is **disabled or enabled** (recording which admin did it and which card).
- Every **denied attempt** to reach the admin area.

These lines are prefixed `ADMIN_AUDIT` in the application logs and never contain passwords or tokens. If you need to review them, ask whoever operates the production server (see [`docs/deploy/production-guide.md`](deploy/production-guide.md)).

---

## Quick reference

| I want to…                              | Where                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| Sign in / edit my card                  | `/me`                                                                              |
| Show / share my QR code                 | `/<my-email-name>` (my public card)                                                |
| Download my contact file                | **Download contact (.vcf)** on my public card                                      |
| Open the admin area (admins only)       | `/admin`                                                                           |
| Disable a departing staff member's card | `/admin` → find them → **Disable**                                                 |
| Become / stop being an admin            | IT adds/removes you from the **`eNamecard Admins`** M365 group, then sign in again |
