# npm Trusted Publishing

Use this to publish from GitHub Actions without long-lived npm tokens.

## What This Solves

- avoids local `npm publish` auth friction
- avoids token handling in the repo
- enables npm provenance with GitHub Actions OIDC

## Repository Workflow

This repo includes:

- `.github/workflows/publish.yml`

The workflow:

1. installs dependencies
2. runs tests
3. builds the package
4. publishes with:

```bash
npm publish --provenance --access public
```

## npm Setup

In npm, add this GitHub repository as a trusted publisher for the package.

Repository:

```text
naster3/google-forms-mcp
```

Package name:

```text
google-forms-mcp-naster
```

## Recommended Publish Flow

Use one of these:

1. Create a GitHub release and let the workflow publish.
2. Run the workflow manually with `workflow_dispatch`.

## Important Notes

- Trusted Publishing must be configured in npm before the workflow can publish.
- The workflow must run on GitHub-hosted runners.
- The workflow needs `id-token: write` permission, which is already configured.
- For the first public publish, `--access public` is required.

## After Setup

Once npm Trusted Publishing is connected, prefer GitHub Actions over local `npm publish`.
