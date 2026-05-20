UPDATE public.agente_proper_nouns
SET route = '/playas'
WHERE route LIKE '/playas/%'
  AND route NOT IN (
    '/playas/mapa',
    '/playas/cala-lanuza',
    '/playas/carrer-la-mar',
    '/playas/muchavista',
    '/playas/san-juan',
    '/playas/cala-cantalar',
    '/playas/cala-palmera',
    '/playas/cala-judios',
    '/playas/cala-tio-ximo',
    '/playas/almadraba',
    '/playas/albufereta',
    '/playas/postiguet',
    '/playas/agua-amarga',
    '/playas/saladar',
    '/playas/urbanova',
    '/playas/el-altet',
    '/playas/arenales-del-sol',
    '/playas/carabassi'
  );