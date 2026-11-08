-- Nuevo sistema de puntuación: solo likes y bonificación al ganador diario.
-- Los puntos antiguos por publicar y la bonificación fija por tres votos dejan de ser válidos.
DELETE FROM spirit_points WHERE source_type IN ('submission','community_bonus');
