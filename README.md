# Time Tracker

Cross-platform time management and productivity app focused on weekly accountability.

The app helps you:
- Track time by project.
- Set weekly goals per project.
- Compare tracked time vs goals.
- Review and retroactively edit entries.

Built with Ionic + Angular + RxDB (offline-first local database).

## Core Features

- Timer start/stop workflow with active timer persistence.
- Project management:
  - Create project
  - Edit project name/color
  - Archive/unarchive project
  - Delete project (with warning)
- Cascade delete behavior:
  - Deleting a project also deletes all entries belonging to that project.
- Weekly reports:
  - Per-project tracked time
  - Per-project weekly goal (hours)
  - Overall weekly goal progress (sum of all project goals)
  - Expand project rows to see time-entry details
  - Edit/delete entries directly from Reports
- Local-first data with RxDB + IndexedDB (Dexie storage).

## User Guide (All Features + How To Access)

### Navigation

- Bottom tab bar:
  - `Timer` -> `Tab1`
  - `Projects` -> `Tab2`
  - `Reports` -> `Tab3`

### Timer (`Tab1`)

- Start tracking time:
  1. Select a project from the project dropdown.
  2. (Optional) Enter a description.
  3. Tap **Start Timer**.
- Stop tracking time:
  - Tap **Stop Timer**.
- Active timer behavior:
  - App stores active timer state locally and restores it when reopened.

### Projects (`Tab2`)

- Create a project:
  1. Tap `+` in the top bar or floating `+` button.
  2. Native color picker opens first.
  3. In the dialog, enter project name and (optionally) adjust hex color.
  4. Tap **Create**.

- Edit a project:
  1. On a project row, **swipe left** to reveal actions.
  2. Tap the **pencil/edit** icon.
  3. Update name/color, then tap **Save**.

- Archive a project:
  1. **Swipe left** on project row.
  2. Tap the **archive** icon.
  3. Confirm in popup.

- Delete an active project:
  1. **Swipe left** on project row.
  2. Tap the **trash** icon.
  3. Confirm in popup.
  4. This also deletes all entries for that project (cascade delete).

- Unarchive a project:
  1. Expand the **Archived Projects** section.
  2. **Swipe left** on archived row.
  3. Tap the **undo** icon.

- Delete an archived project:
  1. Expand **Archived Projects**.
  2. **Swipe left** on archived row.
  3. Tap **trash**.
  4. Confirm in popup.

- Gesture note:
  - Mobile: swipe row left.
  - Desktop/web: click-drag row left with mouse/trackpad to reveal action buttons.

### Reports (`Tab3`)

- Change week:
  - Tap **Previous** / **Next** in the week header.

- Set weekly goal per project:
  - In each project row, edit the **Goal (h)** input.

- View project entry details:
  - Tap a project row to expand/collapse entries for that week.

- Edit a time entry retroactively:
  1. Expand a project in Reports.
  2. Tap **Edit** on an entry.
  3. Update description and duration (minutes).
  4. Tap **Save**.

- Delete a time entry:
  1. Expand a project in Reports.
  2. Tap **Delete** on an entry.
  3. Confirm in popup.

- Progress indicators:
  - Top card: overall weekly progress (sum tracked vs sum of project goals).
  - Per project: progress bar and percent for that project only.

## Tech Stack

- Ionic Angular (`@ionic/angular`)
- Angular 20
- RxDB 16
- Dexie storage plugin for browser IndexedDB
- Jasmine + Karma for tests
- GitHub Actions for CI and Pages deploy

## Project Structure

- `src/app/core/database/`
  - RxDB setup and collection schemas.
- `src/app/shared/repositories/`
  - Data access layer (`ProjectRepository`, `TimeEntryRepository`, base repository).
- `src/app/shared/services/`
  - Business workflows (`TimerService`).
- `src/app/tab1/`
  - Timer screen.
- `src/app/tab2/`
  - Projects screen.
- `src/app/tab3/`
  - Reports screen.
- `.github/workflows/`
  - CI test/build pipeline
  - GitHub Pages deploy pipeline

## Getting Started

### Prerequisites

- Node.js 22+ recommended
- npm

### Install

```bash
npm ci
```

### Run locally

```bash
npm run start
```

Open the local URL printed by Angular (commonly `http://localhost:4200`).

### Build

```bash
npm run build
```

Build output folder: `www/`.

## Testing

### Run tests (watch mode)

```bash
npm test
```

### Run CI-style tests (headless + coverage)

```bash
npm run test:ci
```

Current tested behaviors include:
- Project creation flow.
- Timer tracking lifecycle.
- Weekly per-project goal persistence.
- Correct entry attribution per project.
- Project delete cascade (project + entries).
- RxDB schema/index safety checks.

## CI/CD

### Test Pipeline

Workflow: `.github/workflows/test.yml`

Runs on push/PR:
- `npm ci`
- `npm run test:ci`
- `npm run build`

### GitHub Pages Deploy

Workflow: `.github/workflows/deploy-pages.yml`

Runs on push to `main`:
- Production build with repo base-href.
- SPA fallback via `404.html`.
- Deploys `www/` to Pages.

Expected URL format:
- `https://<username>.github.io/<repo-name>/`

## PWA / iPhone Private Use

For private iPhone use without App Store:
1. Deploy to GitHub Pages.
2. Open the URL in Safari.
3. Tap Share -> **Add to Home Screen**.

This gives an installable web app experience.  
Note: iOS background execution is limited for web apps.

## Data Model Overview

### Project

- `id`, `name`, `color`, `isArchived`, `userId`, timestamps
- soft-delete via `_deleted`

### Time Entry

- `id`, `projectId`, `description`, `startTime`, `endTime`, `duration`, `userId`
- soft-delete via `_deleted`

## Important Implementation Notes

- RxDB indexed fields require strict schema metadata (e.g., `maxLength`, `multipleOf`, `minimum`, `maximum`).
- `ignoreDuplicate` is enabled only in development to avoid RxDB production error `DB9`.
- Repository methods wait for DB initialization before querying collections.

## Known Non-Blocking Warnings

- Angular style budget warning on `tab3.page.scss` (small overage).
- CommonJS optimization warnings from `ajv`/`ajv-formats` via RxDB validator plugin.

These do not block runtime or deployment.

## Roadmap Suggestions

- Authentication (replace hardcoded demo user id).
- Cloud sync and conflict resolution.
- Coverage gates in CI.
- Rich reports (daily trends, categories/tags, streaks).
- Export/import (CSV/JSON).
- Notifications/reminders and goal alerts.

## Scripts

- `npm run start` - dev server
- `npm run build` - production build
- `npm test` - unit tests (watch)
- `npm run test:ci` - headless tests + coverage
- `npm run lint` - lint checks

## License

No license file is currently defined. Add `LICENSE` if you plan to open-source usage terms.
