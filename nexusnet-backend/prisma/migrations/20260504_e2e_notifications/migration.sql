-- ============================================================
-- Migration: E2E Public Keys + Notification Preferences
-- ============================================================

-- ---------------------------------------------------------------
-- 1. UserPublicKey — stores participants' X25519 public keys
--    One row per (userId, conversationId).  A user may have many
--    conversations, each with an independent ephemeral key-pair.
-- ---------------------------------------------------------------
CREATE TABLE "UserPublicKey" (
  "id"             TEXT          NOT NULL,
  "userId"         TEXT          NOT NULL,
  "conversationId" TEXT          NOT NULL,
  -- Base64-encoded X25519 public key (32 raw bytes → 44 b64 chars)
  "publicKey"      VARCHAR(64)   NOT NULL,
  "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserPublicKey_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserPublicKey_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserPublicKey_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE,
  CONSTRAINT "UserPublicKey_userId_conversationId_key"
    UNIQUE ("userId", "conversationId")
);

CREATE INDEX "UserPublicKey_userId_idx"         ON "UserPublicKey"("userId");
CREATE INDEX "UserPublicKey_conversationId_idx" ON "UserPublicKey"("conversationId");

-- ---------------------------------------------------------------
-- 2. NotificationPreference — per-user, per-type opt-in/out
--    Allows users to silence specific notification types.
-- ---------------------------------------------------------------
CREATE TABLE "NotificationPreference" (
  "id"       TEXT          NOT NULL,
  "userId"   TEXT          NOT NULL,
  -- Mirrors the NotificationType enum
  "type"     TEXT          NOT NULL,
  -- true = receive this type; false = muted
  "enabled"  BOOLEAN       NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "NotificationPreference_userId_type_key"
    UNIQUE ("userId", "type")
);

CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- ---------------------------------------------------------------
-- 3. Extend Message — store encrypted payload alongside content
--    We add three nullable columns so that:
--      • Legacy unencrypted messages (isEncrypted = false) keep content as-is.
--      • New E2E messages set isEncrypted = true, store NULL in content,
--        and persist iv/ciphertext/authTag in encryptedPayload.
-- ---------------------------------------------------------------
ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "encryptedPayload" TEXT;   -- serialised EncryptedPayload
  -- isEncrypted already exists in the schema (default true)

-- ---------------------------------------------------------------
-- 4. Add REPLY notification type if not already present
--    (safe no-op if the enum already includes REPLY)
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'REPLY'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'REPLY';
  END IF;
END$$;

-- ---------------------------------------------------------------
-- 5. Add COMMENT_LIKE notification type
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'COMMENT_LIKE'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'COMMENT_LIKE';
  END IF;
END$$;
