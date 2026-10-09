#!/usr/bin/env ruby

require 'thor'

class VersionBumper < Thor::Group
  include Thor::Actions

  VERSION_PATTERN = /(?<assignment>VERSION\s*=\s*|"version"\s*:\s*)(?<quote>["'])(?<version>[^"']+)\k<quote>/

  argument :version_file, type: :string, optional: true,
                          desc: 'File holding the version. Default: the single lib/*/version.rb, else package.json'

  class_exclusive do
    class_option :patch, type: :boolean, lazy_default: false, desc: 'Bump patch version instead of minor version'
    class_option :major, type: :boolean, lazy_default: false, desc: 'Bump major version instead of minor version'
    class_option :minor, type: :boolean, lazy_default: true, desc: 'Bump minor version (default behavior)'
    class_option :version, type: :string, desc: 'Bump to a specific version (overrides all other flags)'
  end

  def verify_versions
    if options.version?
      return if options[:version].match?(/\A\d/) && Gem::Version.correct?(options[:version])

      raise Thor::Error, "#{options[:version].inspect} isn't a version"
    end

    return if current_version_string.match?(/\A\d+\.\d+\.\d+\z/)

    raise Thor::Error, "Can't bump #{current_version_string}: expected MAJOR.MINOR.PATCH. Pass --version instead."
  end

  def bump_version
    rewrite_version version_path
  end

  # A gem that also ships an npm package releases both under one version.
  def bump_package_version
    rewrite_version 'package.json' if version_path != 'package.json' && File.exist?('package.json')
  end

  def report_new_version
    say "Bumped #{version_path} from #{current_version_string} to #{set_color(new_version_string, :yellow)}", :green
    return unless ENV['GITHUB_OUTPUT']

    File.write(ENV['GITHUB_OUTPUT'], "version=#{new_version_string}\nprevious-version=#{current_version_string}\n", mode: 'a')
  end

  private

  def rewrite_version(path)
    gsub_file path, VERSION_PATTERN, "\\k<assignment>\\k<quote>#{new_version_string}\\k<quote>", verbose: false
  end

  def new_version_string
    @new_version_string ||= begin
      return options[:version] if options.version?

      nv = current_version.bump
      nv = nv.bump if options.major?
      nv.segments.fill(0, nv.segments.size, 3 - nv.segments.size).join('.')
    end
  end

  def current_version
    Gem::Version.new(options.patch? ? "#{current_version_string}.0" : current_version_string)
  end

  def current_version_string
    @current_version_string ||= File.read(version_path)[VERSION_PATTERN, :version] or
      raise Thor::Error, "No VERSION constant or \"version\" key in #{version_path}"
  end

  def version_path
    @version_path ||= version_file.to_s.empty? ? detect_version_file : version_file
  end

  def detect_version_file
    candidates = Dir['lib/*/version.rb']
    return candidates.first if candidates.one?
    return 'package.json' if candidates.empty? && File.exist?('package.json')

    raise Thor::Error, "Found #{candidates.size} lib/*/version.rb files; pass the version file"
  end

  class << self
    def exit_on_failure? = true
    def banner = 'version_bumper.rb [VERSION_FILE] [--patch|--major|--version VERSION]'
    def desc = 'Bump the version in a Ruby VERSION constant or package.json'
  end
end

VersionBumper.start(ARGV) if __FILE__ == $PROGRAM_NAME
