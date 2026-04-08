# Google Forms MCP

MCP server for reading, editing, and publishing Google Forms with the official Google Forms API.

This project is for developers and agent builders who want to automate real Google Forms work instead of scraping pages or manually clicking through the UI.

## Why This Exists

Most MCP servers that touch productivity software stop at read-only access or expose vague tool behavior.

This one is focused on a narrower, more useful job:

- inspect a real Google Form
- update structure and copy safely
- add and edit questions
- move and delete items
- attach images
- list responses
- publish or unpublish the form

That makes it useful for:

- AI agents that maintain intake forms
- agencies that generate or refine client questionnaires
- internal tools teams building workflow automations around Google Forms
- developers who need repeatable form changes in code

## What Problem It Solves

Google Forms is widely used, but it is painful to automate reliably.

Typical pain points:

- agents do not know the form structure before editing
- manual edits are slow and error-prone
- publishing state and responder access are easy to mishandle
- response retrieval is inconsistent across ad hoc scripts

This MCP gives agents a structured, typed surface to work with.

## Product Positioning

This is not a generic “Google workspace MCP”.

It is best positioned as:

> The MCP for programmatic Google Forms operations: read, edit, restructure, and publish forms safely with official APIs.

That is much more sellable than “professional Google Forms server”.

## First Successful Use in Under 2 Minutes

The fastest path to value is:

1. Connect the server with working Google OAuth credentials.
2. Run `create_form` or `get_form`.
3. Run `list_items`.
4. Change one obvious thing with `update_form_info` or `add_text_question`.

Recommended first prompt:

```text
Create a Google Form called "Client Intake Form", add a short description for respondents, then add a required short-answer question titled "Project owner name".
```

If that works, users immediately understand the value.

## Core Capabilities

- `create_form`
- `get_form`
- `list_items`
- `update_form_info`
- `add_text_question`
- `add_paragraph_question`
- `add_multiple_choice_question`
- `add_checkbox_question`
- `add_dropdown_question`
- `add_section`
- `update_section`
- `add_image_item`
- `update_image_item`
- `set_question_image`
- `update_question`
- `move_item`
- `delete_item`
- `list_responses`
- `get_response`
- `set_publish_settings`

The tools return structured JSON with normalized item data so agents can reason about the form before mutating it.

## Installation

### Option 1: Run From Source

Requirements:

- Node.js `>=20.11.0`
- `pnpm`
- Google Cloud OAuth credentials

Install:

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

Authorize once:

```powershell
pnpm run auth
```

Build:

```powershell
pnpm run build
```

### Option 2: Package Distribution

The package is prepared to be published as `google-forms-mcp`.

Once published to npm, the intended command surface is:

```powershell
npx google-forms-mcp
```

If you want real adoption, publish the package. Requiring source checkout is a growth bottleneck.

## MCP Client Configuration

### Codex

```json
{
  "mcpServers": {
    "google-forms": {
      "command": "node",
      "args": ["C:/path/to/google-forms-mcp/dist/index.js"],
      "cwd": "C:/path/to/google-forms-mcp",
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

### Generic stdio MCP Client

```json
{
  "command": "node",
  "args": ["/absolute/path/to/dist/index.js"],
  "cwd": "/absolute/path/to/repo",
  "env": {
    "GOOGLE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
    "GOOGLE_CLIENT_SECRET": "your-client-secret",
    "GOOGLE_REDIRECT_URI": "http://127.0.0.1:3005/oauth2callback",
    "GOOGLE_TOKEN_PATH": ".tokens/google-oauth.json",
    "GOOGLE_INCLUDE_DRIVE_SCOPE": "false",
    "GOOGLE_LOG_LEVEL": "info"
  }
}
```

## Google Cloud Setup

1. Create or select a Google Cloud project.
2. Enable Google Forms API.
3. Enable Google Drive API only if you need responder access updates.
4. Configure the OAuth consent screen.
5. Create an OAuth client.
6. Add `http://127.0.0.1:3005/oauth2callback` as an authorized redirect URI if using a web OAuth client.
7. Put the client ID and secret into `.env`.

## Tool Design Notes

This MCP is strongest when the agent works in this order:

1. `get_form` or `list_items`
2. inspect indexes, itemIds, and current shape
3. mutate with a targeted tool
4. re-read the form if more edits are needed

This order matters because Google Forms edits are structure-sensitive.

## Recommended Prompts

See [docs/PROMPTS.md](./docs/PROMPTS.md).

## Troubleshooting

See [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md).

## Launch and Quality Checklists

- [docs/LAUNCH_CHECKLIST.md](./docs/LAUNCH_CHECKLIST.md)
- [docs/QUALITY_CHECKLIST.md](./docs/QUALITY_CHECKLIST.md)
- [docs/CONTENT_PLAN.md](./docs/CONTENT_PLAN.md)

## Scripts

- `pnpm run dev`
- `pnpm run build`
- `pnpm run start`
- `pnpm run test`
- `pnpm run auth`
- `pnpm run ui`
- `pnpm run professionalize:web-form`
- `pnpm run apply:design-images`

The two project-specific scripts are not the product. They are utility scripts layered on top of the product.

## Current Limitations

- local `stdio` transport is the primary supported mode
- no remote hosted version yet
- no per-user responder sharing flow
- Google OAuth setup is still the main installation hurdle

## Security

Never commit:

- `.env`
- `.tokens/`
- `client_secret*.json`

If any credential was ever exposed, rotate it before making the repository public.

See [SECURITY.md](./SECURITY.md).

## License

MIT. See [LICENSE](./LICENSE).
