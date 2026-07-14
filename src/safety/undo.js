import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';

const SNAPSHOT_DIR = join(process.cwd(), '.dragx', 'snapshots');
const LAST_SNAPSHOT_POINTER = join(process.cwd(), '.dragx', 'last-snapshot.json');

/**
 * Takes a snapshot before running a destructive step:
 * - records current git HEAD commit hash (for git-based undo)
 * - copies any file paths mentioned in the command (best-effort file backup)
 */
function createSnapshot(step) {
  if (!existsSync(SNAPSHOT_DIR)) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }

  const timestamp = Date.now();
  const snapshotPath = join(SNAPSHOT_DIR, String(timestamp));
  mkdirSync(snapshotPath, { recursive: true });

  let headCommit = null;
  let stashRef = null;
  try {
    headCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    // Extra safety net: snapshot the full working tree state via git stash create.
    // This works even when extractPathsFromCommand can't parse wildcards, spaces,
    // or complex flags — git already knows exactly what's tracked/modified.
    const stashResult = execSync('git stash create', { encoding: 'utf-8' }).trim();
    if (stashResult) {
      stashRef = stashResult;
      execSync(`git stash store -m "dragx-auto-snapshot-${timestamp}" ${stashRef}`);
    }
  } catch {
    // not a git repo, no commits yet, or nothing to stash — that's fine,
    // the file-copy backup below still runs as a fallback
  }

  // best-effort: extract simple file/dir paths from the command and back them up
  const possiblePaths = extractPathsFromCommand(step.command);
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      try {
        cpSync(p, join(snapshotPath, p.replace(/^\.\//, '')), { recursive: true });
      } catch {
        // skip files that can't be copied (permissions, etc.)
      }
    }
  }

  const record = { timestamp, step, headCommit, stashRef, snapshotPath };
  writeFileSync(LAST_SNAPSHOT_POINTER, JSON.stringify(record, null, 2), 'utf-8');
  return record;
}

/**
 * Very simple path extraction — pulls out likely file/folder args from an rm/mv command.
 * Not bulletproof, but good enough for a best-effort backup layer.
 */
function extractPathsFromCommand(command) {
  const tokens = command.split(' ').filter(Boolean);
  return tokens.filter(
    (t) => !t.startsWith('-') && (t.includes('/') || t.includes('.')) && t !== 'rm' && t !== 'mv'
  );
}

/**
 * Reverts to the last recorded snapshot: restores backed-up files and
 * resets git to the recorded HEAD commit if one was saved.
 */
function undoLast() {
  if (!existsSync(LAST_SNAPSHOT_POINTER)) {
    console.log(chalk.yellow('No snapshot found to undo.'));
    return false;
  }

  const record = JSON.parse(readFileSync(LAST_SNAPSHOT_POINTER, 'utf-8'));

  // restore files from snapshot folder back to cwd (best-effort file-copy layer)
  if (existsSync(record.snapshotPath)) {
    cpSync(record.snapshotPath, process.cwd(), { recursive: true });
  }

  // reset git if we had a HEAD recorded and it differs from current
  if (record.headCommit) {
    try {
      execSync(`git reset --hard ${record.headCommit}`, { stdio: 'ignore' });
    } catch {
      console.log(chalk.yellow('Could not reset git — files were restored where possible.'));
    }
  }

  // apply the stashed working-tree state on top, if one was recorded —
  // this is the more reliable layer for wildcard/complex-path changes
  if (record.stashRef) {
    try {
      execSync(`git stash apply ${record.stashRef}`, { stdio: 'ignore' });
      console.log(chalk.gray('(Also restored uncommitted working-tree changes from stash)'));
    } catch {
      // stash may already be gone or conflict — file-copy layer is the fallback
    }
  }

  console.log(chalk.green(`Reverted: "${record.step.description}"`));
  return true;
}

export { createSnapshot, undoLast };
