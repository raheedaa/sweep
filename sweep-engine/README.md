# The Sweep — morning engine

This little robot wakes up every morning, reads the news for you, curates it, and
publishes one file called `feed.json`. Your Sweep tool reads that file. Set it up
once and never touch it again.

It works with **zero cost**. If you add one Claude key, it also writes the smart
summaries and the "why it matters to you" lines while it sweeps.

---

## What you'll end up with

- A free GitHub account (thinks of it as a folder in the cloud that can run little jobs)
- This engine living in it, running itself every morning
- A public web address ending in `/feed.json`
- That address pasted into your Sweep tool. Done.

Total time: about 15 minutes, once.

---

## Step by step (no coding — just clicking and pasting)

### 1. Make a GitHub account
Go to **github.com** and sign up. It's free.

### 2. Make a new repository
"Repository" just means a folder. Click the **+** (top right) → **New repository**.
- Name it `sweep`
- Choose **Public**
- Click **Create repository**

### 3. Put these files into it
On your new repo page, click **uploading an existing file**.
Drag in **everything from this folder**, including the hidden `.github` folder.
The structure must stay exactly as it is here:

```
sweep/
  build-feed.js
  package.json
  sources.json
  config.json
  README.md
  .github/workflows/sweep.yml
```

Then click **Commit changes**.
> Tip: if drag-and-drop won't include the `.github` folder, upload the other files
> first, then create the workflow file by hand: on the repo, press `.` to open the
> web editor, make a folder `.github/workflows`, and paste in `sweep.yml`.

### 4. (Recommended) Give it a Claude key
This is what writes the summaries and "why it matters to you." One key, used only
by your own robot, never shown to anyone.

1. Go to **console.anthropic.com** → sign in → **API Keys** → **Create key**. Copy it.
2. In your GitHub repo: **Settings** → **Secrets and variables** → **Actions**
   → **New repository secret**.
3. Name: `ANTHROPIC_API_KEY`  ·  Value: paste your key  ·  **Add secret**.

*(Skip this and the engine still runs — you just get clean headlines without the
smart summaries.)*

### 5. Run it once by hand
Top of the repo → **Actions** tab. If asked, click the green **I understand, enable**.
Click **Daily Sweep** on the left → **Run workflow** → **Run workflow**.
Wait ~1 minute; a green tick means it worked. A new file `feed.json` now appears
in your repo.

### 6. Turn on the public address
**Settings** → **Pages** → under *Source* choose **Deploy from a branch** →
Branch **main**, folder **/(root)** → **Save**.
After a minute your file is live at:

```
https://YOUR-USERNAME.github.io/sweep/feed.json
```

(Replace `YOUR-USERNAME`. Open it in a browser to check you see text.)

### 7. Point the Sweep at it
Open your Sweep tool → **Settings** (gear) → **Feed source** →
paste that address → **Save**. Real news replaces the sample instantly.

That's it. Every morning at ~06:20 Lagos time it refreshes itself.

---

## Making it yours

- **Change what it reads:** open `sources.json`, add or remove feeds. The easiest
  way to target something new is a Google News line — copy one and change the words
  after `q=`.
- **Change the time:** in `.github/workflows/sweep.yml`, the line `cron: '20 5 * * *'`
  is in UTC. Lagos is UTC+1, so `20 5` = 06:20 Lagos. Use crontab.guru if you want another time.
- **Change your interests / economy locations / tips:** edit `config.json`. Add
  `London` or anywhere under `economy` (use the 3-letter country code, e.g. `GBR`).
- **Cheaper or richer summaries:** by default it uses a fast, cheap model. To use a
  stronger one, add a *variable* (not secret) named `MODEL` under
  Settings → Secrets and variables → Actions → Variables.

## Good to know
- Keep the repo alive: GitHub pauses the daily schedule if a **public** repo has no
  activity for 60 days. Any small edit resets that.
- Morning runs can be 10–30 min late at busy times — normal, not a fault.
- You can always press **Run workflow** to refresh on demand.
