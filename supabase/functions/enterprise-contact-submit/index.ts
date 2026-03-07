import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import { corsHeaders } from "../_shared/cors.ts";

// Validation schema
const enterpriseLeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  company_name: z.string().trim().min(2).max(200),
  company_size: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']),
  phone: z.string().trim().optional(),
  inquiry_type: z.enum([
    'Enterprise API Integration',
    'Strategic Partnership',
    'White-Label Solution',
    'Custom Development',
    'Technical Support',
    'General Inquiry'
  ]),
  integration_timeline: z.enum(['Immediate', '1-3 months', '3-6 months', '6-12 months', 'Exploring']),
  transaction_volume: z.enum(['< 1K/month', '1K-10K', '10K-100K', '100K+']),
  use_cases: z.array(z.string()).min(1),
  current_systems: z.string().trim().max(500).optional(),
  requirements: z.string().trim().min(10).max(2000),
  preferred_contact: z.enum(['Email', 'Phone', 'Video Call']),
  budget_range: z.enum(['Confidential', '<$5K', '$5K-$20K', '$20K-$100K', '$100K+', 'Not specified']).optional(),
  source_page: z.string().optional(),
});

// Calculate priority based on company size and transaction volume
function calculatePriority(companySize: string, transactionVolume: string, inquiryType: string): string {
  const highPriorityInquiries = ['Enterprise API Integration', 'Strategic Partnership', 'White-Label Solution'];
  const highVolume = ['10K-100K', '100K+'];
  const largeCompany = ['201-1000', '1000+'];

  if (highPriorityInquiries.includes(inquiryType)) {
    if (highVolume.includes(transactionVolume) || largeCompany.includes(companySize)) {
      return 'high';
    }
  }

  if (highVolume.includes(transactionVolume) || largeCompany.includes(companySize)) {
    return 'medium';
  }

  return 'low';
}

// Hash IP address for privacy
async function hashIpAddress(ipAddress: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ipAddress);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing enterprise contact submission...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse and validate request
    const body = await req.json();
    const validatedData = enterpriseLeadSchema.parse(body);

    // Extract metadata
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const ipHash = ipAddress !== 'unknown' ? await hashIpAddress(ipAddress) : null;

    // Calculate priority
    const priority = calculatePriority(
      validatedData.company_size,
      validatedData.transaction_volume,
      validatedData.inquiry_type
    );

    console.log(`Lead priority: ${priority}`);

    // Insert lead into database
    const { data: lead, error: insertError } = await supabase
      .from('enterprise_leads')
      .insert({
        ...validatedData,
        priority,
        ip_address_hash: ipHash,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting lead:', insertError);
      throw insertError;
    }

    console.log('Lead created successfully:', lead.id);

    // Send notification to sales team
    const salesNotification = {
      to: 'sales@kangopen.com',
      subject: `🔥 New ${priority.toUpperCase()} Priority Lead: ${validatedData.company_name}`,
      body: `
        <h2>New Enterprise Lead Received</h2>
        <p><strong>Priority:</strong> <span style="color: ${priority === 'high' ? 'red' : priority === 'medium' ? 'orange' : 'green'};">${priority.toUpperCase()}</span></p>
        
        <h3>Contact Information</h3>
        <ul>
          <li><strong>Name:</strong> ${validatedData.name}</li>
          <li><strong>Email:</strong> ${validatedData.email}</li>
          <li><strong>Phone:</strong> ${validatedData.phone || 'Not provided'}</li>
          <li><strong>Company:</strong> ${validatedData.company_name}</li>
          <li><strong>Company Size:</strong> ${validatedData.company_size}</li>
        </ul>
        
        <h3>Lead Details</h3>
        <ul>
          <li><strong>Inquiry Type:</strong> ${validatedData.inquiry_type}</li>
          <li><strong>Timeline:</strong> ${validatedData.integration_timeline}</li>
          <li><strong>Transaction Volume:</strong> ${validatedData.transaction_volume}</li>
          <li><strong>Budget Range:</strong> ${validatedData.budget_range || 'Not specified'}</li>
          <li><strong>Preferred Contact:</strong> ${validatedData.preferred_contact}</li>
        </ul>
        
        <h3>Use Cases</h3>
        <ul>
          ${validatedData.use_cases.map(uc => `<li>${uc}</li>`).join('')}
        </ul>
        
        <h3>Requirements</h3>
        <p>${validatedData.requirements}</p>
        
        ${validatedData.current_systems ? `<h3>Current Systems</h3><p>${validatedData.current_systems}</p>` : ''}
        
        <p><strong>Lead ID:</strong> ${lead.id}</p>
        <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
      `,
      metadata: {
        lead_id: lead.id,
        priority,
        inquiry_type: validatedData.inquiry_type,
      }
    };

    try {
      await supabase.functions.invoke('send-communication', {
        body: salesNotification
      });
      console.log('Sales notification sent');
    } catch (notifError) {
      console.error('Error sending sales notification:', notifError);
      // Don't fail the request if notification fails
    }

    // Send auto-reply to customer
    const expectedResponseTime = priority === 'high' ? '4 hours' : priority === 'medium' ? '12 hours' : '24 hours';
    
    const autoReply = {
      to: validatedData.email,
      subject: 'Thank you for contacting Kang Open Banking',
      body: `
        <h2>Thank you for reaching out, ${validatedData.name}!</h2>
        
        <p>We've received your inquiry about <strong>${validatedData.inquiry_type}</strong> for ${validatedData.company_name}.</p>
        
        <p>Our team will review your request and get back to you within <strong>${expectedResponseTime}</strong>.</p>
        
        <h3>What happens next?</h3>
        <ol>
          <li>Our team will review your requirements</li>
          <li>We'll prepare a tailored solution proposal</li>
          <li>We'll reach out via ${validatedData.preferred_contact.toLowerCase()} to discuss next steps</li>
        </ol>
        
        <p>In the meantime, you might find these resources helpful:</p>
        <ul>
          <li><a href="${Deno.env.get('VITE_SUPABASE_URL')}/developer">API Documentation</a></li>
          <li><a href="${Deno.env.get('VITE_SUPABASE_URL')}/pricing">Pricing Information</a></li>
          <li><a href="${Deno.env.get('VITE_SUPABASE_URL')}/developer/playground">API Playground</a></li>
        </ul>
        
        <p>If you have any urgent questions, please don't hesitate to contact us directly.</p>
        
        <p>Best regards,<br>Kang Open Banking Team</p>
        
        <p style="color: #666; font-size: 12px;">Reference ID: ${lead.id}</p>
      `,
      metadata: {
        lead_id: lead.id,
        auto_reply: true,
      }
    };

    try {
      await supabase.functions.invoke('send-communication', {
        body: autoReply
      });
      console.log('Auto-reply sent to customer');
    } catch (replyError) {
      console.error('Error sending auto-reply:', replyError);
      // Don't fail the request if auto-reply fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        priority,
        expected_response_time: expectedResponseTime,
        message: 'Thank you for contacting us! We will get back to you soon.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error processing enterprise contact:', error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid input',
          details: error.errors
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process contact submission'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});