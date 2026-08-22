**PRODUCT REQUIREMENTS DOCUMENT**

**Handwritten Notes to Digital Book**

Version 2.0 \| Post-review, build-ready \| Dev and Design HQ

**Revision note**

This is version 2.0. It applies every correction from the live PRD
review. Version 1 is superseded. The largest changes: the data model now
stores span-level flags and subscription state, pricing sits above a
computed cost floor with no unlimited tier, the roadmap adds a v0
validation slice before full build, v1 is restricted to users 15 and
over, and the metrics gain a North Star with target ranges.

Flagged decisions added during authoring carry the tag \[ASSUMPTION\].
Money is stored in minor units, kobo, everywhere.

**Contents**

**1. Product Summary**

A web application that turns photos of handwritten student notes into a
clean, structured digital book. A student uploads images one at a time
or in bulk. A vision-capable AI model reads the handwriting, transcribes
what it can, flags what it cannot, groups related notes into proposed
chapters, and assembles a draft book the student edits before export.

The product targets university students and self-learners, starting in
Nigeria and the broader African market. v1 is solo use, English only,
restricted to users 15 and over, with an in-app reader and PDF export.

**2. Problem Statement**

Students take large volumes of handwritten notes during classes. These
notes are messy, scattered across pages and notebooks, and hard to
revise from. Pages get lost. Handwriting degrades over time. There is no
fast way to turn a stack of photos into organized study material.

No mainstream tool we found combines bulk handwritten capture, topic
grouping, and an editable book export. Generic OCR apps transcribe
single pages but do not structure content into a coherent book. Note
apps assume typed input. Scanner apps produce flat PDFs of images, not
searchable, editable, organized text.

The student needs one place to dump photos of notes and get back a
structured, editable, exportable book grouped by topic.

Core demand hypothesis to validate before heavy build: students will do
the upload and editing work to get a structured book, rather than settle
for raw photos. The v0 validation slice in the roadmap exists to test
this.

**3. Goals and Non-Goals**

**Goals**

-   Let a student upload single or bulk note images and get a structured
    digital book.

-   Transcribe handwriting at or above a target accuracy on a fixed
    internal test set, and flag low-confidence spans for review.

-   Group notes into proposed chapters that the student can re-group and
    reorder.

-   Let the student edit the AI output before export.

-   Export the finished book to PDF.

-   Keep original images safe and owned by the student.

-   Ship a v0 validation slice, then a working v1 with a freemium model.

**Non-Goals**

-   No real-time collaboration or sharing in v1.

-   No redrawing or beautifying of diagrams in v1. The app preserves
    them as images.

-   No multilingual transcription in v1. English only.

-   No users under 15 in v1. The senior secondary persona moves to v2
    behind a parental-consent flow. \[ASSUMPTION\]

-   No mobile native app in v1. The product is a responsive web app.
    \[ASSUMPTION\]

-   No automatic quiz or flashcard generation in v1. \[ASSUMPTION\]

-   No EPUB export in v1.

**4. User Personas**

**Persona 1: The university student (v1 primary)**

Age 15 to 24. Takes notes by hand across four to eight courses. Has a
phone with a decent camera. Studies in bursts before tests. Wants notes
organized by course and topic, fast, without retyping. Price sensitive.
Pays in Naira.

**Persona 2: The self-learner (v1 secondary)**

Age 20 to 35. Takes notes from books, courses, and tutorials. Not
enrolled in a school. Wants to consolidate scattered notes into one
reference manual. Willing to pay if the output is clean. \[ASSUMPTION\]

**Persona 3: The senior secondary student (v2, deferred)**

Age 12 to 15. Heavy handwritten note load across many subjects. Often
shares a device or uses a parent's phone. A minor, so onboarding
requires age verification, parental consent, and a payer-owner split
where a parent can pay for a student account. This persona is out of
scope for v1 and enters in v2 behind a consent flow. \[ASSUMPTION\]

**5. Functional Requirements**

Each requirement is testable. The system must satisfy each one. A page
equals one source image, so every requirement uses the word image.

**Upload**

**R1.** The system accepts image uploads in JPEG, PNG, and HEIC.

**R2.** The system accepts a single image or a batch in one action.

**R3.** The system enforces the student\'s plan image caps first. It
applies a technical per-batch ceiling of 50 images as an upper bound,
never as a user allowance. *\[ASSUMPTION\]*

**R4.** The system runs a basic quality check on each image and scores
it for readability.

**R5.** The system flags any image that fails the quality check and
prompts the student to re-upload that image.

**R6.** The system shows upload progress per image and an overall batch
status.

**R7.** The system stores every original image in cloud object storage
and links it to the student\'s account and book.

**Transcription**

**R8.** The system sends each accepted image to the AI transcription
stage as its own per-image job.

**R9.** The system transcribes handwriting to text.

**R10.** The system stores low-confidence spans as structured records
with a start offset, an end offset, and a type, so the editor can
highlight them and the student can act on them.

**R11.** The system never inserts text it cannot read from the image. It
stores unreadable spans as GAP flags.

**R12.** The system detects diagrams and drawings, preserves them as
embedded images, generates a caption for each, and records where each
sits in the reading flow.

**R13.** The system represents math and equations as plain text
approximations in v1 and flags them as low-confidence. *\[ASSUMPTION\]*

**Structuring**

**R14.** The system groups transcribed content by topic and proposes a
chapter structure.

**R15.** The system infers image sequence from upload order and content
cues, then lets the student reorder images and chapters.
*\[ASSUMPTION\]*

**R16.** The system lets the student merge, split, rename, and reorder
chapters.

**R17.** The system lets the student move a transcribed section from one
chapter to another.

**Editing**

**R18.** The system gives the student a rich text editor for every
transcribed section, with low-confidence and gap spans visibly
highlighted.

**R19.** The system lets the student edit, delete, and accept the
low-confidence and gap spans stored under R10 and R11, and marks each
resolved.

**R20.** The system shows the original image next to the transcribed
text for any section, so the student can compare.

**R21.** The system saves edits automatically and keeps the original
transcription recoverable. *\[ASSUMPTION\]*

**Export**

**R22.** The system exports the finished book to PDF.

**R23.** The PDF preserves chapter order, headings, body text, and
embedded diagram images with captions in their recorded positions.

**R24.** The system lets the student read the finished book in an in-app
reader before export.

**R25.** The system applies a visible watermark to exports for free-plan
users, and no watermark for users with an active PRO subscription.

**Accounts**

**R26.** The system requires a registered account to create or store a
book, and verifies the user is 15 or over at sign-up. *\[ASSUMPTION\]*

**R27.** The system supports email and password sign-up plus at least
one social login. *\[ASSUMPTION\]*

**R28.** The system lets a student delete a book, which deletes its
transcriptions, flags, diagrams, and original images.

**R29.** The system lets a student delete their account and all
associated data.

**Billing**

**R30.** The system applies a free tier with usage limits, with limit
values held in application config.

**R31.** The system enforces plan limits at upload time and blocks
uploads that exceed the student\'s allowance, with a clear message.

**R32.** The system supports paid upgrades and credit purchases through
a payment provider that handles Naira by card, bank transfer, and USSD.
*\[ASSUMPTION\]*

**R33.** The system records every charge, credit purchase, credit spend,
and plan change against the student\'s account.

**R34.** The system gates the no-watermark benefit on an active
subscription period, read from the Subscription record.

**6. AI Processing Pipeline**

The pipeline runs on a dedicated long-running worker, not inside a
Next.js request handler. The student sees live status. Each stage names
its input and output. Every stage maps to one of three tracked job types
so failures are recorded. Stages 1 to 4 run inside the per-image
TRANSCRIBE job. Stage 5 runs inside the per-book STRUCTURE job. Stage 7
runs inside the per-book EXPORT job. Stage 6 assembly runs at the end of
STRUCTURE.

**Stage 1: Image intake and quality check (job: TRANSCRIBE, per image)**

-   Input: raw uploaded image file.

-   Work: validate format, check resolution, blur, and contrast, score
    readability.

-   Output: an accepted image record with a quality score, or a
    re-upload flag.

**Stage 2: OCR and transcription (job: TRANSCRIBE, per image)**

-   Input: accepted image.

-   Work: send the image to the vision-capable AI model. Transcribe
    handwriting to text. Return per-span confidence.

-   Output: a transcribed section with text and per-span confidence
    values.

**Stage 3: Low-confidence flagging (job: TRANSCRIBE, per image)**

-   Input: transcribed section with per-span confidence values.

-   Work: write a TranscriptionFlag for each span below threshold, and a
    GAP flag for each unreadable span, each with start and end offsets.

-   Output: a flagged section ready for student review.

**Stage 4: Diagram detection and captioning (job: TRANSCRIBE, per
image)**

-   Input: accepted image and its transcription.

-   Work: detect non-text regions that are diagrams or drawings. Crop
    and store them as images. Generate a caption for each. Record the
    section and order for in-flow placement.

-   Output: diagram image records with captions and positions, linked to
    their section.

**Stage 5: Topic grouping and chapter proposal (job: STRUCTURE, per
book)**

-   Input: all transcribed sections for the book.

-   Work: cluster sections by topic and propose an ordered chapter
    structure. This stage must handle books larger than one model
    context window. It uses per-section embeddings to cluster, then a
    bounded grouping pass over cluster summaries, never a single call
    over the whole book. \[ASSUMPTION\]

-   Output: a proposed chapter map linking sections to chapters in
    order.

**Stage 6: Assembly (job: STRUCTURE, per book)**

-   Input: chapters, sections, diagrams, captions, positions.

-   Work: assemble the book in reading order. Place diagrams at their
    recorded positions. Apply headings and structure.

-   Output: a draft book the student can read and edit.

**Stage 7: Export (job: EXPORT, per book)**

-   Input: the final edited book.

-   Work: render chapters, text, and diagrams to PDF, with a watermark
    for free-plan users.

-   Output: a downloadable PDF file.

**Cost ceiling**

The pipeline respects a per-book AI cost ceiling. When a book approaches
the ceiling, the system pauses processing and asks the student to spend
credits or upgrade before continuing, rather than silently overspending.
The ceiling value lives in application config and is set above the
largest allowed book at the measured cost per image. \[ASSUMPTION\]

**7. Technical Requirements**

The core stack is locked. Do not change it.

-   Framework: Next.js.

-   Language: TypeScript.

-   ORM: Prisma.

-   Database: PostgreSQL.

**Worker and async processing**

A dedicated long-running worker process runs the pipeline. It sits
outside the Next.js request path and does not depend on serverless
function time limits. The queue lives outside the request path too.
Next.js enqueues jobs and reads status. The worker executes them.

-   Default: a Node worker using a Redis-backed queue such as BullMQ,
    deployed as a long-lived container. Alternative: a managed queue
    such as AWS SQS with a container worker. \[ASSUMPTION\]

-   Each job writes status to PostgreSQL so the front end can poll or
    subscribe for live updates.

-   Jobs retry with backoff. A failed image does not fail the batch.
    TRANSCRIBE jobs run and fail per image. STRUCTURE and EXPORT run per
    book. A batch with some failed images reaches a PARTIAL outcome and
    continues.

**Storage**

-   Store original images and exported PDFs in cloud object storage.
    Store only references and metadata in PostgreSQL, not the binary
    files.

-   Default: Cloudflare R2, chosen for low egress cost. Alternative: AWS
    S3. \[ASSUMPTION\]

**AI integration boundary**

-   Wrap the AI model behind a single internal service interface. The
    interface takes an image and returns transcription, per-span
    confidence, and diagram regions.

-   Keep the app provider-agnostic behind that interface, but lock a
    default model tier for v1 so cost and pricing can be computed.
    Default: a frontier vision-capable LLM accessed by API.
    \[ASSUMPTION\]

-   Assumed blended cost across all AI calls per image: about 20 Naira.
    This is an estimate to confirm in the v0 slice, and it drives the
    price floor in Section 8. \[ASSUMPTION\]

**Auth**

-   Default: Auth.js, formerly NextAuth, with email and Google login.
    Alternative: Clerk. Protect every book, image, flag, and job behind
    the owning student\'s identity. \[ASSUMPTION\]

**Payments**

-   Flutterwave, which supports card, bank transfer, and USSD in
    Naira, and covers the non-card paths that matter in this market.
    \[ASSUMPTION\]

**Error handling**

-   A failed image is isolated and reported per image. The batch
    continues.

-   A failed AI call retries with backoff, then surfaces a clear error
    to the student.

-   The system logs every job failure with enough context to debug.

**8. Business Model**

Freemium. A free tier drives trial. A PRO subscription serves heavy
users. A credit pack serves people who do not want a subscription.
Prices are in Naira, paid by card, bank transfer, or USSD.

**Pricing principle**

-   Price per image must exceed the measured cost per image, with
    margin. No price sits below the cost floor.

-   The subscription carries a bounded monthly image allowance. There is
    no unlimited tier. Monthly allowance times cost per image must stay
    below the subscription price, with margin.

-   All numbers below are provisional and gated on the cost per image
    measured in the v0 slice. \[ASSUMPTION\]

**Provisional tiers**

  --------------------------------------------------------------------------
  **Tier**    **Price (NGN)** **Allowance**       **Per-book   **Export**
                                                  cap**        
  ----------- --------------- ------------------- ------------ -------------
  Free        0               30 images per       20 images    Watermarked
                              month, 3 books                   

  PRO         5,000 per month 150 images per      300 images   No watermark
                              month                            

  Credit pack 3,000 one time  100 images of       Applies      Follows plan
                              processing          within caps  
  --------------------------------------------------------------------------

Worked check at the assumed cost of 20 Naira per image. Free monthly
ceiling costs at most 600 Naira in AI and carries a watermark, which is
acceptable as a trial cost. PRO includes 150 images, so about 3,000
Naira of AI against a 5,000 Naira price, leaving margin before other
costs. The credit pack sells 100 images for 3,000 Naira, about 30 Naira
per image, above the 20 Naira floor. Extra images beyond a PRO allowance
draw from purchased credits. \[ASSUMPTION\]

Credits are a balance, not a plan. A PRO subscriber can also hold and
spend credits. Final prices are confirmed only after the v0 slice
returns a real cost per image.

**9. Risks**

Listed worst first.

**Core accuracy may be too low.**

Handwriting transcription may be too inaccurate on real student notes to
deliver value. If word error rate is high, flagging paints whole pages
yellow and students quit. Mitigation: validate against the labeled test
set early, set a minimum accuracy bar before public launch, and be
willing to narrow the accepted input types if accuracy fails.

**Inverted unit economics.**

If price per image sits below cost per image, volume loses money, and
any unbounded allowance compounds it. Mitigation: a price floor above
measured cost, a bounded monthly allowance, no unlimited tier, plus cost
monitoring. Monitoring alone is not a fix.

**Minors and underage payment.**

Onboarding users under 15 pulls in consent, age verification, and a
payer-owner split, and risks the local data rules. Mitigation: restrict
v1 to users 15 and over. Defer the senior secondary persona to v2 behind
a consent flow and a payer-owner data model.

**Diagram-heavy notes transcribe poorly.**

Mitigation: preserve diagrams as images with captions and positions, do
not force them into text.

**Math-heavy notes lose fidelity.**

Mitigation: flag math as low-confidence plain text in v1, plan LaTeX for
v2.

**Privacy concern.**

Students upload personal academic content. Mitigation: clear ownership,
no training on user notes, full delete of images, flags, and text.

**Slow connectivity in the target market.**

Large uploads may fail. Mitigation: per-image upload, resumable batches,
clear retry. \[ASSUMPTION\]

**AI cost spikes at scale.**

Mitigation: per-plan caps, the per-book cost ceiling, and the bounded
allowance from Section 8.

**10. Prisma Data Model**

This schema fixes every data lapse from the review. It adds
TranscriptionFlag for span-level flags, a Subscription model with status
and period end, a per-image job link, in-flow diagram placement, and
money in minor units. PlanType is reduced to FREE and PRO, with credits
tracked as a balance.

generator client {

provider = \"prisma-client-js\"

}

datasource db {

provider = \"postgresql\"

url = env(\"DATABASE_URL\")

}

enum BookStatus {

DRAFT

PROCESSING

READY

ARCHIVED

}

enum ImageStatus {

UPLOADED

QUALITY_FAILED

ACCEPTED

TRANSCRIBED

FAILED

}

enum SectionConfidence {

HIGH

LOW

GAP

}

enum FlagType {

LOW

GAP

}

enum JobType {

TRANSCRIBE

STRUCTURE

EXPORT

}

enum JobStatus {

QUEUED

RUNNING

SUCCEEDED

FAILED

PARTIAL

}

enum PlanType {

FREE

PRO

}

enum SubscriptionStatus {

ACTIVE

PAST_DUE

CANCELED

}

enum TransactionType {

SUBSCRIPTION_CHARGE

CREDIT_PURCHASE

CREDIT_SPEND

}

model User {

id String \@id \@default(cuid())

email String \@unique

passwordHash String?

name String?

plan PlanType \@default(FREE)

creditBalance Int \@default(0)

createdAt DateTime \@default(now())

updatedAt DateTime \@updatedAt

books Book\[\]

jobs Job\[\]

transactions Transaction\[\]

subscription Subscription?

}

// Subscription state so the no-watermark benefit can be gated on an
active period.

model Subscription {

id String \@id \@default(cuid())

userId String \@unique

status SubscriptionStatus \@default(ACTIVE)

currentPeriodEnd DateTime

providerRef String?

createdAt DateTime \@default(now())

updatedAt DateTime \@updatedAt

user User \@relation(fields: \[userId\], references: \[id\], onDelete:
Cascade)

}

model Book {

id String \@id \@default(cuid())

userId String

title String

status BookStatus \@default(DRAFT)

createdAt DateTime \@default(now())

updatedAt DateTime \@updatedAt

user User \@relation(fields: \[userId\], references: \[id\], onDelete:
Cascade)

images SourceImage\[\]

chapters Chapter\[\]

jobs Job\[\]

@@index(\[userId\])

}

// A \"page\" in the product equals one SourceImage. Ordering lives in
imageOrder.

model SourceImage {

id String \@id \@default(cuid())

bookId String

storageKey String

format String

qualityScore Float?

status ImageStatus \@default(UPLOADED)

imageOrder Int?

createdAt DateTime \@default(now())

book Book \@relation(fields: \[bookId\], references: \[id\], onDelete:
Cascade)

sections Section\[\]

diagrams Diagram\[\]

@@index(\[bookId\])

}

model Chapter {

id String \@id \@default(cuid())

bookId String

title String

order Int

createdAt DateTime \@default(now())

updatedAt DateTime \@updatedAt

book Book \@relation(fields: \[bookId\], references: \[id\], onDelete:
Cascade)

sections Section\[\]

@@index(\[bookId\])

}

model Section {

id String \@id \@default(cuid())

bookId String

chapterId String?

sourceImageId String

order Int

originalText String

editedText String?

confidence SectionConfidence \@default(HIGH)

createdAt DateTime \@default(now())

updatedAt DateTime \@updatedAt

book Book \@relation(fields: \[bookId\], references: \[id\], onDelete:
Cascade)

chapter Chapter? \@relation(fields: \[chapterId\], references: \[id\],
onDelete: SetNull)

sourceImage SourceImage \@relation(fields: \[sourceImageId\],
references: \[id\], onDelete: Cascade)

flags TranscriptionFlag\[\]

diagrams Diagram\[\]

@@index(\[bookId\])

@@index(\[chapterId\])

}

// Span-level confidence flags. Needed by R10, R11, R19 and pipeline
stages 2 and 3.

model TranscriptionFlag {

id String \@id \@default(cuid())

sectionId String

startOffset Int

endOffset Int

type FlagType

suggestion String?

resolved Boolean \@default(false)

createdAt DateTime \@default(now())

section Section \@relation(fields: \[sectionId\], references: \[id\],
onDelete: Cascade)

@@index(\[sectionId\])

}

// Diagram now carries an in-flow position via sectionId + order.

model Diagram {

id String \@id \@default(cuid())

sourceImageId String

sectionId String?

storageKey String

caption String?

order Int?

createdAt DateTime \@default(now())

sourceImage SourceImage \@relation(fields: \[sourceImageId\],
references: \[id\], onDelete: Cascade)

section Section? \@relation(fields: \[sectionId\], references: \[id\],
onDelete: SetNull)

@@index(\[sourceImageId\])

@@index(\[sectionId\])

}

// Job carries an optional sourceImageId so a TRANSCRIBE job runs and
fails per image.

model Job {

id String \@id \@default(cuid())

userId String

bookId String

sourceImageId String?

type JobType

status JobStatus \@default(QUEUED)

attempts Int \@default(0)

error String?

createdAt DateTime \@default(now())

updatedAt DateTime \@updatedAt

user User \@relation(fields: \[userId\], references: \[id\], onDelete:
Cascade)

book Book \@relation(fields: \[bookId\], references: \[id\], onDelete:
Cascade)

@@index(\[bookId\])

@@index(\[userId\])

@@index(\[status\])

@@index(\[sourceImageId\])

}

// Money stored as minor units (kobo) with an explicit currency.

model Transaction {

id String \@id \@default(cuid())

userId String

type TransactionType

amountMinor Int?

currency String \@default(\"NGN\")

credits Int?

reference String?

createdAt DateTime \@default(now())

user User \@relation(fields: \[userId\], references: \[id\], onDelete:
Cascade)

@@index(\[userId\])

}

Plan limit values, batch ceiling, and the per-book cost ceiling live in
application config, not in the schema.

**11. Success Metrics**

**North Star**

Share of new users who export at least one book within seven days. This
is the honest proof the product worked end to end. Every other metric
supports it.

**Launch-gating metrics, with target ranges**

  ------------------------------------------------------------------------
  **Metric**           **Definition**                       **Target**
  -------------------- ------------------------------------ --------------
  Activation rate      New accounts that finish one book in 35 to 50
                       week one                             percent

  North Star export    New users who export a book within   25 to 40
  rate                 seven days                           percent

  Free-to-paid         Free users who subscribe or buy      3 to 6 percent
  conversion           credits                              
  ------------------------------------------------------------------------

Ranges are provisional and confirmed against v0 baselines.
\[ASSUMPTION\]

**Supporting metrics**

-   Transcription accuracy. Word error rate against a 200-image labeled
    test set. Target: down, measured per release. This is the real
    accuracy signal.

-   Section acceptance rate. Share of sections the student accepts
    without edits. This is an engagement proxy, not an accuracy measure,
    since a student may accept out of fatigue.

-   Flag resolve rate. Share of low-confidence and gap flags the student
    resolves. Target: up. A low rate signals confusing flags.

-   Time to first book. Median minutes from first upload to a ready
    draft. Target: down.

-   Book completion rate. Share of started books that reach ready
    status. Target: up.

-   Week-4 retention. Share of week-one users still active in week four.
    Target: up.

-   AI cost per book. Average AI spend to produce one book. Target:
    down, watched against price.

**12. Assumptions**

These are decisions taken during authoring. Each is a settled call, not
a pending question. Anything still unresolved lives in Section 14.

-   **\[ASSUMPTION\]** v1 is a responsive web app, not a native mobile
    app.

-   **\[ASSUMPTION\]** v1 is restricted to users 15 and over. The senior
    secondary persona moves to v2 behind a consent flow.

-   **\[ASSUMPTION\]** Self-learners are the v1 secondary persona.

-   **\[ASSUMPTION\]** The batch ceiling of 50 images is a technical
    upper bound. Plan caps are enforced first.

-   **\[ASSUMPTION\]** Math and equations are plain text approximations
    in v1, flagged as low-confidence. LaTeX moves to v2.

-   **\[ASSUMPTION\]** The AI infers image sequence, and the student can
    reorder.

-   **\[ASSUMPTION\]** Edits autosave and the original transcription
    stays recoverable.

-   **\[ASSUMPTION\]** Auth supports email plus at least one social
    login.

-   **\[ASSUMPTION\]** Payments run through Flutterwave, covering card,
    bank transfer, and USSD in Naira.

-   **\[ASSUMPTION\]** Object storage default is Cloudflare R2. Queue
    default is a Redis-backed worker. Auth default is Auth.js. The AI
    default is a frontier vision LLM at an assumed blended cost of about
    20 Naira per image.

-   **\[ASSUMPTION\]** Provisional pricing. Free: 30 images per month, 3
    books, watermarked. PRO: 5,000 Naira per month, 150 images per
    month, 300 per book, no watermark. Credit pack: 3,000 Naira for 100
    images. Credits are a balance and stack with PRO.

-   **\[ASSUMPTION\]** Grouping uses per-section embeddings plus a
    bounded grouping pass, so it handles books larger than one model
    context.

-   **\[ASSUMPTION\]** Slow connectivity is handled with per-image
    upload and resumable batches.

**13. Phased Roadmap**

**v0: Validation slice**

Theme: prove the riskiest belief before building the rest. Scope:
upload, quality check, per-image transcription, span flagging, and a
plain read view, at low image caps. Goal: measure real word error rate
against the labeled test set and real cost per image. Full v1 is gated
on v0 clearing the minimum accuracy bar. If accuracy fails here, no
downstream work is wasted.

**v1: Core capture to book**

Theme: the full solo loop for users 15 and over. Scope: everything in v0
plus topic grouping, chapter proposal, diagram detection and captioning
with in-flow placement, the rich text editor, reorder, the in-app
reader, PDF export, freemium billing through Flutterwave, and the
Subscription and credit model. English only.

**v2: Fidelity, depth, and minors**

Theme: better output and a wider audience. Scope: LaTeX rendering for
math, EPUB export, improved diagram handling, search inside a book, the
senior secondary persona behind age verification and parental consent
with a payer-owner model, and the first added languages. \[ASSUMPTION\]

**v3: Sharing and study tools**

Theme: collaboration and learning. Scope: shared books and read access,
auto-generated quizzes and flashcards from book content, a native mobile
app, and team or class accounts. \[ASSUMPTION\]

**14. Open Questions**

These remain unresolved and need a decision before or during build.

-   What is the measured AI cost per image across all pipeline calls?
    Every price in Section 8 is gated on this.

-   What word error rate is the minimum bar to pass v0 and unlock full
    v1?

-   Will v2 admit under-15 users, and under exactly what consent and
    payer-owner model?

-   What confidence threshold separates high from low for flagging? This
    depends on the TranscriptionFlag model now in place, and needs
    tuning against real samples.

-   What is the exact watermark design and placement on free exports?

-   Should PRO overage draw from credits automatically, or prompt the
    student each time?

-   What is the data retention policy after account deletion, and does
    it meet local data rules in the target market?

-   How does the system handle a book that mixes several unrelated
    subjects in one batch beyond chapter grouping?

-   What is the target processing time per image, and the acceptable
    upper bound before students drop off?

*End of PRD v2.0. Prepared for Dev and Design HQ.*
