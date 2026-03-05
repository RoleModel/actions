import { getInput, setFailed } from '@actions/core'
import { getOctokit, context } from '@actions/github'
import StagingAutoMerge from './staging-auto-merge.js'

const token = getInput('github-token', { required: true })
const primaryBranch = getInput('primary-branch', { required: true })
const octokit = getOctokit(token)
const stagingAutoMerge = new StagingAutoMerge(octokit, primaryBranch, context.repo, console)

stagingAutoMerge.run().catch(setFailed)
