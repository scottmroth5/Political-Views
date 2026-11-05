-- Questions live in the database and are managed by the admin: added, reviewed, archived or
-- copied, never edited or deleted (docs/decisions.md D-025).

ALTER TABLE "Question"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "copiedFromId" UUID,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- Carry over: inactive questions become archived; reviewed ones get a review time.
UPDATE "Question" SET "archivedAt" = CURRENT_TIMESTAMP WHERE "active" = false;
UPDATE "Question" SET "reviewedAt" = CURRENT_TIMESTAMP WHERE "editorialStatus" = 'REVIEWED';

DROP INDEX "Question_active_editorialStatus_idx";
ALTER TABLE "Question" DROP COLUMN "active";

CREATE INDEX "Question_archivedAt_editorialStatus_idx" ON "Question"("archivedAt", "editorialStatus");
CREATE INDEX "Question_copiedFromId_idx" ON "Question"("copiedFromId");
ALTER TABLE "Question" ADD CONSTRAINT "Question_copiedFromId_fkey"
  FOREIGN KEY ("copiedFromId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reviewed status and its time go together.
ALTER TABLE "Question" ADD CONSTRAINT "Question_reviewed_has_time"
  CHECK (("editorialStatus" = 'REVIEWED') = ("reviewedAt" IS NOT NULL));

-- Immutability: a question's content never changes and rows are never deleted. Archiving and
-- reviewing are one-way. Anything else is refused by the database itself, whatever the app does.
CREATE FUNCTION "question_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Questions cannot be deleted; archive them instead'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."slug" IS DISTINCT FROM OLD."slug"
     OR NEW."topicId" IS DISTINCT FROM OLD."topicId"
     OR NEW."prompt" IS DISTINCT FROM OLD."prompt"
     OR NEW."explanationPrompt" IS DISTINCT FROM OLD."explanationPrompt"
     OR NEW."responseType" IS DISTINCT FROM OLD."responseType"
     OR NEW."choices" IS DISTINCT FROM OLD."choices"
     OR NEW."version" IS DISTINCT FROM OLD."version"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR NEW."copiedFromId" IS DISTINCT FROM OLD."copiedFromId" THEN
    RAISE EXCEPTION 'Questions cannot be edited; copy the question and archive the original'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD."archivedAt" IS NOT NULL AND NEW."archivedAt" IS DISTINCT FROM OLD."archivedAt" THEN
    RAISE EXCEPTION 'Archived questions stay archived'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD."reviewedAt" IS NOT NULL AND NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt" THEN
    RAISE EXCEPTION 'A review cannot be withdrawn; archive the question instead'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Question_immutable"
  BEFORE UPDATE OR DELETE ON "Question"
  FOR EACH ROW EXECUTE FUNCTION "question_immutable"();

CREATE TABLE "AdminSession" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

CREATE TABLE "AdminLoginFailure" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminLoginFailure_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminLoginFailure_createdAt_idx" ON "AdminLoginFailure"("createdAt");
