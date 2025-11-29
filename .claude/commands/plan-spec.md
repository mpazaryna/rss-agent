---
description: Convert a spec file into a TDD implementation plan with test-first sequencing
argument-hint: [spec-file-path]
allowed-tools: Read, Write, Glob
---

## Your Task

Read the specification file provided in `$ARGUMENTS` and generate a TDD-focused implementation plan that decomposes the spec into a test-first development sequence.

### Step 1: Read and Analyze the Spec

1. Read the spec file at the path provided
2. Extract:
   - Feature name / title
   - Requirements and acceptance criteria
   - Technical details and constraints
   - Components and behaviors to implement

### Step 2: Decompose into TDD Sequence

Break down the spec into a logical test-first implementation sequence:

1. **Identify testable units**: Functions, components, API endpoints, behaviors
2. **Determine order**: Start with foundational units, build up dependencies
3. **Keep it practical**: Clear "write test → implement → refactor" steps
4. **Dependencies**: Only note if genuinely helpful for ordering, otherwise use simple numbered list

### Step 3: Generate Plan File

**Naming Convention:**
- Extract the base name from the spec file
- Replace "spec" with "plan" in the filename
- Write to the same directory as the spec

Examples:
- `spec-01.md` → `plan-01.md`
- `authentication-spec.md` → `authentication-plan.md`
- `docs/api-spec.md` → `docs/api-plan.md`

**Plan Structure:**

```markdown
# TDD Implementation Plan: [Feature Name from Spec]

## Overview
[Brief 2-3 sentence summary extracted from spec]

**Key Deliverables:**
- [Deliverable 1]
- [Deliverable 2]
- [Deliverable 3]

## Test-First Implementation Sequence

### 1. [Component/Feature Name] - Test First
**Write failing tests for:**
- [Specific behavior/requirement to test]
- [Another behavior to test]

**Implement to pass:**
- [What to build to make tests pass]

**Refactor:**
- [Any cleanup or optimization after tests pass]

---

### 2. [Next Component/Feature] - Test First
**Write failing tests for:**
- [Behavior to test]

**Implement to pass:**
- [What to build]

**Refactor:**
- [Cleanup if needed]

---

### 3. [Continue for all components...]

---

## Dependencies & Order
[OPTIONAL - Only include if the sequence has non-obvious dependencies]

- Component X must be completed before Y because [reason]
- Z can be developed in parallel with [other component]

## Completion Criteria

**All tests passing:**
- [ ] Unit tests for [component 1]
- [ ] Unit tests for [component 2]
- [ ] Integration tests for [feature]

**TDD cycle followed:**
- [ ] Each component had tests written first
- [ ] No implementation without failing tests
- [ ] Refactoring performed after green tests

**Spec requirements met:**
- [ ] [Requirement 1 from spec]
- [ ] [Requirement 2 from spec]
- [ ] [Requirement 3 from spec]
```

### Step 4: Write and Confirm

1. Write the generated plan to the calculated output path
2. Confirm to the user:
   - Input spec file read
   - Plan file location
   - Number of TDD implementation steps created
   - Next steps to begin implementation

**Success Criteria:**
- Spec file read successfully
- Plan file created in same directory with proper naming
- All spec requirements broken down into TDD sequence
- Each step has explicit "test first" instructions
- Completion criteria includes test coverage checklist
