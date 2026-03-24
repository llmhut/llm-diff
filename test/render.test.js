import { describe, it, expect, vi } from 'vitest';

describe('render', () => {
  it('module exports render and renderModelList', async () => {
    const mod = await import('../src/render.js');
    expect(mod.render).toBeDefined();
    expect(mod.renderModelList).toBeDefined();
  });

  it('renders JSON output without crashing', async () => {
    const { render } = await import('../src/render.js');

    // Capture console.log
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    const mockResult = {
      a: { inputTokens: 100, outputTokens: 200, cost: 0.003, latencyMs: 1200, text: 'Hello world' },
      b: { inputTokens: 90, outputTokens: 180, cost: 0.0025, latencyMs: 900, text: 'Hello there world' },
      delta: {
        totalTokens: -30,
        totalTokensPct: -10,
        cost: -0.0005,
        costPct: -16.7,
        latencyMs: -300,
        latencyPct: -25,
        inputTokens: -10,
        outputTokens: -20,
      },
      wordDiff: [],
      model: { id: 'gpt-4o', provider: 'openai' },
      runs: 1,
    };

    render(mockResult, { json: true });

    console.log = origLog;

    // Should be valid JSON
    const output = JSON.parse(logs.join(''));
    expect(output.model).toBe('gpt-4o');
    expect(output.delta.totalTokens).toBe(-30);
  });
});