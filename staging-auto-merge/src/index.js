import * as core from '@actions/core'
import * as github from '@actions/github'
import StagingAutoMerge from './staging-auto-merge.js'

const token = core.getInput('github-token', { required: true })
const primaryBranch = core.getInput('primary-branch', { required: true })
const octokit = github.getOctokit(token)
const stagingAutoMerge = new StagingAutoMerge(octokit, console, primaryBranch, github.context.repo)

stagingAutoMerge.run().catch(core.setFailed)
