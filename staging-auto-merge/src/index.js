import * as core from '@actions/core'
import StagingAutoMerge from './staging-auto-merge.js'

const stagingAutoMerge = new StagingAutoMerge()
stagingAutoMerge.run().catch(core.setFailed)
