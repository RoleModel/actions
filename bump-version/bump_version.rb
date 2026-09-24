#!/usr/bin/env ruby

class VersionFile
  PATTERN = /(?<assignment>VERSION\s*=\s*|"version"\s*:\s*)(?<quote>["'])(?<version>[^"']+)\k<quote>/
  BUMPS = %w[major minor patch].freeze

  class Error < StandardError; end

  def self.detect
    candidates = Dir["lib/*/version.rb"]
    return candidates.first if candidates.one?

    raise Error, "Found #{candidates.size} lib/*/version.rb files; set the version-file input"
  end

  attr_reader :source

  def initialize(source)
    @source = source
  end

  def current_version
    source[PATTERN, :version] or raise Error, "No VERSION constant or \"version\" key found"
  end

  def next_version(bump)
    return bump if bump.match?(/\A\d/) && Gem::Version.correct?(bump)

    major, minor, patch = Gem::Version.new(current_version).release.segments.values_at(0, 1, 2).map(&:to_i)

    case bump
    when "major" then "#{major + 1}.0.0"
    when "minor" then "#{major}.#{minor + 1}.0"
    when "patch" then "#{major}.#{minor}.#{patch + 1}"
    else raise Error, "bump must be one of #{BUMPS.join(", ")} or an explicit version, got #{bump.inspect}"
    end
  end

  def with_version(version)
    source.sub(PATTERN) { "#{$~[:assignment]}#{$~[:quote]}#{version}#{$~[:quote]}" }
  end
end

if __FILE__ == $PROGRAM_NAME
  begin
    bump, path = ARGV
    path = VersionFile.detect if path.to_s.empty?

    version_file = VersionFile.new(File.read(path))
    previous_version = version_file.current_version
    version = version_file.next_version(bump.to_s)
    File.write(path, version_file.with_version(version))
  rescue VersionFile::Error => e
    abort e.message
  end

  puts "Bumped #{path} from #{previous_version} to #{version}"
  File.write(ENV["GITHUB_OUTPUT"], "version=#{version}\nprevious-version=#{previous_version}\n", mode: "a") if ENV["GITHUB_OUTPUT"]
end
