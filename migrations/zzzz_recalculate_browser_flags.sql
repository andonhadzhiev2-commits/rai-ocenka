-- Reclassify existing browser-marked reviews using the same two sliding windows.
-- Historical customer reviews stay intact; only private warning flags change.
WITH counts AS (
  SELECT id,
    count(*) OVER (
      PARTITION BY browser_hash ORDER BY created_at
      RANGE BETWEEN INTERVAL '10 hours' PRECEDING AND CURRENT ROW
    ) AS n10,
    count(*) OVER (
      PARTITION BY browser_hash ORDER BY created_at
      RANGE BETWEEN INTERVAL '48 hours' PRECEDING AND CURRENT ROW
    ) AS n48
  FROM reviews WHERE browser_hash IS NOT NULL
), flags AS (
  SELECT id, (n10 >= 2 OR n48 >= 3) AS suspicious,
    CASE WHEN n10 >= 2 AND n48 >= 3
      THEN n10 || ' оценки от един браузър за 10 часа; ' || n48 || ' оценки от един браузър за 48 часа'
      WHEN n10 >= 2 THEN n10 || ' оценки от един браузър за 10 часа'
      WHEN n48 >= 3 THEN n48 || ' оценки от един браузър за 48 часа'
      ELSE NULL END AS reason
  FROM counts
)
UPDATE reviews r SET suspected_repeat=f.suspicious, suspicion_reason=f.reason
FROM flags f WHERE r.id=f.id;
