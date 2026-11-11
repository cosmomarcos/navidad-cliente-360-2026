-- Reprograma los retos abiertos o futuros para el nuevo horario de Espíritu Navideño.
-- Los valores almacenados están en UTC; Perú es UTC-5.
UPDATE spirit_challenges
SET starts_at = date(starts_at, '-5 hours') || ' 23:00:00',
    ends_at = date(starts_at, '-5 hours', '+1 day') || ' 05:00:00'
WHERE ends_at > datetime('now');
