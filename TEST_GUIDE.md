# Testing Article Generation

## Option 1: Test on Railway (Recommended)

Since your backend is deployed on Railway with environment variables already configured:

1. **SSH into Railway or use Railway CLI:**
   ```bash
   railway run pnpm generate
   ```

2. **Or trigger via API** (if you have an endpoint set up)

3. **Check the logs** in Railway dashboard to see the generation process

4. **Verify in database:**
   - Check Railway Postgres database
   - Look for new articles in the `articles` table
   - Check that `topics`, `title`, `contentBlocks` are populated correctly

## Option 2: Test Locally

1. **Create `.env` file** in `AppifyBackend/`:
   ```env
   DATABASE_URL=postgresql://postgres:SutGuMkPQWYuWNudhUrpDWYWQgfUHYWZ@shortline.proxy.rlwy.net:53169/railway
   OPENAI_API_KEY=sk-your-key-here
   XAI_API_KEY=xai-your-key-here
   RSS_FEED_URL=https://rss.app/feeds/_Ftsh8MCjwTLhxIZJ.xml
   MAX_ARTICLES_PER_RUN=1
   ```

2. **Run generation:**
   ```bash
   npm run generate
   # or
   npx tsx src/cron/generateArticles.ts
   ```

3. **Check output** - you should see:
   - RSS feed fetching
   - OpenAI blog generation
   - SEO optimization
   - HTML conversion
   - Title generation
   - Meta description generation
   - Image generation
   - Database save confirmation

## What to Verify

After generation, check that articles have:

✅ **Correct structure:**
- `title`: Generated SEO-friendly title (< 60 chars)
- `topics`: One of: AI, Automation, Web, Startups, Defi, Web3, Work, Design, Culture
- `excerpt`: First 200 chars or meta description
- `metaTitle`: SEO meta title
- `metaDescription`: SEO meta description (< 210 chars)
- `contentBlocks`: Array with proper structure (heading, paragraph, image)

✅ **Content blocks format:**
```json
{
  "type": "heading",
  "text": "ICELAND: THE WORLD'S SAFEST COUNTRY..."
}
{
  "type": "paragraph", 
  "text": "Iceland consistently ranks..."
}
```

✅ **Frontend compatibility:**
- Headings should be in ALL CAPS (for frontend styling)
- HTML links preserved in paragraphs
- Images have proper src and alt

## Testing Frontend Display

1. **Start frontend:**
   ```bash
   cd Appify
   npm run dev
   ```

2. **Check API endpoint:**
   - `GET http://localhost:4000/api/news` - Returns paginated articles. Response shape:
     - `articles` – array of article objects for the requested page
     - `total` – total count of articles matching the filter
     - `totalPages` / `total_pages` – number of pages
     - `hasMore` / `has_more` – true if more pages exist (frontend can stop when false)
     - `page`, `limit`, `offset` – current page and size
   - Query: `?limit=50&offset=0` (default limit 50, max 100). No date filter – all published articles are returned; use pagination until `hasMore` is false to load all.
   - `GET http://localhost:4000/api/news/[slug]` - Should return single article

3. **Verify on frontend:**
   - Navigate to `/news/[slug]`
   - Check that:
     - Title displays correctly
     - Date format is correct (DD/MM/YYYY)
     - Topics/category shows properly
     - Content blocks render (headings in caps, paragraphs normal)
     - Image displays

## Troubleshooting

- **No articles generated:** Check RSS feed has new items
- **Missing topics:** Check SEO optimization step
- **Wrong title format:** Check title generator output
- **Content blocks empty:** Check HTML conversion and parsing
- **Frontend not showing:** Check API response format matches frontend expectations
