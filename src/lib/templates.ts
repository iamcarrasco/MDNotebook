export interface NoteTemplate {
  name: string
  description: string
  content: string
  tags?: string[]
  category?: string
}

export const noteTemplates: NoteTemplate[] = [
  {
    name: 'Blank Note',
    description: 'Start from scratch',
    content: '',
    category: 'Quick',
  },
  {
    name: 'Meeting Notes',
    description: 'Structured meeting template',
    content: `# Meeting Notes

**Date**: ${new Date().toISOString().slice(0, 10)}
**Attendees**:

## Agenda

1.

## Discussion

-

## Action Items

- [ ]

## Next Steps

`,
    tags: ['meeting'],
    category: 'Quick',
  },
  {
    name: 'TODO List',
    description: 'Task tracking template',
    content: `# TODO List

## High Priority

- [ ]

## Medium Priority

- [ ]

## Low Priority

- [ ]

## Completed

- [x]

`,
    tags: ['todo'],
    category: 'Planning',
  },
  {
    name: 'Journal Entry',
    description: 'Daily reflection template',
    content: `# Journal - ${new Date().toISOString().slice(0, 10)}

## How am I feeling?



## What happened today?



## What am I grateful for?

1.
2.
3.

## What could I improve?



`,
    tags: ['journal'],
    category: 'Reflection',
  },
  {
    name: 'Project Plan',
    description: 'Project planning template',
    content: `# Project: [Name]

## Overview

Brief description of the project.

## Goals

-

## Timeline

| Phase | Start | End | Status |
|-------|-------|-----|--------|
| Planning | | | In Progress |
| Development | | | Not Started |
| Testing | | | Not Started |
| Launch | | | Not Started |

## Tasks

- [ ]

## Resources

-

## Notes

`,
    tags: ['project'],
    category: 'Planning',
  },
  {
    name: 'Daily Note',
    description: 'Daily journaling with tasks',
    content: `# Daily Note - ${new Date().toISOString().slice(0, 10)}

## Tasks

- [ ]

## Notes



## End of Day Review


`,
    tags: ['daily'],
    category: 'Quick',
  },
]
