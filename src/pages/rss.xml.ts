import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { guideHref, sortByPublished } from '@/lib/guides';
import { SITE_NAME, SITE_DESCRIPTION } from '@/data/nav';

export async function GET(context: APIContext) {
  const guides = sortByPublished(await getCollection('guides', ({ data }) => !data.draft)).slice(
    0,
    30
  );

  return rss({
    title: `${SITE_NAME} — 킹샷 한국어 공략`,
    description: SITE_DESCRIPTION,
    site: context.site ?? 'https://example.com',
    trailingSlash: true,
    customData: '<language>ko-kr</language>',
    items: guides.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.published,
      link: guideHref(entry),
      categories: [entry.data.category, ...entry.data.tags],
    })),
  });
}
