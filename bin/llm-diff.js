#!/usr/bin/env node

import { run } from '../src/cli.js';

run(process.argv.slice(2)).catch((err) => {
  console.error(`\n\x1b[31m✖ ${err.message}\x1b[0m\n`);
  process.exit(1);
});