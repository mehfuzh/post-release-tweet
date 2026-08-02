---
name: post-release-tweet
description: Post a Smartloop release announcement to Twitter/X, optionally with a screenshot. Use when the user says a new version is out and wants it tweeted (e.g. "we released 1.0.27, post to twitter", "announce the release on X"). Handles composing the tweet in the house style and posting with media.
---

# Post a Smartloop release announcement to Twitter/X

Use this when the user wants to announce a Smartloop release on Twitter/X, with or
without a screenshot.

## Setup (first-time / fresh clone)
- Install deps once: `cd ~/.claude/skills/post-release-tweet && npm install`.
- Provide Twitter/X credentials one of two ways:
  - Configure a user-scope `twitter` MCP server in `~/.claude.json` with an `env`
    block holding `API_KEY`, `API_SECRET_KEY`, `ACCESS_TOKEN`, `ACCESS_TOKEN_SECRET`
    (the helper reads them from there — single source of truth), **or**
  - Export those 4 variables in the shell before running `post.js` (env values
    take precedence over the config).
- All 4 must come from **one** X app that sits under a Project with **Read+Write**
  permission — see "Credential gotchas" below.

## Inputs to gather from the user
- **Version** (e.g. `1.0.27`).
- **Highlights** — the 1–4 headline features/fixes to call out.
- **Screenshot** (optional) — a path or an attached image. macOS screenshots often
  live at `~/Desktop/Screenshot *.png` and use a **narrow no-break space** before
  "AM/PM", so match them with a glob (`ls ~/Desktop/Screenshot*<time>*.png`), not a
  literal path.

## Tweet style (house format)
Keep under 280 characters. Match this structure:

```
🚀 Smartloop Studio <VERSION> is here!

<emoji> <Feature 1 — short benefit>
<emoji> <Feature 2 — short benefit>

Private, local AI on your machine.

#localAI #AI #privacy #LLM
```

Guidelines:
- One line per highlight, each led by a relevant emoji (✨ new, 🔄 update, ⚡ perf, 🐛 fix, 🎨 UI).
- Phrase each highlight as a user benefit, not a raw changelog line.
- Always include the tagline `Private, local AI on your machine.`
- Hashtags: always include **#localAI**; round out with a relevant few from
  `#AI #privacy #LLM #opensource`. Lowercase-camel the brandy ones like `#localAI`.
- **Always show the user the drafted text and get approval before posting** — a tweet
  is public and effectively permanent.

## Posting

### With a screenshot (preferred when one is provided)
The `@enescinar/twitter-mcp` MCP tool is **text-only** and cannot attach media. For
image tweets, use the helper script in this skill directory, which uploads the media
then posts. It reads the 4 OAuth 1.0a credentials from the user-scope twitter MCP
config in `~/.claude.json` (single source of truth — no secrets stored in the skill).

```bash
cd ~/.claude/skills/post-release-tweet
IMG=$(ls ~/Desktop/Screenshot*<time>*.png)   # or the path the user gave
TWEET_TEXT="<the approved draft>" IMAGE_PATH="$IMG" node post.js
```

First run may need deps: `cd ~/.claude/skills/post-release-tweet && npm install`.

On success the script prints `POSTED_OK {...}` with the tweet `id`; give the user the
link `https://x.com/i/status/<id>`.

### Text-only (no screenshot)
Either run `node post.js` with no `IMAGE_PATH`, or — in a session where the twitter
MCP tools are loaded — call the `post_tweet` MCP tool with the approved text. (Note:
MCP tools added via `claude mcp add` only load after a session restart.)

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
