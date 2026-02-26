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

## Shared workflow actions

This is a combination of multiple composite actions that can be used to run your entire CI flow for a rails app using parallel_tests. Each action allow you to customize the machine, environment variables, and any custom install steps that are needed. It does require you to check out the code yourself, since some install steps might happen after that.

The only inputs are for the linting and non system test action. Neither are required:

- `linting-step-required`: Boolean (default is false). Only needed if you have a linting command
- `linting-step-command`: String, `bundle exec rubocop --fail-level warning --display-only-fail-level-offenses --format github`

Here's what your `ci.yml` file could look like

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
        uses: actions/checkout@v6

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
        uses: actions/checkout@v6

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
        uses: actions/checkout@v6

      # Custom install steps may be added between checkout & test run if needed. e.g.
      # If your application processes ActiveStorage::Variant records you probably need the following step:
      - run: |
          sudo apt-get update
          sudo apt-get install -y libvips

      - uses: RoleModel/actions/system-tests@v3
        # if you've configured capybara to be compatible with the tmp:clear task
        # you can tell the system-tests action like this:
        with:
          failure-screenshot-dir: tmp/screenshots
  # completely optional job (for Rails projects only) - outputs a stats table in your workflow's summary page
  project-stats:
    name: Project Stats
    runs-on: blacksmith-4vcpu-ubuntu-2204
    timeout-minutes: 5
    steps:
      - name: Checkout Code
        uses: actions/checkout@v6

      - name: Capture Project Stats
        uses: RoleModel/actions/project-stats
```

## Versioning

This is using [anothrNick/github-tag-action](https://github.com/anothrNick/github-tag-action/tree/master) to automatically
post version tags when a commit is merged to master. Unless you include `#patch` or `#major` in your commit message,
it will automatically create a new tag a minor version higher. `#none` will skip tagging altogether.
