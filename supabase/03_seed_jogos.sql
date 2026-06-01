-- ============================================================
-- Seed: FIFA World Cup 2026 group stage matches (48 jogos)
-- All times in BRT (UTC-3)
-- Stadiums: USA, Canada, Mexico
-- ============================================================

-- GRUPO A: México, Canadá, Equador, Colômbia
INSERT INTO public.jogos_copa (fase, grupo, rodada, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, estadio, cidade) VALUES
  ('grupos','A',1,'2026-06-11','21:00','México','Equador','mx','ec','Estadio Azteca','Cidade do México'),
  ('grupos','A',1,'2026-06-12','18:00','Canadá','Colômbia','ca','co','BC Place','Vancouver'),
  ('grupos','A',2,'2026-06-16','18:00','Equador','Colômbia','ec','co','SoFi Stadium','Los Angeles'),
  ('grupos','A',2,'2026-06-16','21:00','México','Canadá','mx','ca','Estadio Azteca','Cidade do México'),
  ('grupos','A',3,'2026-06-20','18:00','Equador','Canadá','ec','ca','Arrowhead Stadium','Kansas City'),
  ('grupos','A',3,'2026-06-20','18:00','México','Colômbia','mx','co','AT&T Stadium','Dallas');

-- GRUPO B: Brasil, Argentina, Paraguai, Venezuela
INSERT INTO public.jogos_copa (fase, grupo, rodada, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, estadio, cidade) VALUES
  ('grupos','B',1,'2026-06-12','21:00','Brasil','Paraguai','br','py','MetLife Stadium','Nova York'),
  ('grupos','B',1,'2026-06-13','00:00','Argentina','Venezuela','ar','ve','Rose Bowl','Los Angeles'),
  ('grupos','B',2,'2026-06-17','18:00','Paraguai','Venezuela','py','ve','Levi''s Stadium','San Francisco'),
  ('grupos','B',2,'2026-06-17','21:00','Brasil','Argentina','br','ar','MetLife Stadium','Nova York'),
  ('grupos','B',3,'2026-06-21','18:00','Paraguai','Argentina','py','ar','Gillette Stadium','Boston'),
  ('grupos','B',3,'2026-06-21','18:00','Brasil','Venezuela','br','ve','Hard Rock Stadium','Miami');

-- GRUPO C: Espanha, Portugal, Turquia, Geórgia
INSERT INTO public.jogos_copa (fase, grupo, rodada, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, estadio, cidade) VALUES
  ('grupos','C',1,'2026-06-13','15:00','Espanha','Geórgia','es','ge','SoFi Stadium','Los Angeles'),
  ('grupos','C',1,'2026-06-13','18:00','Portugal','Turquia','pt','tr','Arrowhead Stadium','Kansas City'),
  ('grupos','C',2,'2026-06-17','15:00','Geórgia','Turquia','ge','tr','AT&T Stadium','Dallas'),
  ('grupos','C',2,'2026-06-17','18:00','Espanha','Portugal','es','pt','Hard Rock Stadium','Miami'),
  ('grupos','C',3,'2026-06-22','18:00','Geórgia','Portugal','ge','pt','BC Place','Vancouver'),
  ('grupos','C',3,'2026-06-22','18:00','Espanha','Turquia','es','tr','Rose Bowl','Los Angeles');

-- GRUPO D: Alemanha, França, Bélgica, Suíça
INSERT INTO public.jogos_copa (fase, grupo, rodada, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, estadio, cidade) VALUES
  ('grupos','D',1,'2026-06-14','18:00','Alemanha','Suíça','de','ch','Levi''s Stadium','San Francisco'),
  ('grupos','D',1,'2026-06-14','21:00','França','Bélgica','fr','be','MetLife Stadium','Nova York'),
  ('grupos','D',2,'2026-06-18','18:00','Suíça','Bélgica','ch','be','Gillette Stadium','Boston'),
  ('grupos','D',2,'2026-06-18','21:00','Alemanha','França','de','fr','AT&T Stadium','Dallas'),
  ('grupos','D',3,'2026-06-22','22:00','Suíça','França','ch','fr','Arrowhead Stadium','Kansas City'),
  ('grupos','D',3,'2026-06-22','22:00','Alemanha','Bélgica','de','be','SoFi Stadium','Los Angeles');

-- GRUPO E: Inglaterra, Holanda, Dinamarca, Sérvia
INSERT INTO public.jogos_copa (fase, grupo, rodada, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, estadio, cidade) VALUES
  ('grupos','E',1,'2026-06-14','15:00','Inglaterra','Sérvia','gb-eng','rs','Hard Rock Stadium','Miami'),
  ('grupos','E',1,'2026-06-14','18:00','Holanda','Dinamarca','nl','dk','Rose Bowl','Los Angeles'),
  ('grupos','E',2,'2026-06-18','15:00','Sérvia','Dinamarca','rs','dk','BC Place','Vancouver'),
  ('grupos','E',2,'2026-06-18','18:00','Inglaterra','Holanda','gb-eng','nl','MetLife Stadium','Nova York'),
  ('grupos','E',3,'2026-06-23','18:00','Sérvia','Holanda','rs','nl','Levi''s Stadium','San Francisco'),
  ('grupos','E',3,'2026-06-23','18:00','Inglaterra','Dinamarca','gb-eng','dk','Gillette Stadium','Boston');

-- GRUPO F: EUA, Uruguai, Chile, Bolívia
INSERT INTO public.jogos_copa (fase, grupo, rodada, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, estadio, cidade) VALUES
  ('grupos','F',1,'2026-06-15','18:00','EUA','Bolívia','us','bo','SoFi Stadium','Los Angeles'),
  ('grupos','F',1,'2026-06-15','21:00','Uruguai','Chile','uy','cl','Arrowhead Stadium','Kansas City'),
  ('grupos','F',2,'2026-06-19','18:00','Bolívia','Chile','bo','cl','Rose Bowl','Los Angeles'),
  ('grupos','F',2,'2026-06-19','21:00','EUA','Uruguai','us','uy','AT&T Stadium','Dallas'),
  ('grupos','F',3,'2026-06-23','22:00','Bolívia','Uruguai','bo','uy','Hard Rock Stadium','Miami'),
  ('grupos','F',3,'2026-06-23','22:00','EUA','Chile','us','cl','MetLife Stadium','Nova York');

-- GRUPO G: Itália, Croácia, Eslováquia, Romênia
INSERT INTO public.jogos_copa (fase, grupo, rodada, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, estadio, cidade) VALUES
  ('grupos','G',1,'2026-06-15','15:00','Itália','Eslováquia','it','sk','BC Place','Vancouver'),
  ('grupos','G',1,'2026-06-15','18:00','Croácia','Romênia','hr','ro','Gillette Stadium','Boston'),
  ('grupos','G',2,'2026-06-19','15:00','Eslováquia','Romênia','sk','ro','Levi''s Stadium','San Francisco'),
  ('grupos','G',2,'2026-06-19','18:00','Itália','Croácia','it','hr','SoFi Stadium','Los Angeles'),
  ('grupos','G',3,'2026-06-24','18:00','Eslováquia','Croácia','sk','hr','Arrowhead Stadium','Kansas City'),
  ('grupos','G',3,'2026-06-24','18:00','Itália','Romênia','it','ro','AT&T Stadium','Dallas');

-- GRUPO H: Japão, Coreia do Sul, Austrália, Indonésia
INSERT INTO public.jogos_copa (fase, grupo, rodada, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, estadio, cidade) VALUES
  ('grupos','H',1,'2026-06-16','15:00','Japão','Indonésia','jp','id','Rose Bowl','Los Angeles'),
  ('grupos','H',1,'2026-06-16','18:00','Coreia do Sul','Austrália','kr','au','Hard Rock Stadium','Miami'),
  ('grupos','H',2,'2026-06-20','15:00','Indonésia','Austrália','id','au','MetLife Stadium','Nova York'),
  ('grupos','H',2,'2026-06-20','18:00','Japão','Coreia do Sul','jp','kr','BC Place','Vancouver'),
  ('grupos','H',3,'2026-06-24','22:00','Indonésia','Coreia do Sul','id','kr','Gillette Stadium','Boston'),
  ('grupos','H',3,'2026-06-24','22:00','Japão','Austrália','jp','au','Levi''s Stadium','San Francisco');

-- GRUPO I: Marrocos, Senegal, África do Sul, Benin
INSERT INTO public.jogos_copa (fase, grupo, rodada, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, estadio, cidade) VALUES
  ('grupos','I',1,'2026-06-16','21:00','Marrocos','Benin','ma','bj','Estadio Azteca','Cidade do México'),
  ('grupos','I',1,'2026-06-17','00:00','Senegal','África do Sul','sn','za','Estadio Akron','Guadalajara'),
  ('grupos','I',2,'2026-06-20','21:00','Benin','África do Sul','bj','za','Estadio BBVA','Monterrey'),
  ('grupos','I',2,'2026-06-21','00:00','Marrocos','Senegal','ma','sn','Estadio Azteca','Cidade do México'),
  ('grupos','I',3,'2026-06-25','18:00','Benin','Senegal','bj','sn','Estadio Akron','Guadalajara'),
  ('grupos','I',3,'2026-06-25','18:00','Marrocos','África do Sul','ma','za','Estadio BBVA','Monterrey');

-- GRUPO J: Egito, Argélia, Costa do Marfim, Tanzânia
INSERT INTO public.jogos_copa (fase, grupo, rodada, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, estadio, cidade) VALUES
  ('grupos','J',1,'2026-06-18','21:00','Egito','Tanzânia','eg','tz','Estadio Akron','Guadalajara'),
  ('grupos','J',1,'2026-06-19','00:00','Argélia','Costa do Marfim','dz','ci','Estadio BBVA','Monterrey'),
  ('grupos','J',2,'2026-06-22','21:00','Tanzânia','Costa do Marfim','tz','ci','Estadio Azteca','Cidade do México'),
  ('grupos','J',2,'2026-06-23','00:00','Egito','Argélia','eg','dz','Estadio BBVA','Monterrey'),
  ('grupos','J',3,'2026-06-26','18:00','Tanzânia','Argélia','tz','dz','Estadio Akron','Guadalajara'),
  ('grupos','J',3,'2026-06-26','18:00','Egito','Costa do Marfim','eg','ci','Estadio Azteca','Cidade do México');

-- GRUPO K: Arábia Saudita, Irã, Iraque, Jordânia
INSERT INTO public.jogos_copa (fase, grupo, rodada, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, estadio, cidade) VALUES
  ('grupos','K',1,'2026-06-20','21:00','Arábia Saudita','Jordânia','sa','jo','Estadio Akron','Guadalajara'),
  ('grupos','K',1,'2026-06-21','00:00','Irã','Iraque','ir','iq','Estadio BBVA','Monterrey'),
  ('grupos','K',2,'2026-06-24','21:00','Jordânia','Iraque','jo','iq','Estadio Azteca','Cidade do México'),
  ('grupos','K',2,'2026-06-25','00:00','Arábia Saudita','Irã','sa','ir','Estadio BBVA','Monterrey'),
  ('grupos','K',3,'2026-06-27','18:00','Jordânia','Irã','jo','ir','Estadio Akron','Guadalajara'),
  ('grupos','K',3,'2026-06-27','18:00','Arábia Saudita','Iraque','sa','iq','Estadio Azteca','Cidade do México');

-- GRUPO L: Nova Zelândia, China, Barein, Taiti
INSERT INTO public.jogos_copa (fase, grupo, rodada, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, estadio, cidade) VALUES
  ('grupos','L',1,'2026-06-21','21:00','Nova Zelândia','Barein','nz','bh','Estadio BBVA','Monterrey'),
  ('grupos','L',1,'2026-06-22','00:00','China','Taiti','cn','pf','Estadio Akron','Guadalajara'),
  ('grupos','L',2,'2026-06-25','21:00','Barein','Taiti','bh','pf','Estadio Azteca','Cidade do México'),
  ('grupos','L',2,'2026-06-26','00:00','Nova Zelândia','China','nz','cn','Estadio BBVA','Monterrey'),
  ('grupos','L',3,'2026-06-28','18:00','Barein','China','bh','cn','Estadio Akron','Guadalajara'),
  ('grupos','L',3,'2026-06-28','18:00','Nova Zelândia','Taiti','nz','pf','Estadio Azteca','Cidade do México');
