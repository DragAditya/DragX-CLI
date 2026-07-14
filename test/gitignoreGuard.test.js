import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureGitignore } from '../src/context/gitignoreGuard.js';

test('ensureGitignore creates file with required entries on first run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dragx-test-'));
  const originalCwd = process.cwd();
  process.chdir(dir);

  try {
    const changed = ensureGitignore();
    assert.equal(changed, true);

    const content = readFileSync(join(dir, '.gitignore'), 'utf-8');
    assert.match(content, /\.dragx\//);
    assert.match(content, /node_modules\//);
    assert.match(content, /\.env/);
  } finally {
    process.chdir(originalCwd);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureGitignore does not report a change on second run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dragx-test-'));
  const originalCwd = process.cwd();
  process.chdir(dir);

  try {
    ensureGitignore();
    const secondRunChanged = ensureGitignore();
    assert.equal(secondRunChanged, false);
  } finally {
    process.chdir(originalCwd);
    rmSync(dir, { recursive: true, force: true });
  }
});
