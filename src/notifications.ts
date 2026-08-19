import nodemailer from 'nodemailer'
import type { Server } from 'socket.io'
import type { Verdict } from './ai.js'
import type { RawStory } from './sources.js'

let transporter: nodemailer.Transporter | null = null
function getTransporter() {
  if (transporter || !process.env.SMTP_HOST) return transporter
  transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined })
  return transporter
}

export async function notifyNewStory(io: Server, story: RawStory, verdict: Verdict, keyword: string, threshold: number) {
  const notification = { title: story.title, url: story.url, sourceName: story.sourceName, summary: verdict.summary, credibilityScore: verdict.credibilityScore, relevanceScore: verdict.relevanceScore, classification: verdict.classification, keywordPhrase: keyword }
  io.emit('story:new', notification)
  if (verdict.credibilityScore < threshold) return false
  const mailer = getTransporter()
  if (!mailer || !process.env.MAIL_TO) return false
  await mailer.sendMail({ from: process.env.MAIL_FROM ?? process.env.SMTP_USER, to: process.env.MAIL_TO, subject: `[Hot Monitor] ${story.title}`, text: `${verdict.summary}\n\n来源：${story.sourceName}\n可信度：${verdict.credibilityScore}\n链接：${story.url}` })
  return true
}
