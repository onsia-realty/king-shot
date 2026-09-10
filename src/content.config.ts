import { defineCollection, z, reference } from 'astro:content';
import { glob } from 'astro/loaders';

const troopClass = z.enum(['보병', '궁병', '기병']);
const rarity = z.enum(['SSR', 'SR', 'R', 'N']);
const tier = z.enum(['S+', 'S', 'A', 'B', 'C', 'D']);

const guides = defineCollection({
  loader: glob({ base: './src/content/guides', pattern: '**/*.md' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['입문', '영웅', '전투', '건설', '이벤트', '연맹', '과금', '이민']),
    tags: z.array(z.string()).default([]),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    cover: image().optional(),
    difficulty: z.enum(['입문', '중급', '고급']).default('중급'),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    related: z.array(reference('guides')).default([]),
  }),
});

const heroes = defineCollection({
  loader: glob({ base: './src/content/heroes', pattern: '**/*.md' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    nameEn: z.string(),
    generation: z.number().int().min(1).max(10),
    rarity,
    troopClass,
    portrait: image().optional(),
    acquisition: z.enum(['파밍', '영웅룰렛', '명예의전당', '패키지', '이벤트']),
    summary: z.string(),
    stats: z.object({ attack: z.number(), defense: z.number(), hp: z.number() }).optional(),
    skills: z.array(z.object({
      name: z.string(),
      type: z.enum(['원정', '성장', '합류']),
      description: z.string(),
    })).default([]),
    exclusiveGear: z.string().optional(),
    ratings: z.object({
      bearRally: tier.optional(),
      garrison: tier.optional(),
      arena: tier.optional(),
      f2p: tier.optional(),
    }).default({}),
    order: z.number().default(0),
  }),
});

const buildings = defineCollection({
  loader: glob({ base: './src/content/buildings', pattern: '**/*.md' }),
  schema: ({ image }) => z.object({
    name: z.string(),        // 한국어명
    nameEn: z.string(),
    icon: image().optional(),
    summary: z.string(),
    unlock: z.string().optional(),   // 해금 조건
    maxLevel: z.number().optional(),
    effects: z.array(z.string()).default([]),
    order: z.number().default(0),
  }),
});

const pets = defineCollection({
  loader: glob({ base: './src/content/pets', pattern: '**/*.md' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    nameEn: z.string(),
    rarity,
    icon: image().optional(),
    summary: z.string(),
    skills: z.array(z.object({ name: z.string(), description: z.string() })).default([]),
    order: z.number().default(0),
  }),
});

export const collections = { guides, heroes, buildings, pets };
