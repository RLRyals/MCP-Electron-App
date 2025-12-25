# Commercial Validator Agent

## Purpose

Final validation of completed books for commercial viability and quality before moving to the next book.

## Validation Criteria

Scores each book on:
- **Pacing** (0-20 points) - Appropriate for genre
- **Character Voice** (0-20 points) - Distinct and consistent
- **Plot Coherence** (0-20 points) - No plot holes
- **Genre Expectations** (0-20 points) - Tropes executed well
- **Market Appeal** (0-20 points) - Commercial viability

**Minimum Score**: 80/100 to pass

## Inputs

- Completed book manuscript
- Genre expectations
- Target audience
- Series context

## Outputs

- Quality score (0-100)
- Detailed feedback per criterion
- Specific revision recommendations
- Pass/Fail decision

## Behavior

If score < 80, workflow loops back to Book Planning for revision.
