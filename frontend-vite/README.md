# NIDA Dashboard UI (Vite)

This folder is the Vite-based migration of the original frontend.

## Scripts

- `npm run dev` or `npm start`: Run development server at `http://localhost:3000`
- `npm run build`: Build production bundle to `dist/`
- `npm run preview`: Preview production build locally

## Environment Variables

This migrated app keeps compatibility with existing `process.env.REACT_APP_*` references.
Set variables as before (for example in shell, Docker args, or env files).

## Docker

The production Docker build now serves static files from `dist/`.
