import { execSync } from 'node:child_process';
import { loadCredentials } from './auth.js';

/**
 * Checks whether the current repo has a configured remote named 'origin'.
 */
function hasRemote() {
  try {
    const remotes = execSync('git remote', { encoding: 'utf-8' }).trim();
    return remotes.split('\n').includes('origin');
  } catch {
    return false;
  }
}

function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Creates a new GitHub repository directly via the GitHub REST API,
 * using the token saved via "dragx login". No gh CLI dependency needed.
 *
 * @param {string} repoName
 * @param {{ isPrivate?: boolean }} options
 * @returns {Promise<{ htmlUrl: string, cloneUrl: string }>}
 */
async function createRemoteRepo(repoName, { isPrivate = false } = {}) {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Not logged in. Run "dragx login" first to save your GitHub token.');
  }

  const response = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: repoName, private: isPrivate }),
  });

  const data = await response.json();

  if (!response.ok) {
    // Surface GitHub's own error message (e.g. "name already exists on this account")
    throw new Error(data.message || `GitHub API returned status ${response.status}`);
  }

  return { htmlUrl: data.html_url, cloneUrl: data.clone_url };
}

/**
 * Checks whether a repo with this name already exists under the logged-in user.
 */
async function repoExists(repoName) {
  const creds = loadCredentials();
  if (!creds) return false;

  const response = await fetch(`https://api.github.com/repos/${creds.username}/${repoName}`, {
    headers: {
      Authorization: `Bearer ${creds.token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  return response.status === 200;
}

export { hasRemote, getCurrentBranch, createRemoteRepo, repoExists };
