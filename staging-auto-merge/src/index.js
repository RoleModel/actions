import * as core from '@actions/core'
import { run } from './main.js'

run().catch(core.setFailed)
