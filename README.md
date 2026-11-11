# Leah Mosier portfolio

A Next.js portfolio with a protected, browser-based visual editor at `/editor`.

The public pages and editor share the structured document in `content/site.json`. GrapesJS powers the editing canvas, but editor code is excluded from public pages. The original static/Grunt project remains in `build/` and `dev/` as a migration reference.

## Development

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and configure editor authentication first. Generate a password hash with `npm run password:hash`.

```sh
npm test
npm run build
```

See [EDITOR.md](EDITOR.md) for architecture, publishing workflow, production environment variables, and setup.
