import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { env, org } from "@/config";
import { avatarUrl } from "@/features/card/avatarUrl";
import { getPublicCardBySlug } from "@/features/card/repository";
import { parseSlug } from "@/features/card/slug";
import { buildQrCodeOptions } from "@/features/qr";
import { resolveCompanyDefaults } from "@/features/vcard/companyDefaults";
import { QrCard } from "./QrCard";

interface CardPageProps {
  params: Promise<{ slug: string }>;
}

// Deduplicated per request so generateMetadata + the page share one DB query.
const loadCard = cache(async (rawSlug: string) => {
  const slug = parseSlug(rawSlug);
  if (!slug) {
    return null;
  }
  return getPublicCardBySlug(slug);
});

// Defense-in-depth guards for values rendered into hrefs (staff-editable in Step 6).
function isSafeWebsite(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
function isSafeEmail(email: string): boolean {
  return /^[^\s?&,<>"']+@[^\s?&,<>"']+$/.test(email);
}
function isSafePhone(phone: string): boolean {
  return /^[+()\-\s\d]+$/.test(phone);
}

export async function generateMetadata({ params }: CardPageProps): Promise<Metadata> {
  const { slug } = await params;
  const card = await loadCard(slug);
  if (!card) {
    return { title: `Card not found — ${org.appName}` };
  }
  return { title: `${card.displayName ?? "Staff member"} — ${org.appName}` };
}

// A single labelled contact row in the details list. Renders nothing when the
// value is absent so the list stays tight.
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-100 py-2 last:border-b-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-0.5 break-words text-neutral-900">{children}</dd>
    </div>
  );
}

export default async function CardPage({ params }: CardPageProps) {
  const { slug: rawSlug } = await params;
  const slug = parseSlug(rawSlug);
  if (!slug) {
    notFound();
  }
  const card = await loadCard(rawSlug);
  if (!card) {
    notFound();
  }

  // Photo is served by the public `/avatar/<slug>` endpoint and referenced by
  // URL — in the QR payload (short URL, still scannable) and the on-page <img>.
  const photoUrl = card.hasPhoto ? avatarUrl(env.AUTH_URL, slug) : undefined;
  const qrOptions = buildQrCodeOptions(card, photoUrl);
  // Resolve address/website the same way the vCard/QR do, so the printed page
  // and the scanned card never disagree on company defaults (L-2).
  const { address, website } = resolveCompanyDefaults(card);
  const orgLine = [card.department, card.company].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <article className="card overflow-hidden">
        <div className="flex flex-col items-center bg-gradient-to-b from-brand-50 to-white px-6 pb-6 pt-8 text-center">
          {card.hasPhoto && (
            // eslint-disable-next-line @next/next/no-img-element -- same-origin dynamic route, not a statically optimizable image
            <img
              src={`/avatar/${slug}`}
              alt={card.displayName ?? "Staff photo"}
              width={120}
              height={120}
              className="h-28 w-28 rounded-full object-cover shadow-sm ring-4 ring-white"
            />
          )}
          <h1 className="mt-4 text-xl font-bold tracking-tight text-neutral-900">
            {card.displayName ?? "Staff member"}
          </h1>
          {card.jobTitle && <p className="mt-1 text-sm text-neutral-600">{card.jobTitle}</p>}
          {orgLine && <p className="text-sm text-neutral-600">{orgLine}</p>}
        </div>

        <div className="px-6 pb-6">
          <dl className="text-sm">
            {card.email && (
              <DetailRow label="Email">
                {isSafeEmail(card.email) ? (
                  <a className="text-brand-700 hover:underline" href={`mailto:${card.email}`}>
                    {card.email}
                  </a>
                ) : (
                  card.email
                )}
              </DetailRow>
            )}
            {card.businessPhone && (
              <DetailRow label="Office">
                {isSafePhone(card.businessPhone) ? (
                  <a className="text-brand-700 hover:underline" href={`tel:${card.businessPhone}`}>
                    {card.businessPhone}
                  </a>
                ) : (
                  card.businessPhone
                )}
              </DetailRow>
            )}
            {card.mobilePhone && (
              <DetailRow label="Mobile">
                {isSafePhone(card.mobilePhone) ? (
                  <a className="text-brand-700 hover:underline" href={`tel:${card.mobilePhone}`}>
                    {card.mobilePhone}
                  </a>
                ) : (
                  card.mobilePhone
                )}
              </DetailRow>
            )}
            {card.faxNumber && (
              <DetailRow label="Fax">
                {isSafePhone(card.faxNumber) ? (
                  <a className="text-brand-700 hover:underline" href={`tel:${card.faxNumber}`}>
                    {card.faxNumber}
                  </a>
                ) : (
                  card.faxNumber
                )}
              </DetailRow>
            )}
            {card.officeLocation && <DetailRow label="Location">{card.officeLocation}</DetailRow>}
            {address && <DetailRow label="Address">{address}</DetailRow>}
            {website && isSafeWebsite(website) && (
              <DetailRow label="Website">
                <a
                  className="text-brand-700 hover:underline"
                  href={website}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {website}
                </a>
              </DetailRow>
            )}
          </dl>

          <div className="mt-6 rounded-xl bg-neutral-50 p-4">
            <QrCard options={qrOptions} />
            <p className="mt-2 text-center text-xs text-neutral-500">
              Scan with your phone camera to add this contact.
            </p>
          </div>

          <a href={`/${slug}.vcf`} download className="btn btn-primary mt-4 w-full">
            Download contact (.vcf)
          </a>
        </div>
      </article>
    </main>
  );
}
