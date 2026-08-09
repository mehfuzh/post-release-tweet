// Posts a tweet (optionally with an image) using the Smartloop twitter MCP creds.
// Credentials are read from the user-scope `twitter` MCP server in ~/.claude.json,
// so this stays the single source of truth (no secrets duplicated here).
//
// Usage:
//   TWEET_TEXT="..." [IMAGE_PATH="/path/to.png"] node post.js
//
// Fetch release notes from GitHub (when `gh` is configured) instead of posting:
//   node post.js release [<version>]   # latest release when <version> is omitted
//   REPO=owner/name node post.js release 1.0.27
// Prints the release JSON ({name, tagName, body}) for the caller to distill into
// highlights. Repo is taken from $REPO, then config.json's "repo", then gh's cwd
// inference.
//
// Env overrides (API_KEY / API_SECRET_KEY / ACCESS_TOKEN / ACCESS_TOKEN_SECRET)
// take precedence over the values pulled from ~/.claude.json if provided.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { TwitterApi } = require('twitter-api-v2');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  } catch (_) {
    return {};
  }
}

// Fetch a GitHub release via `gh` and print its JSON. Requires `gh` installed and
// authenticated; falls back with a clear error otherwise so the caller can ask the
// user for highlights instead.
function fetchRelease(version) {
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  } catch (_) {
    console.error('GH_UNAVAILABLE: gh is not installed or not authenticated; ask the user for highlights.');
    process.exit(2);
  }

  const repo = process.env.REPO || loadConfig().repo;
  const repoArgs = repo ? ['--repo', repo] : [];
  const jsonArgs = ['--json', 'name,tagName,body'];

  // Try the given tag (as-is, then with/without a leading "v"); fall back to latest.
  const candidates = [];
  if (version) {
    const v = String(version).trim();
    candidates.push(v);
    candidates.push(v.startsWith('v') ? v.slice(1) : `v${v}`);
  } else {
    candidates.push(null); // `gh release view` with no tag = latest
  }

  let lastErr = '';
  for (const tag of candidates) {
    const args = ['release', 'view', ...(tag ? [tag] : []), ...repoArgs, ...jsonArgs];
    try {
      const out = execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'], // capture stderr instead of leaking it
      });
      process.stdout.write(out.trim() + '\n');
      return;
    } catch (e) {
      lastErr = (e.stderr && e.stderr.toString()) || e.message;
    }
  }
  console.error('RELEASE_NOT_FOUND:', lastErr.trim());
  process.exit(3);
}

// Subcommand routing: `node post.js release [version]`.
if (process.argv[2] === 'release') {
  fetchRelease(process.argv[3] || process.env.RELEASE_VERSION);
  return;
}

function credsFromClaudeConfig() {
  try {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8')
    );
    // twitter MCP can live under top-level mcpServers or per-project; scan for it.
    const buckets = [cfg.mcpServers, ...Object.values(cfg.projects || {}).map(p => p && p.mcpServers)];
    for (const b of buckets) {
      if (b && b.twitter && b.twitter.env) return b.twitter.env;
    }
  } catch (_) { /* fall through */ }
  return {};
}

const fromCfg = credsFromClaudeConfig();
const pick = (name) => process.env[name] || fromCfg[name];

const client = new TwitterApi({
  appKey: pick('API_KEY'),
  appSecret: pick('API_SECRET_KEY'),
  accessToken: pick('ACCESS_TOKEN'),
  accessSecret: pick('ACCESS_TOKEN_SECRET'),
});

// Print the account's recent tweets so the caller can find the last release
// announcement and diff its highlights against the new release (only tweet what's new).
//   node post.js last-tweet [<count>]
if (process.argv[2] === 'last-tweet') {
  const count = Math.min(Math.max(parseInt(process.argv[3], 10) || 10, 1), 100);
  (async () => {
    try {
      const me = await client.v2.me();
      const timeline = await client.v2.userTimeline(me.data.id, {
        max_results: count,
        exclude: ['retweets', 'replies'],
        'tweet.fields': ['created_at'],
      });
      const tweets = (timeline.data && timeline.data.data) || [];
      console.log(JSON.stringify(tweets, null, 2));
    } catch (e) {
      console.error('TIMELINE_FAILED:', e.data ? JSON.stringify(e.data) : e.message);
      process.exit(1);
    }
  })();
  return;
}

const text = process.env.TWEET_TEXT;
const imagePath = process.env.IMAGE_PATH;

if (!text) {
  console.error('TWEET_TEXT is required');
  process.exit(1);
}

(async () => {
  try {
    let mediaId = null;
    if (imagePath) {
      try {
        mediaId = await client.v1.uploadMedia(imagePath);
        console.log('Media uploaded, id:', mediaId);
      } catch (e) {
        console.error('MEDIA_UPLOAD_FAILED:', e.data ? JSON.stringify(e.data) : e.message);
      }
    }
    const payload = mediaId ? { text, media: { media_ids: [mediaId] } } : { text };
    const res = await client.v2.tweet(payload);
    console.log('POSTED_OK', JSON.stringify(res.data));
  } catch (e) {
    console.error('TWEET_FAILED:', e.data ? JSON.stringify(e.data) : e.message);
    process.exit(1);
  }
})();
