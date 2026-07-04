/**
 * Google Sheets logger for learner interactions.
 *
 * POSTs a row to a Google Apps Script web app, which appends it to a
 * spreadsheet. Chosen over Firestore for user-testing data collection:
 *
 *   - no security rule management
 *   - no fire-and-forget drop-off on Vercel serverless (uses keepalive)
 *   - data lands in a spreadsheet that's trivial to filter/chart/share
 *
 * Setup:
 *   1. Create a Google Sheet.
 *   2. Extensions → Apps Script. Paste a `doPost(e)` handler that appends
 *      rows from the JSON body.
 *   3. Deploy as a Web App with "Anyone" access.
 *   4. Put the resulting URL in `SHEETS_WEBHOOK_URL` (both .env.local and
 *      Vercel project env vars).
 *
 * Behaviour:
 *   - Fire-and-forget: we do NOT await the fetch. The call returns
 *     synchronously.
 *   - `keepalive: true` tells the runtime the request may outlive the
 *     function invocation, so Vercel won't kill it when the response
 *     returns. This is the whole reason we're not on Firestore anymore —
 *     Firestore's REST API + the default `fetch` behavior dropped writes
 *     after the first question of each serverless instance.
 *   - The `timestamp` field is the moment the question was processed on
 *     the server (ISO 8601). The Apps Script handler may also stamp its
 *     own append time in a separate column; both are useful for analysis.
 */

export type LogEntryType = 'ask' | 'deepen' | 'zoom_out';

export interface SheetLogEntry {
  type: LogEntryType;
  question: string;
  observation?: string | null;
  answer: string;
  pinContext?: string | null;
  hintsUsed?: number;
  timestamp: string;
}

/**
 * RETIRED. The Google Sheets pipeline has been replaced by the durable Firestore
 * session backup (`memorial-church-tour-sessions`), reviewable in /admin/sessions.
 * This is now a no-op kept only so existing call sites compile; it sends nothing.
 */
export function logToSheet(entry: SheetLogEntry): void {
  // Intentionally does nothing — see /admin/sessions for explorer responses.
  void entry;
}
