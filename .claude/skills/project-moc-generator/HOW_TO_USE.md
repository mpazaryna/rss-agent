# How to Use the Project MOC Generator Skill

Hey Claude—I just added the "project-moc-generator" skill. Can you generate comprehensive project documentation for this codebase?

## Example Invocations

### Example 1: Complete Project Documentation
```
Hey Claude—I just added the "project-moc-generator" skill. Can you generate a complete project MOC including features, architecture decisions, and component maps?
```

**What you'll get:**
- Clean `docs/moc/` folder structure
- README.md as entry point (auto-renders on GitHub!)
- features.md with implementation details
- architecture.md with decision log
- components.md with source code links
- All using GitHub-compatible markdown links

---

### Example 2: Feature Documentation Only
```
Hey Claude—I just added the "project-moc-generator" skill. Can you analyze the implemented features and create feature-specific MOCs?
```

**What you'll get:**
- `docs/moc/features.md` overview
- Feature catalog with implementation status
- Links to implementing components
- Current capabilities (not future plans)

---

### Example 3: Architecture and Decisions
```
Hey Claude—I just added the "project-moc-generator" skill. Can you document the architectural decisions including what we considered but didn't implement?
```

**What you'll get:**
- `docs/moc/architecture.md` with decision history
- Technology choice documentation
- "Roads not taken" with reasoning
- Links to affected components

---

### Example 4: Component Mapping
```
Hey Claude—I just added the "project-moc-generator" skill. Can you create detailed component maps linking to source code?
```

**What you'll get:**
- `docs/moc/components.md` overview
- Component catalog with details
- Source code file links
- Dependency graphs
- Implementation patterns

---

### Example 5: Update Existing Documentation
```
Hey Claude—I just added the "project-moc-generator" skill. I've added new features since last documentation. Can you update the project MOC?
```

**What you'll get:**
- Updated MOC files with new content
- Refreshed `last_updated` dates in frontmatter
- New feature and component documentation
- Preserved existing custom content where possible

---

### Example 6: Devlog Synthesis
```
Hey Claude—I just added the "project-moc-generator" skill. Can you read through docs/devlog/ and synthesize the project evolution into structured documentation?
```

**What you'll get:**
- Analysis of devlog entries for context
- Decision rationale extracted from notes
- Project evolution narrative
- Integrated insights into MOC structure

---

## What to Provide

### Essential
- Access to your project codebase
- `docs/` folder (skill will create if needed)

### Recommended
- `docs/devlog/` with ongoing notes, decisions, thoughts
- Existing README or project documentation
- Package configuration (package.json, requirements.txt, etc.)

### Optional (improves output)
- Architecture diagrams or notes
- CHANGELOG or version history
- Code comments explaining complex decisions

## What You'll Get

### Documentation Structure
```
docs/
├── moc/
│   ├── README.md               # Your starting point (auto-renders!)
│   ├── features.md             # Feature overview and catalog
│   ├── architecture.md         # Architecture and decisions
│   ├── components.md           # Component overview and maps
│   └── decisions.md            # Detailed ADRs (optional)
└── devlog/
    └── your-notes.md           # Analyzed, not modified
```

**Benefits:**
- Single `moc/` folder keeps everything together
- `README.md` auto-displays when you navigate to `docs/moc/` on GitHub
- Lowercase filenames follow conventions
- Won't conflict with existing docs

### Every Document Includes
- YAML frontmatter with dates
- Standard markdown links (GitHub-compatible)
- Links to source code
- Current implementation state
- Navigation to related docs

### Link Format
All links use standard markdown:
```markdown
# From docs/moc/README.md:
[Features](./features.md)
[Architecture](./architecture.md)

# From any MOC to source code:
[Source Code](../../src/auth/index.ts)

# From main README to MOC:
[Project Documentation](./docs/moc/)
```

NO wiki-links (`[[like this]]`) - ensures GitHub rendering works perfectly.

## Usage Patterns

### Pattern 1: Initial Documentation
First time documenting your project:

```
@project-moc-generator Generate complete project documentation from scratch
```

Review output, add human insights, commit to git.

---

### Pattern 2: Regular Updates
After completing feature work:

```
@project-moc-generator Update project MOC with latest changes
```

Quick refresh to keep docs current.

---

### Pattern 3: Decision Capture
After making architectural decisions:

```
@project-moc-generator Document the decision to use [technology X] and what alternatives we considered
```

Captures context while fresh in mind.

---

### Pattern 4: Onboarding Documentation
Preparing for new team member:

```
@project-moc-generator Generate comprehensive onboarding documentation showing all features and components
```

Creates entry point for understanding entire project.

---

### Pattern 5: Stakeholder Reports
Creating documentation for non-technical stakeholders:

```
@project-moc-generator Generate high-level project overview suitable for stakeholders showing implemented features
```

Focus on capabilities and decisions, less on code internals.

---

## Tips for Best Results

1. **Maintain a devlog**: Keep `docs/devlog/` updated with thoughts, decisions, and context as you work. The skill analyzes these for richer documentation.

2. **Run after milestones**: Generate documentation after completing features or making architectural changes while context is fresh.

3. **Review and enhance**: Generated docs are comprehensive but benefit from human refinement—add examples, diagrams, and insights.

4. **Keep organized**: The skill outputs to `docs/moc/` following a clear structure. Maintain this organization for consistency.

5. **Link from README**: Add link to `docs/moc/` from your main README so it's discoverable—the README.md auto-renders!

6. **Commit with code**: Treat documentation changes like code—review, commit, and track in git.

7. **Use specific requests**: Instead of "document everything", ask for specific areas: "document the auth feature" or "create component map for API services".

## Integration with Workflow

### During Development
```
# Keep notes as you work
echo "Decided to use JWT instead of sessions because..." > docs/devlog/2025-11-20-auth-decision.md

# After completing feature
@project-moc-generator Update project MOC with auth feature
```

### Before Code Review
```
# Generate docs showing what changed
@project-moc-generator Document the new features in this branch

# Review generated docs alongside code
git diff docs/
```

### For Releases
```
# Document state at release
@project-moc-generator Generate complete project documentation for v2.0

# Include in release artifacts
git add docs/
git commit -m "docs: update MOC for v2.0 release"
```

## Common Questions

**Q: Will this modify my source code?**
A: No. The skill only reads source code and writes to `docs/` folder. Your code is never modified.

**Q: What if I already have docs/ folder?**
A: The skill creates a separate `docs/moc/` folder. It won't conflict with your existing documentation files.

**Q: Do I need docs/devlog/?**
A: No, it's optional. But having ongoing notes there provides valuable context for better documentation generation.

**Q: Will it work on GitHub?**
A: Yes! All links use standard markdown format `[text](path)` that renders perfectly on GitHub, GitLab, and other platforms.

**Q: Can I customize the output?**
A: Yes. Generated docs are starting points. Edit them, add diagrams, include examples, and commit the enhanced versions.

**Q: How often should I regenerate?**
A: After significant changes: new features, architectural decisions, component additions. Treat it like updating your README—do it when there's something meaningful to document.

---

## Next Steps

1. **Install the skill** using one of the methods in README.md
2. **Navigate to your project** directory
3. **Invoke with**: `@project-moc-generator Generate complete project MOC`
4. **Review the output** in `docs/moc/` folder
5. **Enhance with human insights** as needed
6. **Commit to git** alongside your code
7. **Share with team** by linking to `docs/moc/` from main README

Start with a complete generation, then use targeted updates as you continue development. Your documentation will stay current with minimal effort!
