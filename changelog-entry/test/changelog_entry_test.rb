require 'minitest/autorun'
require 'tmpdir'
require_relative '../changelog_entry'

class ChangelogEntryTest < Minitest::Test
  LINKED = <<~MD
    # Change Log

    ## [v2.2.5] Oct 6, 2026

    - Automate version bumps

    [v2.2.5]: https://github.com/RoleModel/turbo-confirm/releases/tag/v2.2.5
  MD

  def test_splits_a_description_into_bullets
    assert_equal ['- One', '- Two', '- Three'], ChangelogEntry.from_description("One $> - Two\nThree\n")
    assert_empty ChangelogEntry.from_description('  ')
  end

  def test_adds_the_newest_entry_first_with_its_link
    changelog = ChangelogEntry.new(LINKED).with_entry(tag: 'v2.3.0', bullets: ['- Hover trigger'], date: 'Oct 9, 2026',
                                                      url: 'https://github.com/RoleModel/turbo-confirm/releases/tag/v2.3.0')

    assert_equal <<~MD, changelog
      # Change Log

      ## [v2.3.0] Oct 9, 2026

      - Hover trigger

      ## [v2.2.5] Oct 6, 2026

      - Automate version bumps

      [v2.3.0]: https://github.com/RoleModel/turbo-confirm/releases/tag/v2.3.0
      [v2.2.5]: https://github.com/RoleModel/turbo-confirm/releases/tag/v2.2.5
    MD
  end

  def test_adds_no_link_to_a_changelog_that_keeps_none
    changelog = ChangelogEntry.new("# Changelog\n\n## [v1.0.0] Jan 1, 2026\n\n- First\n")
                              .with_entry(tag: 'v1.1.0', bullets: ['- Second'], date: 'Oct 9, 2026', url: 'https://example.com')

    assert_equal "# Changelog\n\n## [v1.1.0] Oct 9, 2026\n\n- Second\n\n## [v1.0.0] Jan 1, 2026\n\n- First\n", changelog
  end

  def test_starts_the_first_entry_under_the_title
    changelog = ChangelogEntry.new("# Changelog\n").with_entry(tag: 'v0.1.0', bullets: ['- First'], date: 'Oct 9, 2026', url: 'x')

    assert_equal "# Changelog\n\n## [v0.1.0] Oct 9, 2026\n\n- First\n", changelog
  end

  def test_replaces_bracketed_unreleased_heading_and_preserves_section_content
    source = "# Changelog\n\n## [Unreleased]\n\n- Work in progress\n\n## [v1.0.0] Jan 1, 2026\n\n- First\n"

    changelog = ChangelogEntry.new(source).replace_unreleased(tag: 'v1.1.0', date: 'Oct 10, 2026')

    assert_equal "# Changelog\n\n## [v1.1.0] Oct 10, 2026\n\n- Work in progress\n\n## [v1.0.0] Jan 1, 2026\n\n- First\n", changelog
  end

  def test_replaces_plain_unreleased_heading_and_preserves_section_content
    source = "# Changelog\n\n## Unreleased\n\n- Work in progress\n"

    changelog = ChangelogEntry.new(source).replace_unreleased(tag: 'v1.1.0', date: 'Oct 10, 2026')

    assert_equal "# Changelog\n\n## [v1.1.0] Oct 10, 2026\n\n- Work in progress\n", changelog
  end

  def test_drafts_from_commits_since_the_previous_tag_folding_in_bot_commits
    in_repo do
      commit 'Before the release'
      git 'tag', 'v1.0.0'
      commit 'Add a hover trigger (#12)'
      commit 'Bump rack from 3.1 to 3.2', author: 'dependabot[bot]'
      commit 'Fix the anchor in Safari'

      assert_equal ['- Fix the anchor in Safari', '- Add a hover trigger (#12)', '- Update dependencies'],
                   ChangelogEntry.from_commits_since('v1.0.0')
    end
  end

  def test_drafts_a_placeholder_without_history
    in_repo do
      commit 'Only commit'

      assert_equal [ChangelogEntry::PLACEHOLDER], ChangelogEntry.from_commits_since('v0.9.0')
      git 'tag', 'v1.0.0'
      assert_equal [ChangelogEntry::PLACEHOLDER], ChangelogEntry.from_commits_since('v1.0.0')
    end
  end

  private

  # Isolated from the developer's git config, where tag or commit signing would open an editor or prompt.
  def in_repo(&)
    isolated = { 'GIT_CONFIG_GLOBAL' => File::NULL, 'GIT_CONFIG_NOSYSTEM' => '1' }
    previous = ENV.to_h.slice(*isolated.keys)
    ENV.update(isolated)
    Dir.mktmpdir { |dir| Dir.chdir(dir) { git('init', '--quiet') && yield } }
  ensure
    isolated.each_key { |key| ENV[key] = previous[key] }
  end

  def commit(subject, author: 'Andy')
    git '-c', "user.name=#{author}", '-c', 'user.email=a@example.com', 'commit', '--quiet', '--allow-empty', '-m', subject
  end

  def git(*args) = system('git', *args, exception: true)
end
