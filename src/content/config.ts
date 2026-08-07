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

export const collections = {
  zhi: postCollection,
  si: postCollection,
  zhen: postCollection,
  fu: postCollection,
};
