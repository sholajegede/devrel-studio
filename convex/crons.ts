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

// View rows are kept for a year and then dropped. The analytics section never
// looks further back than that, and a table of individual visits is not
// something to hold indefinitely just because the storage is cheap.
crons.daily(
  'prune old page views',
  { hourUTC: 3, minuteUTC: 30 },
  internal.analytics.pruneOldViews,
  {},
)

// The week's attention, to the person who produced the work.
//
// Monday morning, because a digest about last week read on Monday is something
// to act on and the same digest on Friday is a receipt. It sends nothing to a
// workspace with a quiet week — an email that always arrives saying "0 views"
// trains its reader to delete it unopened.
crons.weekly(
  'send weekly digests',
  { dayOfWeek: 'monday', hourUTC: 8, minuteUTC: 0 },
  internal.analytics.sendWeeklyDigests,
  {},
)

export default crons
