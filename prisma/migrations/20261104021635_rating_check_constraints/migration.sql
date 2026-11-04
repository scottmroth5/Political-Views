-- Defense in depth: user ratings are 1-5 and model confidence is 0-1.
-- The domain layer validates these too; the database refuses anything else.
ALTER TABLE "Response"
  ADD CONSTRAINT "Response_importance_range" CHECK ("importance" IS NULL OR "importance" BETWEEN 1 AND 5);

ALTER TABLE "Belief"
  ADD CONSTRAINT "Belief_importance_range" CHECK ("importance" IS NULL OR "importance" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Belief_conviction_range" CHECK ("conviction" IS NULL OR "conviction" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Belief_extraction_confidence_range"
    CHECK ("extractionConfidence" IS NULL OR "extractionConfidence" BETWEEN 0 AND 1);

-- A guided answer that was skipped must not retain content.
ALTER TABLE "Response"
  ADD CONSTRAINT "Response_skip_has_no_content"
    CHECK ("outcome" <> 'SKIPPED' OR ("choiceValue" IS NULL AND "text" IS NULL AND "importance" IS NULL));
