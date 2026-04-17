import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export interface RoleValidationResult {
  valid: boolean;
  userId?: string;
  roles?: string[];
  institutionId?: string;
  error?: string;
}

/**
 * Role-based middleware for edge functions
 * Validates user authentication and checks for required roles
 */
export async function validateUserRole(
  req: Request,
  requiredRoles: string[] = []
): Promise<RoleValidationResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Extract authorization header
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { valid: false, error: 'Missing authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');

  // Validate the user token
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    // F36 — Never log raw token, header value, or full error body. Only the
    // error name + status are safe to emit to function logs.
    console.error('Auth error:', authError?.name || 'unknown', authError?.status ?? '');
    return { valid: false, error: 'Invalid or expired token' };
  }

  // Get user roles
  const { data: userRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (rolesError) {
    console.error('Roles fetch error:', rolesError);
    return { valid: false, error: 'Failed to fetch user roles' };
  }

  const roles = userRoles?.map(r => r.role) || [];

  // If no specific roles required, just verify authentication
  if (requiredRoles.length === 0) {
    return { valid: true, userId: user.id, roles };
  }

  // Check if user has at least one of the required roles
  const hasRequiredRole = requiredRoles.some(role => roles.includes(role));

  if (!hasRequiredRole) {
    console.log(`User ${user.id} lacks required roles. Has: ${roles.join(', ')}, Needs: ${requiredRoles.join(' or ')}`);
    return { 
      valid: false, 
      userId: user.id, 
      roles, 
      error: `Insufficient permissions. Required role: ${requiredRoles.join(' or ')}` 
    };
  }

  // For institution role, also fetch institution ID
  let institutionId: string | undefined;
  if (roles.includes('institution')) {
    const { data: institution } = await supabase
      .from('institutions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    institutionId = institution?.id;
  }

  return { 
    valid: true, 
    userId: user.id, 
    roles,
    institutionId
  };
}

/**
 * Check if user has specific permission
 */
export async function checkPermission(
  userId: string,
  scope: string,
  action: string
): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .rpc('has_permission', { _user_id: userId, _scope: scope, _action: action });

  if (error) {
    console.error('Permission check error:', error);
    return false;
  }

  return data === true;
}

/**
 * Log API access for audit trail
 */
export async function logApiAccess(
  userId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  institutionId?: string
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    await supabase.from('api_usage_metrics').insert({
      client_id: userId,
      endpoint,
      method,
      status_code: statusCode,
      institution_id: institutionId,
    });
  } catch (error) {
    console.error('Failed to log API access:', error);
  }
}

/**
 * Create standardized error response
 */
export function errorResponse(
  corsHeaders: Record<string, string>,
  statusCode: number,
  error: string,
  details?: string
): Response {
  return new Response(
    JSON.stringify({ 
      error, 
      details,
      timestamp: new Date().toISOString()
    }),
    { 
      status: statusCode, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Validate institution access
 * Checks if user belongs to the specified institution
 */
export async function validateInstitutionAccess(
  userId: string,
  institutionId: string
): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('institutions')
    .select('id')
    .eq('id', institutionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Institution access check error:', error);
    return false;
  }

  return !!data;
}

/**
 * Rate limiting check
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await supabase
    .from('api_usage_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', identifier)
    .gte('created_at', windowStart);

  if (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request but log the issue
    return { allowed: true, remaining: maxRequests };
  }

  const currentCount = count || 0;
  const remaining = Math.max(0, maxRequests - currentCount);

  return {
    allowed: currentCount < maxRequests,
    remaining
  };
}
