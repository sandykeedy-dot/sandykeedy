# The Villages We Choose

Sandra Keedy’s author website. This repository contains the approved design, final supplied copy, public artwork, and its build process.

## Updating the website

Edit the JSON files in `content/` for the homepage, synopsis, biography, guide and public settings. The excerpt is in `content/excerpt.html`. `scripts/render-selected.mjs` renders the pages; `assets/sandy-design.css` controls their appearance. Images and fonts are stored locally with the site. Vercel builds this repository with `npm run build`, publishing `dist/`.

Use Node.js 24. Run `npm run build` then `npm run dev` to preview locally on port 4174. Run `npm test` for form-handler checks.

## Launch settings

The current content configuration intentionally keeps forms in preview mode, and the Amazon and Instagram destinations are placeholders. Before activating forms, confirm the recipient and sender address, mailing-list service, Turnstile configuration and real external links. Keep API credentials only in Vercel environment variables; `.env.example` lists the variable names. `ENABLE_LIVE_FORMS` is false by default. Once these are verified, disable preview mode in `content/site.json`; this also permits search indexing.

The mobile preview and copy guide are review aids. The static mobile screenshot lives in `output/playwright/sandy-index-390.png` and should be refreshed after significant design changes.

## Ownership

Repository and hosting are managed in the author’s own GitHub and Vercel accounts. No previous hosting-team link or credential is included.
