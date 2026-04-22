// Step-by-step validation for the Live Support "Start chat" form.
import { z } from 'zod';

export const supportStartChatSchema = z.object({
  departmentId: z
    .string({ required_error: 'Please choose a department.' })
    .uuid('Please choose a department.'),
  subject: z
    .string()
    .trim()
    .min(3, 'Briefly describe your issue (at least 3 characters).')
    .max(200, 'Subject must be under 200 characters.'),
  guestName: z
    .string()
    .trim()
    .max(80, 'Name must be under 80 characters.')
    .optional()
    .or(z.literal('')),
  guestEmail: z
    .string()
    .trim()
    .email('Please enter a valid email address.')
    .max(200, 'Email must be under 200 characters.')
    .optional()
    .or(z.literal('')),
});

export type SupportStartChatInput = z.infer<typeof supportStartChatSchema>;

export type FieldErrors = Partial<Record<'departmentId' | 'subject' | 'guestName' | 'guestEmail', string>>;

export function validateStartChat(input: {
  departmentId?: string;
  subject: string;
  guestName?: string;
  guestEmail?: string;
}): { ok: boolean; errors: FieldErrors } {
  const result = supportStartChatSchema.safeParse({
    departmentId: input.departmentId,
    subject: input.subject,
    guestName: input.guestName ?? '',
    guestEmail: input.guestEmail ?? '',
  });
  if (result.success) return { ok: true, errors: {} };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof FieldErrors;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

/**
 * Extract the most descriptive message possible from a Supabase / Postgres / network error.
 * Used by the toast to surface RLS / constraint / status details directly to the developer-user.
 */
export function describeBackendError(e: any): { message: string; code?: string; details?: string } {
  if (!e) return { message: 'Unknown error' };
  if (typeof e === 'string') return { message: e };

  const code = e.code || e.status || e.statusCode;
  const parts: string[] = [];
  if (e.message) parts.push(e.message);
  if (e.details) parts.push(e.details);
  if (e.hint) parts.push(`Hint: ${e.hint}`);
  if (code) parts.push(`(code ${code})`);

  return {
    message: parts.length ? parts.join(' — ') : 'Could not reach support backend.',
    code: code ? String(code) : undefined,
    details: e.details,
  };
}
