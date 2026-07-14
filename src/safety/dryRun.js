import chalk from 'chalk';
import boxen from 'boxen';
import { formatSteps } from './confirm.js';

/**
 * Prints the plan in a readable, framed format without executing anything.
 * Used when the user passes --preview.
 */
function showDryRun(plan) {
  const body = `${chalk.bold(plan.summary)}\n\n${formatSteps(plan)}`;
  console.log(
    boxen(body, {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderColor: 'yellow',
      borderStyle: 'round',
      title: 'Dry Run — nothing will execute',
      titleAlignment: 'left',
    })
  );
  console.log(chalk.dim('Run without --preview to execute this plan.\n'));
}

export { showDryRun };
