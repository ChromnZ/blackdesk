import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    return null;
  }

  return createHash("sha256").update(secret).digest();
}

export function canEncryptSecrets() {
  return Boolean(getEncryptionKey());
}

export function encryptSecret(plaintext: string) {
  const key = getEncryptionKey();
  if (!key) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string | null | undefined) {
  if (!payload) {
    return null;
  }

  const key = getEncryptionKey();
  if (!key) {
    return null;
  }

  const [ivB64, authTagB64, dataB64] = payload.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) {
    return null;
  }

  try {
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const encrypted = Buffer.from(dataB64, "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
