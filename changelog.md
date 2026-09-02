## ChangeLog

### [v1.0.0](https://github.com/Sagar2011/deal-scout/tags/v1.0.0)
* feat: initial setup with configuration, CLI, and tests

* feat: implement candidate analysis pipeline with LLM integration

- Added analysis, scoring, and recommendation modules for startup candidates.
- Introduced LLM-based analysis using OpenAI API.
- Implemented candidate discovery from Y Combinator and Hacker News.
- Created a structured pipeline to run analyses and generate reports.
- Enhanced CLI to accept topics for analysis runs.
- Added configuration loading for API keys and run directories.
- Included unit and integration tests for new functionalities.
- Updated package.json to include axios as a dependency.

* fix: update .gitignore to correctly ignore all environment files

* chore: remove demo run files and related evidence for cleanup

* feat: enhance LLM integration with independent prompt management and memo generation

* feat: add Prettier for code formatting and improve code structure across multiple files

* feat: update LLM integration to use OpenRouter API and add model configuration options

* feat: enhance candidate analysis and logging in pipeline execution

* feat: implement YC profile enrichment and update memo rendering to HTML format

### [v1.1.0](https://github.com/Sagar2011/deal-scout/tags/v1.1.0)

* feat: enhance scoring analysis and calibration; integrate evidence-based scoring and update documentation
* feat: enhance candidate profile handling; add LinkedIn URLs and logo support
* feat: update memo rendering tests to reflect new HTML structure and class names
* feat: enhance analysis normalization and scoring breakdown; update report rendering
* feat: add AI Agent Guide and contributing guidelines; refactor pipeline for extensibility