# Troubleshooting

## `OAuth token file not found`

Cause:

- you have not completed local OAuth yet
- `GOOGLE_TOKEN_PATH` points to the wrong location

Fix:

```powershell
pnpm run auth
```

Then confirm the token file exists under `.tokens/` or the path configured in `GOOGLE_TOKEN_PATH`.

## `insufficient_permissions`

Cause:

- the Google account cannot access the form
- the OAuth app is missing required scopes
- Drive scope is required for responder access changes

Fix:

- verify the account can open the form manually
- set `GOOGLE_INCLUDE_DRIVE_SCOPE=true` if using `responderAccess`
- re-run `pnpm run auth` after changing scopes

## `form_not_found`

Cause:

- invalid `formId`
- the OAuth account cannot see the form

Fix:

- re-check the form URL and extract the correct form ID
- verify you are authenticated with the correct Google account

## `invalid_item_index`

Cause:

- you tried to edit, move, or delete an item at an index that does not exist

Fix:

- run `list_items` first
- use the current zero-based index shown by the MCP
- prefer `itemId` for more stable targeting when doing multiple edits

## `drive_scope_required`

Cause:

- you called `set_publish_settings` with `responderAccess` but did not authorize Drive scope

Fix:

1. set `GOOGLE_INCLUDE_DRIVE_SCOPE=true`
2. run `pnpm run auth` again
3. retry the tool call

## Google rejects the image URL

Cause:

- the image URL is not public
- the URL redirects in a way Google Forms cannot use

Fix:

- use a direct public image URL
- test the URL in an incognito browser window
- prefer stable CDN or publicly accessible Drive-hosted assets

## The MCP connects but tools are confusing in the client UI

Cause:

- some MCP clients cache tool metadata aggressively

Fix:

- restart the MCP client after updating the server
- rebuild the project with `pnpm run build`

## Publishing appears to work but responders still cannot access the form

Cause:

- the form publish state changed but responder access did not

Fix:

- call `set_publish_settings` again with `responderAccess`
- enable Drive scope if needed
- verify permissions with the same Google account that owns the form
