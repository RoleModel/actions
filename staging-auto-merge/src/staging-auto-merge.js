import { exec as actionsExec } from '@actions/exec'

export default class StagingAutoMerge {
  constructor(octokit, logger = console, primaryBranch, repo) {
    if (!primaryBranch) {
      throw new Error('Primary branch is required.')
    }

    if (!repo?.owner || !repo?.repo) {
      throw new Error('Repository owner and name are required.')
    }

    this.octokit = octokit
    this.logger = logger
    this.primaryBranch = primaryBranch
    this.repo = repo
  }

  async run() {
    await this.exec('git config --global user.email "github-actions@github.com"')
    await this.exec('git config --global user.name "github-actions"')
    await this.exec('git', ['reset', '--hard', `origin/${this.primaryBranch}`])

    const stagingLabelName = await this.findStagingLabelName()

    if (!stagingLabelName) {
      throw new Error('Required label "Staging" was not found in this repository.')
    }

    const pullRequests = await this.octokit.rest.pulls.list({
      ...this.repo,
      state: 'open',
      sort: 'created',
      direction: 'asc',
    })

    for (const pr of pullRequests.data) {
      let execOutput = ''
      let execError = ''
      const options = {
        listeners: {
          stdout: (data) => {
            execOutput += data.toString()
          },
          stderr: (data) => {
            execError += data.toString()
          },
        },
      }

      const {
        title,
        number,
        labels,
        head: { ref: branch },
      } = pr

      if (this.hasStagingLabel(labels, stagingLabelName)) {
        try {
          await this.exec('git', ['merge', `origin/${branch}`, '--squash', '--verbose'], options)
          await this.exec('git', ['commit', '-m', title])
        } catch (error) {
          await this.exec('git restore --staged .')
          await this.exec('git restore .')
          await this.exec('git clean -df')
          await this.createMergeConflictComment(number, execOutput, execError)
          await this.removeStagingLabel(number, stagingLabelName)
        }
      }
    }

    await this.exec('git push --force')

    const closedPullRequests = await this.octokit.rest.pulls.list({
      ...this.repo,
      state: 'closed',
      sort: 'created',
      direction: 'desc',
    })

    this.logger.info('Label Name: ', stagingLabelName)

    for (const closedPr of closedPullRequests.data) {
      const { number, labels, title } = closedPr
      if (this.hasStagingLabel(labels, stagingLabelName)) {
        this.logger.info('removing label from: ', title)
        await this.removeStagingLabel(number, stagingLabelName)
      }
    }
  }

  async exec(command, args, options) {
    return actionsExec(command, args, options)
  }

  extractFilenamesFromConflicts(logText) {
    const regex = /CONFLICT \(content\): Merge conflict in\s+([^\n]+)/g
    const matches = []
    let match

    while ((match = regex.exec(logText)) !== null) {
      matches.push(match[1])
    }

    return matches
  }

  formatCommentBody(mergeConflictMessage, consoleErrorMessage) {
    const formattedConflictFiles = this.extractFilenamesFromConflicts(mergeConflictMessage).join('\n')

    let conflictMessage = `Merge Conflicts in these files:\n${formattedConflictFiles}`
    if (consoleErrorMessage) {
      conflictMessage += `\n\nMerge Command Error: ${consoleErrorMessage}`
    }
    return conflictMessage
  }

  hasStagingLabel(labels, stagingLabelName) {
    return labels.some((label) => label.name.toLowerCase() === stagingLabelName.toLowerCase())
  }

  async findStagingLabelName() {
    const repoLabels = await this.octokit.rest.issues.listLabelsForRepo({
      owner: this.repo.owner,
      repo: this.repo.repo,
    })

    return repoLabels.data.find((label) => label.name.toLowerCase() === 'staging')?.name
  }

  async removeStagingLabel(issueNumber, stagingLabelName) {
    if (!stagingLabelName) return

    try {
      await this.octokit.rest.issues.removeLabel({
        owner: this.repo.owner,
        repo: this.repo.repo,
        issue_number: issueNumber,
        name: stagingLabelName,
      })
    } catch (error) {
      const status = error?.status

      if (status !== 404) {
        throw error
      }
    }
  }

  async createMergeConflictComment(issueNumber, execOutput, execError) {
    await this.octokit.rest.issues.createComment({
      owner: this.repo.owner,
      repo: this.repo.repo,
      issue_number: issueNumber,
      body: this.formatCommentBody(execOutput, execError),
    })
  }
}
