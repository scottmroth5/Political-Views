-- Guided answers become suggested beliefs, one per selected choice. The choice is recorded on the
-- evidence row, and the unique index stops a choice from producing two beliefs (NULLs, used by
-- conversation evidence, never collide).
-- AlterTable
ALTER TABLE "BeliefEvidence" ADD COLUMN     "choiceValue" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BeliefEvidence_responseId_choiceValue_key" ON "BeliefEvidence"("responseId", "choiceValue");

