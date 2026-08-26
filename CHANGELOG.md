# RoleModel/actions

## [v3.11.2] Aug 20, 2026

- Bump outdated `actions/checkout` and `actions/setup-node` references, including `setup-node` in `rails-ci.yml`. (#30)

## [v3.11.1] Aug 16, 2026

- Wait for `apt_packages` to finish installing before Project Stats runs, since it boots the app and can dlopen libraries (e.g. `libvips`) that apt installs. (#29)

## [v3.11.0] Aug 14, 2026

- Hotfix: revert a stray `project-stats@claude/project-stats-ci-integration-234e1e` branch reference introduced in v3.10.0 back to `project-stats@v3`. (#28)

## [v3.10.0] Aug 14, 2026

- Add optional `project-stats` input to `rails-ci.yml` (default `true`). When enabled, it runs `bin/rails stats` in the background and publishes the results as a "Project Stats" GitHub check alongside Test Results. (#27)

## [v3.9.0] Aug 11, 2026

- Add `failure-screenshot-dir` input to `rails-ci.yml` (default `tmp/capybara`) so apps that configure `Capybara.save_path` to a different directory (e.g. so `rails tmp:clear` deletes screenshots) can upload from the right place. (#26)

## [v3.8.1] Aug 7, 2026

- Key the `rails-ci.yml` asset cache on build tooling config too (`app/assets/config/**/*`, `*.config.{js,mjs,cjs,ts}`, `.node-version`), not just asset sources — a tooling change that alters the compiled bundle without touching a hashed source file was previously served a stale cached bundle. (#25)

## [v3.8.0] Aug 4, 2026

- Export `GOOGLE_CHROME_BIN` from the runner's preinstalled Chrome in `rails-ci.yml`. (#22)

## [v3.7.0] Jul 31, 2026

- Fix a `rails-ci.yml` race where Setup Parallel Databases could boot the app before backgrounded `apt_packages` installation finished, intermittently failing with errors like `Typelib file for namespace 'Poppler' (any version) not found`. App-booting steps now wait on the apt install; lint steps that don't boot the app are unaffected. (#23)

## [v3.6.0] Jul 23, 2026

- Tighten `rails-ci.yml` step dependencies so gem-only and yarn-only steps unblock as soon as their one real dependency finishes, instead of all waiting on each other, and bump stale action pins. (#21)

## [v3.5.0] Jul 9, 2026

- Add the `rails-ci.yml` reusable workflow, encapsulating an entire Rails app's CI — linting, Brakeman, dependency audit, asset compilation/caching, and `parallel_rspec` — behind a single `workflow_call` job, with `background:`/`wait:`/`parallel:` step scheduling so independent setup work (Ruby/gem install, apt packages, Node/Yarn install, asset cache restore, turbo-test runtime cache restore) overlaps instead of running sequentially.
  - Inputs: `runner`, `timeout`, `apt_packages`, `rubocop_command`, `dependency_audit_command`, `js_lint_command`, `brakeman_version`, `postgres_version`, `playwright`, `extra_env`.
  - Secrets: `RAILS_MASTER_KEY`, `BUNDLE_RUBYGEMS__PKG__GITHUB__COM` (falls back to `secrets.GITHUB_TOKEN`), `extra_secrets`. (#19)

## [v3.3.0] Mar 11, 2026

- Add optional `web-driver` input to `system-tests` action.
  - default value is `selenium`
  - `playwright` is also supported

## [v3.2.0] Mar 5, 2026

- Add new `staging-auto-merge` action, migrated from https://github.com/RoleModel/staging-auto-merge.
  - Update staging conflict handling to remove the `Staging` label immediately when merge conflicts occur.
  - Update staging squash commit messages to omit PR numbers.

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

[v3.11.2]: https://github.com/RoleModel/actions/releases/tag/v3.11.2
[v3.11.1]: https://github.com/RoleModel/actions/releases/tag/v3.11.1
[v3.11.0]: https://github.com/RoleModel/actions/releases/tag/v3.11.0
[v3.10.0]: https://github.com/RoleModel/actions/releases/tag/v3.10.0
[v3.9.0]: https://github.com/RoleModel/actions/releases/tag/v3.9.0
[v3.8.1]: https://github.com/RoleModel/actions/releases/tag/v3.8.1
[v3.8.0]: https://github.com/RoleModel/actions/releases/tag/v3.8.0
[v3.7.0]: https://github.com/RoleModel/actions/releases/tag/v3.7.0
[v3.6.0]: https://github.com/RoleModel/actions/releases/tag/v3.6.0
[v3.5.0]: https://github.com/RoleModel/actions/releases/tag/v3.5.0
[v3.3.0]: https://github.com/RoleModel/actions/releases/tag/v3.3.0
[v3.2.0]: https://github.com/RoleModel/actions/releases/tag/v3.2.0
[v3.1.0]: https://github.com/RoleModel/actions/releases/tag/v3.1.0
[v3.0.0]: https://github.com/RoleModel/actions/releases/tag/v3.0.0
[v2.0.0]: https://github.com/RoleModel/actions/releases/tag/v2.0.0
[v1.0.0]: https://github.com/RoleModel/actions/releases/tag/v1.0.0
