# Public Release Checklist

Use this before creating the first public GitHub repository for this project.

## 1. Clean Sensitive Files

- Make sure `.env` is not committed.
- Make sure `.tokens/` is not committed.
- Make sure any `client_secret*.json` file is not committed.
- Remove or ignore private assets, screenshots, and local exports that are not part of the product.
- Rotate Google OAuth credentials if they were ever shared or committed anywhere else.

## 2. Review Project-Specific Code

- Review `scripts/professionalize-web-form.ts`.
- Review `scripts/apply-design-images.ts`.
- Confirm they should remain public, or move them to a private/internal repository.
- Replace any remaining real IDs, links, or customer-specific content.

## 3. Validate the Repository Surface

- Confirm `README.md` matches the current behavior.
- Confirm `LICENSE` reflects the license you want.
- Confirm `CONTRIBUTING.md` and `SECURITY.md` match how you want to maintain the project.

## 4. Verify Locally

- Run `pnpm run build`
- Run `pnpm run test`
- Optionally run `pnpm run ui`
- Optionally run `pnpm run dev`

## 5. Initialize Git

If this folder is not yet a Git repository:

```powershell
git init
git add .
git commit -m "Initial public release"
```

## 6. Create the GitHub Repository

- Create a new public repository on GitHub.
- Add the remote.
- Push the default branch.

Example:

```powershell
git remote add origin https://github.com/<your-user>/<your-repo>.git
git branch -M main
git push -u origin main
```

## 7. Optional Metadata to Add Later

Once the GitHub repo exists, consider updating `package.json` with:

- `repository`
- `bugs`
- `homepage`
- `author`
- `files` if you plan to publish to npm
