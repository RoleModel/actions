# RoleModel/actions

Shared Github Actions

## test-cleanup

Cleans up after test runs by uploading screenshots and dumping system information to stdout.

Inputs:
- `artifact-prefix`*: A string prefix to name the uploaded log file. Artifact name will be named `${artifact-prefix}-logs`

Example:

```yaml
- name: Cleanup
  uses: RoleModel/actions/test-cleanup@v3
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
  uses: RoleModel/actions/test-runtime-analyzer@v3
  with:
    test-output-path: tmp/turbo_rspec_runtime.log
```

## staging-auto-merge

Use this action to maintain a `staging` branch with the changes from all open PRs labeled `Staging`. This is recommended to be used with a workflow that auto-deploys the `staging` branch.

If a PR cannot be merged cleanly, the action comments on the PR with conflict details and removes the `Staging` label.

This action assumes the repository has already been cloned with `ref: staging` and `fetch-depth: 0` set. Commits/pushes made using the default GitHub Actions access key do not trigger other actions, so make sure to generate a personal access token or SSH key so that staging auto-deploys can work.

Inputs:

- `github-token`: GitHub token used to list/update pull requests. Default: `${{ github.token }}`
- `primary-branch`: Branch used as the reset base before staged merges. Default: `main`

Example:

```yaml
name: Maintain staging branch

on:
  pull_request:
    types:
      - labeled
      - unlabeled
      - closed
      - synchronize

jobs:
  maintain_staging:
    if: (contains(github.event.pull_request.labels[*].name, 'Staging')) || (github.event.action == 'closed' && github.event.pull_request.merged) || (github.event.label.name == 'Staging')
    runs-on: ubuntu-latest
    timeout-minutes: 2

    steps:
      - name: Check out repository
        uses: actions/checkout@v7
        with:
          ref: staging
          fetch-depth: 0
          ssh-key: ${{ secrets.AUTOMATED_COMMITS_KEY }} # IMPORTANT: Use a custom key to allow triggering other workflows

      - name: Rebuild staging branch
        uses: RoleModel/actions/staging-auto-merge@v3
```

## Rails CI (reusable workflow)

`.github/workflows/rails-ci.yml` is a `workflow_call` reusable workflow that runs an entire Rails app's CI — linting, Brakeman, dependency audit, asset compilation/caching, and `parallel_rspec` — as a single job. It supersedes the composite actions below: use it for new projects, and prefer migrating an existing `ci.yml` to it over adding to the composite-action setup, since it schedules the independent setup steps (Ruby/gems, apt packages, Node/Yarn, asset cache, Brakeman, Rubocop, ESLint, dependency audit, Project Stats) to overlap with `background:`/`wait:`/`parallel:` step syntax instead of running them sequentially across multiple jobs.

### Inputs

- `apt_packages`: Space-separated apt packages to install alongside setup (e.g. "libvips")
- `brakeman_version`: Brakeman gem version to run via reviewdog (omit to skip, e.g. "8.0.5")
- `dependency_audit_command`: Dependency audit command to run (omit to skip)
- `extra_env`: Additional non-secret environment variables, one KEY=VALUE per line (same format as a .env file). Use this for anything the app requires that isn't already covered by an existing input. For real secret values, use the `extra_secrets` secret instead — `secrets.*` can't be referenced here since this is a `with:` input, evaluated before the caller's secrets are in scope.
- `failure-screenshot-dir`: the directory where your test runner saves screenshots on failure. Default: `tmp/capybara`
- `js_lint_command`: JS linting command to run (omit to skip)
- `playwright`: Install the Playwright Chromium browser (for apps using capybara-playwright-driver). Default: `false`
- `postgres_version`: Postgres Docker image version tag. Default: `"17"`
- `project-stats`: Run `bin/rails stats` and post the results to the job summary. Default: `true`
- `rubocop_command`: Rubocop command to run (omit to skip)
- `runner`: Runner to use. Default: `blacksmith-8vcpu-ubuntu-2404`
- `timeout`: Job timeout in minutes. Default: `20`

### Secrets

- `RAILS_MASTER_KEY`: Rails master key for decrypting credentials
- `BUNDLE_RUBYGEMS__PKG__GITHUB__COM`: Credential for the RoleModel RubyGems package registry
- `extra_secrets`: Additional secret environment variables, one KEY=VALUE per line (same shape as `extra_env`). Pass real secret values through here, referencing the caller's own secrets context on the right-hand side of each line.

`extra_env` and `extra_secrets` exist for the same reason (app-specific env vars the workflow doesn't already name), but land differently: `extra_env` is a `with:` input, evaluated before the caller's `secrets:` context is in scope, so it can only carry non-secret `KEY=VALUE` lines. `extra_secrets` is a real `secrets:` value, so it's the one to use for anything sensitive — reference the caller's own secrets on the right-hand side, e.g. `STRIPE_PRIVATE_KEY=${{ secrets.STRIPE_PRIVATE_KEY }}`.

`project-stats` is a built-in input (default `true`) that publishes its own "Project Stats" GitHub check as part of the job. Callers of `rails-ci.yml` get this for free and don't need the separate standalone `project-stats` job shown in the composite-action example below.

### Example ci.yml (basic)

```yaml
jobs:
  ci:
    uses: RoleModel/actions/.github/workflows/rails-ci.yml@v3
    with:
      rubocop_command: bundle exec rubocop --format github
      dependency_audit_command: bin/bundler-audit && bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error
      failure-screenshot-dir: tmp/screenshots
    secrets: inherit
```

### Example ci.yml (with apt packages, Playwright, and app-specific env)

```yaml
jobs:
  ci:
    uses: RoleModel/actions/.github/workflows/rails-ci.yml@v3
    with:
      apt_packages: libvips
      playwright: true
      rubocop_command: bundle exec rubocop --format github
      js_lint_command: yarn lint
      dependency_audit_command: bin/bundler-audit
      brakeman_version: "8.0.5"
      failure-screenshot-dir: tmp/screenshots
      extra_env: |
        STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
    secrets:
      RAILS_MASTER_KEY: ${{ secrets.RAILS_MASTER_KEY }}
      BUNDLE_RUBYGEMS__PKG__GITHUB__COM: ${{ secrets.BUNDLE_RUBYGEMS__PKG__GITHUB__COM }}
      extra_secrets: |
        STRIPE_PRIVATE_KEY=${{ secrets.STRIPE_PRIVATE_KEY }}
```

## Shared workflow actions

This is a combination of multiple composite actions that can be used to run your entire CI flow for a rails app using parallel_tests. Each action allow you to customize the machine, environment variables, and any custom install steps that are needed. It does require you to check out the code yourself, since some install steps might happen after that.

### Inputs, by composit action name

- `linting-and-non-system-tests`:
  - `linting_step_required`
    - Whether linting is required
    - Optional, default is `false`
  - `linting_step_command`
    - Command for linting (e.g., "bundle exec rubocop")
    - Optional, default is `''`
  - `needs-compiled-assets`
    - Whether to retrieve the Rails asset cache (set to false if your workflow does not depend on the compile-assets workflow)
    - Optional, default is `true`
- `system-tests`:
  - `web-driver`
    - Supported values are 'selenium' and 'playwright'
    - Optional, default is `selenium`
  - `failure-screenshot-dir`
    - the directory where your test runner saves screenshots on failure
    - Optional, default is `tmp/capybara`

### Example ci.yml workflow

```yaml
name: CI
on:
  push:
    branches: [ main, master ]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number }}-${{ github.event.ref }}
  cancel-in-progress: true

env:
  CI: true
  RAILS_ENV: test
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: password
  SECRET_KEY_BASE: 123 # If you are using encrypted credentials, you'll need to extract this into a GitHub secret.
                       # Otherwise, the only thing that matters is that the value is not nil.

jobs:
  compile-assets:
    name: Compile Assets
    runs-on: blacksmith-4vcpu-ubuntu-2204
    timeout-minutes: 5
    steps:
      - name: Checkout Code
        uses: actions/checkout@v7

      - uses: RoleModel/actions/compile-assets@v3
        id: check-asset-cache

  non-system-test:
    name: Linting & Ruby Non-System Tests
    runs-on: blacksmith-8vcpu-ubuntu-2204
    timeout-minutes: 5
    # If you have non-system tests that touch the browser, you may need to uncomment the following line.
    # needs: compile-assets
    services:
      postgres:
        image: postgres:17
        ports:
          - "5432:5432"
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password

    steps:
      - name: Checkout Code
        uses: actions/checkout@v7

      - uses: RoleModel/actions/linting-and-non-system-tests@v3
        with:
          linting_step_required: true
          linting_step_command: bundle exec rubocop --fail-level warning --display-only-fail-level-offenses --format github
          needs-compiled-assets: false # Remove this input if you uncommented `needs: compile-assets` above.

  system-test:
    name: Ruby System Tests
    runs-on: blacksmith-16vcpu-ubuntu-2204
    timeout-minutes: 10
    needs: compile-assets
    services:
      postgres:
        image: postgres:17
        ports:
          - "5432:5432"
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password

    steps:
      - name: Checkout Code
        uses: actions/checkout@v7

      # Custom install steps may be added between checkout & test run if needed. e.g.
      # If your application processes ActiveStorage::Variant records you probably need the following step:
      - run: |
          sudo apt-get update
          sudo apt-get install -y libvips

      - uses: RoleModel/actions/system-tests@v3
        with:
          failure-screenshot-dir: tmp/screenshots # if you've configured capybara to be compatible with the tmp:clear task
          web-driver: playwright # remove this input to use the default value (selenium)
  # completely optional job (for Rails projects only) - outputs a stats table in your workflow's summary page
  project-stats:
    name: Project Stats
    runs-on: blacksmith-4vcpu-ubuntu-2204
    timeout-minutes: 5
    steps:
      - name: Checkout Code
        uses: actions/checkout@v7

      - name: Capture Project Stats
        uses: RoleModel/actions/project-stats
```

## Versioning

This is using [anothrNick/github-tag-action](https://github.com/anothrNick/github-tag-action/tree/master) to automatically
post version tags when a commit is merged to master. Unless you include `#patch` or `#major` in your commit message,
it will automatically create a new tag a minor version higher. `#none` will skip tagging altogether.
