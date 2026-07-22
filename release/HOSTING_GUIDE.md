# Hosting guide — GitHub Pages

Goal: get two public URLs for Privacy Policy and Support pages, paste them
into App Store Connect, ship.

Total time: **~5 minutes**, no terminal needed.

---

## Files to upload

From `release/`:
- `index.html`
- `privacy-policy.html`
- `support.html`
- `README.md`

(The other files — `app-store-metadata.md`, `HOSTING_GUIDE.md`,
`APP_STORE_RELEASE.md` — are for you, not for the public repo.)

---

## Step-by-step

### 1. Create the repo (1 min)

1. Open <https://github.com/new>
2. **Repository name**: `burnrate-site` (recommended) or anything you like
3. **Description**: `Static hosting for BurnRate (privacy, support)`
4. Visibility: **Public** (required for free GitHub Pages)
5. Tick: **Add a README file** (we'll overwrite it in step 2 — just makes
   the repo initializable)
6. Click **Create repository**

### 2. Upload the four files (2 min)

In your fresh repo:
1. Click **Add file → Upload files** (button near the top of the file list)
2. Drag-drop the 4 files from `release/`:
   - `index.html`
   - `privacy-policy.html`
   - `support.html`
   - `README.md`
3. At the bottom: commit message `Initial site`, then **Commit changes**

### 3. Enable Pages (30 seconds)

1. Open **Settings** tab in the repo (top of the repo page, not your
   account settings)
2. Left sidebar: **Pages**
3. Under **Build and deployment**:
   - **Source**: Deploy from a branch
   - **Branch**: `main` · folder `/ (root)`
   - Click **Save**
4. Page reloads. Wait ~30-60 seconds for first deployment.
5. Refresh — at the top you'll see: `Your site is live at https://<username>.github.io/burnrate-site/`

### 4. Verify URLs work (30 sec)

Open in a private/incognito window (cache-safe):
- `https://<username>.github.io/burnrate-site/` — landing
- `https://<username>.github.io/burnrate-site/privacy-policy.html`
- `https://<username>.github.io/burnrate-site/support.html`

All three should load with the cream-themed design.

If you get **404 for ~5 minutes** after Save, that's normal first-deploy
delay. If still 404 after 10 minutes, check the Pages settings page —
there's usually a yellow banner with the actual deployment status.

### 5. Fill in the "Last updated" date (1 min)

The privacy policy has a placeholder. In GitHub web UI:
1. Open `privacy-policy.html`
2. Click the pencil icon (edit)
3. Search for `<!-- DATE_HERE -->` (only one match)
4. Replace with today's date, e.g. `2026-06-25`
5. Commit at the bottom

GitHub Pages will rebuild in ~30 sec.

---

## Plug the URLs into App Store Connect

Now in App Store Connect → BurnRate → App Information:

| Field | URL |
|---|---|
| **Privacy Policy URL** | `https://<username>.github.io/burnrate-site/privacy-policy.html` |
| **Support URL** | `https://<username>.github.io/burnrate-site/support.html` |
| **Marketing URL** (optional) | `https://<username>.github.io/burnrate-site/` |

Save. Required-for-submission boxes turn green.

---

## Future edits

To change a policy paragraph or update FAQ:
1. Open the file in GitHub web UI
2. Pencil → edit → commit
3. ~30 sec later it's live — same URL, no re-submit to Apple needed

The whole maintenance loop stays out of the terminal.
