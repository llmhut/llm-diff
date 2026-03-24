# llm-diff

> `git diff` for prompts — compare LLM responses across prompt versions.

See token count changes, cost deltas, latency shifts, and a word-level diff of the actual responses — all in one command.

```
$ llm-diff --a prompt-v1.txt --b prompt-v2.txt --model gpt-4o

llm-diff  openai/gpt-4o

  tokens          312 →        289   -23  (-7.4%)
    input          45 →         38   -7
    output        267 →        251   -16
  cost       $0.0041 →    $0.0038   -$0.0003  (-7.3%)
  latency      1247ms →      943ms   -304ms  (-24.4%)

--- prompt A
+++ prompt B
  The capital of France is Paris.
- It is located in northern France and has a population of approximately 2.1 million people...
+ Paris, with ~2.1M residents, serves as the political and cultural center of the country...
```

## Install

```bash
npx llm-diff --a v1.txt --b v2.txt --model gpt-4o
```

Or install globally:

```bash
npm install -g llm-diff
```

## Quick start

**1. Set your API key:**

```bash
export OPENAI_API_KEY=sk-...
# or ANTHROPIC_API_KEY, GEMINI_API_KEY, GROQ_API_KEY
```

**2. Compare two prompts:**

```bash
# From files
llm-diff --a prompt-v1.txt --b prompt-v2.txt --model gpt-4o

# Inline text
llm-diff -a "Explain gravity" -b "Explain gravity to a child" -m gpt-4o-mini

# With a system prompt
llm-diff -a v1.txt -b v2.txt -m claude-sonnet-4-20250514 -s "You are a science teacher"
```

## Usage

```
llm-diff --a <prompt-a> --b <prompt-b> --model <model> [options]
```

### Required

| Flag | Description |
|------|-------------|
| `--a, -a` | Prompt A — file path or inline text |
| `--b, -b` | Prompt B — file path or inline text |
| `--model, -m` | Model name (see `--models` for full list) |

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--system, -s` | — | System prompt (file path or inline text) |
| `--base-url` | — | Gateway URL override |
| `--max-tokens` | 2048 | Max output tokens |
| `--temperature` | 0 | Temperature |
| `--timeout` | 60000 | Request timeout (ms) |
| `--runs` | 1 | Number of runs to average |
| `--no-parallel` | — | Run A and B sequentially |
| `--full` | — | Show full inline diff with highlighting |
| `--json` | — | JSON output for scripting |
| `--models` | — | List supported models and pricing |

## Supported models

```bash
llm-diff --models
```

### OpenAI
`gpt-4o` · `gpt-4o-mini` · `gpt-4-turbo` · `gpt-4` · `gpt-3.5-turbo` · `o1` · `o1-mini` · `o3-mini`

### Anthropic
`claude-sonnet-4-20250514` · `claude-3.5-haiku` · `claude-3-opus`

### Google Gemini
`gemini-2.0-flash` · `gemini-2.0-pro` · `gemini-1.5-pro` · `gemini-1.5-flash`

### Groq
`llama-3.3-70b` · `llama-3.1-8b` · `mixtral-8x7b` · `gemma2-9b`

## Gateway support

Route requests through a custom gateway (like llmhut) instead of direct API calls:

```bash
llm-diff --a v1.txt --b v2.txt -m gpt-4o --base-url https://gw.llmhut.com/v1
```

The gateway handles authentication, so you don't need provider-specific API keys.

## Averaging multiple runs

LLM responses vary. Average over multiple runs for stable comparisons:

```bash
llm-diff --a v1.txt --b v2.txt -m gpt-4o --runs 5
```

Token counts and latency are averaged. The last response text is used for the diff.

## JSON output

Pipe results into scripts, dashboards, or eval pipelines:

```bash
llm-diff --a v1.txt --b v2.txt -m gpt-4o --json | jq '.delta'
```

```json
{
  "totalTokens": -23,
  "totalTokensPct": -7.4,
  "cost": -0.000293,
  "costPct": -7.1,
  "latencyMs": -304,
  "latencyPct": -24.4
}
```

## Programmatic API

```javascript
import { runDiff } from 'llm-diff';

const result = await runDiff({
  promptA: 'Explain gravity',
  promptB: 'Explain gravity to a 5-year-old',
  model: 'gpt-4o-mini',
});

console.log(result.delta);
// { totalTokens: -23, cost: -0.0003, latencyMs: -304, ... }
```

## How it works

1. Resolves the model → provider, pricing, API adapter
2. Reads prompt A and B (from files or inline text)
3. Fires both requests in parallel (or sequentially with `--no-parallel`)
4. Collects token counts, cost, and latency from the API response
5. Computes deltas between A and B
6. Generates a word-level diff of the response text
7. Renders everything to the terminal (or as JSON)

## Roadmap

- [ ] Eval pipeline integration (named experiments, history)
- [ ] Side-by-side diff view
- [ ] Cross-model comparison (`--model-a gpt-4o --model-b claude-sonnet-4-20250514`)
- [ ] HTML report output
- [ ] Config file support (`.llm-diff.json`)
- [ ] Streaming output with live token counting
- [ ] Mistral, Cohere, Together AI providers

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache License — see [LICENSE](LICENSE).