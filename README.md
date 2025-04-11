# RoleModel/actions
Shared Github Actions

## test-cleanup
Cleans up after test runs by uploading screenshots and dumping system information to stdout.

Inputs:
- `artifact-prefix`*: A string prefix to name the uploaded log file. Artifact name will be named `${artifact-prefix}-logs`

Example:
```yaml
- name: Cleanup
  uses: RoleModel/actions/test-cleanup@v1
  with:
    artifact-prefix: rspec-system
```

## test-runtime-analyzer
Posts the runtime of the longest test files. This is important because the most granular parallel_tests goes is at
the file level, so when running in parallel, the entire suite can never be quicker than the slowest file.

Inputs:
- `test-output-path`*: Path to the test output file that hold runtimes
- `top-count`: Number of slowest tests to show. Default: 10

Example:
```yaml
- name: Analyze test runtimes
  uses: RoleModel/actions/test-runtime-analyzer@v1
  with:
    test-output-path: tmp/turbo_rspec_runtime.log
```
## Shared workflow actions
This is a combination of three composite actions that can be used to run your entire CI flow for a rails app using parallel_tests. Each action allow you to customize the machine, environment variables, and any custom install steps that are needed. It does require you to check out the code yourself, since some install steps might happen after that.

The only inputs are for the linting and non system test action. Neither are required:
- `linting-step-required`: Boolean (default is false). Only needed if you have a linting command
- `linting-step-command`: String, `bundle exec rubocop --fail-level warning --display-only-fail-level-offenses --format github`

Here's what your `ci.yml` file could look like

```yaml
name: "CI"
on:
  push:
    branches: ["master"]
  pull_request:

env:
  CI: true
  RAILS_ENV: test
  HONEYBADGER_SOURCE_MAP_DISABLED: 'true'
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: password
  SECRET_KEY_BASE: 0cb2b4ae6543f334e0eb5bc88bdabc24c9e5155ecb02a175c6f073a5a0d45a45f4a5b7d1288d3b412307bdfa19be441e97960ec4cd344f91f2d06a2595fb239c

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number }}-${{ github.event.ref }}
  cancel-in-progress: true

jobs:
  compile_assets:
    name: Compile assets
    runs-on: blacksmith-4vcpu-ubuntu-2204
    timeout-minutes: 5
    outputs:
      cache-hit: ${{ steps.check-asset-cache.outputs.cache-hit }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - uses: RoleModel/actions/compile-assets@composite-workflow-steps
        id: check-asset-cache

  non-system-test:
    name: Linting & Ruby Non-System Tests
    runs-on: blacksmith-8vcpu-ubuntu-2204
    timeout-minutes: 5
    needs: compile_assets
    if: always() && (needs.compile_assets.outputs.cache-hit == 'true' || (needs.compile_assets.result == 'success'))
    services:
      postgres:
        image: postgres:16
        ports:
          - "5432:5432"
        env:
          POSTGRES_USER: root
          POSTGRES_PASSWORD: password

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run shared flow
        uses: RoleModel/actions/linting-and-non-system-tests@composite-workflow-steps
        with:
          linting_step_required: true
          linting_step_command: bundle exec rubocop --fail-level warning --display-only-fail-level-offenses --format github

  system-test:
    name: Ruby System Tests
    runs-on: blacksmith-16vcpu-ubuntu-2204
    timeout-minutes: 10
    if: always() && (needs.compile_assets.outputs.cache-hit == 'true' || (needs.compile_assets.result == 'success'))
    needs: compile_assets
    services:
      postgres:
        image: postgres:16
        ports:
          - "5432:5432"
        env:
          POSTGRES_USER: root
          POSTGRES_PASSWORD: password

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      # allows for custom install steps if needed
      - name: Setup vips
        run: |
            sudo apt-get update
            sudo apt-get install -y libvips

      - name: Run shared flow
        uses: RoleModel/actions/system-tests@composite-workflow-steps
```

## Versioning
This is using [anothrNick/github-tag-action](https://github.com/anothrNick/github-tag-action/tree/master) to automatically
post version tags when a commit is merged to master. Unless you include `#patch` or `#major` in your commit message,
it will automatically create a new tag a minor version higher. `#none` will skip tagging altogether.
