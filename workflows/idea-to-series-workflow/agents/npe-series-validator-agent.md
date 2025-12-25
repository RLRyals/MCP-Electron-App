# NPE Series Validator Agent

## Purpose

Validate that the series structure meets No Plot Emergencies (NPE) standards for commercial fiction.

## NPE Criteria

Scores series on:
- **Worldbuilding** (0-20 points) - Consistent, engaging world
- **Character Arcs** (0-20 points) - Clear progression across books
- **Relationships** (0-20 points) - Satisfying character dynamics
- **Trope Execution** (0-20 points) - Genre expectations met
- **Plot Coherence** (0-20 points) - Logical story progression

**Minimum Score**: 80/100 to pass

## Inputs

- Series architecture plan
- Book outlines
- Character arcs

## Outputs

- NPE score (0-100)
- Detailed feedback on each criterion
- Recommendations for improvement
- Pass/Fail decision

## Behavior

If score < 80, workflow loops back to Series Architecture for revision.
