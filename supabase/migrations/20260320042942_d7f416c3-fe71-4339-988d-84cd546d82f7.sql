
-- Add broker_type and broker_config to bank_mq_channels for Kafka/RabbitMQ support
ALTER TABLE public.bank_mq_channels
  ADD COLUMN IF NOT EXISTS broker_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS broker_config_encrypted jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS broker_topic text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS broker_queue text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consumer_group text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_guarantee text DEFAULT 'at_least_once';

-- Add comment for documentation
COMMENT ON COLUMN public.bank_mq_channels.broker_type IS 'kafka | rabbitmq | null (for realtime/webhook)';
COMMENT ON COLUMN public.bank_mq_channels.broker_config_encrypted IS 'Encrypted broker connection config: host, port, auth, tls settings';
COMMENT ON COLUMN public.bank_mq_channels.broker_topic IS 'Kafka topic name';
COMMENT ON COLUMN public.bank_mq_channels.broker_queue IS 'RabbitMQ queue/exchange name';
COMMENT ON COLUMN public.bank_mq_channels.consumer_group IS 'Kafka consumer group ID';
COMMENT ON COLUMN public.bank_mq_channels.delivery_guarantee IS 'at_least_once | at_most_once | exactly_once';

-- Create broker_delivery_log for tracking broker message delivery attempts
CREATE TABLE IF NOT EXISTS public.broker_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.bank_mq_messages(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.bank_mq_channels(id) ON DELETE CASCADE,
  broker_type text NOT NULL,
  broker_endpoint text NOT NULL,
  topic_or_queue text,
  request_payload jsonb,
  response_status integer,
  response_body text,
  latency_ms integer,
  success boolean DEFAULT false,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.broker_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on broker_delivery_log"
  ON public.broker_delivery_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_broker_delivery_log_message ON public.broker_delivery_log(message_id);
CREATE INDEX IF NOT EXISTS idx_broker_delivery_log_channel ON public.broker_delivery_log(channel_id);
CREATE INDEX IF NOT EXISTS idx_bank_mq_channels_broker_type ON public.bank_mq_channels(broker_type) WHERE broker_type IS NOT NULL;
