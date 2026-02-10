# Generate Articles on Railway

## Option 1: Use Railway CLI (Recommended)

1. **Install Railway CLI** (if not installed):
   ```bash
   npm i -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Link to your project**:
   ```bash
   railway link
   ```
   Select your project: `78bd5091-3246-433e-9a79-20b1f001fde1`

4. **Run article generator**:
   ```bash
   railway run npm run generate
   ```

## Option 2: Use Railway Dashboard

1. Go to Railway Dashboard
2. Click on **"AppifyGlobal_Backend"** service
3. Go to **"Deployments"** tab
4. Click **"View logs"** on the latest deployment
5. Use the **"Shell"** or **"Run Command"** feature
6. Run: `npm run generate`

## Option 3: Trigger via API (If you have an admin endpoint)

You can also create an admin endpoint to trigger generation, but for now, use Railway CLI.

## Environment Variables Needed

Make sure these are set in Railway:
- `DATABASE_URL` (should be auto-set from Postgres service)
- `OPENAI_API_KEY`
- `XAI_API_KEY`
- `RSS_FEED_URL`
- `ENABLE_CRON=true` (optional, for auto-generation)

## After Generation

Articles will be created with status `pending_review`. To publish them:

1. Use Railway CLI:
   ```bash
   railway run node publish-article.js
   ```

2. Or update via API (if you add an admin endpoint)

3. Or manually update in database
