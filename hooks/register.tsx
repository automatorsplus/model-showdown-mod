import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Showdown, ShowdownResult } from '../types'

const PANE = 'model-showdown'
const TITLE = 'Model Showdown'
const STACK_BELOW = 120

// Prices per million tokens, input and output, at API list prices.
const MODELS = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', input: 1, output: 5 },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', input: 2, output: 10 },
  { id: 'claude-opus-5-5', label: 'Opus 5.5', input: 4, output: 20 },
]

const run = atom({ plugin: 'model-showdown', key: 'run' } as const, null)
const now = atom({ plugin: 'model-showdown', key: 'now' } as const, 0)

async function lastPrompt($: EngineInterface) {
  const messages = await $.session.messages()
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m || m.role !== 'user' || m.toolResults?.length) continue
    const text = m.text.trim()
    if (text && !text.startsWith('<')) return text
  }
  return ''
}

async function setResult($: EngineInterface, runId: number, id: string, patch: Partial<ShowdownResult>) {
  await update($, run, current => {
    if (!current || current.runId !== runId) return current
    return { ...current, results: current.results.map(r => (r.id === id ? { ...r, ...patch } : r)) }
  })
}

async function ask($: EngineInterface, runId: number, question: string, model: (typeof MODELS)[number]) {
  const started = await $.clock.now()
  const result = await $.model
    .complete({ model: model.id, prompt: question, maxTokens: 2000, timeoutMs: 120000 })
    .catch((error: unknown) => ({ isAnswered: false as const, reason: String(error) }))
  const ms = (await $.clock.now()) - started
  if (!result.isAnswered) {
    const detail =
      'error' in result && result.error ? `${result.reason}: ${JSON.stringify(result.error).slice(0, 200)}` : result.reason
    await setResult($, runId, model.id, { status: 'failed', reason: detail, ms })
    return
  }
  const u = result.usage
  const inTokens = u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens
  const outTokens = u.output_tokens
  const cost = (inTokens * model.input + outTokens * model.output) / 1e6
  await setResult($, runId, model.id, { status: 'done', text: result.text, ms, inTokens, outTokens, cost })
}

async function startShowdown($: EngineInterface, question: string) {
  const startedAt = await $.clock.now()
  const runId = startedAt
  const fresh: Showdown = {
    runId,
    question,
    startedAt,
    results: MODELS.map(m => ({
      id: m.id,
      label: m.label,
      status: 'pending',
      text: '',
      reason: '',
      ms: 0,
      inTokens: 0,
      outTokens: 0,
      cost: 0,
    })),
  }
  await update($, run, () => fresh)
  await update($, now, () => startedAt)
  await $.ui.open({ id: PANE, title: TITLE, focus: true })

  // A live seconds counter while any column waits.
  const timer = $.clock.every(1000, async () => {
    const current = await read($, run)
    const t = await $.clock.now()
    await update($, now, () => t)
    if (!current || current.runId !== runId || current.results.every(r => r.status !== 'pending')) timer.cancel()
  })

  void Promise.all(MODELS.map(m => ask($, runId, question, m)))
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`
const money = (usd: number) => (usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(3)}`)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'versus',
      description: 'Ask Haiku, Sonnet and Opus the same question and compare. /versus <question>, or alone for your last prompt',
    })
    return next(e)
  })

  on('command.run', { command: 'versus' }, async ($, e) => {
    const question = e.args.trim() || (await lastPrompt($))
    if (!question) return { text: 'Nothing to ask. Type /versus followed by a question.' }
    await startShowdown($, question)
    return { text: 'Model Showdown started.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const current = await read($, run)
    if (!current) {
      return <Text dimColor>Type /versus followed by a question to start a showdown.</Text>
    }
    const t = await read($, now)
    const isStacked = (e.viewport?.columns ?? 200) < STACK_BELOW
    const done = current.results.filter(r => r.status === 'done')
    const isFinished = current.results.every(r => r.status !== 'pending')
    const fastest = isFinished && done.length ? done.reduce((a, b) => (b.ms < a.ms ? b : a)).id : ''
    const cheapest = isFinished && done.length ? done.reduce((a, b) => (b.cost < a.cost ? b : a)).id : ''

    const column = (r: ShowdownResult) => (
      <Box
        key={`col-${r.id}`}
        flexDirection="column"
        flexGrow={1}
        width={isStacked ? '100%' : '33%'}
        borderStyle="round"
        borderColor={r.status === 'failed' ? '#f87171' : '#4b5563'}
        paddingX={1}
        marginBottom={isStacked ? 1 : 0}
      >
        <Box columnGap={1}>
          <Text bold color="#a78bfa">
            {r.label}
          </Text>
          {r.id === fastest && <Text color="#34d399">fastest</Text>}
          {r.id === cheapest && <Text color="#fbbf24">cheapest</Text>}
        </Box>
        {r.status === 'pending' && <Text dimColor>Waiting... {seconds(Math.max(0, t - current.startedAt))}</Text>}
        {r.status === 'failed' && <Text color="#f87171">Failed: {r.reason}</Text>}
        {r.status === 'done' && (
          <Box flexDirection="column">
            <Text>{r.text}</Text>
            <Text dimColor>
              {seconds(r.ms)} · {r.inTokens} in / {r.outTokens} out · {money(r.cost)}
            </Text>
            <Box key={`actions-${r.id}`} columnGap={1}>
              <Button
                key={`use-${r.id}`}
                label="Use this one"
                variant="secondary"
                hover={{ color: '#a78bfa' }}
                onPress={() => $.prompt.submit({ text: `I picked this answer from ${r.label}:\n\n${r.text}`, asUser: true })}
              />
              <Button
                key={`copy-${r.id}`}
                label="Copy"
                variant="secondary"
                hover={{ color: '#a78bfa' }}
                onPress={() => $.ui.copy({ text: r.text })}
              />
            </Box>
          </Box>
        )}
      </Box>
    )

    return (
      <Box flexDirection="column">
        <Text dimColor>Each model sees only this question, not the chat.</Text>
        <Text color="#a78bfa" wrap="truncate-end">
          Q: {current.question}
        </Text>
        <Box flexDirection={isStacked ? 'column' : 'row'} columnGap={1} marginTop={1}>
          {current.results.map(column)}
        </Box>
      </Box>
    )
  })
}
