export interface StaffCardFixture {
  entraObjectId: string;
  emailSlug: string;
  activated: boolean;
  disabled: boolean;
  displayName: string;
  jobTitle: string;
  department: string;
  company: string;
  email: string;
}

// Local dev / test fixtures only — never real staff data. Keyed by
// entraObjectId so re-seeding is an idempotent upsert (see seedStaffCards.ts).
export const STAFF_CARD_FIXTURES: readonly StaffCardFixture[] = [
  {
    entraObjectId: "00000000-0000-0000-0000-000000000001",
    emailSlug: "jane.tan",
    activated: true,
    disabled: false,
    displayName: "Jane Tan",
    jobTitle: "Marketing Executive",
    department: "Marketing",
    company: "Example Org",
    email: "jane.tan@example.com",
  },
  {
    entraObjectId: "00000000-0000-0000-0000-000000000002",
    emailSlug: "ahmad.zulkifli",
    activated: true,
    disabled: true,
    displayName: "Ahmad Zulkifli",
    jobTitle: "Former Sales Manager",
    department: "Sales",
    company: "Example Org",
    email: "ahmad.zulkifli@example.com",
  },
];
