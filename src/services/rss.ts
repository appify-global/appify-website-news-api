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
  // Comprehensive list of tech, AI, startup, and design feeds
  if (feeds.length === 0) {
    // Core Tech Feeds
    feeds.push("https://www.wired.com/feed/rss");
    feeds.push("https://techcrunch.com/feed/");
    feeds.push("https://www.theverge.com/rss/index.xml");
    feeds.push("https://arstechnica.com/feed/");
    
    // AI & Tech Focused
    feeds.push("https://venturebeat.com/feed/");
    feeds.push("https://www.technologyreview.com/feed/");
    feeds.push("https://www.artificialintelligence-news.com/feed/");
    feeds.push("https://syncedreview.com/feed/");
    feeds.push("https://towardsdatascience.com/feed");
    
    // Startups & Business
    feeds.push("https://www.protocol.com/feed");
    feeds.push("https://www.fastcompany.com/feed");
    feeds.push("https://www.producthunt.com/feed");
    feeds.push("https://blog.ycombinator.com/feed/");
    feeds.push("https://firstround.com/review/feed/");
    
    // Web3 & Blockchain
    feeds.push("https://www.coindesk.com/arc/outboundfeeds/rss/");
    feeds.push("https://decrypt.co/feed");
    feeds.push("https://www.theblock.co/rss.xml");
    
    // Design & UX
    feeds.push("https://www.smashingmagazine.com/feed/");
    feeds.push("https://alistapart.com/main/feed/");
    
    // Work & Culture
    feeds.push("https://feeds.hbr.org/harvardbusiness");
    feeds.push("https://qz.com/feed/");
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

/**
 * Fetch ALL articles from RSS feeds (including ones that may have been processed before).
 * Useful for regenerating deleted articles or processing older content.
 */
export async function fetchAllRSSItems(limit?: number): Promise<RSSItem[]> {
  const feedUrls = getRSSFeedUrls();
  
  if (feedUrls.length === 0) {
    throw new Error("No RSS feed URLs configured");
  }

  console.log(`[RSS] Fetching ALL items from ${feedUrls.length} feed(s) (ignoring existing articles)...`);

  const allItems: RSSItem[] = [];

  // Fetch from all feeds
  for (const feedUrl of feedUrls) {
    try {
      console.log(`[RSS] Fetching feed: ${feedUrl}`);
      const feed = await parser.parseURL(feedUrl);
      console.log(`[RSS] Found ${feed.items.length} items in feed: ${feedUrl}`);

      // Get ALL items, don't filter by existing
      for (const item of feed.items) {
        if (!item.link) continue;

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

        allItems.push({
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
    } catch (error: any) {
      console.error(`[RSS] Failed to fetch feed ${feedUrl}:`, error.message);
      // Continue with other feeds even if one fails
    }
  }

  // Apply limit if specified
  const items = limit ? allItems.slice(0, limit) : allItems;
  console.log(`[RSS] Returning ${items.length} items from all feeds (${limit ? `limited to ${limit}` : 'no limit'}).`);
  return items;
}