import * as core from '@actions/core'
import * as github from '@actions/github'
import { exec } from '@actions/exec'

export default class StagingAutoMerge {
  constructor(octokit) {
    if (octokit) {
      this.octokit = octokit
      return
    }

    const token = core.getInput('github-token', { required: true })
    this.octokit = github.getOctokit(token)
  }

  async run() {
    const primaryBranch = core.getInput('primary-branch', { required: true })

    await exec('git config --global user.email "github-actions@github.com"')
    await exec('git config --global user.name "github-actions"')
    await exec('git', ['reset', '--hard', `origin/${primaryBranch}`])

    const stagingLabelName = await this.findStagingLabelName()

    if (!stagingLabelName) {
      const errorMessage = 'Required label "Staging" was not found in this repository.'
      core.error(errorMessage)
      throw new Error(errorMessage)
    }

    const pullRequests = await this.octokit.rest.pulls.list({
      ...github.context.repo,
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
          await exec('git', ['merge', `origin/${branch}`, '--squash', '--verbose'], options)
          await exec('git', ['commit', '-m', title])
        } catch (error) {
          await exec('git restore --staged .')
          await exec('git restore .')
          await exec('git clean -df')
          await this.createMergeConflictComment(number, execOutput, execError)
          await this.removeStagingLabel(number, stagingLabelName)
        }
      }
    }

    await exec('git push --force')

    const closedPullRequests = await this.octokit.rest.pulls.list({
      ...github.context.repo,
      state: 'closed',
      sort: 'created',
      direction: 'desc',
    })

    console.log('Label Name: ', stagingLabelName)

    for (const closedPr of closedPullRequests.data) {
      const { number, labels, title } = closedPr
      if (this.hasStagingLabel(labels, stagingLabelName)) {
        console.log('removing label from: ', title)
        await this.removeStagingLabel(number, stagingLabelName)
      }
    }
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
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
    })

    return repoLabels.data.find((label) => label.name.toLowerCase() === 'staging')?.name
  }

  async removeStagingLabel(issueNumber, stagingLabelName) {
    if (!stagingLabelName) return

    try {
      await this.octokit.rest.issues.removeLabel({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
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
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issueNumber,
      body: this.formatCommentBody(execOutput, execError),
    })
  }
}
