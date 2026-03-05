import StagingAutoMerge from '../src/staging-auto-merge.js'

const createOctokit = () => ({
  rest: {
    issues: {
      listLabelsForRepo: vi.fn(),
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
    octokit.rest.issues.listLabelsForRepo.mockResolvedValue({
      data: [{ name: 'Staging' }],
    })
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
      const closedPulls = [
        {
          title: 'Old feature',
          number: 99,
          labels: [{ name: 'Staging' }],
        },
      ]

      octokit.rest.pulls.list.mockImplementation(({ state }) =>
        Promise.resolve({ data: state === 'open' ? openPulls : closedPulls }),
      )

      const stagingAutoMerge = new StagingAutoMerge(octokit, logger, primaryBranch, repo)
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
      expect(octokit.rest.issues.removeLabel).toHaveBeenCalledWith({
        owner: 'rolemodel',
        repo: 'actions',
        issue_number: 99,
        name: 'Staging',
      })
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

      octokit.rest.pulls.list.mockImplementation(({ state }) =>
        Promise.resolve({ data: state === 'open' ? openPulls : [] }),
      )

      const stagingAutoMerge = new StagingAutoMerge(octokit, logger, primaryBranch, repo)
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
