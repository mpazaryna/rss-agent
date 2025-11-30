import type { FeedItem } from "./types";
import type { SummaryStyle } from "./summarize";

export type DigestFormat = "markdown" | "html";

export interface DigestRequestBody {
  collection?: string;
  feeds?: Array<{ url: string }>;
  since?: string;
  limit?: number;
  format?: DigestFormat;
  summaryStyle?: SummaryStyle;
  title?: string;
}

export interface DigestArticle {
  title: string;
  url: string;
  published?: string;
  summary: string;
  source: string;
}

export interface DigestSection {
  source: string;
  articles: DigestArticle[];
}

export interface DigestSuccessResponse {
  success: true;
  digest: string;
  format: DigestFormat;
  meta: {
    feedCount: number;
    articleCount: number;
    summarizedCount: number;
    generatedAt: string;
  };
}

// Embedded collections - keep in sync with config/feed-collections.json
// This allows the worker to be self-contained without external config fetches
export const COLLECTIONS: Record<string, { name: string; feeds: Array<{ url: string; name: string }> }> = {
  "ai-ml": {
    name: "AI & Machine Learning",
    feeds: [
      { url: "https://huggingface.co/blog/feed.xml", name: "Hugging Face Blog" },
      { url: "https://openai.com/blog/rss.xml", name: "OpenAI Blog" },
    ],
  },
  "tech-news": {
    name: "Tech News",
    feeds: [
      { url: "https://feeds.arstechnica.com/arstechnica/index", name: "Ars Technica" },
      { url: "https://www.theverge.com/rss/index.xml", name: "The Verge" },
    ],
  },
  "dev-tools": {
    name: "Development & Infrastructure",
    feeds: [
      { url: "https://blog.cloudflare.com/rss/", name: "Cloudflare Blog" },
      { url: "https://github.blog/feed/", name: "GitHub Blog" },
    ],
  },
};

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatDigestMarkdown(
  sections: DigestSection[],
  title?: string
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines: string[] = [];

  lines.push(`# ${title || "Daily Digest"}`);
  lines.push("");
  lines.push(`*Generated: ${dateStr}*`);
  lines.push("");

  for (const section of sections) {
    if (section.articles.length === 0) continue;

    lines.push(`## ${section.source}`);
    lines.push("");

    for (const article of section.articles) {
      lines.push(`### [${article.title}](${article.url})`);
      if (article.published) {
        lines.push(`*${formatDate(article.published)}*`);
      }
      lines.push("");
      lines.push(article.summary);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("*Powered by rss-agent + Workers AI (Mistral)*");

  return lines.join("\n");
}

export function formatDigestHtml(
  sections: DigestSection[],
  title?: string
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const articleHtml = sections
    .filter((s) => s.articles.length > 0)
    .map((section) => {
      const articlesHtml = section.articles
        .map((article) => {
          const dateHtml = article.published
            ? `<p style="color: #666; font-size: 0.9em; margin: 0.25em 0;"><em>${formatDate(article.published)}</em></p>`
            : "";
          return `
        <div style="margin-bottom: 1.5em;">
          <h3 style="margin: 0 0 0.25em 0;">
            <a href="${escapeHtml(article.url)}" style="color: #1a73e8; text-decoration: none;">
              ${escapeHtml(article.title)}
            </a>
          </h3>
          ${dateHtml}
          <p style="margin: 0.5em 0; line-height: 1.5;">${escapeHtml(article.summary)}</p>
        </div>`;
        })
        .join("\n");

      return `
      <div style="margin-bottom: 2em;">
        <h2 style="border-bottom: 1px solid #ddd; padding-bottom: 0.5em; color: #333;">
          ${escapeHtml(section.source)}
        </h2>
        ${articlesHtml}
      </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title || "Daily Digest")}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <header style="margin-bottom: 2em;">
    <h1 style="margin: 0 0 0.25em 0; color: #1a1a1a;">${escapeHtml(title || "Daily Digest")}</h1>
    <p style="color: #666; margin: 0;"><em>Generated: ${dateStr}</em></p>
  </header>

  <main>
    ${articleHtml}
  </main>

  <footer style="margin-top: 2em; padding-top: 1em; border-top: 1px solid #ddd; color: #666; font-size: 0.9em;">
    <p><em>Powered by rss-agent + Workers AI (Mistral)</em></p>
  </footer>
</body>
</html>`;
}

export function buildDigestSections(
  batchResults: Array<{
    success: boolean;
    feed?: { title: string };
    items?: FeedItem[];
  }>
): DigestSection[] {
  return batchResults
    .filter((r) => r.success && r.items && r.items.length > 0)
    .map((r) => ({
      source: r.feed?.title || "Unknown Source",
      articles: r.items!.map((item) => ({
        title: item.title,
        url: item.url,
        published: item.published,
        summary: item.summary || "No summary available.",
        source: r.feed?.title || "Unknown Source",
      })),
    }));
}
