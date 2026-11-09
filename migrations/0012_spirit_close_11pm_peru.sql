-- Extiende los retos ya programados que cerraban a las 10:00 p. m.
-- Los nuevos y existentes retos cierran a las 11:00 p. m. hora Perú (04:00 UTC).
UPDATE spirit_challenges
SET ends_at = datetime(ends_at, '+1 hour')
WHERE ends_at = datetime(starts_at, '+13 hours');
