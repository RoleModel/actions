import { extractFilenamesFromConflicts, formatCommentBody, hasStagingLabel } from '../src/main.js'

describe('extractFilenamesFromConflicts', () => {
  test('extracts conflict filenames from merge output', () => {
    const output = `
Auto-merging app/models/user.rb
CONFLICT (content): Merge conflict in app/models/user.rb
Auto-merging app/services/sync.js
CONFLICT (content): Merge conflict in app/services/sync.js
`
    expect(extractFilenamesFromConflicts(output)).toEqual([
      'app/models/user.rb',
      'app/services/sync.js',
    ])
  })

  test('returns empty array when there are no conflict lines', () => {
    expect(extractFilenamesFromConflicts('All good')).toEqual([])
  })
})

describe('formatCommentBody', () => {
  test('formats conflict file list and includes merge command error when present', () => {
    const output = `
CONFLICT (content): Merge conflict in app/models/user.rb
CONFLICT (content): Merge conflict in app/services/sync.js
`
    const result = formatCommentBody(output, 'fatal: merge failed')

    expect(result).toBe(
      'Merge Conflicts in these files:\napp/models/user.rb\napp/services/sync.js\n\nMerge Command Error: fatal: merge failed',
    )
  })

  test('formats conflict file list without merge command error when absent', () => {
    const output = 'CONFLICT (content): Merge conflict in app/models/user.rb'
    const result = formatCommentBody(output, '')

    expect(result).toBe('Merge Conflicts in these files:\napp/models/user.rb')
  })
})

describe('hasStagingLabel', () => {
  test('matches label names case-insensitively', () => {
    const labels = [{ name: 'bug' }, { name: 'StAgInG' }]
    expect(hasStagingLabel(labels, 'staging')).toBe(true)
  })

  test('returns false when staging label is not present', () => {
    const labels = [{ name: 'bug' }, { name: 'feature' }]
    expect(hasStagingLabel(labels, 'staging')).toBe(false)
  })
})
