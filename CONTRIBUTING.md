# Contributing

## Development Setup

1. Install Node.js (see `.nvmrc` for the expected major version).
2. Install dependencies:

```bash
npm ci
```

3. Start the app in development mode:

```bash
npm run dev
```

## Quality Checks

Run before opening a PR:

```bash
npm run check
npm run test
npm run build
```

## Pull Requests

- Keep PRs focused and small.
- Include a short test plan in the PR description.
- Update documentation when behavior or configuration changes.
