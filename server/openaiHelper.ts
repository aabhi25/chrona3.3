import OpenAI from 'openai';
import { db } from './db';
import { schools } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { decryptApiKey, logApiKeyUsage, sanitizeErrorMessage } from './encryption';

/**
 * Get OpenAI instance for a specific school
 * Uses school's API key if configured, falls back to global key
 */
export async function getOpenAIForSchool(schoolId: string): Promise<OpenAI | null> {
  try {
    // Fetch school's OpenAI API key (encrypted)
    const [school] = await db
      .select({ openaiApiKey: schools.openaiApiKey })
      .from(schools)
      .where(eq(schools.id, schoolId))
      .limit(1);
    
    // Use school-specific key if available
    if (school?.openaiApiKey) {
      try {
        const decryptedKey = decryptApiKey(school.openaiApiKey);
        console.log(`✅ Using school-specific OpenAI API key for school: ${schoolId.slice(0, 8)}...`);
        logApiKeyUsage(schoolId, 'GET_OPENAI_CLIENT', 'school', true, 'Successfully retrieved school-specific OpenAI client');
        return new OpenAI({ apiKey: decryptedKey });
      } catch (error) {
        console.error('Error decrypting school OpenAI API key:', sanitizeErrorMessage(error as Error));
        logApiKeyUsage(schoolId, 'GET_OPENAI_CLIENT', 'school', false, 'Failed to decrypt school API key');
        // Fall through to global key
      }
    }
    
    // Fall back to global API key
    const globalApiKey = process.env.OPENAI_API_KEY;
    if (globalApiKey) {
      console.log(`⚠️  No school-specific OpenAI key found, using global key for school: ${schoolId.slice(0, 8)}...`);
      logApiKeyUsage(schoolId, 'GET_OPENAI_CLIENT', 'global', true, 'Using global API key as fallback');
      return new OpenAI({ apiKey: globalApiKey });
    }
    
    console.log(`❌ No OpenAI API key available for school: ${schoolId.slice(0, 8)}...`);
    logApiKeyUsage(schoolId, 'GET_OPENAI_CLIENT', 'global', false, 'No API key available (school or global)');
    return null;
  } catch (error) {
    console.error('Error getting OpenAI instance for school:', sanitizeErrorMessage(error as Error));
    logApiKeyUsage(schoolId, 'GET_OPENAI_CLIENT', 'global', false, `Error: ${sanitizeErrorMessage(error as Error)}`);
    return null;
  }
}

/**
 * Check if OpenAI is available for a specific school
 */
export async function hasOpenAIAccess(schoolId: string): Promise<boolean> {
  try {
    const [school] = await db
      .select({ openaiApiKey: schools.openaiApiKey })
      .from(schools)
      .where(eq(schools.id, schoolId))
      .limit(1);
    
    return !!(school?.openaiApiKey || process.env.OPENAI_API_KEY);
  } catch (error) {
    console.error('Error checking OpenAI access:', error);
    return false;
  }
}
