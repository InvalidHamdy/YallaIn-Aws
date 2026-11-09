-- Catalog data shown on WR8 (Pick favorites). Safe to run more than once:
-- fixed ids + upsert, so saved favorites keep pointing at the same rows.

INSERT INTO clubs (id, code, name, sort_order) VALUES
  (1,  'AHL', 'Al Ahly',    1),
  (2,  'ZAM', 'Zamalek',    2),
  (3,  'PYR', 'Pyramids',   3),
  (4,  'MAS', 'Al Masry',   4),
  (5,  'ISM', 'Ismaily',    5),
  (6,  'ENP', 'ENPPI',      6),
  (7,  'SMH', 'Smouha',     7),
  (8,  'EGY', 'Egypt NT',   8),
  (9,  'ITT', 'Ittihad',    9),
  (10, 'FTC', 'Future FC', 10)
ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), sort_order = VALUES(sort_order);

INSERT INTO artists (id, name, photo_key, sort_order) VALUES
  (1, 'Amr Diab',     'artists/stage-1.jpg', 1),
  (2, 'Cairokee',     'artists/stage-2.jpg', 2),
  (3, 'Wegz',         'artists/stage-3.jpg', 3),
  (4, 'Tamer Ashour', 'artists/stage-4.jpg', 4),
  (5, 'Marwan Pablo', 'artists/stage-5.jpg', 5)
ON DUPLICATE KEY UPDATE name = VALUES(name), photo_key = VALUES(photo_key), sort_order = VALUES(sort_order);
