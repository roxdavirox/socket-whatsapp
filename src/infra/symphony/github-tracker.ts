import { tryCatchAsync, isOk, pipe, Ok, Err, type Result } from '@tecnomancy/alchemy'
import type { IssueTracker as SymphonyTracker, IssueStateSnapshot } from 'symphony-ts'
import type { Issue as SymphonyIssue } from 'symphony-ts'

type GitHubIssue = {
  readonly id: number
  readonly number: number
  readonly title: string
  readonly body: string | null
  readonly state: string
  readonly labels: readonly { name: string }[]
  readonly created_at: string
  readonly updated_at: string
  readonly html_url: string
}

type GitHubTrackerConfig = {
  readonly owner: string
  readonly repo: string
  readonly token: string
  readonly activeLabels?: readonly string[]
}

// --- tacit transforms ---

const STATE_MAP: Record<string, string> = { open: 'Todo', closed: 'Done' }

const mapState = (ghState: string) => STATE_MAP[ghState] ?? ghState

const extractLabels = (labels: readonly { name: string }[]) => labels.map(l => l.name)

const toSymphonyIssue = (gh: GitHubIssue): SymphonyIssue => ({
  id: String(gh.id),
  identifier: `#${gh.number}`,
  title: gh.title,
  description: gh.body,
  priority: null,
  state: mapState(gh.state),
  branchName: `issue-${gh.number}`,
  url: gh.html_url,
  labels: extractLabels(gh.labels),
  blockedBy: [],
  createdAt: gh.created_at,
  updatedAt: gh.updated_at,
})

const toStateSnapshot = (gh: GitHubIssue): IssueStateSnapshot => ({
  id: String(gh.id),
  identifier: `#${gh.number}`,
  state: mapState(gh.state),
})

const unknownSnapshot = (id: string): IssueStateSnapshot => ({
  id,
  identifier: `#${id}`,
  state: 'unknown',
})

// --- API ---

const buildHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github.v3+json',
})

const buildUrl = (owner: string, repo: string) => (path: string) =>
  `https://api.github.com/repos/${owner}/${repo}${path}`

const safeFetch = async (url: string, token: string): Promise<Result<Response, Error>> => {
  const result = await tryCatchAsync(async (u: string) =>
    fetch(u, { headers: buildHeaders(token) })
  )(url)
  if (!isOk(result)) return result
  return result.value.ok
    ? Ok(result.value)
    : Err(new Error(`GitHub API ${result.value.status}`))
}

const fetchGitHub = (config: GitHubTrackerConfig) => async (path: string): Promise<Result<GitHubIssue[], Error>> => {
  const url = pipe(path, buildUrl(config.owner, config.repo))
  const res = await safeFetch(url, config.token)
  if (!isOk(res)) return res
  return tryCatchAsync(async (r: Response) => r.json() as Promise<GitHubIssue[]>)(res.value)
}

const fetchOneGitHub = (config: GitHubTrackerConfig) => async (path: string): Promise<Result<GitHubIssue, Error>> => {
  const url = pipe(path, buildUrl(config.owner, config.repo))
  const res = await safeFetch(url, config.token)
  if (!isOk(res)) return res
  return tryCatchAsync(async (r: Response) => r.json() as Promise<GitHubIssue>)(res.value)
}

const buildLabelParam = (labels?: readonly string[]) =>
  labels?.length ? `&labels=${labels.join(',')}` : ''

const resolveGhState = (stateNames: readonly string[]) =>
  stateNames.some(s => s.toLowerCase() === 'done') ? 'closed' : 'open'

const fetchAndMap = (config: GitHubTrackerConfig) => async (path: string) => {
  const result = await fetchGitHub(config)(path)
  return isOk(result) ? result.value.map(toSymphonyIssue) : []
}

// --- tracker factory ---

export const createGitHubTracker = (config: GitHubTrackerConfig): SymphonyTracker => ({
  fetchCandidateIssues: () =>
    fetchAndMap(config)(`/issues?state=open&sort=updated&direction=desc${buildLabelParam(config.activeLabels)}`),

  fetchIssuesByStates: (stateNames) =>
    fetchAndMap(config)(`/issues?state=${resolveGhState(stateNames)}&sort=updated`),

  fetchIssueStatesByIds: (issueIds) =>
    Promise.all(
      issueIds.map(async (id) => {
        const result = await fetchOneGitHub(config)(`/issues/${id}`)
        return isOk(result) ? toStateSnapshot(result.value) : unknownSnapshot(id)
      }),
    ),
})
