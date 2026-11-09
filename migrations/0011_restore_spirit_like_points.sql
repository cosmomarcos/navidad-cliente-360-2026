-- Recupera puntos por likes desde los votos que siguen almacenados.
-- Se otorga 1 punto por cada like recibido, con un máximo de 10 por publicación.
-- INSERT OR IGNORE hace que la reparación sea segura si ya existen puntos de likes.
WITH ranked_votes AS (
  SELECT
    v.id AS vote_id,
    s.edition_id,
    s.user_id,
    v.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY s.id
      ORDER BY v.created_at, v.id
    ) AS like_number
  FROM spirit_votes v
  JOIN spirit_submissions s ON s.id = v.submission_id
)
INSERT OR IGNORE INTO spirit_points
  (id, edition_id, user_id, source_type, source_id, points, description, created_at)
SELECT
  lower(hex(randomblob(16))),
  edition_id,
  user_id,
  'like',
  vote_id,
  1,
  'Me gusta recibido',
  created_at
FROM ranked_votes
WHERE like_number <= 10;
