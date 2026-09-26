# Result Card Format

A4 school result card generator built with TanStack Start.

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev
```

The dev server runs on `http://localhost:8080`.

## Scripts

| Script            | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `npm run dev`     | Start the Vite dev server                            |
| `npm run build`   | Production build (Nitro, `cloudflare-module` preset) |
| `npm run preview` | Preview the production build                         |
| `npm run lint`    | Run ESLint                                           |
| `npm run format`  | Format the repo with Prettier                        |

Override the deploy target at build time with `NITRO_PRESET` (for example `NITRO_PRESET=node-server`).

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
