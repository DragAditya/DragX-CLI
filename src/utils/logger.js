import chalk from 'chalk';

const info = (msg) => console.log(chalk.blue(msg));
const success = (msg) => console.log(chalk.green(msg));
const warn = (msg) => console.log(chalk.yellow(msg));
const error = (msg) => console.log(chalk.red(msg));
const step = (msg) => console.log(chalk.cyan(`→ ${msg}`));

export { info, success, warn, error, step };
