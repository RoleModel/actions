#!/usr/bin/env ruby

require 'open3'

class ChangelogEntry
  PLACEHOLDER = '- _No description yet. Fill this in._'.freeze
  LINK = /^\[[^\]]+\]: /
  UNRELEASED_SECTION = /^## \[?Unreleased\]?[^\n]*\n?(?<notes>.*?)(?=^## |^\[[^\]]+\]: |\z)/mi

  # Bullets typed into the workflow form, separated by `$>` or newlines.
  def self.from_description(description)
    description.to_s.split(/\$>|\n/).map(&:strip).reject(&:empty?).map { _1.start_with?('- ') ? _1 : "- #{_1}" }
  end

  # Without a description: the subjects of the commits since the previous release, with bot commits
  # (Dependabot) folded into one line. Falls back to a placeholder when there's no history to read.
  def self.from_commits_since(tag)
    log, status = Open3.capture2('git', 'log', '--no-merges', '--format=%an%x09%s', "#{tag}..HEAD", err: File::NULL)
    return [PLACEHOLDER] unless status.success?

    commits = log.lines(chomp: true).map { _1.split("\t", 2) }
    bots, people = commits.partition { |author, _| author.casecmp?('dependabot[bot]') }
    bullets = people.map { |_, subject| "- #{subject}" }
    bullets << '- Update dependencies' if bots.any?
    bullets.empty? ? [PLACEHOLDER] : bullets
  end

  attr_reader :source

  def initialize(source)
    @source = source
  end

  # The description's bullets, then any notes already under Unreleased. With neither, they're drafted
  # from the commits since the previous release.
  def bullets(description:, previous_tag:)
    bullets = self.class.from_description(description) + unreleased_notes
    bullets.empty? ? self.class.from_commits_since(previous_tag) : bullets
  end

  # In place of the Unreleased section if there is one, else newest first under the title. A
  # reference-style link to the release joins the others, if the changelog keeps them.
  def with_entry(tag:, bullets:, date:, url:)
    entry = "## [#{tag}] #{date}\n\n#{bullets.join("\n")}\n\n"
    changelog =
      if source.match?(UNRELEASED_SECTION) then source.sub(UNRELEASED_SECTION) { entry }
      elsif source.match?(/^## /) then source.sub(/^## /) { entry + _1 }
      else "#{source.rstrip}\n\n#{entry}"
      end
    changelog = changelog.sub(LINK) { "[#{tag}]: #{url}\n#{_1}" } if source.match?(LINK)
    "#{changelog.rstrip}\n"
  end

  private

  def unreleased_notes
    notes = source[UNRELEASED_SECTION, :notes].to_s.strip
    notes.empty? ? [] : [notes]
  end
end

if __FILE__ == $PROGRAM_NAME
  path = ENV.fetch('CHANGELOG_FILE', 'CHANGELOG.md')
  unless File.file?(path)
    puts "No changelog at #{path.inspect}; skipping"
    exit
  end

  prefix = ENV.fetch('TAG_PREFIX', 'v')
  tag = "#{prefix}#{ARGV.fetch(0)}"
  changelog = ChangelogEntry.new(File.read(path))
  bullets = changelog.bullets(description: ENV.fetch('DESCRIPTION', ''), previous_tag: "#{prefix}#{ENV.fetch('PREVIOUS_VERSION', '')}")

  url = "#{ENV.fetch('GITHUB_SERVER_URL', 'https://github.com')}/#{ENV.fetch('GITHUB_REPOSITORY', '')}/releases/tag/#{tag}"
  File.write(path, changelog.with_entry(tag:, bullets:, date: Time.now.utc.strftime('%b %-d, %Y'), url:))

  puts "Added #{tag} to #{path}:", bullets
end
