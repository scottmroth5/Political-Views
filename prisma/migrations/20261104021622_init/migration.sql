-- CreateEnum
CREATE TYPE "DiscoveryMode" AS ENUM ('GUIDED', 'CONVERSATION');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ResponseType" AS ENUM ('SINGLE_CHOICE', 'FREE_TEXT');

-- CreateEnum
CREATE TYPE "ResponseOutcome" AS ENUM ('ANSWERED', 'SKIPPED', 'UNSURE');

-- CreateEnum
CREATE TYPE "EditorialStatus" AS ENUM ('DRAFT', 'REVIEWED');

-- CreateEnum
CREATE TYPE "BeliefStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RevisionActor" AS ENUM ('USER', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoverySession" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "tokenHash" TEXT NOT NULL,
    "mode" "DiscoveryMode" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueCategory" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "IssueCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "topicId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanationPrompt" TEXT,
    "responseType" "ResponseType" NOT NULL,
    "choices" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "editorialStatus" "EditorialStatus" NOT NULL DEFAULT 'DRAFT',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "questionId" UUID,
    "questionVersion" INTEGER,
    "mode" "DiscoveryMode" NOT NULL,
    "outcome" "ResponseOutcome" NOT NULL,
    "choiceValue" TEXT,
    "text" TEXT,
    "importance" INTEGER,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Belief" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "topicId" UUID,
    "position" TEXT NOT NULL,
    "nuance" TEXT,
    "status" "BeliefStatus" NOT NULL DEFAULT 'SUGGESTED',
    "importance" INTEGER,
    "conviction" INTEGER,
    "extractionConfidence" DOUBLE PRECISION,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Belief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeliefEvidence" (
    "id" UUID NOT NULL,
    "beliefId" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "supportingExcerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeliefEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeliefRevision" (
    "id" UUID NOT NULL,
    "beliefId" UUID NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB NOT NULL,
    "actor" "RevisionActor" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeliefRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileSnapshot" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "summary" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverySession_tokenHash_key" ON "DiscoverySession"("tokenHash");

-- CreateIndex
CREATE INDEX "DiscoverySession_userId_idx" ON "DiscoverySession"("userId");

-- CreateIndex
CREATE INDEX "DiscoverySession_expiresAt_idx" ON "DiscoverySession"("expiresAt");

-- CreateIndex
CREATE INDEX "DiscoverySession_status_idx" ON "DiscoverySession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IssueCategory_slug_key" ON "IssueCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_categoryId_idx" ON "Topic"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_slug_key" ON "Question"("slug");

-- CreateIndex
CREATE INDEX "Question_topicId_idx" ON "Question"("topicId");

-- CreateIndex
CREATE INDEX "Question_active_editorialStatus_idx" ON "Question"("active", "editorialStatus");

-- CreateIndex
CREATE INDEX "Response_sessionId_createdAt_idx" ON "Response"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Response_sessionId_questionId_key" ON "Response"("sessionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_sessionId_idempotencyKey_key" ON "Response"("sessionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Belief_sessionId_status_idx" ON "Belief"("sessionId", "status");

-- CreateIndex
CREATE INDEX "Belief_topicId_idx" ON "Belief"("topicId");

-- CreateIndex
CREATE INDEX "BeliefEvidence_responseId_idx" ON "BeliefEvidence"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "BeliefEvidence_beliefId_responseId_key" ON "BeliefEvidence"("beliefId", "responseId");

-- CreateIndex
CREATE INDEX "BeliefRevision_beliefId_createdAt_idx" ON "BeliefRevision"("beliefId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileSnapshot_sessionId_generatedAt_idx" ON "ProfileSnapshot"("sessionId", "generatedAt");

-- AddForeignKey
ALTER TABLE "DiscoverySession" ADD CONSTRAINT "DiscoverySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IssueCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Belief" ADD CONSTRAINT "Belief_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Belief" ADD CONSTRAINT "Belief_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeliefEvidence" ADD CONSTRAINT "BeliefEvidence_beliefId_fkey" FOREIGN KEY ("beliefId") REFERENCES "Belief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeliefEvidence" ADD CONSTRAINT "BeliefEvidence_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeliefRevision" ADD CONSTRAINT "BeliefRevision_beliefId_fkey" FOREIGN KEY ("beliefId") REFERENCES "Belief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSnapshot" ADD CONSTRAINT "ProfileSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
