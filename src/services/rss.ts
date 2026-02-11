import Parser from "rss-parser";
import { prisma } from "../lib/prisma";

const parser = new Parser();

export interface RSSItem {
  title: string;
  link: string;
  contentSnippet?: string;
  content?: string;
  pubDate?: string;
  categories?: string[];
  enclosure?: { url?: string };
  imageUrl?: string; // Extracted image from content or enclosure
}

/**
 * Get RSS feed URLs from environment variables.
 * Supports multiple feeds via comma-separated RSS_FEED_URL or individual feed variables.
 */
function getRSSFeedUrls(): string[] {
  const feeds: string[] = [];

  // Check for comma-separated RSS_FEED_URL
  const feedUrl = process.env.RSS_FEED_URL;
  if (feedUrl) {
    feeds.push(...feedUrl.split(",").map((url) => url.trim()).filter((url) => url));
  }

  // Check for individual feed environment variables
  if (process.env.WIRED_RSS_FEED_URL) {
    feeds.push(process.env.WIRED_RSS_FEED_URL);
  }
  if (process.env.TECHCRUNCH_RSS_FEED_URL) {
    feeds.push(process.env.TECHCRUNCH_RSS_FEED_URL);
  }

  // Default feeds if no environment variables are set
  if (feeds.length === 0) {
    feeds.push("https://www.wired.com/feed/rss");
    feeds.push("https://techcrunch.com/feed/");
  }

  return feeds;
}

/**
 * Fetch new articles from RSS feeds that haven't been processed yet.
 * Supports multiple RSS feeds and returns only items whose source URL doesn't already exist in the database.
 */
export async function fetchNewRSSItems(): Promise<RSSItem[]> {
  const feedUrls = getRSSFeedUrls();
  
  if (feedUrls.length === 0) {
    throw new Error("No RSS feed URLs configured");
  }

  console.log(`[RSS] Fetching ${feedUrls.length} feed(s): ${feedUrls.join(", ")}`);

  const allNewItems: RSSItem[] = [];

  // Fetch from all feeds
  for (const feedUrl of feedUrls) {
    try {
      console.log(`[RSS] Fetching feed: ${feedUrl}`);
      const feed = await parser.parseURL(feedUrl);
      console.log(`[RSS] Found ${feed.items.length} items in feed: ${feedUrl}`);

      // Filter out items that already exist in the database
      for (const item of feed.items) {
        if (!item.link) continue;

        const exists = await prisma.article.findUnique({
          where: { sourceUrl: item.link },
          select: { id: true },
        });

        if (!exists) {
          // Extract image from RSS item
          let imageUrl: string | undefined;
          
          // Check enclosure first (RSS standard for images)
          if (item.enclosure?.url) {
            imageUrl = item.enclosure.url;
          }
          // Check content for img tags
          else if (item.content) {
            const imgMatch = item.content.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
            if (imgMatch && imgMatch[1]) {
              imageUrl = imgMatch[1];
            }
          }
          // Check itunes:image or media:content (common RSS extensions)
          else if ((item as any)["itunes:image"]?.href) {
            imageUrl = (item as any)["itunes:image"].href;
          }
          else if ((item as any)["media:content"]?.url) {
            imageUrl = (item as any)["media:content"].url;
          }

          allNewItems.push({
            title: item.title || "Untitled",
            link: item.link,
            contentSnippet: item.contentSnippet,
            content: item.content,
            pubDate: item.pubDate,
            categories: item.categories,
            enclosure: item.enclosure,
            imageUrl,
          });
        }
      }
    } catch (error: any) {
      console.error(`[RSS] Failed to fetch feed ${feedUrl}:`, error.message);
      // Continue with other feeds even if one fails
    }
  }

  console.log(`[RSS] ${allNewItems.length} new items to process from all feeds.`);
  return allNewItems;
}
