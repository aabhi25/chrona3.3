# Timezone Standards for Chrona

## Overview
Chrona uses **IST (Asia/Kolkata, UTC+5:30)** as the exclusive timezone for all date and time operations throughout the system. This ensures consistent scheduling and accurate date handling for Indian educational institutions.

## Why IST-Only?
- **Consistency**: Single timezone eliminates conversion errors and edge cases
- **Target Audience**: All users are in India (IST timezone)
- **Reliability**: Prevents UTC/local timezone conflicts in scheduling, attendance, and timetables
- **Data Integrity**: Ensures dates don't shift due to timezone conversions

## Mandatory Rules for All Development

### ✅ DO: Use Shared IST Utilities
All date/time operations **MUST** use the helper functions from `shared/utils/dateUtils.ts`:

```typescript
import { 
  getCurrentDateIST,           // Get current date in IST as YYYY-MM-DD string
  getCurrentDateTimeIST,        // Get current Date object in IST
  formatDateIST,                // Format Date to YYYY-MM-DD in IST
  getWeekStartDateIST,          // Get Monday of current week in IST
  getWeekEndDateIST,            // Get Sunday of current week in IST
  addDaysIST,                   // Add/subtract days while maintaining IST
  parseISTDate,                 // Parse YYYY-MM-DD string to Date with IST offset
  getDateTimeInIST              // Get ISO string with IST offset
} from '@/utils/dateUtils';
```

### ✅ DO: Safe Date Patterns

#### Creating Dates
```typescript
// ✅ CORRECT: Use shared utilities ONLY
const today = getCurrentDateIST();              // "2025-10-04"
const now = getCurrentDateTimeIST();            // Date object in IST
const date = parseISTDate('2025-10-04');        // Parse YYYY-MM-DD with IST offset

// ❌ WRONG: Do NOT manually create dates, even with IST offset
const date = new Date('2025-10-04T00:00:00+05:30');  // ESLint will block this

// ✅ CORRECT: Use Intl for formatting (only in utilities)
const formatted = someDate.toLocaleDateString('en-CA', { 
  timeZone: 'Asia/Kolkata' 
});
```

#### Date Arithmetic
```typescript
// ✅ CORRECT: Use IST-aware helper
const tomorrow = addDaysIST(getCurrentDateTimeIST(), 1);

// ✅ CORRECT: For week calculations
const weekStart = getWeekStartDateIST(someDate);  // Always Monday
const weekEnd = getWeekEndDateIST(someDate);      // Always Sunday
```

#### Displaying Dates
```typescript
// ✅ CORRECT: Format with IST utilities
const displayDate = formatDateIST(someDate);

// ✅ CORRECT: For time display
const timeStr = someDate.toLocaleTimeString('en-IN', {
  timeZone: 'Asia/Kolkata'
});
```

### ❌ DON'T: Anti-Patterns to Avoid

#### Never Use These Patterns
```typescript
// ❌ WRONG: ANY use of new Date() - ESLint will block ALL of these
const date = new Date();
const date = new Date('2025-10-04');
const date = new Date('2025-10-04T00:00:00+05:30');
const date = new Date(2025, 9, 4);
const timestamp = Date.now();
const parsed = Date.parse('2025-10-04');

// ❌ WRONG: Converts to UTC, causes date shifts
const dateStr = new Date().toISOString().split('T')[0];

// ❌ WRONG: UTC methods cause incorrect dates
const day = someDate.getUTCDay();
const hours = someDate.getUTCHours();

// ❌ WRONG: Without timezone, uses server locale
const formatted = someDate.toLocaleDateString();

// ❌ WRONG: date-fns without timezone awareness
import { format } from 'date-fns';
const str = format(new Date(), 'yyyy-MM-dd');
```

#### Why These Are Wrong
- **ALL `new Date()` calls are banned** - Even with IST offset strings, they bypass utilities and create maintenance risks
- `.toISOString()` always converts to UTC, causing date shifts for IST
- UTC methods don't account for IST offset (+5:30)
- Default formatting uses server locale, not IST
- `Date.parse()` and `Date.UTC()` are UTC-based and cause timezone issues

**CRITICAL**: ESLint will block ALL `new Date()` usage outside of `dateUtils.ts`. ALWAYS use shared IST helpers.

### 🔧 Common Use Cases

#### Backend: API Responses
```typescript
// ✅ CORRECT: Return IST date strings
app.get('/api/attendance', async (req, res) => {
  const today = getCurrentDateIST();
  const attendance = await getAttendanceForDate(today);
  res.json({ date: today, attendance });
});
```

#### Backend: Database Queries
```typescript
// ✅ CORRECT: Use IST dates for queries
const weekStart = getWeekStartDateIST(new Date());
const timetables = await db.query.weeklyTimetables.findMany({
  where: eq(weeklyTimetables.weekStartDate, weekStart)
});
```

#### Frontend: Date Display
```typescript
// ✅ CORRECT: Parse and display IST dates
import { parseISTDate, formatDateIST } from '@/utils/dateUtils';

function TimetableCard({ weekStart }: { weekStart: string }) {
  const date = parseISTDate(weekStart);  // Parse YYYY-MM-DD with IST offset
  const display = formatDateIST(date);   // Format back to YYYY-MM-DD
  
  return <div>Week of {display}</div>;
}
```

#### Cron Jobs & Scheduled Tasks
```typescript
// ✅ CORRECT: Use IST utilities for cron logic
function getUpcomingMondayIST(): Date {
  const now = getCurrentDateTimeIST();
  
  // Get IST weekday using Intl
  const formatter = new Intl.DateTimeFormat('en-US', { 
    weekday: 'long',
    timeZone: 'Asia/Kolkata'
  });
  const dayName = formatter.format(now).toLowerCase();
  
  // Calculate next Monday with proper rollover
  // ... use Date.UTC for arithmetic, then create with +05:30 offset
  
  return mondayDate;
}
```

## TypeScript Type Safety

### Use IST-Aware Types
```typescript
// Define explicit IST date string type
export type ISTDateString = string; // YYYY-MM-DD format in IST

// Use in function signatures
function processAttendance(date: ISTDateString): Promise<void> {
  // date is guaranteed to be YYYY-MM-DD in IST
}
```

## Testing Guidelines

### Test Timezone Edge Cases
```typescript
describe('Weekly Timetable Generation', () => {
  it('should handle month boundaries correctly in IST', () => {
    // Test Oct 31 + 2 days = Nov 2
    const oct31 = new Date('2025-10-31T00:00:00+05:30');
    const result = addDaysIST(oct31, 2);
    expect(formatDateIST(result)).toBe('2025-11-02');
  });
  
  it('should handle year boundaries correctly in IST', () => {
    // Test Dec 31 + 1 day = Jan 1 next year
    const dec31 = new Date('2025-12-31T00:00:00+05:30');
    const result = addDaysIST(dec31, 1);
    expect(formatDateIST(result)).toBe('2026-01-01');
  });
});
```

## Code Review Checklist

Before merging any PR with date/time operations, verify:

- [ ] All date creation uses `shared/utils/dateUtils.ts` helpers
- [ ] No bare `new Date()` calls (except in dateUtils.ts itself)
- [ ] No `.toISOString().split('T')[0]` patterns
- [ ] No UTC methods (`getUTCDay`, `getUTCHours`, etc.) outside utilities
- [ ] All `toLocaleDateString` calls include `{ timeZone: 'Asia/Kolkata' }`
- [ ] API responses use IST date strings (YYYY-MM-DD format)
- [ ] Database queries use IST dates from shared utilities
- [ ] Tests cover timezone edge cases (month/year boundaries)
- [ ] User-facing UI displays dates in IST format

## ESLint Configuration

ESLint rules catch 99% of timezone violations automatically. See `.eslintrc.json` for the complete configuration.

### What ESLint Catches:
- ✅ All `new Date()` calls (with or without arguments)
- ✅ `Date()` constructor calls
- ✅ `Date.now()`, `Date.parse()`, `Date.UTC()` usage
- ✅ `.toISOString()` calls
- ✅ UTC methods (`getUTCDay`, `getUTCHours`, etc.)
- ✅ Imports of `date-fns` or `moment`

### Known Limitation:
⚠️ ESLint cannot catch Date aliasing (e.g., `const D = Date; new D()`). Code reviewers must watch for this pattern manually. However, this is an uncommon edge case that developers are unlikely to use accidentally.

### For Code Reviewers:
When reviewing PRs with date/time operations:
1. Run ESLint to catch automated violations
2. Manually verify no Date aliasing is used
3. Confirm all date operations use IST helpers from `shared/utils/dateUtils.ts`
4. Check that tests cover timezone edge cases

## Migration Guide

### Converting Legacy Code

#### Before (UTC/Local timezone)
```typescript
const today = new Date().toISOString().split('T')[0];
const weekStart = new Date();
weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
```

#### After (IST timezone)
```typescript
const today = getCurrentDateIST();
const weekStart = getWeekStartDateIST(getCurrentDateTimeIST());
```

## Additional Resources

- **Main Utilities**: `shared/utils/dateUtils.ts`
- **Architecture Docs**: `replit.md` - Backend Architecture section
- **Examples**: Search codebase for `getCurrentDateIST` usage patterns

## Questions?

If you're unsure about timezone handling:
1. Check `shared/utils/dateUtils.ts` for available helpers
2. Look for similar patterns in existing code
3. Consult the team before introducing new date/time logic

---

**Remember**: When in doubt, use the shared IST utilities. They handle all timezone complexity for you!
