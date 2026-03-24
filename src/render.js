/**
 * Terminal renderer — pretty-prints diff results.
 *
 * Supports two modes:
 *   • human  – colored terminal output (default)
 *   • json   – machine-readable JSON
 */

// ANSI codes
const c = {
    reset:  '\x1b[0m',
    bold:   '\x1b[1m',
    dim:    '\x1b[2m',
    red:    '\x1b[31m',
    green:  '\x1b[32m',
    yellow: '\x1b[33m',
    cyan:   '\x1b[36m',
    bgRed:  '\x1b[41m',
    bgGreen:'\x1b[42m',
    gray:   '\x1b[90m',
    white:  '\x1b[37m',
    strikethrough: '\x1b[9m',
  };
  
  /**
   * Render the diff result to stdout.
   */
  export function render(result, opts = {}) {
    if (opts.json) {
      return renderJson(result);
    }
    return renderHuman(result, opts);
  }
  
  // ---------------------------------------------------------------------------
  // JSON output
  // ---------------------------------------------------------------------------
  
  function renderJson(result) {
    const { a, b, delta, model, runs } = result;
    const output = {
      model: model.id,
      provider: model.provider,
      runs,
      a: {
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        totalTokens: a.inputTokens + a.outputTokens,
        cost: round(a.cost, 6),
        latencyMs: round(a.latencyMs, 0),
        text: a.text,
      },
      b: {
        inputTokens: b.inputTokens,
        outputTokens: b.outputTokens,
        totalTokens: b.inputTokens + b.outputTokens,
        cost: round(b.cost, 6),
        latencyMs: round(b.latencyMs, 0),
        text: b.text,
      },
      delta: {
        totalTokens: delta.totalTokens,
        totalTokensPct: round(delta.totalTokensPct, 1),
        cost: round(delta.cost, 6),
        costPct: round(delta.costPct, 1),
        latencyMs: round(delta.latencyMs, 0),
        latencyPct: round(delta.latencyPct, 1),
      },
    };
    console.log(JSON.stringify(output, null, 2));
  }
  
  // ---------------------------------------------------------------------------
  // Human-readable output
  // ---------------------------------------------------------------------------
  
  function renderHuman(result, opts) {
    const { a, b, delta, wordDiff, model, runs } = result;
  
    const lines = [];
  
    // Header
    lines.push('');
    lines.push(`${c.bold}${c.cyan}llm-diff${c.reset}  ${c.dim}${model.provider}/${model.id}${c.reset}`);
    if (runs > 1) {
      lines.push(`${c.dim}averaged over ${runs} runs${c.reset}`);
    }
    lines.push('');
  
    // Stats table
    const totalA = a.inputTokens + a.outputTokens;
    const totalB = b.inputTokens + b.outputTokens;
  
    lines.push(statsRow(
      'tokens',
      `${totalA}`,
      `${totalB}`,
      delta.totalTokens,
      delta.totalTokensPct,
      ''
    ));
  
    lines.push(statsRow(
      '  input',
      `${a.inputTokens}`,
      `${b.inputTokens}`,
      delta.inputTokens,
      null,
      '',
      true
    ));
  
    lines.push(statsRow(
      '  output',
      `${a.outputTokens}`,
      `${b.outputTokens}`,
      delta.outputTokens,
      null,
      '',
      true
    ));
  
    lines.push(statsRow(
      'cost',
      `$${formatCost(a.cost)}`,
      `$${formatCost(b.cost)}`,
      delta.cost,
      delta.costPct,
      '$'
    ));
  
    lines.push(statsRow(
      'latency',
      `${round(a.latencyMs, 0)}ms`,
      `${round(b.latencyMs, 0)}ms`,
      delta.latencyMs,
      delta.latencyPct,
      'ms'
    ));
  
    lines.push('');
  
    // Response diff
    lines.push(`${c.bold}--- prompt A${c.reset}`);
    lines.push(`${c.bold}+++ prompt B${c.reset}`);
    lines.push('');
  
    if (opts.full) {
      // Full inline diff
      for (const part of wordDiff) {
        if (part.added) {
          process.stdout.write(`${c.bgGreen}${c.white}${part.value}${c.reset}`);
        } else if (part.removed) {
          process.stdout.write(`${c.bgRed}${c.white}${c.strikethrough}${part.value}${c.reset}`);
        } else {
          process.stdout.write(part.value);
        }
      }
      process.stdout.write('\n');
    } else {
      // Compact: only changed lines
      renderCompactDiff(wordDiff);
    }
  
    lines.push('');
  
    console.log(lines.join('\n'));
  }
  
  /**
   * Compact diff view — shows only lines with changes, with surrounding context.
   */
  function renderCompactDiff(wordDiff) {
    // Build the full A and B texts, then do a line diff
    let aText = '';
    let bText = '';
    for (const part of wordDiff) {
      if (!part.added) aText += part.value;
      if (!part.removed) bText += part.value;
    }
  
    const aLines = aText.split('\n');
    const bLines = bText.split('\n');
  
    // Simple LCS-based line diff
    const lineDiff = diffLines(aLines, bLines);
  
    const contextLines = 2;
    const output = [];
    let lastPrinted = -1;
  
    // Find which lines have changes
    const changedIndices = new Set();
    lineDiff.forEach((entry, i) => {
      if (entry.type !== 'equal') {
        // Mark surrounding context too
        for (let j = Math.max(0, i - contextLines); j <= Math.min(lineDiff.length - 1, i + contextLines); j++) {
          changedIndices.add(j);
        }
      }
    });
  
    lineDiff.forEach((entry, i) => {
      if (!changedIndices.has(i)) return;
  
      if (lastPrinted >= 0 && i > lastPrinted + 1) {
        output.push(`${c.dim}  ...${c.reset}`);
      }
      lastPrinted = i;
  
      switch (entry.type) {
        case 'removed':
          output.push(`${c.red}- ${entry.value}${c.reset}`);
          break;
        case 'added':
          output.push(`${c.green}+ ${entry.value}${c.reset}`);
          break;
        case 'equal':
          output.push(`${c.dim}  ${entry.value}${c.reset}`);
          break;
      }
    });
  
    console.log(output.join('\n'));
  }
  
  /**
   * Minimal line differ (no external dep needed for this simple case).
   */
  function diffLines(aLines, bLines) {
    const result = [];
    let ai = 0;
    let bi = 0;
  
    // Simple greedy match — not optimal LCS but good enough for readable diffs
    while (ai < aLines.length && bi < bLines.length) {
      if (aLines[ai] === bLines[bi]) {
        result.push({ type: 'equal', value: aLines[ai] });
        ai++;
        bi++;
      } else {
        // Look ahead for a match
        const aMatch = findNext(bLines, aLines[ai], bi, 5);
        const bMatch = findNext(aLines, bLines[bi], ai, 5);
  
        if (aMatch === -1 && bMatch === -1) {
          // Both lines changed
          result.push({ type: 'removed', value: aLines[ai] });
          result.push({ type: 'added', value: bLines[bi] });
          ai++;
          bi++;
        } else if (bMatch !== -1 && (aMatch === -1 || bMatch - ai <= aMatch - bi)) {
          // Lines were removed from A
          while (ai < bMatch) {
            result.push({ type: 'removed', value: aLines[ai] });
            ai++;
          }
        } else {
          // Lines were added in B
          while (bi < aMatch) {
            result.push({ type: 'added', value: bLines[bi] });
            bi++;
          }
        }
      }
    }
  
    while (ai < aLines.length) {
      result.push({ type: 'removed', value: aLines[ai++] });
    }
    while (bi < bLines.length) {
      result.push({ type: 'added', value: bLines[bi++] });
    }
  
    return result;
  }
  
  function findNext(arr, value, from, maxLook) {
    const limit = Math.min(arr.length, from + maxLook);
    for (let i = from; i < limit; i++) {
      if (arr[i] === value) return i;
    }
    return -1;
  }
  
  // ---------------------------------------------------------------------------
  // Stats formatting helpers
  // ---------------------------------------------------------------------------
  
  function statsRow(label, valA, valB, delta, deltaPct, unit, subdued = false) {
    const labelStr = subdued
      ? `${c.dim}${label.padEnd(12)}${c.reset}`
      : `${c.bold}${label.padEnd(12)}${c.reset}`;
  
    const arrow = `${c.dim}→${c.reset}`;
    const valAStr = valA.padStart(10);
    const valBStr = valB.padStart(10);
  
    let deltaStr;
    if (typeof delta === 'number') {
      const sign = delta > 0 ? '+' : '';
      const color = delta < 0 ? c.green : delta > 0 ? c.red : c.dim;
  
      if (unit === '$') {
        deltaStr = `${color}${sign}$${formatCost(Math.abs(delta))}${c.reset}`;
      } else if (unit === 'ms') {
        deltaStr = `${color}${sign}${round(delta, 0)}ms${c.reset}`;
      } else {
        deltaStr = `${color}${sign}${delta}${c.reset}`;
      }
  
      if (deltaPct != null && deltaPct !== 0) {
        const pctColor = deltaPct < 0 ? c.green : deltaPct > 0 ? c.red : c.dim;
        deltaStr += `  ${pctColor}(${deltaPct > 0 ? '+' : ''}${round(deltaPct, 1)}%)${c.reset}`;
      }
    } else {
      deltaStr = '';
    }
  
    return `  ${labelStr}${valAStr} ${arrow} ${valBStr}   ${deltaStr}`;
  }
  
  function formatCost(n) {
    if (n < 0.001) return n.toFixed(6);
    if (n < 0.01)  return n.toFixed(5);
    if (n < 1)     return n.toFixed(4);
    return n.toFixed(2);
  }
  
  function round(n, decimals) {
    const f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
  }
  
  // ---------------------------------------------------------------------------
  // Model list printer
  // ---------------------------------------------------------------------------
  
  export function renderModelList(grouped) {
    console.log(`\n${c.bold}${c.cyan}Supported models${c.reset}\n`);
    for (const [provider, models] of Object.entries(grouped)) {
      console.log(`  ${c.bold}${provider}${c.reset}`);
      for (const m of models) {
        const input = `$${m.inputCostPer1k.toFixed(5)}/1k in`;
        const output = `$${m.outputCostPer1k.toFixed(5)}/1k out`;
        console.log(`    ${m.alias.padEnd(24)} ${c.dim}${input}  ${output}${c.reset}`);
      }
      console.log('');
    }
  }