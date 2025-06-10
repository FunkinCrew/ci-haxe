# setup-haxe

This action sets up a Haxe environment for use in your workflows.

## Usage

See [action.yml](action.yml) and [.github/workflows/](.github/workflows/).

Basic:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: FunkinCrew/ci-haxe@v3
        with:
          haxe-version: 4.3.7
      - run: |
          haxe -version
          haxelib install hxnodejs
```

For nigthly versions:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: FunkinCrew/ci-haxe@v3
        with:
          haxe-version: latest  # Install 'haxe_latest.tar.gz' from https://build.haxe.org/builds/haxe/linux64/
      - run: haxe -version
```

Caching global packages data:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: FunkinCrew/ci-haxe@v3
        with:
          haxe-version: 4.3.7
          cache-dependency-path: 'lib.hxml'
      - run: |
          haxe -version
          haxelib install lib.hxml --always
```
