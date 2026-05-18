-- Create content_entries table for DevRel Studio
CREATE TABLE IF NOT EXISTS content_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  link TEXT DEFAULT '',
  tracking_link TEXT DEFAULT '',
  platform TEXT NOT NULL,
  publication_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  views INTEGER DEFAULT 0,
  content_type TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries by status and date
CREATE INDEX IF NOT EXISTS idx_content_entries_status ON content_entries(status);
CREATE INDEX IF NOT EXISTS idx_content_entries_publication_date ON content_entries(publication_date);

-- Create waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  company TEXT,
  role TEXT,
  use_case TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
