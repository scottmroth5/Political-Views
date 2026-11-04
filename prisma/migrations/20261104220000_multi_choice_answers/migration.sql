-- Allow multi-select questions and store selections as an array.
ALTER TYPE "ResponseType" ADD VALUE 'MULTI_CHOICE';

ALTER TABLE "Response" ADD COLUMN "choiceValues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Preserve existing single-choice answers.
UPDATE "Response" SET "choiceValues" = ARRAY["choiceValue"] WHERE "choiceValue" IS NOT NULL;

ALTER TABLE "Response" DROP CONSTRAINT "Response_skip_has_no_content";
ALTER TABLE "Response" DROP COLUMN "choiceValue";

-- A guided answer that was skipped must not retain content.
ALTER TABLE "Response"
  ADD CONSTRAINT "Response_skip_has_no_content"
    CHECK ("outcome" <> 'SKIPPED' OR (cardinality("choiceValues") = 0 AND "text" IS NULL AND "importance" IS NULL));
