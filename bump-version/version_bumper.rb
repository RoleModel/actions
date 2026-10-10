#!/usr/bin/env ruby

require 'thor'

class VersionBumper < Thor::Group
  include Thor::Actions

  VERSION_PATTERN = /(?<assignment>VERSION\s*=\s*|"version"\s*:\s*)(?<quote>["'])(?<version>[^"']+)\k<quote>/

  argument :file_path_glob, type: :string, optional: true, default: 'lib/*/version.rb',
                            desc: 'File holding the official version constant. (package.json supported automatically)'

  class_exclusive do
    class_option :patch, type: :boolean, lazy_default: false, desc: 'Bump patch version instead of minor version'
    class_option :major, type: :boolean, lazy_default: false, desc: 'Bump major version instead of minor version'
    class_option :minor, type: :boolean, lazy_default: true, desc: 'Bump minor version (default behavior)'
    class_option :version, type: :string, desc: 'Bump to a specific version (overrides all other flags)'
  end

  def validate_explicit_version
    if options.version?
      return if options[:version].match?(/\A\d/) && Gem::Version.correct?(options[:version])

      raise Thor::Error, "#{options[:version].inspect} isn't an acceptable version format"
    end

    return if current_version_string.match?(/\A\d+\.\d+\.\d+\z/)

    raise Thor::Error, "Can't bump #{current_version_string}: expected MAJOR.MINOR.PATCH. Pass --version instead."
  end

  def bump_version
    file_paths.each do |path|
      gsub_file path, VERSION_PATTERN, "\\k<assignment>\\k<quote>#{new_version_string}\\k<quote>", verbose: false
    end
  end

  def report_new_version
    say "Bumped version from #{current_version_string} to #{set_color(new_version_string, :yellow)}", :green
    return unless ENV['GITHUB_OUTPUT']

    File.write(ENV['GITHUB_OUTPUT'], "version=#{new_version_string}\nprevious-version=#{current_version_string}\n", mode: 'a')
  end

  private

  def new_version_string
    @new_version_string ||= begin
      return options[:version] if options.version?

      nv = current_version.bump
      # we now have a two segment version, unless this was a patch
      nv = nv.bump if options.major?
      # fill in missing segments to ensure a three-segment version
      nv.segments.fill(0, nv.segments.size, 3 - nv.segments.size).join('.')
    end
  end

  # Gem::Version#bump always increments the second to last segment only, so we need to append a segment to do a patch bump correctly
  def current_version
    Gem::Version.new(options.patch? ? "#{current_version_string}.0" : current_version_string)
  end

  def current_version_string
    @current_version_string ||= file_paths.map { |path| File.read(path)[VERSION_PATTERN, :version] }.compact.first or
      raise Thor::Error, "No VERSION constant or \"version\" key in #{file_paths}"
  end

  def file_paths
    @file_paths ||= Dir.glob([file_path_glob, 'package.json'])
  end

  class << self
    def exit_on_failure? = true
    def banner = 'version_bumper.rb [VERSION_FILE_GLOB] [--patch|--major|--version VERSION]'
    def desc = 'Bump the VERSION constant and/or the version key in package.json'
  end
end

VersionBumper.start(ARGV) if __FILE__ == $PROGRAM_NAME
