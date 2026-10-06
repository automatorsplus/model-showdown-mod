export type ShowdownResult = {
  id: string
  label: string
  status: 'pending' | 'done' | 'failed'
  text: string
  reason: string
  ms: number
  inTokens: number
  outTokens: number
  cost: number
}

export type Showdown = { runId: number; question: string; startedAt: number; results: ShowdownResult[] }

declare module 'claude-code' {
  interface PluginState {
    'model-showdown': { run: Showdown | null; now: number }
  }
}
