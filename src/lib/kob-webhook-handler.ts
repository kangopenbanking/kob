/**
 * KOB Webhook Event Handler — Client-side event bus
 * 
 * Uses Supabase Realtime as transport to receive webhook events
 * that have been verified server-side and stored in webhook_inbox.
 * 
 * Provides deduplication by event ID (max 1000 entries) and
 * dispatches events to registered handler functions.
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface WebhookEventPayload {
  id: string;
  event: string;
  created_at: string;
  api_version?: string;
  livemode?: boolean;
  data: Record<string, unknown>;
}

type EventHandler = (payload: WebhookEventPayload) => void;

const MAX_DEDUP_SIZE = 1000;

class KOBWebhookHandler {
  private handlers = new Map<string, Set<EventHandler>>();
  private wildcardHandlers = new Set<EventHandler>();
  private processedIds = new Set<string>();
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;

  /**
   * Subscribe to webhook events for a specific user/entity
   */
  subscribe(entityId: string, entityType: 'user' | 'merchant' | 'institution' = 'user') {
    if (this.channel) this.unsubscribe();
    this.userId = entityId;

    this.channel = supabase
      .channel(`kob-webhooks-${entityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_deliveries',
          filter: `webhook_id=eq.${entityId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.event_data) {
            this.dispatch(row.event_data as WebhookEventPayload);
          }
        }
      )
      .subscribe();
  }

  /**
   * Unsubscribe from all webhook events
   */
  unsubscribe() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.userId = null;
  }

  /**
   * Register a handler for a specific event type
   * Supports wildcards: "charge.*" matches "charge.created", "charge.failed", etc.
   */
  on(event: string, handler: EventHandler): () => void {
    if (event === '*' || event === 'wildcard.*') {
      this.wildcardHandlers.add(handler);
      return () => this.wildcardHandlers.delete(handler);
    }

    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  /**
   * Manually dispatch an event (used for testing or direct injection)
   */
  dispatch(payload: WebhookEventPayload) {
    // Deduplication
    if (this.processedIds.has(payload.id)) return;

    this.processedIds.add(payload.id);
    if (this.processedIds.size > MAX_DEDUP_SIZE) {
      const iterator = this.processedIds.values();
      for (let i = 0; i < 100; i++) {
        const val = iterator.next().value;
        if (val) this.processedIds.delete(val);
      }
    }

    // Exact match handlers
    const exactHandlers = this.handlers.get(payload.event);
    if (exactHandlers) {
      exactHandlers.forEach(handler => {
        try { handler(payload); } catch (err) { console.error('[KOB Webhook] Handler error:', err); }
      });
    }

    // Wildcard handlers (e.g., "charge.*" matches "charge.created")
    const [prefix] = payload.event.split('.');
    const wildcardKey = `${prefix}.*`;
    const wildcardHandlers = this.handlers.get(wildcardKey);
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try { handler(payload); } catch (err) { console.error('[KOB Webhook] Handler error:', err); }
      });
    }

    // Global wildcard handlers
    this.wildcardHandlers.forEach(handler => {
      try { handler(payload); } catch (err) { console.error('[KOB Webhook] Handler error:', err); }
    });
  }

  /**
   * Clear all handlers and deduplication state
   */
  reset() {
    this.handlers.clear();
    this.wildcardHandlers.clear();
    this.processedIds.clear();
    this.unsubscribe();
  }
}

// Singleton instance
export const webhookHandler = new KOBWebhookHandler();
