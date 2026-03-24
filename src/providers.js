/**
 * Provider registry — pricing, API call adapters, token counting.
 *
 * Each provider exports:
 *   models      – map of model aliases → { id, inputCostPer1k, outputCostPer1k }
 *   complete()  – (model, prompt, opts) → { text, inputTokens, outputTokens, latencyMs }
 */

// ---------------------------------------------------------------------------
// Pricing tables (USD per 1 000 tokens, as of early 2026)
// ---------------------------------------------------------------------------

const OPENAI_MODELS = {
    'gpt-4o':       { id: 'gpt-4o',       inputCostPer1k: 0.0025,  outputCostPer1k: 0.01   },
    'gpt-4o-mini':  { id: 'gpt-4o-mini',  inputCostPer1k: 0.00015, outputCostPer1k: 0.0006 },
    'gpt-4-turbo':  { id: 'gpt-4-turbo',  inputCostPer1k: 0.01,    outputCostPer1k: 0.03   },
    'gpt-4':        { id: 'gpt-4',        inputCostPer1k: 0.03,    outputCostPer1k: 0.06   },
    'gpt-3.5-turbo':{ id: 'gpt-3.5-turbo',inputCostPer1k: 0.0005,  outputCostPer1k: 0.0015 },
    'o1':           { id: 'o1',           inputCostPer1k: 0.015,   outputCostPer1k: 0.06   },
    'o1-mini':      { id: 'o1-mini',      inputCostPer1k: 0.003,   outputCostPer1k: 0.012  },
    'o3-mini':      { id: 'o3-mini',      inputCostPer1k: 0.0011,  outputCostPer1k: 0.0044 },
  };
  
  const ANTHROPIC_MODELS = {
    'claude-sonnet-4-20250514':  { id: 'claude-sonnet-4-20250514',  inputCostPer1k: 0.003,  outputCostPer1k: 0.015  },
    'claude-3.5-haiku': { id: 'claude-3-5-haiku-20241022', inputCostPer1k: 0.0008, outputCostPer1k: 0.004  },
    'claude-3-opus':    { id: 'claude-3-opus-20240229',    inputCostPer1k: 0.015,  outputCostPer1k: 0.075  },
  };
  
  const GEMINI_MODELS = {
    'gemini-2.0-flash':  { id: 'gemini-2.0-flash',  inputCostPer1k: 0.0001,  outputCostPer1k: 0.0004  },
    'gemini-2.0-pro':    { id: 'gemini-2.0-pro',    inputCostPer1k: 0.00125, outputCostPer1k: 0.005   },
    'gemini-1.5-pro':    { id: 'gemini-1.5-pro',    inputCostPer1k: 0.00125, outputCostPer1k: 0.005   },
    'gemini-1.5-flash':  { id: 'gemini-1.5-flash',  inputCostPer1k: 0.000075,outputCostPer1k: 0.0003  },
  };
  
  const GROQ_MODELS = {
    'llama-3.3-70b':  { id: 'llama-3.3-70b-versatile',  inputCostPer1k: 0.00059, outputCostPer1k: 0.00079 },
    'llama-3.1-8b':   { id: 'llama-3.1-8b-instant',     inputCostPer1k: 0.00005, outputCostPer1k: 0.00008 },
    'mixtral-8x7b':   { id: 'mixtral-8x7b-32768',       inputCostPer1k: 0.00024, outputCostPer1k: 0.00024 },
    'gemma2-9b':      { id: 'gemma2-9b-it',             inputCostPer1k: 0.0002,  outputCostPer1k: 0.0002  },
  };
  
  // ---------------------------------------------------------------------------
  // Provider detection
  // ---------------------------------------------------------------------------
  
  const ALL_MODELS = {
    ...prefix(OPENAI_MODELS, 'openai'),
    ...prefix(ANTHROPIC_MODELS, 'anthropic'),
    ...prefix(GEMINI_MODELS, 'gemini'),
    ...prefix(GROQ_MODELS, 'groq'),
  };
  
  function prefix(map, provider) {
    const out = {};
    for (const [alias, info] of Object.entries(map)) {
      out[alias] = { ...info, provider };
    }
    return out;
  }
  
  /**
   * Resolve a model string → { provider, id, inputCostPer1k, outputCostPer1k }.
   * Throws if unknown.
   */
  export function resolveModel(name) {
    const key = name.toLowerCase();
    if (ALL_MODELS[key]) return ALL_MODELS[key];
  
    // Allow full provider/model syntax:  openai/gpt-4o
    const [prov, ...rest] = key.split('/');
    const modelPart = rest.join('/');
    if (ALL_MODELS[modelPart] && ALL_MODELS[modelPart].provider === prov) {
      return ALL_MODELS[modelPart];
    }
  
    throw new Error(
      `Unknown model "${name}". Run \`llm-diff --models\` to see supported models.`
    );
  }
  
  /**
   * List every supported model grouped by provider.
   */
  export function listModels() {
    const grouped = {};
    for (const [alias, info] of Object.entries(ALL_MODELS)) {
      if (!grouped[info.provider]) grouped[info.provider] = [];
      grouped[info.provider].push({ alias, ...info });
    }
    return grouped;
  }
  
  // ---------------------------------------------------------------------------
  // API adapters
  // ---------------------------------------------------------------------------
  
  /**
   * Fire a chat completion and return normalised result.
   *
   * @param {object}  model        – resolved model from resolveModel()
   * @param {string}  prompt       – the user message (or full messages JSON)
   * @param {object}  opts
   * @param {string}  [opts.system]      – system message
   * @param {string}  [opts.baseUrl]     – gateway override
   * @param {number}  [opts.maxTokens]   – max output tokens (default 2048)
   * @param {number}  [opts.temperature] – temperature (default 0)
   * @param {number}  [opts.timeout]     – request timeout ms (default 60000)
   * @returns {Promise<{text: string, inputTokens: number, outputTokens: number, latencyMs: number}>}
   */
  export async function complete(model, prompt, opts = {}) {
    const { provider } = model;
    switch (provider) {
      case 'openai':    return openaiComplete(model, prompt, opts);
      case 'anthropic': return anthropicComplete(model, prompt, opts);
      case 'gemini':    return geminiComplete(model, prompt, opts);
      case 'groq':      return groqComplete(model, prompt, opts);
      default:          throw new Error(`No adapter for provider "${provider}"`);
    }
  }
  
  // ---------------------------------------------------------------------------
  // OpenAI-compatible (also covers Groq, llmhut gateway, any OpenAI-compat API)
  // ---------------------------------------------------------------------------
  
  async function openaiComplete(model, prompt, opts) {
    const apiKey = env('OPENAI_API_KEY');
    const baseUrl = opts.baseUrl || 'https://api.openai.com/v1';
    return openaiCompatComplete(model, prompt, { ...opts, apiKey, baseUrl });
  }
  
  async function groqComplete(model, prompt, opts) {
    const apiKey = env('GROQ_API_KEY');
    const baseUrl = opts.baseUrl || 'https://api.groq.com/openai/v1';
    return openaiCompatComplete(model, prompt, { ...opts, apiKey, baseUrl });
  }
  
  async function openaiCompatComplete(model, prompt, opts) {
    const {
      apiKey,
      baseUrl,
      system,
      maxTokens = 2048,
      temperature = 0,
      timeout = 60_000,
    } = opts;
  
    const messages = buildMessages(prompt, system);
  
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const t0 = performance.now();
  
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model.id,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
        signal: controller.signal,
      });
  
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`${model.provider} API ${res.status}: ${body.slice(0, 300)}`);
      }
  
      const data = await res.json();
      const latencyMs = performance.now() - t0;
  
      return {
        text: data.choices?.[0]?.message?.content ?? '',
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        latencyMs,
      };
    } finally {
      clearTimeout(timer);
    }
  }
  
  // ---------------------------------------------------------------------------
  // Anthropic
  // ---------------------------------------------------------------------------
  
  async function anthropicComplete(model, prompt, opts) {
    const apiKey = env('ANTHROPIC_API_KEY');
    const baseUrl = opts.baseUrl || 'https://api.anthropic.com';
    const {
      system,
      maxTokens = 2048,
      temperature = 0,
      timeout = 60_000,
    } = opts;
  
    const messages = buildMessages(prompt); // Anthropic takes system separately
  
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const t0 = performance.now();
  
    try {
      const body = {
        model: model.id,
        messages,
        max_tokens: maxTokens,
        temperature,
      };
      if (system) body.system = system;
  
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
  
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
      }
  
      const data = await res.json();
      const latencyMs = performance.now() - t0;
  
      const text = data.content
        ?.filter(b => b.type === 'text')
        .map(b => b.text)
        .join('') ?? '';
  
      return {
        text,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        latencyMs,
      };
    } finally {
      clearTimeout(timer);
    }
  }
  
  // ---------------------------------------------------------------------------
  // Google Gemini
  // ---------------------------------------------------------------------------
  
  async function geminiComplete(model, prompt, opts) {
    const apiKey = env('GEMINI_API_KEY');
    const baseUrl = opts.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const {
      system,
      maxTokens = 2048,
      temperature = 0,
      timeout = 60_000,
    } = opts;
  
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    };
    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }
  
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const t0 = performance.now();
  
    try {
      const url = `${baseUrl}/models/${model.id}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
  
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Gemini API ${res.status}: ${text.slice(0, 300)}`);
      }
  
      const data = await res.json();
      const latencyMs = performance.now() - t0;
  
      const text = data.candidates?.[0]?.content?.parts
        ?.map(p => p.text)
        .join('') ?? '';
  
      const usage = data.usageMetadata ?? {};
  
      return {
        text,
        inputTokens: usage.promptTokenCount ?? 0,
        outputTokens: usage.candidatesTokenCount ?? 0,
        latencyMs,
      };
    } finally {
      clearTimeout(timer);
    }
  }
  
  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  
  function buildMessages(prompt, system) {
    const msgs = [];
    // If prompt is raw JSON array of messages, use it directly
    if (prompt.trimStart().startsWith('[')) {
      try {
        const parsed = JSON.parse(prompt);
        if (Array.isArray(parsed)) return parsed;
      } catch { /* fall through */ }
    }
    if (system) msgs.push({ role: 'system', content: system });
    msgs.push({ role: 'user', content: prompt });
    return msgs;
  }
  
  function env(key) {
    const val = process.env[key];
    if (!val) {
      throw new Error(
        `Missing environment variable ${key}. ` +
        `Set it or pass --base-url to use a gateway that handles auth.`
      );
    }
    return val;
  }
  
  // ---------------------------------------------------------------------------
  // Cost calculation
  // ---------------------------------------------------------------------------
  
  export function calculateCost(model, inputTokens, outputTokens) {
    return (
      (inputTokens / 1000) * model.inputCostPer1k +
      (outputTokens / 1000) * model.outputCostPer1k
    );
  }