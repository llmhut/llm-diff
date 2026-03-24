# Contributing to llm-diff

Thanks for your interest in contributing! Here's how to get started.

## Development setup

```bash
git clone https://github.com/llmhut/llm-diff.git
cd llm-diff
npm install
```

## Running tests

```bash
npm test           # single run
npm run test:watch # watch mode
```

## Adding a new provider

1. Add the model pricing table to `src/providers.js`
2. Write an API adapter function following the existing pattern
3. Add it to the `ALL_MODELS` map and the `complete()` switch
4. Add tests in `test/providers.test.js`
5. Update the README model table

## Adding a new feature

1. Open an issue describing the feature
2. Fork and create a branch: `git checkout -b feat/your-feature`
3. Write tests first, then implement
4. Run `npm test` to make sure everything passes
5. Open a PR with a clear description

## Code style

- ES modules (`import`/`export`)
- No TypeScript (keep it simple, types via JSDoc)
- No external deps for arg parsing or core logic — keep `node_modules` light
- Every public function gets a JSDoc comment

## Commit messages

Use conventional commits:

```
feat: add mistral provider support
fix: correct gemini token counting
docs: update pricing table
test: add edge case for empty prompts
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.