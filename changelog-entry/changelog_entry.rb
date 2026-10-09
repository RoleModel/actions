#!/usr/bin/env ruby

require 'open3'

class ChangelogEntry
  PLACEHOLDER = '- _No description yet. Fill this in._'.freeze
  LINK = /^\[[^\]]+\]: /

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
    bots, people = commits.partition { |author, _| author.end_with?('[bot]') }
    bullets = people.map { |_, subject| "- #{subject}" }
    bullets << '- Update dependencies' if bots.any?
    bullets.empty? ? [PLACEHOLDER] : bullets
  end

  attr_reader :source

  def initialize(source)
    @source = source
  end

  # Newest first, under the title. A reference-style link to the release joins the others, if the
  # changelog keeps them.
  def with_entry(tag:, bullets:, date:, url:)
    entry = "## [#{tag}] #{date}\n\n#{bullets.join("\n")}\n\n"
    changelog = source.match?(/^## /) ? source.sub(/^## /) { entry + _1 } : "#{source.rstrip}\n\n#{entry}"
    changelog = changelog.sub(LINK) { "[#{tag}]: #{url}\n#{_1}" } if source.match?(LINK)
    "#{changelog.rstrip}\n"
  end
end

if __FILE__ == $PROGRAM_NAME
  path = ENV.fetch('CHANGELOG_FILE', 'CHANGELOG.md')
  tag = "#{ENV.fetch('TAG_PREFIX', 'v')}#{ARGV.fetch(0)}"
  previous_tag = "#{ENV.fetch('TAG_PREFIX', 'v')}#{ENV.fetch('PREVIOUS_VERSION', '')}"

  bullets = ChangelogEntry.from_description(ENV.fetch('DESCRIPTION', ''))
  bullets = ChangelogEntry.from_commits_since(previous_tag) if bullets.empty?

  url = "#{ENV.fetch('GITHUB_SERVER_URL', 'https://github.com')}/#{ENV.fetch('GITHUB_REPOSITORY', '')}/releases/tag/#{tag}"
  changelog = ChangelogEntry.new(File.read(path)).with_entry(tag:, bullets:, date: Time.now.utc.strftime('%b %-d, %Y'), url:)
  File.write(path, changelog)

  puts "Added #{tag} to #{path}:", bullets
end
