import StagingAutoMerge from '../src/staging-auto-merge.js'

const paginate = async (method, params) => {
  const items = []
  for (let page = 1; ; page++) {
    const { data } = await method({ ...params, page })
    items.push(...data)
    if (data.length < params.per_page) return items
  }
}

const pagesOf = (items) => ({ page = 1, per_page = 30 }) =>
  Promise.resolve({ data: items.slice((page - 1) * per_page, page * per_page) })

const createOctokit = () => ({
  paginate: vi.fn(paginate),
  rest: {
    issues: {
      listLabelsForRepo: vi.fn(),
      listForRepo: vi.fn(),
      removeLabel: vi.fn(),
      createComment: vi.fn(),
    },
    pulls: {
      list: vi.fn(),
    },
  },
})

describe('StagingAutoMerge', () => {
  let octokit
  let logger
  let repo
  let primaryBranch

  beforeEach(() => {
    octokit = createOctokit()
    logger = { info: vi.fn() }
    repo = { owner: 'rolemodel', repo: 'actions' }
    primaryBranch = 'main'
    octokit.rest.issues.listLabelsForRepo.mockImplementation(pagesOf([{ name: 'Staging' }]))
    octokit.rest.issues.listForRepo.mockImplementation(pagesOf([]))
  })

  describe('run', () => {
    it('merges staging pull requests and cleans up closed pull request labels', async () => {
      const openPulls = [
        {
          title: 'Add feature',
          number: 12,
          labels: [{ name: 'staging' }],
          head: { ref: 'feature-branch' },
        },
      ]
      const closedLabeled = [
        { title: 'Old feature', number: 99, pull_request: {} },
        { title: 'Closed issue', number: 98 },
      ]

      octokit.rest.pulls.list.mockImplementation(pagesOf(openPulls))
      octokit.rest.issues.listForRepo.mockImplementation(pagesOf(closedLabeled))

      const stagingAutoMerge = new StagingAutoMerge(octokit, primaryBranch, repo, logger)
      const execMock = vi.fn().mockResolvedValue(undefined)
      stagingAutoMerge.exec = execMock

      await stagingAutoMerge.run()

      expect(execMock).toHaveBeenCalledWith(
        'git',
        ['merge', 'origin/feature-branch', '--squash', '--verbose'],
        expect.any(Object),
      )
      expect(execMock).toHaveBeenCalledWith('git', ['commit', '-m', 'Add feature'])
      expect(octokit.rest.issues.createComment).not.toHaveBeenCalled()
      expect(octokit.rest.issues.listForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'closed', labels: 'Staging' }),
      )
      expect(octokit.rest.issues.removeLabel).toHaveBeenCalledTimes(1)
      expect(octokit.rest.issues.removeLabel).toHaveBeenCalledWith({
        owner: 'rolemodel',
        repo: 'actions',
        issue_number: 99,
        name: 'Staging',
      })
    })

    it('merges a labeled pull request beyond the first page of open pull requests', async () => {
      const openPulls = Array.from({ length: 150 }, (_, i) => ({
        title: `PR ${i + 1}`,
        number: i + 1,
        labels: i === 139 ? [{ name: 'Staging' }] : [],
        head: { ref: `branch-${i + 1}` },
      }))

      octokit.rest.pulls.list.mockImplementation(pagesOf(openPulls))

      const stagingAutoMerge = new StagingAutoMerge(octokit, primaryBranch, repo, logger)
      const execMock = vi.fn().mockResolvedValue(undefined)
      stagingAutoMerge.exec = execMock

      await stagingAutoMerge.run()

      expect(execMock).toHaveBeenCalledWith(
        'git',
        ['merge', 'origin/branch-140', '--squash', '--verbose'],
        expect.any(Object),
      )
    })

    it('finds the staging label beyond the first page of repository labels', async () => {
      const labels = Array.from({ length: 120 }, (_, i) => ({ name: i === 109 ? 'Staging' : `label-${i}` }))

      octokit.rest.issues.listLabelsForRepo.mockImplementation(pagesOf(labels))
      octokit.rest.pulls.list.mockImplementation(pagesOf([]))

      const stagingAutoMerge = new StagingAutoMerge(octokit, primaryBranch, repo, logger)
      stagingAutoMerge.exec = vi.fn().mockResolvedValue(undefined)

      await expect(stagingAutoMerge.run()).resolves.toBeUndefined()
    })

    it('posts a merge conflict comment and removes the staging label on failure', async () => {
      const openPulls = [
        {
          title: 'Breaking change',
          number: 77,
          labels: [{ name: 'Staging' }],
          head: { ref: 'breaking-branch' },
        },
      ]

      octokit.rest.pulls.list.mockImplementation(pagesOf(openPulls))

      const stagingAutoMerge = new StagingAutoMerge(octokit, primaryBranch, repo, logger)
      const execMock = vi.fn(async (command, args, options) => {
        if (command === 'git' && Array.isArray(args) && args[0] === 'merge') {
          options.listeners.stdout(
            Buffer.from('CONFLICT (content): Merge conflict in app/models/user.rb'),
          )
          options.listeners.stderr(Buffer.from('fatal: merge failed'))
          throw new Error('merge failed')
        }
      })
      stagingAutoMerge.exec = execMock

      await stagingAutoMerge.run()

      expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'rolemodel',
        repo: 'actions',
        issue_number: 77,
        body: 'Merge Conflicts in these files:\napp/models/user.rb\n\nMerge Command Error: fatal: merge failed',
      })
      expect(octokit.rest.issues.removeLabel).toHaveBeenCalledWith({
        owner: 'rolemodel',
        repo: 'actions',
        issue_number: 77,
        name: 'Staging',
      })
    })
  })
})
