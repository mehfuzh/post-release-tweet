# post-release-tweet

A [Claude Code](https://claude.com/claude-code) skill that composes and posts a
product **release announcement** to Twitter/X — optionally with a screenshot — in a
configurable house style.

## Install

Drop this directory into your Claude skills folder (e.g.
`~/.claude/skills/post-release-tweet`), then:

```bash
cd ~/.claude/skills/post-release-tweet
npm install
```

## Configure

**Credentials** — provide four OAuth 1.0a values from a single X app that lives under
a Project with **Read + Write** permission, either by:

- adding a user-scope `twitter` MCP server in `~/.claude.json` with an `env` block
  holding `API_KEY`, `API_SECRET_KEY`, `ACCESS_TOKEN`, `ACCESS_TOKEN_SECRET`, or
- exporting those four variables in your shell (they override the config).

No secrets are stored in this repo — the helper reads them at runtime.

**Brand (optional)** — copy the example config and fill in your details:

```bash
cp config.example.json config.json
```

`config.json` is git-ignored, so brand details and forks stay local.

## Use

In Claude Code, say something like *"we released 1.0.27, post it to twitter"* and the
skill will gather the version + highlights, draft the tweet, show it to you for
approval, and post it (with media if you provide a screenshot).

See [`SKILL.md`](./SKILL.md) for the full format, posting flow, and credential
troubleshooting.
