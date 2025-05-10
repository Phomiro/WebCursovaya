UPDATE products 
SET image = '/images/paracetamol.jpg'
WHERE Название LIKE '%Парацетамол%';

UPDATE products 
SET image = '/images/bandage.jpg'
WHERE Название LIKE '%Бинт%';

UPDATE products 
SET image = '/images/handcream.jpg'
WHERE Название LIKE '%Крем для рук%';

UPDATE products 
SET image = '/images/aspirin.jpg'
WHERE Название LIKE '%Аспирин%';

UPDATE products 
SET image = '/images/vitamin_c.jpg'
WHERE Название LIKE '%Витамин C%';

-- Для остальных товаров установим путь по умолчанию
UPDATE products 
SET image = '/images/default-product.png'
WHERE image IS NULL; 