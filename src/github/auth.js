import { existsSync, mkdirSync, writeFileSync, readFileSync, chmodSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';

// Stored in the user's home dir (not the project repo) so it's never
// accidentally committed or pushed, and persists across projects.
const AUTH_DIR = join(homedir(), '.dragx');
const AUTH_FILE = join(AUTH_DIR, 'auth.enc');
const KEY_FILE = join(AUTH_DIR, '.keyfile'); // separate from encrypted data on purpose

const ALGO = 'aes-256-cbc';

function ensureAuthDir() {
  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true });
  }
}

/**
 * Gets (or generates on first use) a random 32-byte encryption key,
 * stored in its own file separate from the encrypted credentials.
 * This is real randomness — not derived from any guessable/public value
 * like the home directory path — and the key file itself is permission-
 * restricted (owner-only) as a second layer.
 */
function getOrCreateKey() {
  ensureAuthDir();

  if (existsSync(KEY_FILE)) {
    return Buffer.from(readFileSync(KEY_FILE, 'utf-8'), 'hex');
  }

  const key = randomBytes(32);
  writeFileSync(KEY_FILE, key.toString('hex'), 'utf-8');
  try {
    chmodSync(KEY_FILE, 0o600);
  } catch {
    // some filesystems (Termux/Android) may not fully support chmod — best-effort
  }
  return key;
}

/**
 * Encrypts and saves the GitHub token + username locally.
 */
function saveCredentials({ username, token }) {
  ensureAuthDir();
  const key = getOrCreateKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, key, iv);

  const payload = JSON.stringify({ username, token, savedAt: new Date().toISOString() });
  const encrypted = Buffer.concat([cipher.update(payload, 'utf-8'), cipher.final()]);

  const fileContents = JSON.stringify({ iv: iv.toString('hex'), data: encrypted.toString('hex') });
  writeFileSync(AUTH_FILE, fileContents, 'utf-8');

  // restrict file permissions to owner-only read/write (best-effort — no-op on some platforms)
  try {
    chmodSync(AUTH_FILE, 0o600);
  } catch {
    // Termux/Android or some filesystems may not support chmod fully — safe to ignore
  }
}

/**
 * Loads and decrypts stored credentials, or returns null if none saved.
 */
function loadCredentials() {
  if (!existsSync(AUTH_FILE)) return null;

  try {
    const key = getOrCreateKey();
    const fileContents = JSON.parse(readFileSync(AUTH_FILE, 'utf-8'));
    const iv = Buffer.from(fileContents.iv, 'hex');
    const encrypted = Buffer.from(fileContents.data, 'hex');

    const decipher = createDecipheriv(ALGO, key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return JSON.parse(decrypted.toString('utf-8'));
  } catch {
    return null; // corrupted or unreadable — treat as not logged in
  }
}

/**
 * Deletes stored credentials.
 */
function clearCredentials() {
  if (existsSync(AUTH_FILE)) {
    try {
      writeFileSync(AUTH_FILE, ''); // overwrite before removal
      unlinkSync(AUTH_FILE);
    } catch {
      // already gone or permission issue — safe to ignore
    }
  }
  if (existsSync(KEY_FILE)) {
    try {
      unlinkSync(KEY_FILE);
    } catch {
      // safe to ignore
    }
  }
}

function isLoggedIn() {
  return loadCredentials() !== null;
}

export { saveCredentials, loadCredentials, clearCredentials, isLoggedIn, AUTH_FILE };
