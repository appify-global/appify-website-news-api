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
}

/**
 * Fetch new articles from the RSS feed that haven't been processed yet.
 * Returns only items whose source URL doesn't already exist in the database.
 */
export async function fetchNewRSSItems(): Promise<RSSItem[]> {
  const feedUrl = process.env.RSS_FEED_URL;
  if (!feedUrl) {
    throw new Error("RSS_FEED_URL is not set");
  }

  console.log(`[RSS] Fetching feed: ${feedUrl}`);
  const feed = await parser.parseURL(feedUrl);
  console.log(`[RSS] Found ${feed.items.length} items in feed.`);

  // Filter out items that already exist in the database
  const newItems: RSSItem[] = [];

  for (const item of feed.items) {
    if (!item.link) continue;

    const exists = await prisma.article.findUnique({
      where: { sourceUrl: item.link },
      select: { id: true },
    });

    if (!exists) {
      newItems.push({
        title: item.title || "Untitled",
        link: item.link,
        contentSnippet: item.contentSnippet,
        content: item.content,
        pubDate: item.pubDate,
        categories: item.categories,
        enclosure: item.enclosure,
      });
    }
  }

  console.log(`[RSS] ${newItems.length} new items to process.`);
  return newItems;
}
