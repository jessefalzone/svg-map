# Legacy Python converter

This directory contains the original build-time Python image-map converter and
its Poetry environment. The browser JavaScript library at the repository root
is the recommended workflow for new projects.

```sh
poetry install
poetry run python map-to-svg.py path/to/map.html
```

Run `poetry run python map-to-svg.py --help` for all CLI options.
