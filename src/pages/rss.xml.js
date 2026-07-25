import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const allPosts = [
    ...(await getCollection('zhi')).map(p => ({ ...p, category: '知', emoji: '📘' })),
    ...(await getCollection('si')).map(p => ({ ...p, category: '思', emoji: '📝' })),
    ...(await getCollection('zhen')).map(p => ({ ...p, category: '帧', emoji: '📷' })),
    ...(await getCollection('fu')).map(p => ({ ...p, category: '馥', emoji: '🌸' })),
  ].sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  return rss({
    title: "pessimist11",
    description: "知·思·帧·馥 — 关于技术、生活、旅行与气味",
    site: context.site,
    items: allPosts.map(post => ({
      title: `[${post.emoji}${post.category}] ${post.data.title}`,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/${post.collection}/${post.id}/`,
    })),
  });
}
