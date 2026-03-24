import { describe, it, expect, vi } from 'vitest';
import { resolveModel, listModels, calculateCost } from '../src/providers.js';

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

describe('resolveModel', () => {
  it('resolves a known model alias', () => {
    const m = resolveModel('gpt-4o');
    expect(m.id).toBe('gpt-4o');
    expect(m.provider).toBe('openai');
    expect(m.inputCostPer1k).toBeGreaterThan(0);
  });

  it('resolves case-insensitively', () => {
    const m = resolveModel('GPT-4O');
    expect(m.id).toBe('gpt-4o');
  });

  it('resolves provider/model syntax', () => {
    const m = resolveModel('openai/gpt-4o-mini');
    expect(m.id).toBe('gpt-4o-mini');
    expect(m.provider).toBe('openai');
  });

  it('resolves anthropic models', () => {
    const m = resolveModel('claude-sonnet-4-20250514');
    expect(m.provider).toBe('anthropic');
  });

  it('resolves gemini models', () => {
    const m = resolveModel('gemini-2.0-flash');
    expect(m.provider).toBe('gemini');
  });

  it('resolves groq models', () => {
    const m = resolveModel('llama-3.3-70b');
    expect(m.provider).toBe('groq');
  });

  it('throws on unknown model', () => {
    expect(() => resolveModel('nonexistent-model')).toThrow('Unknown model');
  });
});

// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------

describe('calculateCost', () => {
  it('calculates cost correctly', () => {
    const model = resolveModel('gpt-4o');
    // 1000 input tokens + 500 output tokens
    const cost = calculateCost(model, 1000, 500);
    const expected = (1000 / 1000) * model.inputCostPer1k + (500 / 1000) * model.outputCostPer1k;
    expect(cost).toBeCloseTo(expected, 8);
  });

  it('returns 0 for 0 tokens', () => {
    const model = resolveModel('gpt-4o');
    expect(calculateCost(model, 0, 0)).toBe(0);
  });

  it('handles large token counts', () => {
    const model = resolveModel('gpt-4');
    const cost = calculateCost(model, 100_000, 50_000);
    expect(cost).toBeGreaterThan(0);
    // gpt-4: 100k * 0.03/1k + 50k * 0.06/1k = 3 + 3 = 6
    expect(cost).toBeCloseTo(6, 2);
  });
});

// ---------------------------------------------------------------------------
// Model listing
// ---------------------------------------------------------------------------

describe('listModels', () => {
  it('returns models grouped by provider', () => {
    const grouped = listModels();
    expect(Object.keys(grouped)).toContain('openai');
    expect(Object.keys(grouped)).toContain('anthropic');
    expect(Object.keys(grouped)).toContain('gemini');
    expect(Object.keys(grouped)).toContain('groq');
  });

  it('each model has required fields', () => {
    const grouped = listModels();
    for (const models of Object.values(grouped)) {
      for (const m of models) {
        expect(m).toHaveProperty('alias');
        expect(m).toHaveProperty('id');
        expect(m).toHaveProperty('inputCostPer1k');
        expect(m).toHaveProperty('outputCostPer1k');
        expect(m).toHaveProperty('provider');
      }
    }
  });
});