#!/usr/bin/env ruby

require 'json'
require 'thor'

class VersionBumper < Thor::Group
  VERSION_PATTERN = /(?<assignment>\bVERSION\s*=\s*)(?<quote>["'])(?<version>[^"']+)\k<quote>/

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
    file_paths.each { |path| package_json?(path) ? npm_version : bump_constant(path) }
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
    @current_version_string ||= file_paths.map { |path| version_in(path) }.compact.first or
      raise Thor::Error, "No VERSION constant or \"version\" key in #{file_paths}"
  end

  def version_in(path)
    return JSON.parse(File.read(path))['version'] if package_json?(path)

    File.read(path)[VERSION_PATTERN, :version]
  end

  def bump_constant(path)
    File.write path, File.read(path).sub(VERSION_PATTERN, "\\k<assignment>\\k<quote>#{new_version_string}\\k<quote>")
  end

  def npm_version
    system 'npm', 'version', new_version_string, '--no-git-tag-version', '--ignore-scripts', out: File::NULL, exception: true
  end

  def package_json?(path) = File.basename(path) == 'package.json'

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
