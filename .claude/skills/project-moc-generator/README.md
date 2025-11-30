# Project MOC Generator

Version 1.0.0

A Claude skill for generating comprehensive Map of Content (MOC) documentation for software projects using GitHub-compatible markdown links.

## What This Skill Does

The Project MOC Generator analyzes your codebase and generates structured documentation in the `docs/` folder:

- **PROJECT_MOC.md**: Top-level overview linking to all documentation areas
- **Feature MOCs**: Documents implemented features with component links
- **Architecture MOCs**: Captures technical decisions and "roads not taken"
- **Component Maps**: Detailed component documentation with source code links

All documentation uses standard markdown links `[text](path)` that render perfectly on GitHub.

## Key Features

- Analyzes current codebase implementation (not future plans)
- Reads `docs/devlog/` for project context and evolution
- Generates GitHub-compatible markdown (no wiki-links)
- Includes date tracking in frontmatter
- Creates navigable documentation hierarchy
- Links directly to source code files
- Documents decision history and reasoning

## Installation

### For Claude Desktop
1. Download `project-moc-generator.zip`
2. Drag and drop into Claude Desktop application
3. Skill loads automatically

### For Claude Code
```bash
# Copy to your Claude Code skills directory
cp -r project-moc-generator ~/.claude/skills/

# Or install from this repository
cd /path/to/claude-toolkit
cp -r generated-skills/project-moc-generator ~/.claude/skills/
```

### For Claude Apps (Browser)
Use the `skill-creator` skill to import `project-moc-generator.zip`

## Usage

Navigate to your project directory and invoke:

```
@project-moc-generator Generate complete project MOC
```

Or more specific requests:

```
@project-moc-generator Document all implemented features

@project-moc-generator Create architecture decision log

@project-moc-generator Generate component maps
```

## Requirements

- Project with source code
- `docs/` folder (created if doesn't exist)
- `docs/devlog/` folder (optional but recommended)

## Output Structure

```
your-project/
├── docs/
│   ├── PROJECT_MOC.md          # Start here
│   ├── features/
│   │   ├── FEATURES_MOC.md
│   │   └── *.md
│   ├── architecture/
│   │   ├── ARCHITECTURE_MOC.md
│   │   ├── decisions.md
│   │   └── tech-stack.md
│   ├── components/
│   │   ├── COMPONENTS_MOC.md
│   │   └── *.md
│   └── devlog/
│       └── (your notes)
├── src/
│   └── (your code)
└── README.md
```

## Workflow Integration

Recommended practice:

1. Keep ongoing notes in `docs/devlog/` as you work
2. After completing features or milestones, run the skill
3. Review and enhance generated documentation
4. Commit docs alongside code changes

```bash
# Complete feature work
git add src/

# Generate documentation
# Use Claude: @project-moc-generator Generate updated MOC

# Review and commit together
git add docs/
git commit -m "feat: add feature X with documentation"
```

## Examples

See `HOW_TO_USE.md` for detailed examples and invocation patterns.

See `sample_input.json` for example project structure and `expected_output.md` for sample generated documentation.

## Support

This skill is part of the Claude Toolkit. For issues or enhancements, visit the repository or use Claude Code to iterate on the skill.

## Version History

### 1.0.0 (2025-11-20)
- Initial release
- Project MOC generation with standard markdown links
- Feature, architecture, and component documentation
- Devlog analysis integration
- Date tracking in frontmatter
- GitHub-compatible output
