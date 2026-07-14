import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';

/**
 * Formats a plan's steps into a clean, numbered, spaced block —
 * used by both confirmPlan and dryRun for a consistent look.
 */
function formatSteps(plan) {
  return plan.steps
    .map((step, i) => {
      const tag = step.destructive ? chalk.red('⚠ destructive') : chalk.green('safe');
      const num = chalk.dim(`${i + 1}.`);
      return `${num} ${step.description}  ${chalk.dim(`(${tag})`)}\n   ${chalk.dim('$')} ${chalk.cyan(step.command)}`;
    })
    .join('\n\n');
}

/**
 * Shows the full plan and asks for one overall confirmation.
 * Returns true if the user confirms, false otherwise.
 */
async function confirmPlan(plan) {
  const confidenceLine =
    plan.confidence === 'low'
      ? chalk.red(`⚠ Confidence: low — I made significant assumptions here, double-check the plan`)
      : plan.confidence === 'medium'
        ? chalk.yellow(`Confidence: medium — some assumptions made`)
        : chalk.dim(`Confidence: high`);

  const body = `${chalk.bold(plan.summary)}\n${confidenceLine}\n\n${formatSteps(plan)}`;
  console.log(
    boxen(body, {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderColor: plan.confidence === 'low' ? 'red' : 'cyan',
      borderStyle: 'round',
      title: 'Plan',
      titleAlignment: 'left',
    })
  );

  const hasDestructive = plan.steps.some((s) => s.destructive);
  const message = hasDestructive
    ? chalk.yellow('This includes destructive steps. Proceed?')
    : 'Proceed?';

  const { proceed } = await inquirer.prompt([
    { type: 'confirm', name: 'proceed', message, default: !hasDestructive },
  ]);

  return proceed;
}

/**
 * Extra, individual confirmation for a single destructive step
 * (used when running step-by-step rather than as one batch).
 */
async function confirmStep(step) {
  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: chalk.yellow(`⚠ Destructive: "${step.description}" — run it?`),
      default: false,
    },
  ]);
  return proceed;
}

export { confirmPlan, confirmStep, formatSteps };
