# Google Forms MCP Server

An MCP server for Google Forms built with Node.js and TypeScript, using the official Google APIs.

It is designed for local use with Codex or any MCP client that can connect over `stdio`.

## What It Does

- Reads Google Forms metadata and items
- Updates form title and description
- Adds, updates, moves, and deletes questions
- Lists responses
- Optionally updates publish settings
- Optionally uses Google Drive permissions when responder access changes require it

## Tech Stack

- Node.js 20+
- TypeScript
- `@modelcontextprotocol/sdk`
- Google Forms API v1
- Google Drive API v3
- Zod for input validation

## Project Layout

```text
src/
  auth/
  google/
  mcp/
  tools/
  types/
  ui/
  utils/
scripts/
tests/
```

## Requirements

- Node.js `>=20.11.0`
- `pnpm` `10.x`
- A Google account with access to Google Forms
- A Google Cloud project with OAuth credentials
- Google Forms API enabled
- Google Drive API enabled only if you need responder-access changes through Drive permissions

## Quick Start

```powershell
pnpm install
Copy-Item .env.example .env
```

Fill in `.env`:

```env
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:3005/oauth2callback
GOOGLE_TOKEN_PATH=.tokens/google-oauth.json
GOOGLE_INCLUDE_DRIVE_SCOPE=false
GOOGLE_LOG_LEVEL=info
```

Then authorize locally:

```powershell
pnpm run auth
```

Build and start:

```powershell
pnpm run build
pnpm run start
```

For development:

```powershell
pnpm run dev
```

## Google Cloud Setup

1. Create or select a Google Cloud project.
2. Enable Google Forms API.
3. Enable Google Drive API only if you need responder-access updates.
4. Configure the OAuth consent screen.
5. Create an OAuth client.
6. Add `http://127.0.0.1:3005/oauth2callback` as an authorized redirect URI if you use a web client.
7. Copy the client ID and client secret into `.env`.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Yes | Local OAuth callback URI |
| `GOOGLE_TOKEN_PATH` | Yes | Local token file path |
| `GOOGLE_INCLUDE_DRIVE_SCOPE` | No | Set to `true` if Drive permissions are needed |
| `GOOGLE_LOG_LEVEL` | No | Logging level, default `info` |
| `UI_PORT` | No | Port for the optional local UI |
| `TARGET_FORM_ID` | Only for utility scripts | Required by the project-specific scripts in `scripts/` |

## Scripts

| Command | Description |
| --- | --- |
| `pnpm run dev` | Start the MCP server in watch mode |
| `pnpm run build` | Compile TypeScript to `dist/` |
| `pnpm run start` | Run the compiled MCP server |
| `pnpm run test` | Run the local test suite |
| `pnpm run auth` | Run the local OAuth bootstrap flow |
| `pnpm run ui` | Start the optional local inspection UI |
| `pnpm run professionalize:web-form` | Run a project-specific form transformation script |
| `pnpm run apply:design-images` | Run a project-specific image placement script |

## Optional Local UI

Start the UI:

```powershell
pnpm run ui
```

Then open:

```text
http://127.0.0.1:3210
```

The UI can:

- Load a form by `formId`
- Show metadata, publish state, and responder URL
- Show normalized items and recent responses
- Edit common question and form fields
- Add, move, and delete questions

## MCP Client Example

Example configuration for a local MCP client:

```json
{
  "mcpServers": {
    "google-forms": {
      "command": "node",
      "args": ["<repo-path>/dist/index.js"],
      "cwd": "<repo-path>",
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "your-client-secret",
        "GOOGLE_REDIRECT_URI": "http://127.0.0.1:3005/oauth2callback",
        "GOOGLE_TOKEN_PATH": ".tokens/google-oauth.json",
        "GOOGLE_INCLUDE_DRIVE_SCOPE": "false",
        "GOOGLE_LOG_LEVEL": "info"
      }
    }
  }
}
```

## Public Repository Notes

This repository is safe to publish only if you keep local secrets and local artifacts out of version control.

Do not commit:

- `.env`
- `.tokens/`
- `client_secret*.json`
- local generated assets
- form-specific private data

The repository already ignores common local files, but you should still review the working tree before the first public push.

## Project-Specific Utility Scripts

Two scripts under `scripts/` are intentionally treated as utility scripts, not core server behavior:

- `scripts/professionalize-web-form.ts`
- `scripts/apply-design-images.ts`

They now require `TARGET_FORM_ID` from the environment instead of embedding a real form ID in source code.

These scripts still assume a specific content model and local image assets, so review them before presenting them as reusable public examples.

## Testing

```powershell
pnpm run test
```

## Limitations

- The server focuses on local `stdio` transport
- It does not create brand-new forms as part of the core toolset
- It does not manage individual responder email permissions
- Drive permissions are only used where the Forms API does not cover the required behavior

## Preparing This Repo for a Public Release

See `docs/PUBLIC_RELEASE_CHECKLIST.md`.

## License

MIT. See `LICENSE`.
