# Claude Code Slash Command: `/plan-from-spec`

## Overview
A generic slash command that reads `spec-01.md` and documentation from `docs/` directory, then generates a comprehensive `plan-01.md` using strict Test-Driven Development (TDD) principles.

---

## Setup Instructions

### 1. Create Command Configuration
Create `.claude/commands/plan-from-spec.yaml` in your project root:

```yaml
name: plan-from-spec
description: Read spec-01.md and ai_docs/, generate TDD-driven plan-01.md
trigger: /plan-from-spec
enabled: true

prompt: |
  You are a TDD planning expert. Your task is to create a comprehensive plan document that breaks down project requirements into discrete, testable units.
  
  **Your Process:**
  1. Read the provided spec-01.md thoroughly
  2. Review all documentation in ai_docs/
  3. Extract core requirements and acceptance criteria
  4. Decompose into TDD-first functions with tests
  5. Create dependency mapping
  6. Generate plan-01.md
  
  **Output Requirements:**
  - Create plan-01.md in the project root
  - Strict TDD methodology: test first, implementation follows
  - Each function includes:
    * Clear test cases (what we're testing)
    * Function signature
    * Expected behavior
    * Dependencies
    * Acceptance criteria
  - Organize by logical units
  - Include test execution order/sequence
  - Mark blocking dependencies clearly
  
  **Format for each TDD unit:**
  ```
  ### [Unit Name]
  
  **Purpose:** [Clear statement of what this does]
  
  **Test Cases:**
  - Test: [What behavior to verify]
    Expected: [What should happen]
    
  **Function Signature:**
  \`\`\`
  [language-specific signature]
  \`\`\
  
  **Implementation Notes:**
  [Brief notes on approach]
  
  **Dependencies:**
  - [Any functions or modules this depends on]
  
  **Acceptance Criteria:**
  - [ ] [Criterion 1]
  - [ ] [Criterion 2]
  ```
  
  Begin now. Read the spec and documentation, then generate the plan.

actions:
  - type: read_file
    path: spec-01.md
    variable: spec_content
    
  - type: read_directory
    path: ai_docs/
    variable: docs_content
    recursive: true
    
  - type: generate_file
    path: plan-01.md
    variable: generated_plan
    
  - type: display
    message: "✅ plan-01.md generated successfully with TDD structure"
```

---

## Installation

### For Project Using Claude Code CLI:

```bash
mkdir -p .claude/commands
cp plan-from-spec.yaml .claude/commands/
```

### For Claude.ai with Projects:

You can trigger this functionality by pasting the prompt directly into Claude with:
1. Files attached: `spec-01.md` and contents from `ai_docs/`
2. Or use: `/plan-from-spec` if your project is configured with Claude Code

---

## Usage

### In Claude Code CLI:
```bash
claude /plan-from-spec
```

### In Claude.ai:
```
/plan-from-spec
```

---

## Output: Generated plan-01.md Structure

The command generates `plan-01.md` with this structure:

```markdown
# Project Plan - TDD Methodology

## Overview
[Summary of project from spec]

## Core Requirements
[Extracted from spec-01.md]

## Testing Strategy
[TDD approach overview]

---

## Phase 1: Foundation Tests & Core Functions

### [Unit 1: Core Function A]

**Purpose:** [What this does]

**Test Cases:**
- Test: [Behavior 1]
  Expected: [Result 1]
- Test: [Behavior 2]
  Expected: [Result 2]

**Function Signature:**
\`\`\`python
def core_function_a(input_param: Type) -> ReturnType:
    """[Docstring with behavior description]"""
\`\`\`

**Implementation Notes:**
[Key design decisions, algorithms, edge cases]

**Dependencies:**
- None (Foundation unit)

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] [Specific requirement 1]
- [ ] [Specific requirement 2]

---

### [Unit 2: Core Function B]

[... similar structure ...]

---

## Phase 2: Integration & Dependent Functions

### [Unit N: Function depending on Phase 1]

**Dependencies:**
- core_function_a
- core_function_b

[... structure continues ...]

---

## Dependency Graph

\`\`\`
core_function_a ──┐
                  ├─→ integration_function_x
core_function_b ──┤
                  └─→ integration_function_y
\`\`\`

---

## Test Execution Sequence

1. Phase 1 Foundation (parallel execution allowed)
2. Phase 2 Integration (depends on Phase 1 completion)
3. Phase 3 Advanced (depends on Phase 2)
4. Phase 4 Edge Cases & Performance (final verification)

---

## Success Criteria
- All tests defined and passing
- All acceptance criteria met
- Code review ready for implementation phase
```

---

## Customization for Your Projects

### For Different Spec Names:
Modify the command trigger and file path:
```yaml
trigger: /plan-from-spec-[project-name]
actions:
  - type: read_file
    path: specs/spec-01.md
```

### For Different Documentation Structure:
Update the read_directory action:
```yaml
actions:
  - type: read_directory
    path: docs/
    variable: docs_content
```

---

## Integration with Your Workflow

### Typical Usage Flow:
1. **Write spec-01.md** — Define requirements
2. **Organize ai_docs/** — Add architecture, context, decisions
3. **Run `/plan-from-spec`** — Generate TDD plan
4. **Review plan-01.md** — Refine test units if needed
5. **Begin TDD implementation** — Red → Green → Refactor

### GitHub Issues Integration:
Once plan-01.md is generated, you can:
- Create GitHub Issues from each TDD unit
- Link issues to PRs as you implement
- Track test passage as completion

---

## Best Practices

**Spec Writing for Best Results:**
- Be explicit about acceptance criteria in spec-01.md
- Include edge cases in documentation
- Document assumptions clearly

**For TDD-Ready Plans:**
- Ensure each unit is independently testable
- Keep functions to single responsibility
- Make dependencies explicit

**After Generation:**
- Review the dependency graph for circular dependencies
- Validate test cases cover all acceptance criteria
- Adjust execution sequence based on team capacity

---

## Troubleshooting

**Plan not generating?**
- Ensure spec-01.md exists in project root
- Verify ai_docs/ directory exists (can be empty initially)
- Check file permissions are readable

**Too many units?**
- Specify in ai_docs/PLANNING_NOTES.md: `MAX_UNITS: 15`
- Command will consolidate related units

**Need different output format?**
- Edit the prompt section to specify format
- Request JSON, YAML, or other structured output
- Include template in ai_docs/PLAN_TEMPLATE.md

---

## Configuration Options

Add `ai_docs/PLANNING_CONFIG.md`:

```markdown
# Planning Configuration

## Test Framework
Language: [python/typescript/swift/rust]
Framework: [pytest/jest/xctest/cargo test]

## Max Planning Units
Limit: [number, blank for auto]

## Priority Focus Areas
- [Area 1]
- [Area 2]

## Excluded from Planning
- [Any sections/files to skip]

## Custom Acceptance Criteria Template
[Any project-specific criteria]
```

---

## Examples

### Python Project:
```bash
/plan-from-spec
# Generates plan-01.md with pytest-style test functions
```

### Swift/iOS Project:
```bash
/plan-from-spec
# Generates plan-01.md with XCTest structure
```

### Multi-language Project:
Add `ai_docs/PLANNING_CONFIG.md` with language specification.

---

## Advanced: Multi-Spec Projects

For projects with multiple specs, create variants:

```yaml
# .claude/commands/plan-from-spec-backend.yaml
trigger: /plan-backend
path: specs/backend/spec-01.md
docs_path: docs/backend/

# .claude/commands/plan-from-spec-frontend.yaml
trigger: /plan-frontend
path: specs/frontend/spec-01.md
docs_path: docs/frontend/
```

---

## Integration with MCP Servers

If using MCP servers, add to your command:

```yaml
mcp_tools:
  - github: List and create issues from plan
  - filesystem: Read/write plan files
  - code: Analyze existing codebase for conflicts
```

This enables the command to auto-create GitHub Issues from the generated plan.

---

## Summary

This slash command provides a **generic, reusable foundation** for:
- ✅ Spec-to-plan transformation
- ✅ Strict TDD structuring
- ✅ Dependency mapping
- ✅ Cross-project consistency
- ✅ Automated documentation

**Copy to your projects and customize as needed.**