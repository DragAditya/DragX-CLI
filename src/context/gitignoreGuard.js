import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED_ENTRIES = ['.dragx/', 'node_modules/', '.env'];

function getGitignorePath() {
  return join(process.cwd(), '.gitignore');
}

/**
 * Ensures .gitignore exists and contains the required entries so that
 * internal dragx state (.dragx/), dependencies, and secrets never get
 * accidentally staged or committed.
 * Runs BEFORE every plan is generated, unconditionally — not optional.
 */
function ensureGitignore() {
  const gitignorePath = getGitignorePath();
  let existing = '';
  if (existsSync(gitignorePath)) {
    existing = readFileSync(gitignorePath, 'utf-8');
  }

  const missing = REQUIRED_ENTRIES.filter((entry) => !existing.includes(entry));
  if (missing.length === 0) return false; // nothing to change

  const updated = existing.trim().length > 0
    ? `${existing.trim()}\n${missing.join('\n')}\n`
    : `${missing.join('\n')}\n`;

  writeFileSync(gitignorePath, updated, 'utf-8');
  return true; // signals that .gitignore was created/updated
}

export { ensureGitignore, REQUIRED_ENTRIES };
