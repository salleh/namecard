-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "staff_cards" (
    "id" TEXT NOT NULL,
    "entraObjectId" TEXT NOT NULL,
    "emailSlug" TEXT NOT NULL,
    "activated" BOOLEAN NOT NULL DEFAULT false,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "givenName" TEXT,
    "surname" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "company" TEXT,
    "email" TEXT,
    "businessPhone" TEXT,
    "mobilePhone" TEXT,
    "faxNumber" TEXT,
    "officeLocation" TEXT,
    "address" TEXT,
    "website" TEXT,
    "photo" BYTEA,
    "graphSnapshot" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_cards_entraObjectId_key" ON "staff_cards"("entraObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_cards_emailSlug_key" ON "staff_cards"("emailSlug");

