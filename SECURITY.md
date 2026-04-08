# Security Policy

## Reporting

If you discover a security issue, do not open a public issue with exploit details.

Report it privately to the repository maintainer and include:

- a short description of the issue
- affected files or flows
- reproduction steps
- impact assessment

## Sensitive Data

This project uses OAuth credentials and local token storage. The following must never be committed:

- `.env`
- `.tokens/`
- `client_secret*.json`
- any exported token file

If any credential in this workspace has already been exposed outside your machine, rotate it in Google Cloud before making the repository public.

## Scope

Typical sensitive areas for this project:

- OAuth callback and token handling
- Google API scopes
- Drive permission changes
- form-specific private metadata embedded in scripts or logs
