# CONTINUE DEVELOPMENT: UNIVERSITY COMPETITION TABULATION SYSTEM

You are continuing development of an existing web-based competition tabulation system for:

**Our Lady of Fatima University**
**College of Computer Studies**

I ALREADY HAVE:

* A Supabase account
* A Supabase organization
* A Supabase project

DO NOT create a new Supabase organization or project.

Use the existing Supabase project as the backend for this application.

---

# 1. FIRST: INSPECT THE EXISTING PROJECT

Before changing anything:

1. Inspect the entire existing codebase.
2. Identify the framework, language, package manager, build system, routing, components, styling system, and existing Supabase integration.
3. Identify all existing pages and features.
4. Identify existing database-related code.
5. Identify existing authentication logic.
6. Identify existing mock/placeholder data.
7. Identify every font currently being used.
8. Identify whether there are existing migrations or SQL files.
9. Identify environment variables currently being used.
10. Do not unnecessarily rewrite working code.

Preserve the existing architecture unless there is a strong technical reason to change it.

---

# 2. USE MY EXISTING SUPABASE PROJECT

Connect the application to the existing Supabase project.

Do NOT create:

* another Supabase project
* another database
* another organization
* another authentication backend

Use environment variables for the Supabase connection.

Create/update:

`.env.local`

or the appropriate environment file for the existing framework.

Use:

* Supabase Project URL
* Supabase Anon/Publishable Key

NEVER put a Supabase Service Role Key in frontend code.

NEVER commit secrets into Git.

Create or update `.env.example` showing the required variable names without exposing actual credentials.

---

# 3. COMPLETE SUPABASE DATABASE

Make sure the existing Supabase project contains the complete database required for the system.

Implement the required tables and relationships for:

* Profiles
* Users/Roles
* Competitions
* Events
* Contestants
* Teams
* Team Members
* Judge/Event Assignments
* Criteria
* Judge Criteria if required by the current scoring architecture
* Score Sheets
* Scores
* Results
* Rankings
* Winners
* Tie Breakers
* Audit Logs

Use proper:

* Primary keys
* Foreign keys
* Unique constraints
* Check constraints
* Indexes
* Timestamps
* Relationships

Do not leave the database design as documentation only.

Create actual SQL migrations.

---

# 4. MIGRATION STRUCTURE

Create a proper migration directory:

`supabase/migrations/`

Every database change must be represented by a migration file.

Example:

`supabase/migrations/202609030001_initial_schema.sql`

Then additional migrations for later changes.

Do not tell the developer to manually recreate the database using screenshots or random SQL snippets.

The project should be reproducible.

A fresh developer should be able to clone the project, connect their Supabase project, and run the migrations.

---

# 5. FONT SYSTEM: REPLACE EVERY CURRENT FONT

IMPORTANT UI REQUIREMENT:

Replace the current fonts throughout the ENTIRE application.

Do not simply change the main heading font.

Search the entire project for:

* Google Fonts imports
* @font-face
* font-family
* Tailwind font configuration
* CSS variables containing fonts
* component-level font declarations
* inline styles
* third-party font imports

Remove the existing font choices and replace them consistently.

---

# 6. USE A LESS COMMON, HUMAN-SELECTED FONT PAIR

The current fonts look like common AI/vibe-coded website fonts.

Do NOT use the usual:

* Inter
* Poppins
* Roboto
* Open Sans
* Montserrat
* Lato
* Nunito
* DM Sans
* Manrope

Choose a more distinctive Google Fonts pairing that still looks professional for a university information system.

The typography should feel intentionally designed rather than generated from a typical SaaS template.

Use:

### Display / Headings

A distinctive but highly readable serif or humanist display font.

### Body / UI

A less-common neutral sans-serif with excellent readability.

The pair must work well together.

Do not use an overly decorative font.

Do not sacrifice readability just to be unique.

Use the selected pair consistently across:

* Login
* Registration
* Dashboard
* Tables
* Forms
* Buttons
* Navigation
* Modals
* Contestant pages
* Judge scoring
* Rankings
* Final Verdict
* Public results
* Empty states
* Error messages

Make sure there are no leftover old fonts anywhere in the project.

---

# 7. TYPOGRAPHY HIERARCHY

Do not use one font size everywhere.

Create a deliberate typography system.

Example hierarchy:

* University name
* College name
* Page title
* Section heading
* Card title
* Table heading
* Body text
* Form labels
* Helper text
* Error text
* Metadata
* Buttons

Use appropriate font weights.

Avoid excessive bold text.

Typography should provide hierarchy without relying on giant text.

---

# 8. UNIVERSITY BRANDING

At the top/header of the system display:

**Our Lady of Fatima University**

and:

**College of Computer Studies**

This should be visible in the primary application shell where appropriate.

Use the full university/college name instead of generic text such as:

"Competition Management"

as the primary identity.

---

# 9. JUDGE REGISTRATION

Ensure there is a working Judge Registration system using Supabase Auth.

Fields:

* Full Name
* Email Address
* Password
* Confirm Password
* Judge ID / Employee ID
* Contact Number

Implement strict validation.

Frontend validation AND database validation should be used where appropriate.

---

# 10. STRICT INPUT VALIDATION

Every input throughout the application must be validated.

Do not only validate the login form.

Validate:

* Registration
* Login
* Contestants
* Teams
* Competitions
* Events
* Criteria
* Percentages
* Scores
* Judge assignments
* Tie breakers
* Winner configuration
* Profile information

Reject:

* Empty values
* Whitespace-only values
* Invalid formats
* Invalid numbers
* Negative numbers where inappropriate
* Impossible percentages
* Duplicate records
* Invalid foreign keys
* Scores outside allowed ranges

Display useful validation messages.

Example:

BAD:

`Invalid input`

GOOD:

`Weight must be between 1 and 100.`

GOOD:

`The total criterion weight must equal exactly 100% before scoring can begin.`

---

# 11. CONTESTANT SYSTEM

Implement the complete contestant management system.

Admin can:

* Add contestants
* Edit contestants
* Remove contestants
* Search contestants
* Filter contestants
* Assign contestants to events
* Manage teams
* View contestant details

Contestant information:

* Contestant Number
* Full Name
* Student ID
* Course
* Year Level
* Section
* Contact Information
* Event
* Team if applicable
* Status

Do not use hardcoded contestant arrays.

All contestants must come from Supabase.

---

# 12. EVENTS

The system must support these initial events:

1. Quiz Bee
2. Programming Competition
3. Linux Competition
4. PC Assembly and Disassembly
5. Dance Competition
6. Pageant

Store events in Supabase.

Do not hardcode the events into frontend logic.

Admins should be able to create additional events later.

---

# 13. JUDGE ASSIGNMENTS

Admins can assign judges to events.

A judge must only see their assigned events.

Implement proper database relationships and RLS.

Prevent duplicate judge/event assignments.

---

# 14. JUDGE CRITERIA

Judges can configure criteria for their assigned events.

Each criterion contains:

* Name
* Description
* Percentage
* Maximum Score
* Display Order

Total percentage must equal:

**100%**

Do not allow scoring to start when the total is not exactly 100%.

Once scoring begins, criteria must become locked.

Only Admin can unlock them.

---

# 15. SCORING

Judges can score contestants using their configured criteria.

Validate every score.

Calculate:

`Weighted Score = Raw Score × (Percentage / 100)`

The system must calculate:

* Criterion weighted score
* Judge total
* Contestant final score
* Event ranking

Do not rely exclusively on frontend calculations.

Use PostgreSQL/database logic where appropriate for official calculations.

---

# 16. MULTIPLE JUDGES

When multiple judges score the same event:

Each judge submits an independent score sheet.

The system calculates each judge's final score.

Then calculate the official contestant result using the configured aggregation method.

Default:

**Average of submitted judge totals**

Example:

Judge 1 = 92.50
Judge 2 = 89.00
Judge 3 = 94.00

Official score:

`(92.50 + 89.00 + 94.00) / 3`

Display the final score using consistent decimal precision.

---

# 17. RANKING

Automatically generate rankings.

Sort contestants by:

**Final Score DESC**

Display:

| Rank | Contestant   | Final Score |
| ---- | ------------ | ----------: |
| 1    | Contestant A |       95.50 |
| 2    | Contestant B |       93.25 |
| 3    | Contestant C |       90.75 |

Ranking must come from actual Supabase data.

Do not use mock rankings.

---

# 18. TIE HANDLING

Detect ties automatically.

Do not randomly assign a winner.

Support configurable tie breakers.

For example:

1. Highest final score
2. Highest score in priority criterion
3. Next configured criterion
4. Manual Admin resolution if still tied

Any manual tie resolution must be recorded in the audit log.

---

# 19. FINAL VERDICT

Create a dedicated:

**FINAL VERDICT**

screen.

Show the official ranking and suggested winners.

Example:

### CHAMPION

Contestant Name
95.50

### 1ST RUNNER-UP

Contestant Name
94.25

### 2ND RUNNER-UP

Contestant Name
92.75

Allow placement labels to be configurable per event.

The system should automatically suggest placements based on ranking.

Admin must explicitly confirm the final verdict.

---

# 20. FINALIZATION

Workflow:

Judge scoring

↓

All judges submit

↓

System calculates official scores

↓

Ranking generated

↓

Tie detection

↓

Admin review

↓

Admin confirms final verdict

↓

Event finalized

↓

Results published

Once finalized:

* Scores become read-only
* Rankings become read-only
* Winners become read-only

Any reopening must be an explicit Admin action and must create an audit record.

---

# 21. PUBLIC RESULTS

Create a public results page.

Only published results should be visible.

Display:

* Our Lady of Fatima University
* College of Computer Studies
* Competition
* Event
* Rankings
* Winners
* Final Scores

Do not expose private judge information.

---

# 22. ROW LEVEL SECURITY

Implement and test Supabase RLS.

### Admin

Full authorized access.

### Judge

Can only access:

* Their profile
* Assigned events
* Assigned event contestants
* Their criteria
* Their scores
* Their score sheets

Cannot access or modify another judge's scores.

### Public

Can only access published result information.

Do not assume hiding UI elements is security.

Security must be enforced in PostgreSQL/RLS.

---

# 23. AUDIT LOGGING

Record:

* Contestant changes
* Event changes
* Judge assignments
* Criteria changes
* Criteria locking
* Score changes
* Score submissions
* Score sheet reopening
* Tie resolutions
* Winner confirmation
* Finalization
* Publication
* Administrative changes

Every important action should record:

**Who + What + When**

---

# 24. REMOVE MOCK DATA

Search the entire project for:

* mock contestants
* fake scores
* fake judges
* sample rankings
* hardcoded statistics
* placeholder competition data
* demo users
* static dashboard numbers

Remove these from production functionality.

If seed data is needed, only seed legitimate initial event definitions.

Do NOT seed fake contestants or fake scores.

---

# 25. LOADING / ERROR / EMPTY STATES

Every Supabase operation needs:

* Loading state
* Success state
* Error state
* Empty state

Do not leave screens blank while requests are loading.

Do not show raw PostgreSQL/Supabase errors to users.

Translate technical errors into understandable messages.

---

# 26. README.md

Create a comprehensive:

`README.md`

The README must explain exactly how another developer can run this project locally.

Include:

## Project Overview

Explain what the system does.

## Technology Stack

Document the actual technologies discovered in the project.

## Requirements

For example:

* Node.js version
* npm/pnpm/yarn
* Git
* Supabase CLI
* Any other required tools

Only document tools that the project actually requires.

## Installation

Explain:

1. Clone repository
2. Open project
3. Install dependencies
4. Configure environment variables
5. Connect to Supabase
6. Run migrations
7. Start development server

---

# 27. SUPABASE LOCAL DEVELOPMENT DOCUMENTATION

The README must explain the difference between:

### Option A — Using the existing hosted Supabase project

The local web application connects directly to the existing Supabase project through `.env.local`.

Explain how to configure it.

### Option B — Local Supabase development

If the project supports Supabase CLI/local development, document how to:

* Install Supabase CLI
* Initialize Supabase
* Start local Supabase
* Apply migrations
* Reset database
* Seed database if applicable
* Stop local Supabase

Make it clear which option is recommended for initial testing.

Do not claim commands work unless they match the actual project configuration.

---

# 28. MIGRATION INSTRUCTIONS

The README must clearly explain how to migrate the database.

For example, document the appropriate commands for the project's actual setup.

Explain:

* Where migration files are located
* How to apply migrations
* How to reset a local database
* How to create a new migration
* How to verify the migration
* How to safely update the hosted Supabase database

The migration workflow must be reproducible.

---

# 29. ENVIRONMENT VARIABLES

Create:

`.env.example`

Document required variables.

For example:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Use the correct variable names for the actual framework.

Do not put actual credentials into `.env.example`.

Add `.env.local` to `.gitignore` if appropriate.

---

# 30. LOCAL RUNNING INSTRUCTIONS

The README must tell me exactly how to run the website locally.

Example structure:

```text
1. Install dependencies
2. Configure .env.local
3. Apply Supabase migrations
4. Start development server
5. Open the local URL
```

Explain the actual command used by the project.

For example:

```bash
npm install
npm run dev
```

But use the project's actual package manager/scripts if different.

---

# 31. LOCAL TESTING CHECKLIST

Add a complete testing checklist to README.

### Authentication

* [ ] Judge registration
* [ ] Invalid email
* [ ] Weak password
* [ ] Password mismatch
* [ ] Duplicate Judge ID
* [ ] Duplicate email
* [ ] Judge login
* [ ] Logout

### Contestants

* [ ] Add contestant
* [ ] Edit contestant
* [ ] Invalid student ID
* [ ] Duplicate contestant
* [ ] Event assignment

### Criteria

* [ ] Add criterion
* [ ] Edit criterion
* [ ] Percentage validation
* [ ] Total must equal 100%
* [ ] Criteria lock

### Scoring

* [ ] Score validation
* [ ] Weighted score calculation
* [ ] Missing score detection
* [ ] Score submission
* [ ] Score locking

### Tabulation

* [ ] Multiple judges
* [ ] Final score calculation
* [ ] Ranking
* [ ] Tie detection
* [ ] Tie breaker

### Final Verdict

* [ ] Winner suggestion
* [ ] Admin confirmation
* [ ] Finalization
* [ ] Result locking

### Public Results

* [ ] Publish
* [ ] Public ranking
* [ ] Public winners
* [ ] Private information remains hidden

### Security

* [ ] Judge cannot access another judge's scores
* [ ] Judge cannot access Admin functionality
* [ ] Public cannot access private data
* [ ] RLS policies verified

---

# 32. DATABASE TESTING

Include SQL or documented test procedures for verifying:

* Tables exist
* Foreign keys work
* Constraints work
* RLS works
* Judge isolation works
* Scores are protected
* Public results only expose published records

Do not consider the database complete until these have been tested.

---

# 33. CODE QUALITY

Keep the implementation clean.

Avoid:

* duplicated logic
* giant components
* hardcoded database values
* hardcoded rankings
* hardcoded users
* unnecessary dependencies
* unused imports
* console errors
* placeholder functionality

Create reusable components and services where appropriate.

Keep Supabase queries organized.

Keep validation logic reusable.

---

# 34. FINAL VERIFICATION

Before considering the task complete:

Run the project locally.

Verify:

1. Application starts successfully.
2. Supabase connection works.
3. Authentication works.
4. Registration works.
5. Database migrations work.
6. Contestant management works.
7. Judge assignment works.
8. Criteria management works.
9. Scoring works.
10. Weighted calculations are correct.
11. Multiple judge calculations work.
12. Ranking works.
13. Tie detection works.
14. Final verdict works.
15. Publishing works.
16. RLS works.
17. No mock data remains.
18. No old fonts remain.
19. No console errors remain.
20. README instructions accurately match the actual project.

If you discover an existing implementation that conflicts with these requirements, adapt it rather than creating duplicate systems.

---

# 35. IMPORTANT FINAL RULE

Do not merely tell me what code I should write.

Actually implement the changes in the existing project.

Create/update the required:

* application code
* components
* pages
* styles
* fonts
* Supabase migrations
* database functions
* RLS policies
* validation
* README
* `.env.example`

Use the existing Supabase project.

Do not expose credentials.

Do not create a fake backend.

Do not leave TODOs for core functionality.

The final result should be a functional local development version of the **Our Lady of Fatima University – College of Computer Studies Competition Tabulation System**, ready for database migration, local testing, and eventually deployment.
