import crypto from "node:crypto"

// AES-256-GCM helpers for storing user secrets (like their OpenAI API
// key) in Supabase without keeping them readable at rest. The
// encryption key lives only in the server environment.

function encryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY
  if (!raw) {
    throw new Error("APP_ENCRYPTION_KEY is missing from the environment.")
  }
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded.")
  }
  return key
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64")
}

export function decryptSecret(payload: string): string {
  const buffer = Buffer.from(payload, "base64")
  const iv = buffer.subarray(0, 12)
  const authTag = buffer.subarray(12, 28)
  const data = buffer.subarray(28)
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  )
}
