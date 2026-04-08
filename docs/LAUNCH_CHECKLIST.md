# Launch Checklist

## Product

- The one-line description clearly says this MCP reads, edits, and publishes Google Forms.
- The README shows a 2-minute first success flow.
- At least 5 real prompt examples are documented.
- The tool names are understandable without reading source code.

## Distribution

- Publish the package to npm.
- Confirm the package includes `dist/`, `bin/`, `README.md`, `LICENSE`, and `.env.example`.
- Test installation from a clean machine or clean directory.

## MCP Client Support

- Verify setup works in Codex.
- Verify setup works in at least one additional stdio MCP client.
- Confirm the tool list and descriptions render correctly.

## Security

- `.env` is not committed.
- `.tokens/` is not committed.
- `client_secret*.json` is not committed.
- Any previously exposed OAuth credentials have been rotated.

## Validation

- `pnpm run build` passes.
- `pnpm run test` passes.
- OAuth bootstrap works from scratch.
- `get_form` works on a real form.
- one write flow works end to end
- one response-read flow works end to end

## Growth

- Record a short demo GIF or video.
- Publish a launch post with one concrete workflow.
- Share a “copy-paste config + first prompt” snippet.
- Publish at least one example integration or agent workflow.
