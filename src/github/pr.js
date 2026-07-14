import { execSync, execFileSync } from 'node:child_process';
import { ask } from '../ai/client.js';

const PR_SYSTEM_PROMPT = `You write concise, professional GitHub pull request descriptions based on a git diff or commit log summary. Respond in plain markdown (not JSON) with a short "## Summary" section (2-4 bullet points) and, if relevant, a "## Notes" section. Do not include a title.`;

/**
 * Checks if GitHub CLI (gh) is installed and authenticated.
 */
function isGhAvailable() {
  try {
    execSync('gh auth status', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a PR description from recent commit log using AI,
 * then creates the PR via `gh pr create`.
 * Uses execFileSync with an argument array (not a shell string) so titles
 * or descriptions containing quotes, backticks, or "$()" can never be
 * interpreted as shell syntax — this closes a command-injection risk.
 */
async function createPR(title) {
  if (!isGhAvailable()) {
    throw new Error(
      'GitHub CLI (gh) is not installed or not authenticated. Install it and run "gh auth login" first.'
    );
  }

  const recentLog = execSync('git log --oneline -10', { encoding: 'utf-8' }).trim();
  const description = await ask(PR_SYSTEM_PROMPT, `Recent commits:\n${recentLog}`);

  const result = execFileSync(
    'gh',
    ['pr', 'create', '--title', title, '--body', description],
    { encoding: 'utf-8' }
  );

  return result.trim();
}

export { createPR, isGhAvailable };
