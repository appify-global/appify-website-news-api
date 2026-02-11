# RSS Feeds Setup

This project supports multiple RSS feeds for article scraping.

## Supported Feeds

The system now supports:
- **Wired**: `https://www.wired.com/feed/rss`
- **TechCrunch**: `https://techcrunch.com/feed/`
- **Custom feeds**: Via environment variables

## Configuration Options

### Option 1: Comma-separated URLs (Recommended)

Set `RSS_FEED_URL` with multiple feeds separated by commas:

```
RSS_FEED_URL=https://www.wired.com/feed/rss,https://techcrunch.com/feed/,https://your-custom-feed.com/rss
```

### Option 2: Individual Feed Variables

Set individual environment variables for each feed:

```
WIRED_RSS_FEED_URL=https://www.wired.com/feed/rss
TECHCRUNCH_RSS_FEED_URL=https://techcrunch.com/feed/
```

### Option 3: Default Feeds

If no environment variables are set, the system defaults to:
- Wired: `https://www.wired.com/feed/rss`
- TechCrunch: `https://techcrunch.com/feed/`

## How It Works

1. **Multiple Feeds**: The system fetches from all configured feeds
2. **Deduplication**: Articles are deduplicated by `sourceUrl` (prevents duplicates across feeds)
3. **Error Handling**: If one feed fails, the system continues with other feeds
4. **Processing**: All new articles from all feeds are processed together

## Adding New Feeds

To add a new RSS feed:

1. Add it to `RSS_FEED_URL` (comma-separated), or
2. Create a new environment variable like `NEWSITE_RSS_FEED_URL` and update `getRSSFeedUrls()` in `src/services/rss.ts`

## Example Environment Variables

```bash
# Option 1: Comma-separated
RSS_FEED_URL=https://www.wired.com/feed/rss,https://techcrunch.com/feed/

# Option 2: Individual variables
WIRED_RSS_FEED_URL=https://www.wired.com/feed/rss
TECHCRUNCH_RSS_FEED_URL=https://techcrunch.com/feed/
```
