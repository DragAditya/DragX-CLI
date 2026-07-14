import { execSync } from 'node:child_process';

/**
 * Runs a shell command safely and returns trimmed stdout, or empty string on failure.
 */
function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() }).trim();
  } catch {
    return '';
  }
}

/**
 * Scans the current directory for git status and a shallow file tree.
 * Returns a context string to feed the AI.
 */
function scanRepo() {
  const isGitRepo = safeExec('git rev-parse --is-inside-work-tree') === 'true';

  if (!isGitRepo) {
    return {
      isGitRepo: false,
      contextText: 'Not inside a git repository. No git-based actions are possible here.',
    };
  }

  const status = safeExec('git status --short') || '(clean — no changes)';
  const branch = safeExec('git branch --show-current') || 'unknown';
  const remotes = safeExec('git remote -v') || '(no remotes configured)';
  const rawFileTree = safeExec(
    'find . -maxdepth 3 -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.dragx/*" -type f'
  );
  const recentCommits = safeExec('git log --oneline -5') || '(no commits yet)';

  // Cap file tree to first 200 entries — large repos (or a missed node_modules
  // exclusion) could otherwise blow up the AI context and waste tokens/quota.
  const fileTreeLines = rawFileTree.split('\n').filter(Boolean);
  const fileTree =
    fileTreeLines.length > 200
      ? `${fileTreeLines.slice(0, 200).join('\n')}\n... [truncated — ${fileTreeLines.length} files total, showing first 200]`
      : rawFileTree;

  const contextText = [
    `Current branch: ${branch}`,
    `Git remotes:\n${remotes}`,
    `Git status:\n${status}`,
    `Recent commits:\n${recentCommits}`,
    `File tree (depth 3, excluding node_modules/.dragx):\n${fileTree}`,
  ].join('\n\n');

  return { isGitRepo: true, branch, status, remotes, fileTree, recentCommits, contextText };
}

export { scanRepo };
