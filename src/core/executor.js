import { execSync, spawnSync } from 'node:child_process';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { confirmStep } from '../safety/confirm.js';
import { createSnapshot } from '../safety/undo.js';
import { suggestFix } from '../utils/errorHandler.js';
import { createRemoteRepo, repoExists } from '../github/push.js';
import * as log from '../utils/logger.js';

const MAX_FIX_ATTEMPTS = 2; // avoid infinite retry loops on stubborn failures

/**
 * Handles the special "dragx:create_remote_repo" pseudo-command by calling
 * the GitHub API directly (via our own stored token) instead of shelling out.
 * Always asks the user to confirm/edit the repo name first — never guesses
 * or silently picks one, since a wrong repo name is hard to walk back.
 */
async function handleCreateRemoteRepo(step) {
  const folderDefault = process.cwd().split('/').pop();

  const { repoName, isPrivate } = await inquirer.prompt([
    { type: 'input', name: 'repoName', message: 'Repo name:', default: folderDefault },
    { type: 'confirm', name: 'isPrivate', message: 'Make it private?', default: false },
  ]);

  const exists = await repoExists(repoName);
  if (exists) {
    log.warn(`Repo "${repoName}" already exists on GitHub — skipping creation, will just push.`);
    return { alreadyExisted: true, repoName };
  }

  const { cloneUrl } = await createRemoteRepo(repoName, { isPrivate });
  execSync(`git remote add origin ${cloneUrl}`, { cwd: process.cwd() });
  log.success(`Created "${repoName}" and linked as origin`);
  return { alreadyExisted: false, repoName, cloneUrl };
}

/**
 * Runs a single shell command. Uses inherited stdio (so the user can type
 * directly into things like "gh auth login") when interactive is true,
 * otherwise captures output normally.
 */
function runCommand(command, interactive = false) {
  if (interactive) {
    const result = spawnSync(command, {
      shell: true,
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    if (result.status !== 0) {
      const err = new Error(`Interactive command exited with code ${result.status}`);
      err.stderr = '';
      throw err;
    }
    return '';
  }
  return execSync(command, { encoding: 'utf-8', cwd: process.cwd() });
}

/**
 * Attempts to auto-heal a failed step: asks the AI for a fix, confirms with
 * the user, runs the fix (interactively if needed), then retries the
 * original command. Recurses up to MAX_FIX_ATTEMPTS times.
 */
/**
 * Basic heuristic to detect if a fix command is itself destructive,
 * reusing the same pattern the planner uses for regular steps.
 */
const DESTRUCTIVE_PATTERN = /rm |delete|force|reset --hard|push -f|uninstall/;

async function attemptAutoFix(step, errorOutput, attempt = 1) {
  const fix = await suggestFix(step.command, errorOutput);

  if (!fix.fixCommand) {
    console.log(chalk.gray('  No automatic fix available — manual action needed.\n'));
    return { status: 'failed', error: errorOutput };
  }

  const fixIsDestructive = DESTRUCTIVE_PATTERN.test(fix.fixCommand);
  const promptMessage = fixIsDestructive
    ? `⚠ Potentially destructive fix: ${chalk.cyan(fix.fixCommand)} — run it?`
    : `Run fix: ${chalk.cyan(fix.fixCommand)}?`;

  const { runFix } = await inquirer.prompt([
    { type: 'confirm', name: 'runFix', message: promptMessage, default: !fixIsDestructive },
  ]);

  if (!runFix) {
    console.log(chalk.gray('  Skipped — step remains failed.\n'));
    return { status: 'failed', error: errorOutput };
  }

  if (fixIsDestructive) {
    createSnapshot({ command: fix.fixCommand, description: `auto-fix: ${fix.explanation}` });
  }

  const fixSpinner = ora({ text: `Applying fix: ${fix.fixCommand}`, color: 'yellow' }).start();
  try {
    if (fix.requiresInteractive) {
      fixSpinner.stop();
      console.log(chalk.gray('  (needs your input below)\n'));
      runCommand(fix.fixCommand, true);
    } else {
      runCommand(fix.fixCommand, false);
      fixSpinner.succeed(chalk.white(`Applied: ${fix.fixCommand}`));
    }
  } catch (fixErr) {
    fixSpinner.fail(chalk.white(`Fix failed: ${fix.fixCommand}`));
    return { status: 'failed', error: fixErr.message };
  }

  if (!fix.retryOriginal) {
    return { status: 'fixed_no_retry' };
  }

  // retry the original step now that the fix is in place
  const retrySpinner = ora({ text: `Retrying: ${step.description}`, color: 'cyan' }).start();
  try {
    const output =
      step.command === 'dragx:create_remote_repo'
        ? await handleCreateRemoteRepo(step)
        : runCommand(step.command, false);
    retrySpinner.succeed(chalk.white(step.description));
    return { status: 'success', output };
  } catch (retryErr) {
    retrySpinner.fail(chalk.white(step.description));
    const retryError = retryErr.stderr?.toString() || retryErr.message;
    if (attempt < MAX_FIX_ATTEMPTS) {
      console.log(chalk.gray(`  Still failing — trying another fix (${attempt + 1}/${MAX_FIX_ATTEMPTS})...\n`));
      return attemptAutoFix(step, retryError, attempt + 1);
    }
    console.log(chalk.red(`  Gave up after ${MAX_FIX_ATTEMPTS} attempts.\n`));
    return { status: 'failed', error: retryError };
  }
}

/**
 * Executes each step of a plan in order, automatically.
 * - Destructive steps get an individual confirmation + snapshot before running.
 * - On failure, auto-heals via attemptAutoFix (asks before running any fix).
 * - Continues to the next step automatically once a step succeeds or is fixed.
 * - Only stops the whole batch if a step fails and no fix works / user declines.
 */
/**
 * Shows a short diff preview before a commit step runs, so the user sees
 * the actual content changes — not just "3 files staged" but WHAT changed.
 * Truncated to keep terminal output manageable.
 */
function showDiffPreview() {
  try {
    const diff = execSync('git diff --staged', { encoding: 'utf-8', cwd: process.cwd() });
    if (!diff.trim()) return;

    const lines = diff.split('\n');
    const preview = lines.slice(0, 40).join('\n');
    const truncated = lines.length > 40 ? `\n... (${lines.length - 40} more lines)` : '';

    console.log(chalk.dim('\n  ┈┈┈ diff preview ┈┈┈'));
    console.log(
      preview
        .split('\n')
        .map((l) => {
          if (l.startsWith('+') && !l.startsWith('+++')) return chalk.green(`  ${l}`);
          if (l.startsWith('-') && !l.startsWith('---')) return chalk.red(`  ${l}`);
          return chalk.dim(`  ${l}`);
        })
        .join('\n') + truncated
    );
    console.log(chalk.dim('  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n'));
  } catch {
    // not a git repo, no staged changes, or diff failed — silently skip preview
  }
}

async function executePlan(plan) {
  const results = [];
  console.log(''); // breathing room before the run starts

  for (const step of plan.steps) {
    if (step.command.startsWith('git commit')) {
      showDiffPreview();
    }

    if (step.destructive) {
      const ok = await confirmStep(step);
      if (!ok) {
        console.log(chalk.gray(`  ○ ${step.description} — skipped\n`));
        results.push({ step, status: 'skipped' });

        const isLastStep = step === plan.steps[plan.steps.length - 1];
        if (!isLastStep) {
          const { continueAnyway } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'continueAnyway',
              message: chalk.yellow(
                'Later steps may depend on this — continue with the rest of the plan anyway?'
              ),
              default: false,
            },
          ]);
          if (!continueAnyway) {
            console.log(chalk.gray('\nStopped — remaining steps were not run.\n'));
            break;
          }
        }
        continue;
      }
      createSnapshot(step);
    }

    const spinner = ora({ text: step.description, color: 'cyan' }).start();

    try {
      let output;
      if (step.command === 'dragx:create_remote_repo') {
        spinner.stop(); // pause spinner — this step needs interactive prompts
        output = await handleCreateRemoteRepo(step);
        spinner.start();
      } else {
        output = runCommand(step.command, false);
      }
      spinner.succeed(chalk.white(step.description));
      results.push({ step, status: 'success', output });
    } catch (err) {
      spinner.fail(chalk.white(step.description));
      const errorOutput = err.stderr?.toString() || err.message;
      const healResult = await attemptAutoFix(step, errorOutput);
      results.push({ step, ...healResult });

      if (healResult.status === 'failed') {
        console.log(chalk.red(`\n  Stopped — this step couldn't be resolved automatically.\n`));
        break;
      }
      // status 'success' or 'fixed_no_retry' — continue to next step automatically
    }
  }

  return results;
}

export { executePlan };
