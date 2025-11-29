---
description: Fetch GitHub issue details and load into context for coding agent analysis and implementation
argument-hint: [issue-number]
allowed-tools: Bash(gh:*)
---

## Context

Current repository: !`gh repo view --json nameWithOwner -q .nameWithOwner`

## Your task

Fetch the full details of GitHub issue #$ARGUMENTS and present it in a structured format for the coding agent to work with.

**Steps:**

1. **Fetch Issue Details**
   - Use `gh issue view $ARGUMENTS` to retrieve the complete issue
   - Include title, body, labels, assignees, and milestone if present
   - Capture any linked pull requests or related issues

2. **Present for Coding Context**
   - Display the issue in a clear, readable format
   - Highlight key requirements and acceptance criteria
   - Extract any code snippets, file references, or technical specifications
   - Note any discussion points or clarifications from comments

3. **Prepare for Implementation**
   - Summarize the main task and objectives
   - List any dependencies or prerequisites mentioned
   - Identify files or components likely to be affected
   - Flag any edge cases or special considerations

**Output Format:**

Present the information as:
```
# Issue #$ARGUMENTS: [Title]

## Status
- State: [open/closed]
- Labels: [labels list]
- Assignee: [assignee if any]
- Milestone: [milestone if any]

## Description
[Full issue body with formatting preserved]

## Key Requirements
- [Extracted requirement 1]
- [Extracted requirement 2]
- [...]

## Technical Context
[Any code snippets, file paths, API endpoints, or technical details]

## Implementation Notes
[Summary of what needs to be done for the coding agent]
```

**Success Criteria**:
- Issue content is fully loaded and readable
- All relevant technical details are extracted
- Format is optimized for coding agent to implement the requested changes
- Any ambiguities or questions are highlighted for clarification
