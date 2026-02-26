# RoleModel/actions

## [v3.1.0] Feb 26, 2026

Add new `project-stats` action which provides a markdown version of
the output of `bin/rails stats` to your workflow's summary page on Github.

## [v3.0.0] Feb 17, 2026

Update Dependency Actions + Add an Input (#6) #major

- Standardize wording, Quoting, & Capitalization
  across composite actions
- Add optional input (needs-compiled-assets) to
  linting-and-non-system-tests action (def. true)
- Update Dependency Actions
  - actions/cache v4 -> v5
  - actions/setup-node v4 -> v6
  - mikepenz/action-junit-report v4 -> v6
  - browser-actions/setup-chrome v1 -> v2
  - actions/upload-artifact v4 -> v6

## [v2.0.0] Apr 11, 2025

We originally had a shared workflow that contained all of these actions, but that
was too restrictive. Some projects needed special things to happen (custom install
step, setting up special ENV variables, or needing special secrets that we didn't want
to pass into the composite actions). As an alternative strategy, we're going to provide
many "composite" actions which you can reference from your projects `.github/workflows/ci.yml`.

New Composite Actions:

- compile assets
- non system tests
- and system tests

## [v1.0.0] Feb 18, 2025

- Add `test-cleanup` action to save logs
- Add `test-runtime-analyzer` action to post test runtimes

[v3.1.0]: https://github.com/RoleModel/actions/releases/tag/v3.1.0
[v3.0.0]: https://github.com/RoleModel/actions/releases/tag/v3.0.0
[v2.0.0]: https://github.com/RoleModel/actions/releases/tag/v2.0.0
[v1.0.0]: https://github.com/RoleModel/actions/releases/tag/v1.0.0
