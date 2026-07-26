import type { APIContext } from 'astro';

export function GET(context: APIContext) {
  const sitemapUrl = context.site
    ? new URL('sitemap-index.xml', context.site).toString()
    : '/sitemap-index.xml';

  const body = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
