-- F39: Atomic seat reservation to prevent travel trip overselling
CREATE OR REPLACE FUNCTION public.travel_reserve_seats(
  _trip_id uuid,
  _seats text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trip RECORD;
  v_taken_seats text[];
  v_conflicts text[];
  v_seat_count int;
BEGIN
  IF _seats IS NULL OR array_length(_seats, 1) IS NULL OR array_length(_seats, 1) = 0 THEN
    RAISE EXCEPTION 'seats array must not be empty';
  END IF;

  v_seat_count := array_length(_seats, 1);

  -- Lock the trip row to serialize concurrent bookings
  SELECT id, available_seats, currency, price
  INTO v_trip
  FROM public.travel_trips
  WHERE id = _trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trip_not_found';
  END IF;

  IF v_trip.available_seats < v_seat_count THEN
    RAISE EXCEPTION 'insufficient_seats: % available, % requested', v_trip.available_seats, v_seat_count;
  END IF;

  -- Detect already-booked seats on this trip (under the lock)
  SELECT COALESCE(array_agg(t.seat_label), ARRAY[]::text[])
  INTO v_taken_seats
  FROM public.travel_tickets t
  JOIN public.travel_bookings b ON b.id = t.booking_id
  WHERE b.trip_id = _trip_id
    AND b.booking_status = 'confirmed'
    AND t.ticket_status IN ('valid', 'used');

  -- Find conflicting seats
  SELECT COALESCE(array_agg(s), ARRAY[]::text[])
  INTO v_conflicts
  FROM unnest(_seats) s
  WHERE s = ANY(v_taken_seats);

  IF array_length(v_conflicts, 1) > 0 THEN
    RAISE EXCEPTION 'seat_conflict: %', array_to_string(v_conflicts, ',');
  END IF;

  -- Atomically decrement available seats
  UPDATE public.travel_trips
  SET available_seats = available_seats - v_seat_count,
      updated_at = now()
  WHERE id = _trip_id;

  RETURN jsonb_build_object(
    'success', true,
    'trip_id', _trip_id,
    'reserved_count', v_seat_count,
    'remaining_seats', v_trip.available_seats - v_seat_count,
    'price', v_trip.price,
    'currency', v_trip.currency
  );
END;
$$;