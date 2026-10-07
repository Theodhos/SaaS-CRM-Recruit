# Phones — calling lists and browser calling

Communication → **Phones**: numbers imported from Excel/CSV, searched and filtered on the server, called from the
browser, with the call history kept per number. Each instructor sees their own list; the admin sees all.

## Flow

```
CSV / Excel export
  → POST /phones/imports/preview   (multipart: file, defaultCountry)   parse · normalise · validate · detect duplicates
  → POST /phones/imports/:id/confirm                                   batched inserts in the background
  → GET  /phones/imports/:id                                            progress + totals (poll while RUNNING)
  → GET  /phones/imports/:id/errors                                     CSV of the rows not imported and why
  → GET  /phones?search=&callFilter=&page=&pageSize=                    the list (server-side pagination)
  → POST /phones/:id/calls                                              call record INITIATED + provider token
  → browser dials with the Twilio Voice SDK
  → POST /phones/calls/twiml   (public, Twilio)                         what to dial for this call
  → POST /phones/calls/webhook (public, Twilio)                         ringing / answered / completed / busy / failed / no-answer
  → PATCH /phones/calls/:id                                             browser-side status + the after-call note
  → GET  /phones/:id                                                    the phone with its call history
  → DELETE /phones/:id                                                  remove a number (soft delete)
```

## Normalisation

`libphonenumber-js` turns every value into E.164. The **default country** (every country is offered; Albania +355 is
pre-selected) only applies to national numbers: `0691234567` → `+355691234567`, `00355 69 …` → `+35569…`, while
`+49 30 …` keeps Germany. Invalid numbers are reported per row, never guessed. Duplicates are detected inside the
file and against the organisation's existing numbers (`@@unique([organisationId, normalizedPhone])`); the confirm
step uses `createMany({ skipDuplicates: true })` so a race can only skip a row, never fail the import.

The preview is kept in the API process for 30 minutes (`PhonesService.previews`); confirming after that returns
`410 PREVIEW_EXPIRED` and the file has to be uploaded again. Large files are processed in chunks of 500 rows with the
event loop yielded between chunks; totals are written to the `PhoneImport` row after every chunk.

Columns are matched by header (`Phone / Telefon / Mobile / Tel / Numri…`, `Name / Emri`, `First name` + `Last name`,
`Email`, `Company / Kompania`); without a phone header the column whose values look like numbers is used.

## Calling (Twilio Programmable Voice)

The browser never sees a credential. `POST /phones/:id/calls` returns a one-hour Access Token (Voice grant bound to
the TwiML App); the SDK connects with `{ To, CallId }`; Twilio requests `/phones/calls/twiml`, which answers a
`<Dial>` to the number with status callbacks to `/phones/calls/webhook?callId=…`. Webhooks are idempotent
(`SequenceNumber` is stored as `lastEventSeq`) and, when `TWILIO_AUTH_TOKEN` is set, signature-checked.

Environment (see `.env.example`): `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`,
`TWILIO_TWIML_APP_SID`, `TWILIO_CALLER_ID`, optional `TWILIO_AUTH_TOKEN`, and `PUBLIC_API_URL` (the URL Twilio can
reach; configure the TwiML App's voice URL as `<PUBLIC_API_URL>/api/v1/phones/calls/twiml`). Without them the list
works fully and the Call button explains what is missing (`GET /phones/capabilities`).

Call statuses: `INITIATED → RINGING → ANSWERED → ENDED`, or `NO_ANSWER / BUSY / FAILED / REJECTED`. The phone row keeps
`lastCallAt`, `lastCallStatus` (the outcome of the latest call) and `callCount` for the list filters
(`callFilter = NEVER_CALLED | CALLED | ANSWERED | NO_ANSWER | BUSY | FAILED`).

## Permissions and scoping

Phones carry the contact permissions: `contact:read` to list, `contact:create` to import, `contact:update` to call and
annotate, `contact:delete` to remove. `phone`, `phoneCall` and `phoneImport` are tenant-scoped and owner-scoped
(`packages/database/src/owner-scope.ts`): an instructor's imports are their own calling list.
