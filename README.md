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

## Versioning
This is using [anothrNick/github-tag-action](https://github.com/anothrNick/github-tag-action/tree/master) to automatically
post version tags when a commit is merged to master. Unless you include `#patch` or `#major` in your commit message,
it will automatically create a new tag a minor version higher. `#none` will skip tagging altogether.