import { defineCollection, z } from 'astro:content';

const postCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    coverImage: z.string().optional(),
    coverImages: z.array(z.string()).optional(),
    // 帧 专属字段
    location: z.string().optional(),
    camera: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    // 馥 专属字段
    brand: z.string().optional(),
    notes: z.array(z.string()).optional(),
    rating: z.number().min(1).max(5).optional(),
  }),
});

const appleMusicUrl = (host: string) => z.string().url().refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === host && !url.username && !url.password && !url.port;
  } catch { return false; }
}, '请使用 Apple Music 官方 HTTPS 链接');

const musicCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    artist: z.string(),
    pubDate: z.date(),
    description: z.string().optional(),
    album: z.string().optional(),
    releaseYear: z.number().int().optional(),
    genre: z.string().optional(),
    coverImage: z.string().url().optional(),
    musicUrl: appleMusicUrl('music.apple.com'),
    embedUrl: appleMusicUrl('embed.music.apple.com').optional(),
  }),
});

export const collections = {
  zhi: postCollection,
  si: postCollection,
  zhen: postCollection,
  fu: postCollection,
  ling: musicCollection,
};
