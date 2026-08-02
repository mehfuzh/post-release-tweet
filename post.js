// Posts a tweet (optionally with an image) using the Smartloop twitter MCP creds.
// Credentials are read from the user-scope `twitter` MCP server in ~/.claude.json,
// so this stays the single source of truth (no secrets duplicated here).
//
// Usage:
//   TWEET_TEXT="..." [IMAGE_PATH="/path/to.png"] node post.js
//
// Env overrides (API_KEY / API_SECRET_KEY / ACCESS_TOKEN / ACCESS_TOKEN_SECRET)
// take precedence over the values pulled from ~/.claude.json if provided.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

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
