import { z } from 'zod'
import type { RawStory } from './sources.js'

const contentTypeSchema = z.string().optional().default('other').transform((value) => {
  const normalized = value.toLowerCase()
  if (normalized.includes('blog') || normalized.includes('博客')) return 'technical_blog' as const
  if (normalized.includes('release') || normalized.includes('发布')) return 'technical_release' as const
  if (normalized.includes('discussion') || normalized.includes('讨论')) return 'developer_discussion' as const
  if (normalized.includes('research') || normalized.includes('研究')) return 'research' as const
  return 'other' as const
})

const classificationSchema = z.string().optional().default('unverified').transform((value) => {
  const normalized = value.toLowerCase()
  if (normalized.includes('mislead') || normalized.includes('误导') || normalized.includes('假')) return 'misleading' as const
  if (normalized.includes('verif') || normalized.includes('confirm') || normalized.includes('确')) return 'verified' as const
  if (normalized.includes('irrelevant') || normalized.includes('无关')) return 'irrelevant' as const
  return 'unverified' as const
})

const verdictSchema = z.object({
  relevant: z.boolean(),
  technical: z.boolean(),
  contentType: contentTypeSchema,
  relevanceScore: z.number().min(0).max(100).transform((value) => Math.round(value)),
  keywordFocusScore: z.number().min(0).max(100).transform((value) => Math.round(value)),
  credibilityScore: z.number().min(0).max(100).transform((value) => Math.round(value)),
  classification: classificationSchema,
  summary: z.string().min(1).max(500),
  keyFacts: z.array(z.string()).max(6),
  reasoning: z.string().min(1).max(800),
})

export type Verdict = z.infer<typeof verdictSchema>

const technicalSignals = /\b(api|sdk|model|llm|ai|ml|machine learning|open source|github|repo|code|coding|developer|programming|release|benchmark|inference|training|agent|framework|database|技术|开发|编程|代码|模型|算法|开源|接口|框架|训练|推理|基准|研究)\b/i

export async function evaluateStory(story: RawStory, phrase: string): Promise<Verdict> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) {
    const technical = technicalSignals.test(`${story.title} ${story.content}`)
    const directMatch = `${story.title} ${story.content}`.toLocaleLowerCase().includes(phrase.trim().toLocaleLowerCase())
    const relevant = technical && directMatch
    return {
      relevant,
      technical,
      contentType: technical ? 'technical_blog' : 'other',
      relevanceScore: relevant ? 75 : 0,
      keywordFocusScore: relevant ? 80 : 0,
      credibilityScore: story.sourceQuality,
      classification: story.sourceQuality >= 90 ? 'verified' : 'unverified',
      summary: story.content.slice(0, 300),
      keyFacts: [],
      reasoning: relevant ? '未配置 DeepSeek，仅保留关键词直接出现且来源质量达标的技术内容。' : '未检测到关键词直接相关的技术内容，已过滤。',
    }
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(30_000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat', stream: false, response_format: { type: 'json_object' }, temperature: 0.1,
      messages: [
        { role: 'system', content: '你是面向 AI 编程博主的技术热点编辑和事实核验员。只根据给定内容判断，不要把推测写成事实。只有技术博客、技术产品/模型发布、开发者讨论、代码/API/SDK/开源项目、技术研究或基准测试才算 technical=true。普通新闻、娱乐、生活方式、泛营销、招聘、体育、金融和与技术无关的内容必须 technical=false。关键词必须是内容的主要事件、核心技术对象或被实质分析的主题；只是在背景、转述、标签或顺带提及时，keywordFocusScore 必须不高于 30，且 relevant=false。明确产品发布、技术细节、基准、源码或核心分析可给 70 分以上。可信度必须结合给定的来源质量与内容中的可验证事实，未知社交账号的无证据主张不得视为高可信。必须输出 JSON，字段为 relevant、technical、contentType、relevanceScore、keywordFocusScore、credibilityScore、classification、summary、keyFacts、reasoning。relevant 只有在同时满足“关键词是核心主题”“technical=true”时才为 true。' },
        { role: 'user', content: JSON.stringify({ keyword: phrase, source: story.sourceName, sourceType: story.sourceType, sourceQuality: story.sourceQuality, author: story.author, title: story.title, url: story.url, publishedAt: story.publishedAt, content: story.content.slice(0, 6000) }) },
      ],
    }),
  })
  if (!response.ok) throw new Error(`DeepSeek returned ${response.status}`)
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const raw = payload.choices?.[0]?.message?.content
  if (!raw) throw new Error('DeepSeek returned empty content')
  return verdictSchema.parse(JSON.parse(raw))
}
