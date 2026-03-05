import StagingAutoMerge from '../src/staging-auto-merge.js'

describe('extractFilenamesFromConflicts', () => {
  it('extracts conflict filenames from merge output', () => {
    const output = `
Auto-merging app/models/user.rb
CONFLICT (content): Merge conflict in app/models/user.rb
Auto-merging app/services/sync.js
CONFLICT (content): Merge conflict in app/services/sync.js
`
    const stagingAutoMerge = new StagingAutoMerge({})

    expect(stagingAutoMerge.extractFilenamesFromConflicts(output)).toEqual([
      'app/models/user.rb',
      'app/services/sync.js',
    ])
  })

  it('returns empty array when there are no conflict lines', () => {
    const stagingAutoMerge = new StagingAutoMerge({})
    expect(stagingAutoMerge.extractFilenamesFromConflicts('All good')).toEqual([])
  })
})

describe('formatCommentBody', () => {
  it('formats conflict file list and includes merge command error when present', () => {
    const output = `
CONFLICT (content): Merge conflict in app/models/user.rb
CONFLICT (content): Merge conflict in app/services/sync.js
`
    const stagingAutoMerge = new StagingAutoMerge({})
    const result = stagingAutoMerge.formatCommentBody(output, 'fatal: merge failed')

    expect(result).toBe(
      'Merge Conflicts in these files:\napp/models/user.rb\napp/services/sync.js\n\nMerge Command Error: fatal: merge failed',
    )
  })

  it('formats conflict file list without merge command error when absent', () => {
    const output = 'CONFLICT (content): Merge conflict in app/models/user.rb'
    const stagingAutoMerge = new StagingAutoMerge({})
    const result = stagingAutoMerge.formatCommentBody(output, '')

    expect(result).toBe('Merge Conflicts in these files:\napp/models/user.rb')
  })
})

describe('hasStagingLabel', () => {
  it('matches label names case-insensitively', () => {
    const labels = [{ name: 'bug' }, { name: 'StAgInG' }]
    const stagingAutoMerge = new StagingAutoMerge({})
    expect(stagingAutoMerge.hasStagingLabel(labels, 'staging')).toBe(true)
  })

  it('returns false when staging label is not present', () => {
    const labels = [{ name: 'bug' }, { name: 'feature' }]
    const stagingAutoMerge = new StagingAutoMerge({})
    expect(stagingAutoMerge.hasStagingLabel(labels, 'staging')).toBe(false)
  })
})
