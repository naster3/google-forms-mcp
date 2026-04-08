# Contributing

## Before Opening a Change

- Open an issue for bugs, regressions, or feature proposals when the change is not trivial.
- Keep pull requests focused on one concern.
- Do not include credentials, tokens, private form IDs, or local generated assets.

## Local Setup

```powershell
pnpm install
Copy-Item .env.example .env
pnpm run auth
pnpm run build
pnpm run test
```

## Development Guidelines

- Use Node.js 20.11+.
- Prefer small, composable changes.
- Keep the MCP JSON response shape stable.
- Add or update tests when behavior changes.
- Keep Google Forms and Google Drive responsibilities clearly separated.

## Pull Request Checklist

- The project builds successfully.
- Tests pass locally.
- No secrets or tokens are included.
- Documentation is updated if behavior changed.
- Any project-specific utilities remain clearly marked as non-core behavior.
