# Changelog

> **Note:** This action is based on [@MatteoCampinoti94/changelog-to-release](https://github.com/MatteoCampinoti94/changelog-to-release).
> This changelog continues from his last release v1.0.3.

## v1.1.0

### Changes

* Updated to Node v24

## v1.0.3

### Fixes

* Fix [CVE-2022-35954](https://github.com/advisories/GHSA-7r3h-m5j6-3q42)

## v1.0.2

### Features

* Support _links_ sections with 🔗 emoji in the default configuration

### Changes

* Use the gear emoji ⚙️ for _changes_ sections
* Use the delivery truck emoji 🚚 for _distribution_ sections
* Add "new features" alias for "features" sections

### Fixes

* Fix `changelog` path input not being set to default when input is an empty value

## v1.0.1

### Fixes

* Fix regex error when parsing version headers

## v1.0.0 - First Release

First release of the action available at `lipkau/gh-tools/actions/changelog-to-release@v1`.

### Features

* Parse CHANGELOG.md to create release body
* Add emojis 🚀 to the title sections
* Sort sections
