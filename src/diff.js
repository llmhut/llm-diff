/**
 * Core diff engine.
 *
 * Takes two prompts (or files), fires them at the same model,
 * and returns a structured result with token/cost/latency deltas
 * plus a textual diff of the responses.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { diffWords } from 'diff';
import { resolveModel, complete, calculateCost } from './providers.js';

/**
 * @typedef {object} DiffResult
 * @property {object} a              – result from prompt A
 * @property {object} b              – result from prompt B
 * @property {object} delta          – computed deltas
 * @property {Array}  wordDiff       – diff-lib change objects
 * @property {object} model          – resolved model info
 */

/**
 * Run the diff.
 *
 * @param {object} opts
 * @param {string} opts.promptA      – text or path to prompt A
 * @param {string} opts.promptB      – text or path to prompt B
 * @param {string} opts.model        – model name/alias
 * @param {string} [opts.system]     – optional system prompt (text or path)
 * @param {string} [opts.baseUrl]    – gateway URL override
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.temperature]
 * @param {number} [opts.timeout]
 * @param {number} [opts.runs]       – number of runs to average (default 1)
 * @param {boolean}[opts.parallel]   – run A and B in parallel (default true)
 * @returns {Promise<DiffResult>}
 */
export async function runDiff(opts) {
  const model = resolveModel(opts.model);

  const [promptA, promptB, system] = await Promise.all([
    loadInput(opts.promptA),
    loadInput(opts.promptB),
    opts.system ? loadInput(opts.system) : Promise.resolve(undefined),
  ]);

  const callOpts = {
    system,
    baseUrl: opts.baseUrl,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    timeout: opts.timeout,
  };

  const runs = Math.max(1, opts.runs || 1);
  const parallel = opts.parallel !== false;

  // Collect results across runs
  const aResults = [];
  const bResults = [];

  for (let i = 0; i < runs; i++) {
    if (parallel) {
      const [a, b] = await Promise.all([
        complete(model, promptA, callOpts),
        complete(model, promptB, callOpts),
      ]);
      aResults.push(a);
      bResults.push(b);
    } else {
      aResults.push(await complete(model, promptA, callOpts));
      bResults.push(await complete(model, promptB, callOpts));
    }
  }

  // Average the numeric fields, keep last text
  const a = average(aResults);
  const b = average(bResults);

  // Cost
  a.cost = calculateCost(model, a.inputTokens, a.outputTokens);
  b.cost = calculateCost(model, b.inputTokens, b.outputTokens);

  // Deltas
  const totalTokensA = a.inputTokens + a.outputTokens;
  const totalTokensB = b.inputTokens + b.outputTokens;

  const delta = {
    inputTokens: b.inputTokens - a.inputTokens,
    outputTokens: b.outputTokens - a.outputTokens,
    totalTokens: totalTokensB - totalTokensA,
    totalTokensPct: totalTokensA ? ((totalTokensB - totalTokensA) / totalTokensA) * 100 : 0,
    cost: b.cost - a.cost,
    costPct: a.cost ? ((b.cost - a.cost) / a.cost) * 100 : 0,
    latencyMs: b.latencyMs - a.latencyMs,
    latencyPct: a.latencyMs ? ((b.latencyMs - a.latencyMs) / a.latencyMs) * 100 : 0,
  };

  // Word-level diff of responses
  const wordDiff = diffWords(a.text, b.text);

  return { a, b, delta, wordDiff, model, runs };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load input — if it looks like a file path, read the file; otherwise treat as
 * inline text.
 */
async function loadInput(input) {
  if (!input) return input;

  // Heuristic: it's a file if it contains a dot-extension or slash, and is
  // short enough to be a path rather than a prompt.
  const looksLikePath = (
    input.length < 500 &&
    !input.includes('\n') &&
    /\.[a-z0-9]{1,6}$/i.test(input)
  );

  if (looksLikePath) {
    try {
      return await readFile(resolve(input), 'utf-8');
    } catch {
      // Not a file — treat as literal text
      return input;
    }
  }
  return input;
}

/**
 * Average numeric fields across multiple run results. Keep last text.
 */
function average(results) {
  if (results.length === 1) return { ...results[0] };
  const n = results.length;
  return {
    text: results[n - 1].text,
    inputTokens: Math.round(results.reduce((s, r) => s + r.inputTokens, 0) / n),
    outputTokens: Math.round(results.reduce((s, r) => s + r.outputTokens, 0) / n),
    latencyMs: results.reduce((s, r) => s + r.latencyMs, 0) / n,
  };
}