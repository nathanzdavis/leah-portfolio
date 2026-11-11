# Visual editor operations

The public portfolio and protected `/editor` use `content/site.json`. GrapesJS JSON is the persistence format; the public site ships only the lightweight React renderer.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Run `npm run password:hash` and save its output as `EDITOR_PASSWORD_HASH`.
3. Set a random 32+ character `EDITOR_SESSION_SECRET`.
4. Set `GITHUB_EDITOR_TOKEN` to a fine-grained token limited to this repository with Contents read/write and Metadata read.
5. Set `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, and optional `VERCEL_TEAM_ID` for deployment status.
6. Run `npm install`, `npm run dev`, then open `/editor`.

Never prefix secrets with `NEXT_PUBLIC_`. Local development can persist to `.editor/draft.json` without GitHub; production requires GitHub storage.

## Workflow

Edits autosave to `editor-drafts`. Publish validates the document, commits `content/site.json` to `master`, and the existing GitHub integration triggers Vercel. The editor then polls Vercel by commit SHA. History restores an old document into the draft without rewriting Git history.

The Account button changes the editor password. The replacement scrypt hash is encrypted with AES-256-GCM using `EDITOR_SESSION_SECRET` and stored on the editor draft branch. Plaintext passwords are never persisted or committed. Rotating `EDITOR_SESSION_SECRET` requires resetting the initial `EDITOR_PASSWORD_HASH` because it also protects the saved credential.

The legacy `build/` and `dev/` folders remain as a migration reference. Do not run `npm run import:legacy` after real editor changes have been published.
