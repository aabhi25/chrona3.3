import crypto from 'crypto';
import { getCurrentDateTimeIST } from '@shared/utils/dateUtils';
import { hashTemporaryPassword } from '../auth';

export type CredentialStatus = 'active' | 'expires_soon' | 'expired' | 'not_generated';

export function generateLoginId(type: 'teacher' | 'student' | 'parent', admissionNumber?: string): string {
  if (type === 'teacher') {
    const empNumber = Math.floor(100000 + Math.random() * 900000);
    return `EMP${empNumber}`;
  } else if (type === 'student') {
    return admissionNumber || `ADM${Math.floor(100000 + Math.random() * 900000)}`;
  } else if (type === 'parent') {
    if (!admissionNumber) {
      throw new Error('Admission number required for parent login ID');
    }
    return `P${admissionNumber}`;
  }
  throw new Error('Invalid user type');
}

export function generateTemporaryPasswordString(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    result += chars.charAt(randomIndex);
  }
  return result;
}

export function generateTemporaryPasswordExpiry(hoursFromNow: number = 48): Date {
  const expiryDate = getCurrentDateTimeIST();
  expiryDate.setHours(expiryDate.getHours() + hoursFromNow);
  return expiryDate;
}

export function calculateCredentialStatus(
  temporaryPassword: string | null,
  temporaryPasswordExpiresAt: Date | null
): CredentialStatus {
  if (!temporaryPassword || !temporaryPasswordExpiresAt) {
    return 'not_generated';
  }

  const now = getCurrentDateTimeIST();
  const expiresAt = new Date(temporaryPasswordExpiresAt);

  if (now > expiresAt) {
    return 'expired';
  }

  const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursUntilExpiry <= 24) {
    return 'expires_soon';
  }

  return 'active';
}

export interface BatchGenerationResult {
  total: number;
  generated: number;
  failed: number;
  results: Array<{
    userId: string;
    success: boolean;
    loginId?: string;
    temporaryPassword?: string;
    expiresAt?: Date;
    error?: string;
  }>;
}

// Helper function to process items in parallel with concurrency limit
async function pLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const promise = fn(item).then(result => {
      results.push(result);
      executing.splice(executing.indexOf(promise), 1);
    });
    
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
  return results;
}

export async function generateCredentialsForUsers(
  users: Array<{
    id: string;
    role: 'student' | 'teacher' | 'parent';
    admissionNumber?: string;
    employeeId?: string;
  }>,
  updateUserFn: (userId: string, data: {
    temporaryPassword: string;
    temporaryPasswordPlainText: string;
    temporaryPasswordExpiresAt: Date;
    isFirstLogin: boolean;
  }) => Promise<void>,
  progressCallback?: (current: number, total: number) => void
): Promise<BatchGenerationResult> {
  const results: BatchGenerationResult = {
    total: users.length,
    generated: 0,
    failed: 0,
    results: []
  };

  // Process in batches of 100 users
  const BATCH_SIZE = 100;
  const HASH_CONCURRENCY = 10; // Hash 10 passwords in parallel
  
  for (let batchStart = 0; batchStart < users.length; batchStart += BATCH_SIZE) {
    const batch = users.slice(batchStart, batchStart + BATCH_SIZE);
    
    // Step 1: Generate passwords and prepare data for batch (in parallel)
    const preparedData = await pLimit(
      batch,
      HASH_CONCURRENCY,
      async (user) => {
        try {
          const tempPassword = generateTemporaryPasswordString();
          const hashedPassword = await hashTemporaryPassword(tempPassword);
          const expiresAt = generateTemporaryPasswordExpiry(48);
          const loginId = user.role === 'teacher' 
            ? (user.employeeId || generateLoginId('teacher'))
            : user.role === 'student'
            ? (user.admissionNumber || generateLoginId('student'))
            : generateLoginId('parent', user.admissionNumber);

          return {
            userId: user.id,
            success: true as const,
            data: {
              temporaryPassword: hashedPassword,
              temporaryPasswordPlainText: tempPassword,
              temporaryPasswordExpiresAt: expiresAt,
              isFirstLogin: true
            },
            loginId,
            tempPassword,
            expiresAt
          };
        } catch (error) {
          return {
            userId: user.id,
            success: false as const,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    );

    // Step 2: Bulk update database (all at once per batch)
    const updatePromises = preparedData.map(async (item) => {
      if (item.success) {
        try {
          await updateUserFn(item.userId, item.data);
          return { ...item, dbSuccess: true };
        } catch (error) {
          return {
            userId: item.userId,
            success: false as const,
            error: error instanceof Error ? error.message : 'Database update failed'
          };
        }
      }
      return item;
    });

    const batchResults = await Promise.all(updatePromises);

    // Step 3: Collect results and report progress
    for (const item of batchResults) {
      if (item.success) {
        results.generated++;
        results.results.push({
          userId: item.userId,
          success: true,
          loginId: item.loginId!,
          temporaryPassword: item.tempPassword!,
          expiresAt: item.expiresAt!
        });
      } else {
        results.failed++;
        results.results.push({
          userId: item.userId,
          success: false,
          error: item.error
        });
      }
      
      // Report progress after each user
      if (progressCallback) {
        const currentCount = batchStart + batchResults.indexOf(item) + 1;
        progressCallback(currentCount, users.length);
      }
    }
  }

  return results;
}
