/**
 * CLI entrypoint — parses args, validates, runs the diff, renders output.
 *
 * Zero dependencies for argument parsing (just process.argv).
 */

import { runDiff } from './diff.js';
import { render, renderModelList } from './render.js';
import { listModels } from './providers.js';

const VERSION = '0.1.0';

const HELP = `
\x1b[1m\x1b[36mllm-diff\x1b[0m v${VERSION}
Compare LLM responses across prompt versions.

\x1b[1mUsage:\x1b[0m
  llm-diff --a <prompt-a> --b <prompt-b> --model <model>

\x1b[1mRequired:\x1b[0m
  --a, -a <file|text>       Prompt A (file path or inline text)
  --b, -b <file|text>       Prompt B (file path or inline text)
  --model, -m <name>        Model to use (run --models to see list)

\x1b[1mOptions:\x1b[0m
  --system, -s <file|text>  System prompt (shared for both A and B)
  --base-url <url>          Gateway URL override (e.g. llmhut gateway)
  --max-tokens <n>          Max output tokens (default: 2048)
  --temperature <n>         Temperature (default: 0)
  --timeout <ms>            Request timeout (default: 60000)
  --runs <n>                Number of runs to average (default: 1)
  --no-parallel             Run A and B sequentially
  --full                    Show full inline diff (not just changed lines)
  --json                    Output as JSON (for scripting / eval pipelines)
  --models                  List all supported models and pricing
  --version, -v             Show version
  --help, -h                Show this help

\x1b[1mExamples:\x1b[0m
  \x1b[2m# Compare two prompt files\x1b[0m
  llm-diff --a prompt-v1.txt --b prompt-v2.txt --model gpt-4o

  \x1b[2m# Inline prompts with system message\x1b[0m
  llm-diff -a "Explain gravity simply" -b "Explain gravity to a 5-year-old" -m claude-sonnet-4-20250514 -s "You are a physics teacher"

  \x1b[2m# Average over 3 runs, JSON output for CI\x1b[0m
  llm-diff --a v1.txt --b v2.txt -m gpt-4o-mini --runs 3 --json

  \x1b[2m# Route through llmhut gateway\x1b[0m
  llm-diff --a v1.txt --b v2.txt -m gpt-4o --base-url https://gw.llmhut.com/v1

\x1b[1mEnvironment variables:\x1b[0m
  OPENAI_API_KEY            Required for OpenAI models
  ANTHROPIC_API_KEY         Required for Anthropic models
  GEMINI_API_KEY            Required for Gemini models
  GROQ_API_KEY              Required for Groq models

\x1b[2mhttps://github.com/llmhut/llm-diff\x1b[0m
`;

/**
 * Parse argv into a flat options object.
 */
function parseArgs(argv) {
  const opts = {};
  const args = [...argv];

  while (args.length) {
    const arg = args.shift();

    switch (arg) {
      case '--a':
      case '-a':
        opts.promptA = args.shift();
        break;
      case '--b':
      case '-b':
        opts.promptB = args.shift();
        break;
      case '--model':
      case '-m':
        opts.model = args.shift();
        break;
      case '--system':
      case '-s':
        opts.system = args.shift();
        break;
      case '--base-url':
        opts.baseUrl = args.shift();
        break;
      case '--max-tokens':
        opts.maxTokens = parseInt(args.shift(), 10);
        break;
      case '--temperature':
        opts.temperature = parseFloat(args.shift());
        break;
      case '--timeout':
        opts.timeout = parseInt(args.shift(), 10);
        break;
      case '--runs':
        opts.runs = parseInt(args.shift(), 10);
        break;
      case '--no-parallel':
        opts.parallel = false;
        break;
      case '--full':
        opts.full = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--models':
        opts.listModels = true;
        break;
      case '--version':
      case '-v':
        opts.version = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown flag: ${arg}. Run llm-diff --help for usage.`);
        }
    }
  }

  return opts;
}

/**
 * Main entry.
 */
export async function run(argv) {
  const opts = parseArgs(argv);

  if (opts.help) {
    console.log(HELP);
    return;
  }

  if (opts.version) {
    console.log(VERSION);
    return;
  }

  if (opts.listModels) {
    renderModelList(listModels());
    return;
  }

  // Validate required args
  if (!opts.promptA) throw new Error('Missing --a (prompt A). Run llm-diff --help for usage.');
  if (!opts.promptB) throw new Error('Missing --b (prompt B). Run llm-diff --help for usage.');
  if (!opts.model)   throw new Error('Missing --model. Run llm-diff --help for usage.');

  // Show spinner for non-JSON mode
  let spinner;
  if (!opts.json) {
    spinner = startSpinner('Running prompts...');
  }

  try {
    const result = await runDiff(opts);
    if (spinner) spinner.stop();
    render(result, { json: opts.json, full: opts.full });
  } catch (err) {
    if (spinner) spinner.stop();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Minimal terminal spinner
// ---------------------------------------------------------------------------

function startSpinner(msg) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const id = setInterval(() => {
    process.stderr.write(`\r\x1b[36m${frames[i++ % frames.length]}\x1b[0m ${msg}`);
  }, 80);

  return {
    stop() {
      clearInterval(id);
      process.stderr.write('\r\x1b[K'); // clear line
    },
  };
}