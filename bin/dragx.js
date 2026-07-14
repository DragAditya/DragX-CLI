#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { platform } from 'node:os';

// DragX relies on Unix-style shells (bash/sh) for command execution — it's
// built and tested for Linux, macOS, and Termux (Android). Native Windows
// (outside WSL) uses a different shell (cmd/PowerShell) where quoting,
// piping, and commands like "rm" behave differently or don't exist at all.
// Rather than fail deep inside a shell-exec with a confusing error, warn
// clearly up front.
if (platform() === 'win32') {
  console.log(
    chalk.yellow(
      '\n⚠ DragX is built for Unix-style shells (Linux/macOS/Termux) and is not tested on native Windows.\n' +
        '  It will likely misbehave outside WSL (Windows Subsystem for Linux).\n' +
        '  If you\'re on Windows, run this inside WSL for correct behavior.\n'
    )
  );
}

import { parseCommand } from '../src/core/parser.js';
import { parsePlan } from '../src/core/planner.js';
import { executePlan } from '../src/core/executor.js';
import { classifyIntent } from '../src/core/intentRouter.js';
import { chatReply } from '../src/core/chat.js';
import { explainProject } from '../src/core/projectHelp.js';
import { showDryRun } from '../src/safety/dryRun.js';
import { confirmPlan } from '../src/safety/confirm.js';
import { undoLast } from '../src/safety/undo.js';
import { recordCommand, loadMemory } from '../src/context/memory.js';
import { createPR } from '../src/github/pr.js';
import { saveCredentials, loadCredentials, clearCredentials, isLoggedIn } from '../src/github/auth.js';
import * as log from '../src/utils/logger.js';
import inquirer from 'inquirer';
import ora from 'ora';
import boxen from 'boxen';

const program = new Command();

program
  .name('dragx')
  .description('Natural language (Hindi/English/Hinglish) CLI for git & GitHub workflows')
  .version('1.0.0');

// Main command: dragx "<natural language instruction>"
program
  .argument('[instruction]', 'what you want to do, in Hindi/English/Hinglish')
  .option('--preview', 'show the plan without executing anything')
  .option('--undo', 'revert the last destructive action')
  .action(async (instruction, options) => {
    try {
      if (options.undo) {
        undoLast();
        return;
      }

      if (!instruction) {
        printHelp();
        return;
      }

      const intentSpinner = ora({ text: 'Samajh raha hoon...', color: 'magenta' }).start();
      const intent = await classifyIntent(instruction);
      intentSpinner.stop();

      // --- CHAT: casual conversation, no plan/execution ---
      if (intent === 'chat') {
        const chatSpinner = ora({ text: 'Soch raha hoon...', color: 'magenta' }).start();
        const reply = await chatReply(instruction);
        chatSpinner.stop();
        console.log(`\n${reply}\n`);
        return;
      }

      // --- PROJECT HELP: explain how to run/setup this project, offer to do it ---
      if (intent === 'project_help') {
        const helpSpinner = ora({ text: 'Project samajh raha hoon...', color: 'magenta' }).start();
        const explanation = await explainProject(instruction);
        helpSpinner.stop();

        console.log(
          boxen(explanation, {
            padding: 1,
            margin: { top: 1, bottom: 1 },
            borderColor: 'green',
            borderStyle: 'round',
            title: 'Project Guide',
            titleAlignment: 'left',
          })
        );

        const { doSetup } = await inquirer.prompt([
          { type: 'confirm', name: 'doSetup', message: 'Setup kar du automatically?', default: true },
        ]);

        if (!doSetup) {
          console.log(chalk.gray('\nOk, manually follow the steps above whenever ready.\n'));
          return;
        }

        // fall through into the normal action pipeline with a setup-focused instruction
        instruction = 'install dependencies and set up this project so it is ready to run';
      }

      // --- ACTION: build and execute a git/file plan (also reached after project_help setup consent) ---
      const thinkSpinner = ora({ text: 'Plan bana raha hoon...', color: 'magenta' }).start();
      let rawResponse, plan;
      try {
        rawResponse = await parseCommand(instruction);
        plan = parsePlan(rawResponse);
        thinkSpinner.stop();
      } catch (thinkErr) {
        thinkSpinner.fail('Failed to understand the command');
        throw thinkErr; // let the outer catch print the actual error message
      }

      // Ambiguity check: if the AI genuinely couldn't tell what was meant,
      // ask instead of guessing — a wrong guess on a destructive action is
      // far more costly than one extra question.
      while (plan.needsClarification) {
        console.log(chalk.yellow(`\n❓ ${plan.clarificationQuestion}\n`));
        const { clarification } = await inquirer.prompt([
          { type: 'input', name: 'clarification', message: 'Your answer:' },
        ]);

        const combinedInstruction = `${instruction}\n(Clarification: ${clarification})`;
        const clarifySpinner = ora({ text: 'Samajh raha hoon...', color: 'magenta' }).start();
        rawResponse = await parseCommand(combinedInstruction);
        plan = parsePlan(rawResponse);
        clarifySpinner.stop();
        instruction = combinedInstruction; // keep context growing if it asks again
      }

      // Proactive check: if this plan needs GitHub (push/remote-create) and
      // the user hasn't logged in yet, ask them to log in FIRST — don't wait
      // for the command to fail mid-execution.
      const needsGithub = plan.steps.some(
        (s) => s.command.includes('git push') || s.command === 'dragx:create_remote_repo'
      );
      if (needsGithub && !isLoggedIn() && !options.preview) {
        log.warn('This needs GitHub access, but you\'re not logged in yet.');
        const { doLogin } = await inquirer.prompt([
          { type: 'confirm', name: 'doLogin', message: 'Log in to GitHub now?', default: true },
        ]);

        if (!doLogin) {
          log.warn('Cancelled — GitHub login is required for this action.');
          return;
        }

        await runLoginFlow();
      }

      if (options.preview) {
        showDryRun(plan);
        return;
      }

      const confirmed = await confirmPlan(plan);
      if (!confirmed) {
        console.log(chalk.gray('\nCancelled — no changes made.\n'));
        return;
      }

      const results = await executePlan(plan);
      recordCommand(instruction, plan);

      const failed = results.some((r) => r.status === 'failed');
      if (!failed) {
        console.log(chalk.green.bold('\n✓ Done!\n'));
      }
    } catch (err) {
      console.log(chalk.red(`\nError: ${err.message}\n`));
      process.exitCode = 1;
      process.exit(1); // force-exit — prevents any leftover spinner/prompt listener from hanging the terminal
    }
  });

// dragx pr "<title>" — auto-generate and open a PR
program
  .command('pr <title>')
  .description('create a GitHub PR with an AI-generated description')
  .action(async (title) => {
    try {
      log.info('Generating PR description...');
      const url = await createPR(title);
      log.success(`✓ PR created: ${url}`);
    } catch (err) {
      log.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
  });

// dragx login — store GitHub username + Personal Access Token locally (encrypted)
program
  .command('login')
  .description('save your GitHub username and Personal Access Token locally (encrypted)')
  .action(async () => {
    await runLoginFlow();
  });

/**
 * Shared login flow: prompts for username + PAT, saves them encrypted locally.
 * Used both by "dragx login" directly and by the proactive check inside
 * the main command when a plan needs GitHub access but no token is saved yet.
 */
async function runLoginFlow() {
  console.log(chalk.cyan('\nGitHub login (stored locally, encrypted, never uploaded anywhere)'));
  console.log(
    chalk.gray(
      'Note: GitHub requires a Personal Access Token, not a password.\n' +
        'Generate one at: https://github.com/settings/tokens (scope: "repo")\n'
    )
  );

  const answers = await inquirer.prompt([
    { type: 'input', name: 'username', message: 'GitHub username:' },
    { type: 'password', name: 'token', message: 'Personal Access Token:', mask: '*' },
  ]);

  if (!answers.username || !answers.token) {
    log.error('Username and token are both required. Login cancelled.');
    return false;
  }

  saveCredentials(answers);
  log.success('✓ Credentials saved locally (encrypted). Use "dragx logout" to remove them.\n');
  return true;
}

// dragx logout — delete stored credentials
program
  .command('logout')
  .description('delete locally saved GitHub credentials')
  .action(() => {
    if (!isLoggedIn()) {
      log.warn('No saved credentials found.');
      return;
    }
    clearCredentials();
    log.success('✓ Credentials removed.');
  });

// dragx whoami — show currently saved username (never prints the token)
program
  .command('whoami')
  .description('show the currently saved GitHub username')
  .action(() => {
    const creds = loadCredentials();
    if (!creds) {
      log.warn('Not logged in. Run "dragx login" first.');
      return;
    }
    log.info(`Logged in as: ${creds.username} (saved ${creds.savedAt})`);
  });

// dragx history — show recent command history for this project
program
  .command('history')
  .description('show recent DragX command history for this project')
  .action(() => {
    const memory = loadMemory();
    if (!memory.history || memory.history.length === 0) {
      console.log(chalk.gray('\nNo history yet for this project.\n'));
      return;
    }

    const recent = memory.history.slice(-10).reverse();
    const lines = recent
      .map((h, i) => {
        const time = new Date(h.timestamp).toLocaleString();
        return `${chalk.dim(`${i + 1}.`)} ${chalk.white(h.input)}\n   ${chalk.dim(`${h.summary} — ${time}`)}`;
      })
      .join('\n\n');

    console.log(
      boxen(lines, {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderColor: 'blue',
        borderStyle: 'round',
        title: `History (last ${recent.length})`,
        titleAlignment: 'left',
      })
    );
  });

// dragx stats — quick counts about DragX usage in this project
program
  .command('stats')
  .description('show quick usage stats for this project')
  .action(() => {
    const memory = loadMemory();
    const total = memory.history?.length ?? 0;
    const totalSteps = (memory.history || []).reduce((sum, h) => sum + (h.stepCount || 0), 0);
    const since = memory.createdAt ? new Date(memory.createdAt).toLocaleDateString() : 'unknown';

    const body = [
      `${chalk.bold('Commands run:')} ${total}`,
      `${chalk.bold('Total steps executed:')} ${totalSteps}`,
      `${chalk.bold('Tracking since:')} ${since}`,
    ].join('\n');

    console.log(
      boxen(body, {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderColor: 'magenta',
        borderStyle: 'round',
        title: 'DragX Stats',
        titleAlignment: 'left',
      })
    );
  });

/**
 * Custom help shown when "dragx" is run with no arguments.
 */
function printHelp() {
  console.log(chalk.cyan.bold('\nDragX — Hinglish AI assistant for your terminal\n'));
  console.log('Usage:');
  console.log(chalk.gray('  dragx "<anything — chat, project help, or a git/file action>"'));
  console.log('');
  console.log('Examples:');
  console.log(chalk.gray('  dragx "hello bhai, kaisa hai tu"          → casual chat'));
  console.log(chalk.gray('  dragx "ye project kaise run karu"          → explains + offers auto-setup'));
  console.log(chalk.gray('  dragx "sari files add karo aur commit karo" → git action'));
  console.log(chalk.gray('  dragx "purani files delete karo" --preview → dry run'));
  console.log(chalk.gray('  dragx pr "Fix OAuth bug"                   → AI-written PR'));
  console.log('');
  console.log('Commands:');
  console.log(chalk.gray('  login     save GitHub username + token locally (encrypted)'));
  console.log(chalk.gray('  logout    delete saved credentials'));
  console.log(chalk.gray('  whoami    show saved GitHub username'));
  console.log(chalk.gray('  pr <title>  create a PR with an AI-generated description'));
  console.log(chalk.gray('  history   show recent command history'));
  console.log(chalk.gray('  stats     show usage stats for this project'));
  console.log('');
  console.log('Options:');
  console.log(chalk.gray('  --preview   show the plan without running anything'));
  console.log(chalk.gray('  --undo      revert the last destructive action'));
  console.log('');
}

program.parse();
