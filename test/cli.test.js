import { describe, it, expect, vi } from 'vitest';

describe('CLI arg parsing', () => {
  it('shows help without crashing', async () => {
    const { run } = await import('../src/cli.js');

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    await run(['--help']);

    console.log = origLog;

    const output = logs.join('\n');
    expect(output).toContain('llm-diff');
    expect(output).toContain('--model');
    expect(output).toContain('--a');
  });

  it('shows version', async () => {
    const { run } = await import('../src/cli.js');

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    await run(['--version']);

    console.log = origLog;

    expect(logs[0]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('lists models without crashing', async () => {
    const { run } = await import('../src/cli.js');

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    await run(['--models']);

    console.log = origLog;

    const output = logs.join('\n');
    expect(output).toContain('openai');
    expect(output).toContain('gpt-4o');
  });

  it('throws on missing --a', async () => {
    const { run } = await import('../src/cli.js');
    await expect(run(['--b', 'test', '-m', 'gpt-4o'])).rejects.toThrow('Missing --a');
  });

  it('throws on missing --b', async () => {
    const { run } = await import('../src/cli.js');
    await expect(run(['--a', 'test', '-m', 'gpt-4o'])).rejects.toThrow('Missing --b');
  });

  it('throws on missing --model', async () => {
    const { run } = await import('../src/cli.js');
    await expect(run(['--a', 'test', '--b', 'test'])).rejects.toThrow('Missing --model');
  });

  it('throws on unknown flag', async () => {
    const { run } = await import('../src/cli.js');
    await expect(run(['--bogus'])).rejects.toThrow('Unknown flag');
  });
});