CHRONA SCHOOL MANAGEMENT DATABASE BACKUP
========================================

Created: $(date)

This directory contains complete database backups of your Chrona School Management system.

FILES:
------
1. chrona_backup_YYYYMMDD_HHMMSS.sql  (2.2 MB)
   - Plain SQL format
   - Human-readable
   - Can be opened in text editor
   - Restore with: psql $DATABASE_URL < filename.sql

2. chrona_backup_YYYYMMDD_HHMMSS.dump (455 KB)
   - PostgreSQL custom format (compressed)
   - Smaller file size
   - More efficient for large databases
   - Restore with: pg_restore --dbname=$DATABASE_URL filename.dump

DATABASE CONTENTS:
-----------------
- All tables and data
- Teachers, Students, Classes
- Timetables and Schedules
- Attendance records
- Academic sessions
- User accounts
- All other school data

NOTES:
------
- Backups are created with --no-owner --no-acl flags for portability
- Both files contain the same data in different formats
- Choose the format that best suits your needs

TO RESTORE:
-----------
For SQL file:
  psql your_database_url < chrona_backup_YYYYMMDD_HHMMSS.sql

For DUMP file:
  pg_restore --dbname=your_database_url chrona_backup_YYYYMMDD_HHMMSS.dump

DOWNLOAD:
---------
You can download these files using the Replit file browser:
1. Open the Files panel
2. Navigate to db_backups/
3. Right-click on the file
4. Select "Download"
