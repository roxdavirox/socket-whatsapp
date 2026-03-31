import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGitHubTracker } from './github-tracker.js'

const mkIssue = (num: number, state = 'open') => ({
  id: num * 100,
  number: num,
  title: `Issue ${num}`,
  body: `Description ${num}`,
  state,
  labels: [{ name: 'bug' }],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  html_url: `https://github.com/test/repo/issues/${num}`,
})

const mockFetch = (data: unknown) =>
  vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(''),
  }))

describe('createGitHubTracker', () => {
  const config = { owner: 'test', repo: 'repo', token: 'ghp_test' }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchCandidateIssues maps GitHub issues to Symphony format', async () => {
    globalThis.fetch = mockFetch([mkIssue(1), mkIssue(2)]) as never
    const tracker = createGitHubTracker(config)

    const issues = await tracker.fetchCandidateIssues()
    expect(issues).toHaveLength(2)
    expect(issues[0]?.identifier).toBe('#1')
    expect(issues[0]?.state).toBe('Todo')
    expect(issues[0]?.labels).toEqual(['bug'])
    expect(issues[0]?.branchName).toBe('issue-1')
  })

  it('fetchCandidateIssues includes label filter', async () => {
    globalThis.fetch = mockFetch([]) as never
    const tracker = createGitHubTracker({ ...config, activeLabels: ['symphony'] })

    await tracker.fetchCandidateIssues()
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('labels=symphony'),
      expect.anything(),
    )
  })

  it('fetchIssuesByStates maps Done to closed', async () => {
    globalThis.fetch = mockFetch([mkIssue(1, 'closed')]) as never
    const tracker = createGitHubTracker(config)

    const issues = await tracker.fetchIssuesByStates(['Done'])
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('state=closed'),
      expect.anything(),
    )
    expect(issues[0]?.state).toBe('Done')
  })

  it('fetchIssueStatesByIds returns snapshots', async () => {
    globalThis.fetch = mockFetch(mkIssue(1)) as never
    const tracker = createGitHubTracker(config)

    const snapshots = await tracker.fetchIssueStatesByIds(['1'])
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.identifier).toBe('#1')
    expect(snapshots[0]?.state).toBe('Todo')
  })

  it('returns empty on API error', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, text: () => Promise.resolve('error') })) as never
    const tracker = createGitHubTracker(config)

    const issues = await tracker.fetchCandidateIssues()
    expect(issues).toEqual([])
  })
})
