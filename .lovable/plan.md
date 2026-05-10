## Objetivo

Hacer que cada subcategoría de "Comida rápida" busque y filtre por las cadenas y palabras clave que has indicado, para que aparezcan resultados como McDonald's en Hamburguesas, Telepizza/Domino's en Pizzas, 100 Montaditos/Lizarrán en Montaditos, KFC/pollos asados en Pollo frito y Taco Bell en Comida mexicana.

## Cambios (solo en `supabase/functions/chat/index.ts`)

1. **Ampliar el tipo de subcategorías** (`FastFoodSub`)
   - Añadir: `"montaditos"`, `"chicken"`, `"mexican"`.

2. **Detección del prompt (`detectFastFoodSub`)**
   - Hamburguesas: añadir `mcdonalds`, `mac donalds`, `burger king`, `tgb`, `the good burger`, `goiko`, `five guys`, `foster's hollywood`, `carls jr`.
   - Pizzas: añadir `telepizza`, `domino`, `dominos`, `pizza hut`, `papa johns`.
   - Montaditos (nueva): `montaditos`, `100 montaditos`, `cien montaditos`, `lizarran`, `lizarrán`, `bocadillos`, `bocatas`.
   - Kebab: ya cubierto.
   - Pollo frito (nueva `chicken`): `pollo frito`, `pollos asados`, `pollo asado`, `kfc`, `popeyes`, `alitas`, `wings`, `fried chicken`.
   - Mexicana (nueva `mexican`): `mexicano`, `mexicana`, `tacos`, `burritos`, `taco bell`, `tex mex`.
   - Mantener `chain` y `all` como están.

3. **Keywords de búsqueda (`fastFoodSubQueries`)**
   - `burger`: `["hamburguesería", "burger", "smash burger", "McDonald's", "Burger King", "TGB", "Goiko", "Five Guys", "Foster's Hollywood", "Carl's Jr"]`.
   - `pizza`: `["pizzería", "pizza", "Telepizza", "Domino's Pizza", "Pizza Hut", "Papa John's"]`.
   - `montaditos`: `["100 Montaditos", "Lizarrán", "montaditos", "bocadillos"]`.
   - `kebab`: igual (`kebab`, `döner`, `shawarma`).
   - `chicken`: `["KFC", "Popeyes", "pollo frito", "pollos asados", "asador de pollos", "alitas"]`.
   - `mexican`: `["Taco Bell", "mexicano", "tacos", "burritos", "tex mex"]`.

4. **Filtro de resultados (`matchesFoodPreference`)**
   - `montaditos`: aceptar si el nombre/tipo contiene `montadit|lizarran|bocadillo|sandwich`.
   - `chicken`: aceptar si contiene `kfc|popeyes|pollo|chicken|fried_chicken|asador`.
   - `mexican`: aceptar si contiene `mexican|taco|burrito|tex.?mex`.
   - Mantener filtros actuales para `burger`, `pizza`, `kebab`, `chain`, `all`.

5. **Prompts del menú (`src/components/ChatScreen.tsx`)**
   - Ajustar los prompts de cada submenú para que disparen claramente la subcategoría correcta, p.ej.:
     - Pollo frito → `"Un sitio de pollo frito o pollos asados (KFC, Popeyes…) abierto ahora"`.
     - Comida mexicana → `"Un mexicano o Taco Bell abierto ahora"`.
     - Montaditos → `"Un sitio de montaditos (100 Montaditos, Lizarrán…) abierto ahora"`.
   - El resto ya quedan bien con los nuevos detectores.

## Notas

- Los filtros se basan en lo que devuelve Google Places (nombre + tipos), así que las cadenas se reconocerán por el nombre del local.
- No se cambia nada de UI más allá de los textos de los prompts del submenú.
