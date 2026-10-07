# Website applications (public endpoint)

Lets an agency's public website send applications straight into the CRM. Each one becomes a **Candidate** — ranked by
the same potential score as every other candidate — whether or not the applicant chose a job. Nothing needs to be
logged in on the website side.

```
POST {API_URL}/api/v1/public/applications
Content-Type: application/json
```

| Field | Required | Notes |
| --- | --- | --- |
| `organisation` | yes | the agency's slug (the `slug` of its Organisation, e.g. `acme-recruiting`) |
| `firstName`, `lastName` | yes | 1-100 characters |
| `email` | yes | used to avoid duplicates (case-insensitive) |
| `phone`, `location`, `jobTitle`, `currentCompany` | no | free text, bounded length |
| `jobId` | no | an **open** job of that organisation; the applicant is linked to it and the job's owner is notified |
| `website` | no | **honeypot** — render it hidden and leave it empty; anything in it is treated as a bot |

Response: `201 { "success": true, "data": { "received": true } }`. The same response is returned when the e-mail is
already on file (the record is kept single; a newly chosen job is attached if none was set), so the form cannot be used
to discover who is in the database.

Errors: `400` (validation, job not open / not this organisation's), `404` (unknown or suspended organisation),
`429` (more than 10 submissions per minute from one client).

## Minimal HTML form

```html
<form id="apply">
  <input name="firstName" required>  <input name="lastName" required>  <input name="email" type="email" required>
  <input name="phone">  <input name="jobTitle" placeholder="What do you do?">
  <select name="jobId"><option value="">Any open position</option><!-- fill from your own job list --></select>
  <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
  <button>Apply</button>
</form>
<script>
  document.getElementById('apply').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    for (const k of Object.keys(data)) if (data[k] === '') delete data[k];
    const res = await fetch('https://app.example.com/api/v1/public/applications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organisation: 'acme-recruiting', ...data }),
    });
    alert(res.ok ? 'Thank you — we received your application.' : 'Something went wrong, please try again.');
  });
</script>
```

## Configuration

* `PUBLIC_APPLICATIONS_ORIGINS` — comma-separated website origins allowed to call this endpoint from a browser
  (default `*`: any origin; the endpoint carries no cookies, so this is safe). Everything else in the API keeps the strict
  `CORS_ORIGINS` policy.
* Rate limit: 10 requests / minute / client IP at the API, plus the edge's general API limit.

## What it never does

Creates companies or other records from the submitted text, accepts fields other than the ones above, reveals whether an
e-mail exists, or attaches an applicant to a job that is closed or belongs to another organisation.
