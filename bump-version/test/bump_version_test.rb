require "minitest/autorun"
require_relative "../bump_version"

class VersionFileTest < Minitest::Test
  RUBY_SOURCE = <<~RUBY
    module LazyChain
      VERSION = '1.4.2'
    end
  RUBY

  PACKAGE_JSON = <<~JSON
    {
      "name": "@rolemodel/turbo-form",
      "version": "0.4.0",
      "dependencies": { "@hotwired/turbo": "8.0.0" }
    }
  JSON

  def test_bumps_each_semver_segment
    version_file = VersionFile.new(RUBY_SOURCE)

    assert_equal "2.0.0", version_file.next_version("major")
    assert_equal "1.5.0", version_file.next_version("minor")
    assert_equal "1.4.3", version_file.next_version("patch")
  end

  def test_explicit_version_is_used_as_given
    assert_equal "2.0.0.rc1", VersionFile.new(RUBY_SOURCE).next_version("2.0.0.rc1")
  end

  def test_pads_short_versions_and_drops_prerelease_segments
    assert_equal "1.0.1", VersionFile.new(%(VERSION = "1")).next_version("patch")
    assert_equal "2.1.0", VersionFile.new(%(VERSION = "2.0.0.beta2")).next_version("minor")
  end

  def test_rejects_unknown_or_blank_bump
    version_file = VersionFile.new(RUBY_SOURCE)

    assert_raises(VersionFile::Error) { version_file.next_version("huge") }
    assert_raises(VersionFile::Error) { version_file.next_version("") }
  end

  def test_rewrites_ruby_constant_preserving_quote_style
    assert_equal RUBY_SOURCE.sub("1.4.2", "1.5.0"), VersionFile.new(RUBY_SOURCE).with_version("1.5.0")
    assert_equal %(VERSION = "1.5.0"), VersionFile.new(%(VERSION = "1.4.2")).with_version("1.5.0")
  end

  def test_rewrites_only_the_package_json_version_key
    version_file = VersionFile.new(PACKAGE_JSON)

    assert_equal "0.4.0", version_file.current_version
    assert_equal PACKAGE_JSON.sub(%("version": "0.4.0"), %("version": "0.5.0")), version_file.with_version("0.5.0")
  end

  def test_missing_version_raises
    assert_raises(VersionFile::Error) { VersionFile.new("module Nope; end").current_version }
  end
end
