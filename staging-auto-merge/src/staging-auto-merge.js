import { exec as actionsExec } from '@actions/exec'

export default class StagingAutoMerge {
  constructor(octokit, primaryBranch, repo, logger = console) {
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
    await this.validateStagingLabel()
    await this.configureGitUser()
    await this.resetToPrimaryBranch()
    await this.mergeStagedPullRequests()
    await this.pushChanges()
    await this.cleanupClosedPullRequests()
  }

  async configureGitUser() {
    await this.exec('git config --global user.email "github-actions@github.com"')
    await this.exec('git config --global user.name "github-actions"')
  }

  async resetToPrimaryBranch() {
    await this.exec('git', ['reset', '--hard', `origin/${this.primaryBranch}`])
  }

  async validateStagingLabel() {
    this.stagingLabelName = await this.findStagingLabelName()

    if (!this.stagingLabelName) {
      throw new Error('Required label "Staging" was not found in this repository.')
    }
  }

  async mergeStagedPullRequests() {
    const pullRequests = await this.octokit.rest.pulls.list({
      ...this.repo,
      state: 'open',
      sort: 'created',
      direction: 'asc',
    })

    for (const pr of pullRequests.data) {
      if (this.hasStagingLabel(pr.labels)) {
        await this.mergePullRequest(pr)
      }
    }
  }

  async mergePullRequest(pr) {
    const { title, number, head: { ref: branch } } = pr
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

    try {
      await this.exec('git', ['merge', `origin/${branch}`, '--squash', '--verbose'], options)
      await this.exec('git', ['commit', '-m', title])
    } catch (error) {
      await this.abortMerge()
      await this.createMergeConflictComment(number, execOutput, execError)
      await this.removeStagingLabel(number)
    }
  }

  async abortMerge() {
    await this.exec('git restore --staged .')
    await this.exec('git restore .')
    await this.exec('git clean -df')
  }

  async pushChanges() {
    await this.exec('git push --force')
  }

  async cleanupClosedPullRequests() {
    const closedPullRequests = await this.octokit.rest.pulls.list({
      ...this.repo,
      state: 'closed',
      sort: 'created',
      direction: 'desc',
    })

    this.logger.info('Label Name: ', this.stagingLabelName)

    for (const closedPr of closedPullRequests.data) {
      if (this.hasStagingLabel(closedPr.labels)) {
        this.logger.info('removing label from: ', closedPr.title)
        await this.removeStagingLabel(closedPr.number)
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

  hasStagingLabel(labels) {
    return labels.some((label) => label.name.toLowerCase() === this.stagingLabelName.toLowerCase())
  }

  async findStagingLabelName() {
    const repoLabels = await this.octokit.rest.issues.listLabelsForRepo({
      owner: this.repo.owner,
      repo: this.repo.repo,
    })

    return repoLabels.data.find((label) => label.name.toLowerCase() === 'staging')?.name
  }

  async removeStagingLabel(issueNumber) {
    if (!this.stagingLabelName) return

    try {
      await this.octokit.rest.issues.removeLabel({
        owner: this.repo.owner,
        repo: this.repo.repo,
        issue_number: issueNumber,
        name: this.stagingLabelName,
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
