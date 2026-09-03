-- Booking indexes for therapist selection and appointment scheduling.
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_therapist_schedule
  ON therapy_sessions (therapist_id, scheduled_start_time, scheduled_end_time)
  WHERE status IN ('scheduled','in_progress');
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_client_schedule
  ON therapy_sessions (client_id, scheduled_start_time DESC);
CREATE INDEX IF NOT EXISTS idx_therapist_availability_lookup
  ON therapist_availability (therapist_id, day_of_week, start_time)
  WHERE is_available = TRUE;
