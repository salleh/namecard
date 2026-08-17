-- CreateTable
CREATE TABLE "field_locks" (
    "field" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_locks_pkey" PRIMARY KEY ("field")
);
