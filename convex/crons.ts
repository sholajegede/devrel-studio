import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Once a day is the right cadence: npm's download counts are themselves daily
// aggregates, and GitHub star counts move slowly enough that anything more
// frequent would just spend rate limit for no new information.
crons.daily(
  'refresh package and demo stats',
  { hourUTC: 4, minuteUTC: 0 },
  internal.sync.syncAllStats,
)

// Hourly, not monthly. The day, hour and timezone are configured per client in
// the dashboard, and a cron can only honour that by waking up every hour and
// asking each schedule whether this is its hour where the client lives.
//
// Each run is cheap: one indexed read of enabled schedules, and almost always
// nothing to do.
crons.hourly(
  'send scheduled client reports',
  { minuteUTC: 5 },
  internal.reports.runScheduledReports,
  {},
)

// Once a day, and early enough that a notice about a trial ending "tomorrow"
// arrives while there is still a working day left to act on it. 08:00 UTC is
// morning across the UK and Nigeria, which is where the first users are.
//
// The run is idempotent: each notice is recorded against the account when it
// sends, so a retry or a double run mails nobody twice.
crons.daily(
  'send trial notices',
  { hourUTC: 8, minuteUTC: 0 },
  internal.trials.runTrialNotices,
  {},
)

export default crons
