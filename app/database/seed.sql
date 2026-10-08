INSERT INTO users (
    email,
    password_hash,
    role,
    full_name
)
VALUES
(
    'supervisor@appareflow.com',
    'TEMP_HASH_CUTTING_SUPERVISOR',
    'cutting_supervisor',
    'Cutting Supervisor'
),
(
    'verifier@appareflow.com',
    'TEMP_HASH_CUTTING_VERIFIER',
    'cutting_verifier',
    'Cutting Verifier'
),
(
    'sewing@appareflow.com',
    'TEMP_HASH_SEWING_SUPERVISOR',
    'sewing_supervisor',
    'Sewing Supervisor'
);



INSERT INTO recipes (
    recipe_code,
    name,
    category,
    std_fabric_yards,
    wastage_cap
)
VALUES
(
    'REC-BL01',
    'Casual Blouse',
    'Blouse',
    1.80,
    5.00
),
(
    'REC-CT02',
    'Crop Top',
    'Crop Top',
    1.10,
    8.00
);



INSERT INTO recipe_components (
    recipe_id,
    component_name,
    pieces_per_garment
)
SELECT
    id,
    'Front Body Panel',
    1
FROM recipes
WHERE recipe_code = 'REC-BL01';

INSERT INTO recipe_components (
    recipe_id,
    component_name,
    pieces_per_garment
)
SELECT
    id,
    'Back Body Panel',
    1
FROM recipes
WHERE recipe_code = 'REC-BL01';

INSERT INTO recipe_components (
    recipe_id,
    component_name,
    pieces_per_garment
)
SELECT
    id,
    'Sleeves (Left & Right)',
    2
FROM recipes
WHERE recipe_code = 'REC-BL01';

INSERT INTO recipe_components (
    recipe_id,
    component_name,
    pieces_per_garment
)
SELECT
    id,
    'Collar & Stand',
    1
FROM recipes
WHERE recipe_code = 'REC-BL01';

INSERT INTO recipe_components (
    recipe_id,
    component_name,
    pieces_per_garment
)
SELECT
    id,
    'Sleeve Cuffs',
    2
FROM recipes
WHERE recipe_code = 'REC-BL01';



INSERT INTO recipe_components (
    recipe_id,
    component_name,
    pieces_per_garment
)
SELECT
    id,
    'Front Chest Panel',
    1
FROM recipes
WHERE recipe_code = 'REC-CT02';

INSERT INTO recipe_components (
    recipe_id,
    component_name,
    pieces_per_garment
)
SELECT
    id,
    'Back Support Panel',
    1
FROM recipes
WHERE recipe_code = 'REC-CT02';

INSERT INTO recipe_components (
    recipe_id,
    component_name,
    pieces_per_garment
)
SELECT
    id,
    'Neck Binding Strip',
    1
FROM recipes
WHERE recipe_code = 'REC-CT02';

INSERT INTO recipe_components (
    recipe_id,
    component_name,
    pieces_per_garment
)
SELECT
    id,
    'Hem Elastic Casing',
    1
FROM recipes
WHERE recipe_code = 'REC-CT02';

INSERT INTO recipe_components (
    recipe_id,
    component_name,
    pieces_per_garment
)
SELECT
    id,
    'Side Strap Accents',
    2
FROM recipes
WHERE recipe_code = 'REC-CT02';
```
