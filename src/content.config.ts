import { defineCollection, z, reference } from 'astro:content';
import { glob } from 'astro/loaders';

const troopClass = z.enum(['보병', '궁병', '기병']);
const rarity = z.enum(['SSR', 'SR', 'R', 'N']);
const tier = z.enum(['S+', 'S', 'A', 'B', 'C', 'D']);

/** 토벌(절대수치) 스탯 한 묶음 */
const statBlock = z.object({ attack: z.number(), defense: z.number(), hp: z.number() });

/**
 * 영웅 스킬 한 개.
 * 게임은 스킬을 토벌(성 밖 전투)과 원정(전장 편성)으로 나누고,
 * 일부 영웅은 어느 쪽에도 안 들어가는 특성 스킬을 따로 가진다.
 * description 의 {v1}·{v2} 자리표시자를 levels·levels2 값으로 채워 화면에 뿌린다.
 */
const heroSkill = z.object({
  name: z.string(),            // 한국어 스킬명
  nameEn: z.string(),          // 영문 원문 (대조 및 아이콘 슬러그용)
  mode: z.enum(['토벌', '원정', '특성']),
  description: z.string(),     // {v1}, 필요하면 {v2} 자리표시자를 포함한다
  levels: z.array(z.string()).default([]),   // ["80%","90%","100%","110%","120%"]
  levels2: z.array(z.string()).default([]),  // 두 번째 수치 줄. 대부분 비어 있다
});

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
    stats: z.object({
      exploration: statBlock.optional(),
      expedition: z.object({ attack: z.string(), defense: z.string() }).optional(),
    }).optional(),
    heroClass: z.enum(['전투', '성장', '지원']).optional(),
    skills: z.array(heroSkill).default([]),
    exclusiveGear: z.object({
      name: z.string(),
      nameEn: z.string(),
      exploration: statBlock.optional(),
      expedition: z.object({ lethality: z.string(), hp: z.string() }).optional(),
      parts: z.array(z.number()).default([]),   // 부속품 수량 [5,10,15,...,50]
      skills: z.array(heroSkill).default([]),
    }).optional(),
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
