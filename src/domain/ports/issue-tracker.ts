import type { Result } from '@tecnomancy/alchemy'

export type IssueState = 'open' | 'in_progress' | 'review' | 'done' | 'cancelled'

export type Issue = {
  readonly id: string
  readonly identifier: string
  readonly title: string
  readonly description: string | null
  readonly priority: number | null
  readonly state: IssueState
  readonly branchName: string | null
  readonly url: string | null
  readonly labels: readonly string[]
  readonly createdAt: string | null
  readonly updatedAt: string | null
}

export type IssueStateSnapshot = {
  readonly id: string
  readonly identifier: string
  readonly state: string
}

export type IssueTracker = {
  readonly fetchCandidates: () => Promise<Result<readonly Issue[], Error>>
  readonly fetchByStates: (states: readonly IssueState[]) => Promise<Result<readonly Issue[], Error>>
  readonly fetchStatesByIds: (ids: readonly string[]) => Promise<Result<readonly IssueStateSnapshot[], Error>>
}
