// Simple in-memory progress tracking for bulk operations
interface ProgressData {
  current: number;
  total: number;
  role: string;
  completed: boolean;
  startedAt: Date;
}

const progressStore = new Map<string, ProgressData>();

export function createProgressTracking(progressId: string, total: number, role: string): void {
  progressStore.set(progressId, {
    current: 0,
    total,
    role,
    completed: false,
    startedAt: new Date()
  });
}

export function updateProgress(progressId: string, current: number, total: number): void {
  const existing = progressStore.get(progressId);
  if (existing) {
    existing.current = current;
    existing.total = total;
    existing.completed = current >= total;
  }
}

export function getProgress(progressId: string): ProgressData | undefined {
  return progressStore.get(progressId);
}

export function clearProgress(progressId: string): void {
  progressStore.delete(progressId);
}

// Clean up old progress entries (older than 10 minutes)
setInterval(() => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  for (const [id, data] of progressStore.entries()) {
    if (data.startedAt < tenMinutesAgo) {
      progressStore.delete(id);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes
