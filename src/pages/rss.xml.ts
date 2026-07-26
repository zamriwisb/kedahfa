import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { loadSiteData } from '../lib/content';

export async function GET(context: APIContext) {
  const { club, articles } = await loadSiteData();

  return rss({
    title: `${club.name} news`,
    description: `The latest news and match reports from ${club.name}.`,
    site: context.site!,
    items: articles.map((article) => ({
      title: article.title,
      description: article.excerpt,
      pubDate: article.date,
      link: `/news/${article.slug}`,
    })),
  });
}
