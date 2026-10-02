# UNIVERSITY COMPETITION TABULATION SYSTEM

## Supabase-Based Web Application

Build a complete web-based **Competition Tabulation System** for a university department.

The system will manage university competitions, events, judges, contestants, customizable judging criteria, percentage weights, scoring, rankings, ties, result finalization, and public results.

The most important requirement is that **judges assigned to an event can configure their own judging criteria and percentage weights for that event**.

The system must be reliable enough to be used during an actual university competition.

---

# 1. COMPETITIONS

The system should support these competition events:

1. Quiz Bee
2. Programming Competition
3. Linux Competition
4. PC Assembly and Disassembly
5. Dance Competition
6. Pageant

These should be stored as database records rather than hard-coded throughout the application.

Administrators should be able to add additional events later.

---

# 2. USER ROLES

Implement three primary roles:

## ADMIN

The administrator can:

* Create competitions
* Create events
* Assign judges to events
* Manage contestants/participants
* Manage users
* Monitor scoring progress
* View submitted scores
* Review rankings
* Finalize results
* Publish results
* View audit logs

The admin should NOT be responsible for defining the actual judging criteria unless necessary.

---

## JUDGE

Judges are assigned to one or more events.

A judge can:

* View assigned events
* Configure judging criteria for their assigned event
* Set percentage weights
* Set maximum scores
* Reorder criteria
* Edit criteria before scoring starts
* Score contestants
* Submit score sheets
* View their own submitted scores
* See scoring progress

A judge cannot:

* Configure criteria for an event they are not assigned to
* Modify another judge's scores
* Modify another judge's criteria
* See another judge's unpublished individual scores
* Change finalized results
* Access administrative functions

---

## VIEWER / PUBLIC USER

Can only:

* View published competitions
* View published events
* View published rankings
* View public contestant/team information

No editing permissions.

---

# 3. JUDGE-CREATED CRITERIA

This is a core feature.

When a judge opens an assigned event, they should see:

## SCORING CRITERIA

"Configure how this event will be judged."

The judge can click:

**+ Add Criterion**

Each criterion contains:

* Criterion name
* Description
* Percentage weight
* Maximum score
* Display order

Example for Pageant:

| Criterion            | Percentage |
| -------------------- | ---------: |
| Beauty and Poise     |        25% |
| Intelligence         |        25% |
| Communication Skills |        20% |
| Talent               |        15% |
| Stage Presence       |        15% |
| **TOTAL**            |   **100%** |

The judge can create completely different criteria for another event.

---

# 4. DIFFERENT EVENTS HAVE DIFFERENT CRITERIA

Do NOT create one universal criteria list.

Each event should have its own scoring configuration.

For example:

## QUIZ BEE

Possible criteria:

* Accuracy
* Speed
* Final Round Performance

## PROGRAMMING

Possible criteria:

* Correctness
* Code Quality
* Efficiency
* Problem Solving
* Completion Time

## LINUX

Possible criteria:

* Command Accuracy
* System Administration
* Troubleshooting
* Completion Time

## PC ASSEMBLY AND DISASSEMBLY

Possible criteria:

* Assembly Accuracy
* Disassembly Procedure
* Safety
* Component Identification
* Completion Time

## DANCE COMPETITION

Possible criteria:

* Choreography
* Synchronization
* Creativity
* Stage Presence
* Costume
* Musicality

## PAGEANT

Possible criteria:

* Beauty and Poise
* Intelligence
* Communication
* Talent
* Stage Presence
* Overall Performance

These are only examples.

The judge must be able to create, rename, remove, reorder, and assign percentages to the criteria instead of the application forcing these predefined criteria.

---

# 5. PERCENTAGE VALIDATION

The total percentage must always equal exactly:

**100%**

For example:

Criterion A = 30%

Criterion B = 30%

Criterion C = 40%

TOTAL = 100%

Valid.

But:

Criterion A = 40%

Criterion B = 40%

Criterion C = 30%

TOTAL = 110%

Invalid.

Display a warning:

> Criteria percentages must total exactly 100%.

Do not allow the judge to activate scoring until the total equals 100%.

Also prevent:

* Negative percentages
* 0% criteria
* Percentages greater than 100%
* Duplicate criteria names within the same event/judge configuration

---

# 6. CRITERIA LOCKING

Judges can freely modify their criteria while the event is still in configuration mode.

Event workflow:

CONFIGURATION

↓

CRITERIA READY

↓

SCORING OPEN

↓

SCORING IN PROGRESS

↓

SCORING LOCKED

↓

RESULTS REVIEW

↓

FINALIZED

Once scoring begins:

**Criteria cannot normally be changed.**

If an administrator needs to unlock the criteria:

* Require explicit confirmation
* Record the action
* Record who unlocked it
* Record when it happened
* Record the previous configuration

Do not silently change criteria after scores have already been entered.

---

# 7. IMPORTANT: JUDGE-SPECIFIC CRITERIA

If multiple judges are assigned to the same event, determine how their criteria should work.

The system should support:

### Shared Event Criteria

The first judge/admin creates the criteria, and the criteria become the official criteria for that event.

Other judges use the same criteria.

This should be the default recommended behavior because it keeps judging consistent.

However, the database architecture should support judge-specific configurations if the university later decides that each judge can independently configure criteria.

Do NOT allow conflicting criteria configurations to accidentally produce invalid final rankings.

The event should have an official scoring configuration.

---

# 8. SCORING CONFIGURATION DATABASE

Use a structure similar to:

### events

* id
* competition_id
* name
* description
* event_date
* venue
* status
* scoring_status
* created_at
* updated_at

### event_criteria

* id
* event_id
* name
* description
* percentage
* max_score
* display_order
* created_by
* locked
* created_at
* updated_at

This table represents the official criteria for an event.

If judge-specific configurations are implemented, create:

### judge_event_criteria

* id
* judge_id
* event_id
* criterion_id
* percentage
* created_at
* updated_at

Only implement this additional table if it is actually needed.

Avoid unnecessary duplication.

---

# 9. SCORE DATABASE

Create:

### scores

* id
* event_id
* contestant_id
* judge_id
* criterion_id
* score
* submitted
* submitted_at
* created_at
* updated_at

Add a unique constraint so a judge cannot accidentally create duplicate scores for:

judge + event + contestant + criterion

---

# 10. SCORE CALCULATION

The percentage configured by the judge determines the weight of each criterion.

Example:

Criterion:

Programming Correctness

Weight:

40%

Judge score:

90/100

Weighted score:

90 × 0.40 = 36

Second criterion:

Code Quality

Weight:

30%

Score:

80/100

Weighted score:

80 × 0.30 = 24

Third criterion:

Efficiency

Weight:

30%

Score:

95/100

Weighted score:

95 × 0.30 = 28.5

Final score:

88.5

Display the calculation clearly.

---

# 11. SCORING ENGINE

Create reusable functions:

calculateWeightedScore()

calculateJudgeTotal()

calculateEventFinalScore()

calculateRankings()

detectTies()

applyTieBreaker()

Do not place calculation logic directly inside React components.

Keep scoring logic centralized and testable.

---

# 12. EVENT-SPECIFIC SCORING

The system must NOT assume that every event is scored identically.

For example:

### Programming

A judge might configure:

Correctness 50%

Efficiency 20%

Code Quality 20%

Problem Solving 10%

Total = 100%

### Dance

Another event might use:

Choreography 30%

Synchronization 25%

Creativity 20%

Stage Presence 15%

Musicality 10%

Total = 100%

### Pageant

Another event might use:

Beauty and Poise 20%

Communication 30%

Talent 20%

Stage Presence 15%

Overall Impact 15%

Total = 100%

The scoring engine must dynamically read the criteria and percentage values from Supabase.

Never hard-code these formulas.

---

# 13. JUDGE DASHBOARD

After logging in, judges should see:

## MY EVENTS

Quiz Bee
Status: Configuration Complete

Programming Competition
Status: Scoring Open

Linux Competition
Status: Not Started

PC Assembly and Disassembly
Status: Scoring Complete

Show:

* Event name
* Date
* Number of contestants
* Criteria status
* Scoring progress
* Submission status

---

# 14. JUDGE EVENT PAGE

When opening an event:

### EVENT INFORMATION

Programming Competition

Contestants: 12

Judges: 3

Status: Scoring Open

Then show:

### JUDGING CRITERIA

| Criterion       |   Weight | Max Score |
| --------------- | -------: | --------: |
| Correctness     |      40% |       100 |
| Efficiency      |      25% |       100 |
| Code Quality    |      20% |       100 |
| Problem Solving |      15% |       100 |
| **TOTAL**       | **100%** |           |

Provide:

**Edit Criteria**

only while configuration is unlocked.

---

# 15. SCORE ENTRY

For each contestant:

CONTESTANT #01

Team Alpha

| Criterion       | Weight |  Score |
| --------------- | -----: | -----: |
| Correctness     |    40% | [ 90 ] |
| Efficiency      |    25% | [ 85 ] |
| Code Quality    |    20% | [ 92 ] |
| Problem Solving |    15% | [ 88 ] |

Show:

**Weighted Total: 88.65**

Allow the judge to:

* Save
* Move to next contestant
* Review previous contestant
* See completion status

---

# 16. SCORE VALIDATION

If maximum score is 100:

Accept:

0–100

Reject:

* Negative values
* Values above 100
* Invalid characters
* Empty required fields

Display useful validation messages.

---

# 17. JUDGE SUBMISSION

Display:

SCORING PROGRESS

10 / 12 CONTESTANTS

When all required scores are complete:

**SUBMIT SCORE SHEET**

Before submission:

> You are about to submit your scores. After submission, your score sheet will be locked and cannot normally be edited.

After submission:

* Lock the judge's scores
* Record timestamp
* Notify the tabulator/admin
* Add audit log entry

---

# 18. ADMIN TABULATION DASHBOARD

Admin should see every event's progress.

Example:

| Event       | Contestants | Judges | Status  |
| ----------- | ----------: | -----: | ------- |
| Quiz Bee    |          20 |    3/3 | Ready   |
| Programming |          12 |    2/3 | Waiting |
| Linux       |          15 |    3/3 | Ready   |
| PC Assembly |          10 |    3/3 | Ready   |
| Dance       |           8 |    5/5 | Ready   |
| Pageant     |          12 |    5/5 | Ready   |

Clicking an event opens its tabulation page.

---

# 19. TABULATION PAGE

Show:

### EVENT

Programming Competition

### OFFICIAL CRITERIA

Correctness — 40%

Efficiency — 25%

Code Quality — 20%

Problem Solving — 15%

### JUDGE SUBMISSION STATUS

Judge 1 — Submitted

Judge 2 — Submitted

Judge 3 — Submitted

Then:

### CALCULATED RESULTS

| Rank | Contestant   | Judge 1 | Judge 2 | Judge 3 | Final |
| ---: | ------------ | ------: | ------: | ------: | ----: |
|    1 | Team Alpha   |    92.5 |    94.0 |    91.5 | 92.67 |
|    2 | Team Bravo   |    90.0 |    91.5 |    90.5 | 90.67 |
|    3 | Team Charlie |    88.0 |    89.5 |    90.0 | 89.17 |

Individual judge scores should only be visible to authorized administrators.

---

# 20. RANKING

Automatically rank contestants from highest final score to lowest.

Example:

1st — 94.25

2nd — 92.80

3rd — 90.40

Use consistent rounding rules.

Do not round intermediate calculations unless explicitly required.

---

# 21. TIE HANDLING

Detect identical final scores.

Example:

1st — Team Alpha — 94.25

1st — Team Bravo — 94.25

3rd — Team Charlie — 91.00

Mark tied contestants clearly.

Support configurable tie-breakers.

Possible tie-breakers:

* Highest score in a designated criterion
* Highest average in a designated criterion
* Additional judging round

Never arbitrarily break a tie.

---

# 22. RESULTS FINALIZATION

Admin workflow:

ALL JUDGES SUBMITTED

↓

SYSTEM CALCULATES RESULTS

↓

ADMIN REVIEWS

↓

ADMIN FINALIZES RESULTS

↓

RESULTS LOCKED

↓

ADMIN PUBLISHES RESULTS

Once finalized:

* Rankings become immutable
* Scores cannot be silently changed
* Criteria cannot be changed
* Changes require controlled administrative action
* All changes are recorded in the audit log

---

# 23. PUBLIC RESULTS

Published competitions should have a public results page.

Example:

## UNIVERSITY COMPETITION 2026

### PROGRAMMING COMPETITION

1. Team Alpha
2. Team Bravo
3. Team Charlie

### LINUX COMPETITION

1. Team Delta
2. Team Echo
3. Team Foxtrot

### DANCE COMPETITION

1. Team Alpha
2. Team Bravo
3. Team Charlie

### PAGEANT

1. Candidate A
2. Candidate B
3. Candidate C

Only published results should appear.

---

# 24. SUPABASE AUTHENTICATION

Use Supabase Auth.

Implement:

* Login
* Logout
* Password reset
* Session persistence
* Protected routes

Do NOT create fake authentication with localStorage.

---

# 25. SUPABASE ROW LEVEL SECURITY

RLS is mandatory.

Judge:

Can only access:

* Their own profile
* Assigned events
* Contestants in assigned events
* Official criteria for assigned events
* Their own scores
* Their own submissions

Judge cannot:

* Modify another judge's scores
* Access unrelated events
* Access unpublished results belonging to unrelated competitions
* Modify finalized results

Admin:

Can access authorized administrative data.

Public:

Can only read published competition/event/result data.

Never rely only on frontend role checks.

---

# 26. AUDIT LOG

Record important actions:

* Judge created criteria
* Judge edited criteria
* Criteria locked
* Score entered
* Score modified
* Score sheet submitted
* Admin unlocked score sheet
* Admin unlocked criteria
* Results calculated
* Results finalized
* Results published

Example:

September 3, 2026 — 6:42 PM

Judge Santos

Updated "Programming Correctness"

Weight changed:

35% → 40%

This provides accountability during actual competitions.

---

# 27. UI DESIGN

Make the application look like a professional university system.

Avoid generic AI dashboard design.

Avoid:

* Excessive gradients
* Excessive rounded cards
* Glassmorphism everywhere
* Giant statistics
* Excessive animations
* Unnecessary illustrations

Prioritize:

* Tables
* Forms
* Clear hierarchy
* Strong typography
* Good spacing
* Subtle borders
* Clear status indicators
* Fast interactions

Use a distinctive Google Fonts pairing rather than defaulting to Inter, Roboto, or Poppins.

The UI should feel custom-built for a university competition.

---

# 28. RESPONSIVE DESIGN

Support:

* Desktop
* Laptop
* Tablet
* Mobile

Judges may use phones or tablets while scoring, so the score-entry interface must work especially well on mobile.

---

# 29. DATABASE INTEGRITY

Use:

* Foreign keys
* Unique constraints
* CHECK constraints
* NOT NULL constraints
* Proper indexes
* Transactions for multi-step operations

Prevent:

* Duplicate scores
* Invalid percentages
* Orphaned records
* Scores for unassigned judges
* Scores for nonexistent contestants
* Editing locked scores

---

# 30. DEVELOPMENT APPROACH

Before coding:

1. Inspect the current project.
2. Identify the existing framework.
3. Do not destroy existing functionality unnecessarily.
4. Design the Supabase database schema.
5. Create SQL migrations.
6. Configure authentication.
7. Configure RLS.
8. Implement event management.
9. Implement judge assignments.
10. Implement judge-created criteria.
11. Implement percentage validation.
12. Implement scoring engine.
13. Implement rankings.
14. Implement result finalization.
15. Implement public results.
16. Implement audit logs.
17. Build/refine the UI.

Do not build fake frontend-only functionality.

All important data must persist in Supabase.

---

# 31. IMPORTANT BUSINESS RULE

The system must always preserve the relationship:

EVENT → OFFICIAL CRITERIA → SCORES → FINAL RESULTS

A final result must be traceable back to:

* Competition
* Event
* Contestant
* Judge
* Criterion
* Percentage
* Raw score
* Weighted score
* Final score
* Rank

This allows the tabulator to verify how a final ranking was produced.

---

# 32. FINAL REQUIREMENT

Build this as a real competition tabulation platform rather than a generic CRUD application.

The most important features are:

1. Judge accounts
2. Event assignment
3. Judge-configured judging criteria
4. Percentage weights totaling exactly 100%
5. Dynamic scoring based on those percentages
6. Secure judge-specific permissions
7. Automatic tabulation
8. Ranking
9. Tie detection
10. Score locking
11. Result finalization
12. Audit trail
13. Public results

The initial competition events are:

* Quiz Bee
* Programming
* Linux
* PC Assembly and Disassembly
* Dance Competition
* Pageant

Design the database so additional competition types can be added later without changing the application's core architecture.
