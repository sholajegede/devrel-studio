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

// The report has always been live at the client's dashboard URL; this is the
// nudge to go and look. Sent on the 1st for the month that just closed, at an
// hour that lands in the morning across the Americas and Europe rather than at
// 4am for whoever happens to be furthest east.
crons.monthly(
  'notify clients their monthly report is ready',
  { day: 1, hourUTC: 9, minuteUTC: 0 },
  internal.reports.sendMonthlyReports,
  {},
)

export default crons
