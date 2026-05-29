# Sheets Logging Update — Opinion Dial, User Choice, Group Context

*Last updated 2026-05-29. Companion to `Build_State.md §4` (Logging).*

This is the action list to wire your Google Sheet up for the new events
the app now fires. Existing columns/events keep working — you're
**adding**, not replacing.

## What the app sends now

Every `/api/log-tour` row already carries the legacy 24 fields. On top
of those, **every** row now also includes the group context, and two
new event types add their own fields.

### Group context — on every row

| JSON field | Type | Description |
|---|---|---|
| `roomCode` | string \| null | 4-char room code if the device is in a multi-device room; `null` for solo |
| `isHost` | boolean | `true` for solo OR the host in a group; `false` for non-host participants |
| `memberCount` | number | 1 for solo, 2–4 in a group |

These are populated from `RoomContext` and reset to `(null, true, 1)`
when the user leaves the room.

### `event: "opinion_dial"`

Fired by **each** member's device once every member has chosen + revealed
their spectrum position. One row per member per question.

| JSON field | Type | Description |
|---|---|---|
| `stopIndex` | number | Active-stops index of the question's stop. `-1` for EQ questions. |
| `stopTitle` | string | "EQ Additional" / "EQ Closing Additional N" for EQ rows. |
| `questionKey` | string | Unique per question — `${stopId}:wonder:${round}` or `eq:additional:0` etc. |
| `questionText` | string | The question that was discussed |
| `opinionLeftLabel` | string | Admin's left-spectrum text |
| `opinionRightLabel` | string | Admin's right-spectrum text |
| `opinionMyPosition` | number | This member's chosen position (0 = left, 1 = right) |
| `opinionOtherPositions` | string | Comma-separated other members' positions |
| `opinionSimilarity` | `"similar"` \| `"different"` | Whether avg distance < 0.25 |
| `opinionAvgDistance` | number | Average distance from this member to others |

### `event: "user_choice_picked"`

Fired by the **picker only** (solo OR the first non-host in a group)
when they lock in a question on a User Choice Question. One row per
pick.

| JSON field | Type | Description |
|---|---|---|
| `stopIndex` | number | Active-stops index of the wonder's stop |
| `stopTitle` | string | The stop's title |
| `questionKey` | string | Same shape as barriers — `${stopId}:wonder:${round}` |
| `userChoiceQuestion` | string | The chosen question text (admin-authored OR proposed-own) |
| `userChoiceIsCustom` | boolean | `true` when the picker proposed their own question |

The custom case **also** still emits the existing `question_banked`
event (the proposed question goes into the picker's Inquiries log).
Those are two separate rows recording two different facts.

## What to do in your Sheet

### 1. Add these columns to the right of the existing 24

| # | Column header | Sourced from |
|---|---|---|
| 25 | Room Code | `roomCode` |
| 26 | Is Host | `isHost` |
| 27 | Member Count | `memberCount` |
| 28 | Question Key | `questionKey` |
| 29 | Opinion Left Label | `opinionLeftLabel` |
| 30 | Opinion Right Label | `opinionRightLabel` |
| 31 | Opinion My Position | `opinionMyPosition` |
| 32 | Opinion Other Positions | `opinionOtherPositions` |
| 33 | Opinion Similarity | `opinionSimilarity` |
| 34 | Opinion Avg Distance | `opinionAvgDistance` |
| 35 | User Choice Question | `userChoiceQuestion` |
| 36 | User Choice Is Custom | `userChoiceIsCustom` |

(Add a 37th header row, freeze it, etc. — keeping the order matters
only if your Apps Script positions by index.)

### 2. Apps Script — add the new fields to the row mapping

In your existing `doPost(e)` handler, find the line that builds the
row array. Append the new fields in the same column order you added
above. Example fragment:

```js
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  sheet.appendRow([
    new Date(),                       // 1  Logged At
    data.timestamp || '',             // 2  Timestamp
    data.sessionId || '',             // 3  Session ID
    data.source || '',                // 4  Source
    data.event || '',                 // 5  Event/Type
    data.tourTitle || '',             // 6  Tour Title
    data.stopTitle || '',             // 7  Stop Title
    data.stopIndex ?? '',             // 8  Stop #
    data.reflectionScore ?? '',       // 9  Reflection Score
    data.followUpResponse || '',      // 10 Follow-Up Response
    data.questionText || '',          // 11 Question
    data.questionRouting || '',       // 12 Question Routing
    data.stopsCompleted ?? '',        // 13 Stops Completed
    data.durationMinutes ?? '',       // 14 Duration (min)
    data.eqTheory || '',              // 15 EQ Initial Theory
    data.eqReasoning || '',           // 16 EQ Initial Reasoning
    data.eqFinalReflection || '',     // 17 EQ Final Reflection
    data.eqFinalReasoning || '',      // 18 EQ Final Reasoning
    data.eqCognitiveSlider ?? '',     // 19 EQ Cognitive Slider
    data.eqPerceptualSlider ?? '',    // 20 EQ Perceptual Slider
    data.eqWhatChanged || '',         // 21 EQ What Changed
    data.eqWhyChanged || '',          // 22 EQ Why Changed
    data.observation || '',           // 23 Observation
    data.answer || '',                // 24 Answer
    // ── new columns below ──
    data.roomCode || '',              // 25 Room Code
    data.isHost === undefined ? '' : data.isHost, // 26 Is Host
    data.memberCount ?? '',           // 27 Member Count
    data.questionKey || '',           // 28 Question Key
    data.opinionLeftLabel || '',      // 29 Opinion Left Label
    data.opinionRightLabel || '',     // 30 Opinion Right Label
    data.opinionMyPosition ?? '',     // 31 Opinion My Position
    data.opinionOtherPositions || '', // 32 Opinion Other Positions
    data.opinionSimilarity || '',     // 33 Opinion Similarity
    data.opinionAvgDistance ?? '',    // 34 Opinion Avg Distance
    data.userChoiceQuestion || '',    // 35 User Choice Question
    data.userChoiceIsCustom === undefined ? '' : data.userChoiceIsCustom, // 36 Is Custom
  ]);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

If your existing handler iterates over a fixed header array instead of
appending positionally, just add the 12 new header names to that array
in the same order.

### 3. Re-deploy the script

Apps Script → Deploy → **Manage deployments** → edit the existing
"Web app" deployment → **Version: New version** → Deploy.

`SHEETS_WEBHOOK_URL` does **not** change — you're re-using the same
deployment URL, just bumping the version.

## Cross-referencing rows

- **Across members of one room**: filter by `Room Code` + `Question Key`.
  Each member's `opinion_dial` row carries their own position; pair
  with the matching room's `Member Count` to know how many were in.
- **Picker vs viewers** on a User Choice Question: only the picker has
  a `user_choice_picked` row. Other members in the same room (same
  `Room Code` + `Question Key`) saw the same question — those rows
  surface via the other events (e.g. `stop_entered`, `opinion_dial`).
- **Solo runs**: `Room Code` is blank, `Is Host` is TRUE, `Member
  Count` is 1.
