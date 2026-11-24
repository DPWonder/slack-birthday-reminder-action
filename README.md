# Team Birthday Reminder for Slack (GitHub Action)

Keep your team's birthdays and work anniversaries in a CSV in a repository, and this Action posts the day's ones to a Slack or Discord channel every morning. No bot to install, no server, no account anywhere: a scheduled workflow, a CSV and an incoming webhook.

```
🎂 Birthday today: Avery Q.
🎉 Cleo M.: 3 years on the team today
```

## Set it up (about 5 minutes)

1. **Add `team.csv`** to a repository (a private one is fine). Only `Name` is required; `Birthday` and `Start date` are read when present, other columns are ignored.

   ```csv
   Name,Birthday,Start date,Team,Notes
   Avery Q.,1991-02-14,2022-03-07,Design,
   Bram T.,05-30,,Support,No year is fine
   ```

   Dates can be `1991-02-14`, `02-14` (no year), `2/14/1991` (US order) or `14.02.1991` (day first). A Feb 29 birthday is posted on Feb 28 in other years. A start date posts an anniversary from its first full year. Ready-made template (CSV and Excel): [employee-birthday-tracker-template](https://github.com/DPWonder/employee-birthday-tracker-template).

2. **Create an incoming webhook.** Slack: *Apps > Incoming Webhooks > Add to Slack*, pick the channel, copy the URL. Discord: *Channel settings > Integrations > Webhooks > New Webhook*, copy the URL.

3. **Save it as a secret:** repository *Settings > Secrets and variables > Actions > New repository secret*, name `BIRTHDAY_WEBHOOK`.

4. **Add the workflow** as `.github/workflows/birthdays.yml`:

   ```yaml
   name: Team birthdays
   on:
     schedule:
       - cron: '0 14 * * 1-5'   # 14:00 UTC on weekdays; GitHub may run it a few minutes late
     workflow_dispatch:
   jobs:
     remind:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: DPWonder/slack-birthday-reminder-action@v1
           with:
             csv: team.csv
             webhook-url: ${{ secrets.BIRTHDAY_WEBHOOK }}
             timezone: America/New_York
   ```

   Press *Run workflow* once on the Actions tab with `dry-run: true` to see the message in the log without posting.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `csv` | `team.csv` | Path to the CSV. |
| `webhook-url` | | Slack or Discord incoming webhook. Keep it in a secret. |
| `timezone` | `UTC` | Decides what "today" is, for example `Europe/London`. |
| `days-ahead` | `0` | `1` posts the day before, so there is time for a card. |
| `format` | `slack` | `slack` or `discord`. |
| `dry-run` | `false` | `true` prints the message and posts nothing. |

**Weekends:** with a weekday-only schedule, Saturday and Sunday birthdays are not posted. Add a second step with `days-ahead: 1` on Fridays, or run every day.

Run it outside GitHub too: `CSV=team.csv WEBHOOK_URL=... TIMEZONE=Europe/London node index.js`. Tests: `node test.js`.

## Privacy

The CSV lives in your repository and the message goes only to your webhook. The Action sends nothing anywhere else. Keep the repository private if the list has birth years.

## When a CSV is not enough

If nobody on the team wants to edit a CSV, [Greetigo](https://greetigo.com/employee-birthday-tracker?utm_source=github&utm_medium=readme&utm_campaign=action-1124) does the same from a pasted list, with email the day before and on the day, and a message ready to send. Free for a team of up to 25. This Action does not need it.

## License

MIT
