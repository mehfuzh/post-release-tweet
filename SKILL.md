---
name: post-release-tweet
description: Compose and post a product release announcement to Twitter/X, optionally with a screenshot. Use when the user says a new version is out and wants it tweeted (e.g. "we released 1.0.27, post to twitter", "announce the release on X"). Handles composing the tweet in a configurable house style and posting with media.
---

# Post a product release announcement to Twitter/X

Use this when the user wants to announce a software release on Twitter/X, with or
without a screenshot. The tweet format is driven by an optional brand config so the
same skill works for any product.

## Setup (first-time / fresh clone)
- Install deps once: `cd <skill-dir> && npm install`.
- Provide Twitter/X credentials one of two ways:
  - Configure a user-scope `twitter` MCP server in `~/.claude.json` with an `env`
    block holding `API_KEY`, `API_SECRET_KEY`, `ACCESS_TOKEN`, `ACCESS_TOKEN_SECRET`
    (the helper reads them from there — single source of truth), **or**
  - Export those 4 variables in the shell before running `post.js` (env values
    take precedence over the config).
- All 4 must come from **one** X app that sits under a Project with **Read+Write**
  permission — see "Credential gotchas" below.
- **(Optional) Brand config:** copy `config.example.json` to `config.json` and fill in
  your product name, tagline, hashtags, and (optionally) `repo` (`owner/name`) to pull
  release notes from GitHub. If `config.json` is absent, ask the user for these values
  instead. `config.json` is git-ignored so brand details / forks stay local.

## Inputs to gather from the user
- **Product name** — from `config.json` if present, else ask.
- **Version** (e.g. `1.0.27`).
- **Highlights** — the 1–4 headline features/fixes to call out. If `gh` is configured,
  pull these from the GitHub Releases page instead of asking (see "Pulling highlights
  from GitHub Releases" below); otherwise ask the user.
- **Screenshot** (optional) — a path or an attached image. macOS screenshots often
  live at `~/Desktop/Screenshot *.png` and use a **narrow no-break space** before
  "AM/PM", so match them with a glob (`ls ~/Desktop/Screenshot*<time>*.png`), not a
  literal path.

## Pulling highlights from GitHub Releases (when `gh` is configured)
When the GitHub CLI is available and authenticated, source the highlights from the
project's Releases page instead of asking the user to type them out. The fetch is
built into `post.js`:

```bash
cd <skill-dir>
node post.js release <VERSION>   # a specific tag; omit <VERSION> for the latest release
REPO=owner/name node post.js release 1.0.27   # override the repo explicitly
```

- **Repo resolution:** `$REPO` → `repo` in `config.json` → `gh`'s cwd inference. If
  none resolve and you're not inside the repo, ask the user which repo to read.
- **Tag matching:** the helper tries the tag as given, then with/without a leading
  `v`, then falls back sensibly. It prints the release as JSON
  (`{name, tagName, body}`) on stdout.
- **If `gh` isn't usable:** the helper exits non-zero with `GH_UNAVAILABLE` (not
  installed / not authenticated) or `RELEASE_NOT_FOUND`. In that case, fall back to
  asking the user for the highlights.
- **Distill the body:** the `body` is markdown changelog text — extract the 1–4 most
  user-facing items and rephrase each as a short benefit (don't paste raw changelog
  lines or commit subjects).

## Only tweet what's new (diff against the last release tweet)
Before drafting, check the account's previous release announcement and drop anything
already covered there, so the new tweet only calls out genuinely new items:

1. **Fetch recent tweets:** `cd <skill-dir> && node post.js last-tweet` prints the
   account's recent original tweets as JSON. Identify the most recent
   release-announcement tweet (starts with `🚀 <PRODUCT> <VERSION> is here!`).
2. **Diff the highlights:** compare the items you pulled from the new release against
   what that tweet already announced. Keep only the items **not** in the last release
   tweet; those are the highlights for the new one.
3. If `last-tweet` fails (e.g. read access not available on the API tier), note it and
   proceed with all of the new release's highlights.

Always show the user the highlights you kept and the drafted tweet for approval — these
helpers only save typing, they don't skip the confirmation gate.

## Tweet style (house format)
Keep under 280 characters. Match this structure (fields in `<...>` come from the brand
config or the user):

```
🚀 <PRODUCT> <VERSION> is here!

<emoji> <Feature 1 — short benefit>
<emoji> <Feature 2 — short benefit>

<TAGLINE>

<HASHTAGS>
```

Guidelines:
- One line per highlight, each led by a relevant emoji (✨ new, 🔄 update, ⚡ perf, 🐛 fix, 🎨 UI).
- Phrase each highlight as a user benefit, not a raw changelog line.
- Include the `tagline` from the config if one is set; otherwise omit that line.
- Use the `hashtags` from the config; if none are configured, suggest a relevant few
  and confirm with the user. Lowercase-camel the brandy ones (e.g. `#localAI`).
- **Always show the user the drafted text and get approval before posting** — a tweet
  is public and effectively permanent.

## Posting

### With a screenshot (preferred when one is provided)
Text-only MCP tools cannot attach media. For image tweets, use the helper script in
this skill directory, which uploads the media then posts. It reads the 4 OAuth 1.0a
credentials from the user-scope twitter MCP config in `~/.claude.json` (single source
of truth — no secrets stored in the skill).

```bash
cd <skill-dir>
IMG=$(ls ~/Desktop/Screenshot*<time>*.png)   # or the path the user gave
TWEET_TEXT="<the approved draft>" IMAGE_PATH="$IMG" node post.js
```

First run may need deps: `cd <skill-dir> && npm install`.

On success the script prints `POSTED_OK {...}` with the tweet `id`; give the user the
link `https://x.com/i/status/<id>`.

### Text-only (no screenshot)
Either run `node post.js` with no `IMAGE_PATH`, or — in a session where the twitter
MCP tools are loaded — call the `post_tweet` MCP tool with the approved text. (Note:
MCP tools added via `claude mcp add` only load after a session restart.)

### Deleting a tweet
To remove a tweet (e.g. to re-post with a different screenshot), pass its id:

```bash
cd <skill-dir>
node post.js delete <tweet-id>
```

Prints `DELETED {"deleted":true}` on success. The id is the one from `POSTED_OK` or
the tail of the `https://x.com/i/status/<id>` link.

## Credential gotchas (learned the hard way)
If posting fails, the error `detail` tells you exactly what's wrong:
- `client-not-enrolled` (403) → the app is a **Standalone App**, not inside a
  **Project**. Fix in developer.x.com: create a Project and put the app under it.
- `oauth1-permissions` (403) → app permission is **Read-only**. Set **Read and Write**
  in the app's *User authentication settings*, then **regenerate the Access Token**
  (a token minted before enabling write stays read-only).
- `Invalid or expired token` (401, code 89) → the Access Token doesn't match the
  Consumer Key. Regenerating the **API Key/Secret invalidates existing Access
  Tokens** — always pull all 4 values from the **same** app in one sitting, API
  key first, then the access token.
- All 4 credentials (API Key, API Secret, Access Token, Access Token Secret) must come
  from **one** app that is under a Project with Read+Write.
