-- CreateTable
CREATE TABLE "UserLlmSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "openaiApiKeyEnc" TEXT,
    "anthropicApiKeyEnc" TEXT,
    "googleApiKeyEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLlmSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLlmSettings_userId_key" ON "UserLlmSettings"("userId");

-- AddForeignKey
ALTER TABLE "UserLlmSettings" ADD CONSTRAINT "UserLlmSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;