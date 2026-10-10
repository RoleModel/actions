require 'minitest/autorun'
require 'tmpdir'
require_relative '../version_bumper'

class VersionBumperTest < Minitest::Test
  def setup
    @dir = Dir.mktmpdir
    @pwd = Dir.pwd
    Dir.chdir(@dir)
    write 'lib/lazy_chain/version.rb', "module LazyChain\n  VERSION = '1.4.2'\nend\n"
  end

  def teardown
    Dir.chdir(@pwd)
    FileUtils.rm_rf(@dir)
  end

  def test_bumps_minor_by_default_and_each_semver_segment
    assert_equal '1.5.0', bump
    assert_equal '1.5.1', bump('--patch')
    assert_equal '2.0.0', bump('--major')
    assert_equal "module LazyChain\n  VERSION = '2.0.0'\nend\n", read('lib/lazy_chain/version.rb')
  end

  def test_explicit_version_is_used_as_given
    assert_equal '2.0.0.rc1', bump('--version', '2.0.0.rc1')
  end

  def test_refuses_to_guess_from_a_version_that_isnt_major_minor_patch
    write 'lib/lazy_chain/version.rb', 'VERSION = "2.0.0.beta2"'

    assert_raises(Thor::Error) { bump('--patch') }
    assert_equal 'VERSION = "2.0.0.beta2"', read('lib/lazy_chain/version.rb')
    assert_equal '2.0.0', bump('--version', '2.0.0')
  end

  def test_rejects_an_explicit_version_that_isnt_one
    assert_raises(Thor::Error) { bump('--version', 'huge') }
    assert_raises(Thor::Error) { bump('--version', '') }
  end

  def test_keeps_quote_style_and_whatever_follows_the_constant
    write 'lib/lazy_chain/version.rb', %(VERSION = "1.4.2".freeze # comment)

    bump
    assert_equal %(VERSION = "1.5.0".freeze # comment), read('lib/lazy_chain/version.rb')
  end

  def test_bumps_package_json_alongside_the_gem
    write 'package.json', %({\n  "name": "@rolemodel/lazy-chain",\n  "version": "1.4.2",\n  "scripts": { "version": "auto-changelog -p" },\n  "dependencies": { "@hotwired/turbo": "8.0.0" }\n}\n)

    bump
    assert_includes read('package.json'), %("version": "1.5.0")
    assert_includes read('package.json'), %("version": "auto-changelog -p")
    assert_includes read('package.json'), %("@hotwired/turbo": "8.0.0")
  end

  def test_falls_back_to_package_json_without_a_gem
    FileUtils.rm_rf('lib')
    write 'package.json', %({ "name": "@rolemodel/turbo-confirm", "version": "2.2.5" })

    assert_equal '2.3.0', bump
  end

  def test_takes_an_explicit_version_file
    FileUtils.rm_rf('lib')
    write 'config/version.rb', 'VERSION = "0.1.0"'

    assert_equal '0.2.0', bump(file: 'config/version.rb')
    assert_equal 'VERSION = "0.2.0"', read('config/version.rb')
  end

  def test_writes_github_outputs
    bump('--patch')
    assert_equal "version=1.4.3\nprevious-version=1.4.2\n", read(github_output)
  end

  private

  def bump(*flags, file: nil)
    File.write(github_output, '')
    previous_output, ENV['GITHUB_OUTPUT'] = ENV['GITHUB_OUTPUT'], github_output
    capture_io { VersionBumper.new([file].compact, flags).invoke_all }
    read(github_output)[/^version=(.+)$/, 1]
  ensure
    ENV['GITHUB_OUTPUT'] = previous_output
  end

  def github_output = File.join(@dir, 'github_output')

  def write(path, content)
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, content)
  end

  def read(path) = File.read(path)
end
