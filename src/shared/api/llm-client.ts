/**
 * LLM API Client
 *
 * Cloud API caller for:
 * - Script rewriting (改写)
 * - AI reply generation (AI 回复)
 * - Sensitive word detection (敏感词检测) — optional, can also be local
 */

import { ErrorCode, type ApiResponse } from '@shared/types/api'

type LlmProviderConfig = {
  apiKey: string
  baseUrl: string
  model: string
}

function getLlmConfig(): LlmProviderConfig | null {
  const apiKey = import.meta.env.VITE_LLM_API_KEY as string | undefined
  const baseUrl =
    (import.meta.env.VITE_LLM_BASE_URL as string | undefined) ?? 'https://api.openai.com/v1'
  const model = (import.meta.env.VITE_LLM_MODEL as string | undefined) ?? 'gpt-4o-mini'

  if (!apiKey) return null
  return { apiKey, baseUrl, model }
}

export async function llmRewrite(
  text: string,
  style?: string
): Promise<ApiResponse<{ rewritten_text: string; tokens_used: number }>> {
  const config = getLlmConfig()
  if (!config) {
    return {
      ok: true,
      data: { rewritten_text: text, tokens_used: 0 }
    }
  }

  const stylePrompt = style ? `风格要求：${style}。` : ''

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: `你是一个直播话术改写助手。${stylePrompt}请改写以下文本，保持原意但更吸引人，不超过120字。`
          },
          { role: 'user', content: text }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    })

    if (!res.ok) {
      return {
        ok: false,
        data: null,
        errorCode: ErrorCode.TIMEOUT,
        message: `LLM API error: ${res.status}`
      }
    }

    const json = (await res.json()) as any
    const rewritten = json.choices?.[0]?.message?.content?.trim() ?? text

    return {
      ok: true,
      data: {
        rewritten_text: rewritten,
        tokens_used: json.usage?.total_tokens ?? 0
      }
    }
  } catch (e) {
    return {
      ok: false,
      data: null,
      errorCode: ErrorCode.TIMEOUT,
      message: e instanceof Error ? e.message : 'LLM API call failed'
    }
  }
}

export async function llmGenerateReply(
  sampleText: string,
  policyConfig?: { temperature?: number; max_reply_len?: number }
): Promise<ApiResponse<{ reply: string; tokens_used: number }>> {
  const config = getLlmConfig()
  if (!config) {
    return {
      ok: true,
      data: {
        reply: `[AI回复] ${sampleText.slice(0, 80)}`,
        tokens_used: 0
      }
    }
  }

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: `你是一个直播间AI回复助手。根据观众的提问或评论，生成自然友好的回复。回复不超过${policyConfig?.max_reply_len ?? 80}字。`
          },
          { role: 'user', content: sampleText }
        ],
        max_tokens: 200,
        temperature: policyConfig?.temperature ?? 0.8
      })
    })

    if (!res.ok) {
      return {
        ok: false,
        data: null,
        errorCode: ErrorCode.TIMEOUT,
        message: `LLM API error: ${res.status}`
      }
    }

    const json = (await res.json()) as any
    const reply = json.choices?.[0]?.message?.content?.trim() ?? ''

    return {
      ok: true,
      data: {
        reply,
        tokens_used: json.usage?.total_tokens ?? 0
      }
    }
  } catch (e) {
    return {
      ok: false,
      data: null,
      errorCode: ErrorCode.TIMEOUT,
      message: e instanceof Error ? e.message : 'LLM API call failed'
    }
  }
}

export type SensitiveWordResult = {
  hit_words: string[]
  safe: boolean
}

/**
 * 敏感词检测（本地内置词库 + 可选云 API）
 */
const BUILTIN_SENSITIVE_WORDS = ['违禁', '敏感词', '违规', '赌博', '色情', '诈骗', '暴力', '血腥']

export function localSensitiveCheck(text: string, customWords?: string[]): SensitiveWordResult {
  const words = customWords && customWords.length > 0 ? customWords : BUILTIN_SENSITIVE_WORDS
  const hit = words.filter((w) => text.includes(w))
  return {
    hit_words: hit,
    safe: hit.length === 0
  }
}
