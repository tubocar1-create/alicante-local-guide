
INSERT INTO public.agente_faqs (keywords, any_of, response, route, priority, notes) VALUES
(ARRAY['comer'], ARRAY['comer','cenar','almorzar','comida','restaurante','hambre'], 'Abro el submenú Comer: dime qué te apetece (cocina típica, arroces, italiano, japonés, vegano, brunch, postres, comida rápida, barato o internacional).', '/', 40, 'Dashboard: submenú Comer'),
(ARRAY['cocina típica'], ARRAY['cocina típica','alicantina','tradicional','tasca','mediterránea'], 'Abro el Dashboard de cocina típica alicantina.', '/', 41, 'Dashboard: Cocina típica'),
(ARRAY['arroces'], ARRAY['arroz','arroces','paella','pescado','marisco','marisquería','seafood'], 'Abro el Dashboard de arroces y pescado.', '/', 41, 'Dashboard: Arroces y pescado'),
(ARRAY['italiano'], ARRAY['italiano','pasta','trattoria','ristorante','pizza','pizzería'], 'Abro el Dashboard italiano.', '/', 41, 'Dashboard: Italiano'),
(ARRAY['japonés'], ARRAY['japonés','sushi','ramen','asiático','chino','thai','vietnamita','coreano','wok','noodle'], 'Abro el Dashboard japonés / asiático.', '/', 41, 'Dashboard: Japonés / Asiático'),
(ARRAY['vegano'], ARRAY['vegano','vegetariano','saludable','healthy','poke','veggie'], 'Abro el Dashboard vegano / saludable.', '/', 41, 'Dashboard: Vegano / Saludable'),
(ARRAY['brunch'], ARRAY['brunch','desayuno','breakfast','tortitas','pancakes','gofres','cruasán','bollería'], 'Abro el Dashboard de desayuno / brunch.', '/', 41, 'Dashboard: Desayuno / Brunch'),
(ARRAY['postres'], ARRAY['postres','heladería','helado','gelatería','pastelería','chocolatería','crepes','tarta','dulces'], 'Abro el Dashboard de postres y cafetería.', '/', 41, 'Dashboard: Postres / Cafetería'),
(ARRAY['barato'], ARRAY['barato','económico','low cost','menú del día','comer barato'], 'Abro el Dashboard low cost.', '/', 41, 'Dashboard: Barato y rico'),
(ARRAY['internacional'], ARRAY['internacional','hindú','libanés','árabe','peruano','latino','venezolano','colombiano','argentino','marroquí','griego'], 'Abro el Dashboard internacional.', '/', 41, 'Dashboard: Internacional'),
(ARRAY['comida rápida'], ARRAY['comida rápida','fast food','comida basura'], 'Abro el submenú de Comida rápida: hamburguesas, pizzas rápidas, montaditos, kebaps, pollo frito o mexicano.', '/', 42, 'Dashboard: submenú Comida rápida'),
(ARRAY['hamburguesa'], ARRAY['hamburguesa','burger','smashburger','mcdonald','burger king','goiko','five guys','tgb'], 'Abro el Dashboard de hamburgueserías.', '/', 43, 'Dashboard: Hamburguesas'),
(ARRAY['montaditos'], ARRAY['montaditos','100 montaditos','lizarrán'], 'Abro el Dashboard de montaditos.', '/', 43, 'Dashboard: Montaditos'),
(ARRAY['kebap'], ARRAY['kebap','kebab','döner','shawarma'], 'Abro el Dashboard de kebaps.', '/', 43, 'Dashboard: Kebaps'),
(ARRAY['pollo frito'], ARRAY['pollo frito','pollos asados','kfc','popeyes','pollería'], 'Abro el Dashboard de pollo frito.', '/', 43, 'Dashboard: Pollo frito'),
(ARRAY['mexicano'], ARRAY['mexicano','taco bell','tacos','burritos','tex-mex','taquería'], 'Abro el Dashboard mexicano.', '/', 43, 'Dashboard: Mexicano'),
(ARRAY['pizzería rápida'], ARRAY['telepizza','dominos','domino''s','papa john','pizza hut','pizza móvil','pizza a domicilio'], 'Abro el Dashboard de pizzas rápidas.', '/', 43, 'Dashboard: Pizzas rápidas');
