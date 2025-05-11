const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Настройка подключения к базе данных
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Sketchbook14',
    database: 'pharmacy_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

// Настройка middleware
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'client')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'pharmacy-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Middleware для проверки аутентификации
const checkAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Middleware для проверки роли
const checkRole = (roles) => {
    return (req, res, next) => {
        if (req.session.user && roles.includes(req.session.user.role)) {
            next();
        } else {
            res.status(403).send('Доступ запрещен');
        }
    };
};

// Главная страница
app.get('/', async (req, res) => {
    try {
        const [products] = await pool.query('SELECT * FROM products WHERE Наличие = true LIMIT 6');
        
        // Получаем адрес доставки пользователя
        let userPharmacy = null;
        if (req.session.user) {
            const [clientData] = await pool.query('SELECT Адрес_доставки FROM clients WHERE UserID = ?', [req.session.user.id]);
            if (clientData && clientData.length > 0) {
                userPharmacy = clientData[0].Адрес_доставки;
            }
        }

        // Получаем список доступных товаров в аптеке пользователя
        let availableProducts = [];
        if (userPharmacy) {
            const [pharmacy] = await pool.query('SELECT Доступные_товары FROM pharmacies WHERE Адрес = ?', [userPharmacy]);
            if (pharmacy && pharmacy.length > 0) {
                try {
                    availableProducts = JSON.parse(pharmacy[0].Доступные_товары || '[]');
                } catch (error) {
                    console.error('Ошибка при парсинге JSON:', error);
                    availableProducts = [];
                }
            }
        }

        // Проверяем доступность каждого товара
        const productsWithAvailability = products.map(product => {
            const isAvailable = availableProducts.includes(product.Название);
            return { ...product, isAvailable };
        });

        res.render('index', { 
            user: req.session.user,
            products: productsWithAvailability
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

// Маршрут для каталога
app.get('/catalog', async (req, res) => {
    try {
        const category = req.query.category;
        const search = req.query.search;
        let query = 'SELECT * FROM products WHERE Наличие = true';
        const params = [];

        if (category) {
            query += ' AND Вид_товара = ?';
            params.push(category);
        }

        if (search) {
            query += ' AND (Название LIKE ? OR Описание LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [products] = await pool.query(query, params);
        
        // Получаем адрес доставки пользователя
        let userPharmacy = null;
        if (req.session.user) {
            const [clientData] = await pool.query('SELECT Адрес_доставки FROM clients WHERE UserID = ?', [req.session.user.id]);
            if (clientData && clientData.length > 0) {
                userPharmacy = clientData[0].Адрес_доставки;
            }
        }

        // Получаем список доступных товаров в аптеке пользователя
        let availableProducts = [];
        if (userPharmacy) {
            const [pharmacy] = await pool.query('SELECT Доступные_товары FROM pharmacies WHERE Адрес = ?', [userPharmacy]);
            if (pharmacy && pharmacy.length > 0) {
                try {
                    availableProducts = JSON.parse(pharmacy[0].Доступные_товары || '[]');
                } catch (error) {
                    console.error('Ошибка при парсинге JSON:', error);
                    availableProducts = [];
                }
            }
        }

        // Проверяем доступность каждого товара
        const productsWithAvailability = products.map(product => {
            const isAvailable = availableProducts.includes(product.Название);
            return { ...product, isAvailable };
        });

        // Получаем список категорий для фильтра
        const [categories] = await pool.query('SELECT DISTINCT Вид_товара FROM products WHERE Наличие = true');
        
        res.render('catalog', { 
            products: productsWithAvailability,
            categories: categories.map(c => c.Вид_товара),
            currentCategory: category,
            search: search,
            user: req.session.user
        });
    } catch (error) {
        console.error('Ошибка при получении каталога:', error);
        res.status(500).send('Ошибка при получении каталога');
    }
});

// Маршрут для страницы товара
app.get('/product/:id', async (req, res) => {
    try {
        const [products] = await pool.query('SELECT * FROM products WHERE ProductID = ?', [req.params.id]);
        
        if (products.length === 0) {
            return res.status(404).send('Товар не найден');
        }

        const product = products[0];
        let isAvailable = false;
        let availablePharmacies = [];

        // Получаем список всех аптек
        const [pharmacies] = await pool.query('SELECT * FROM pharmacies');
        
        // Проверяем наличие товара в каждой аптеке
        availablePharmacies = pharmacies.filter(pharmacy => {
            try {
                const availableProducts = JSON.parse(pharmacy.Доступные_товары || '[]');
                return availableProducts.includes(product.Название);
            } catch (error) {
                console.error('Ошибка при парсинге JSON:', error);
                return false;
            }
        });

        if (req.session.user) {
            const [clientData] = await pool.query('SELECT Адрес_доставки FROM clients WHERE UserID = ?', [req.session.user.id]);
            if (clientData && clientData.length > 0) {
                const userPharmacy = clientData[0].Адрес_доставки;
                const [pharmacy] = await pool.query('SELECT Доступные_товары FROM pharmacies WHERE Адрес = ?', [userPharmacy]);
                
                if (pharmacy && pharmacy.length > 0) {
                    try {
                        const availableProducts = JSON.parse(pharmacy[0].Доступные_товары || '[]');
                        isAvailable = availableProducts.includes(product.Название);
                    } catch (error) {
                        console.error('Ошибка при парсинге JSON:', error);
                        isAvailable = false;
                    }
                }
            }
        }

        res.render('product', {
            user: req.session.user,
            product: product,
            isAvailable: Boolean(isAvailable),
            availablePharmacies: availablePharmacies
        });
    } catch (error) {
        console.error('Ошибка при получении товара:', error);
        res.status(500).send('Ошибка сервера');
    }
});

// Маршруты аутентификации
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [results] = await pool.query('SELECT * FROM users WHERE Email = ?', [email]);
        if (results.length === 0) {
            return res.render('login', { error: 'Пользователь не найден' });
        }

                const user = results[0];
                const match = await bcrypt.compare(password, user.Пароль);
                
                if (match) {
                    req.session.user = {
                        id: user.UserID,
                        email: user.Email,
                        role: user.Роль,
                        ФИО: user.ФИО
                    };

                    // Получаем дополнительные данные в зависимости от роли
                    if (user.Роль === 'client') {
                const [clientData] = await pool.query('SELECT * FROM clients WHERE UserID = ?', [user.UserID]);
                            if (clientData.length > 0) {
                                req.session.user = {
                                    ...req.session.user,
                                    Адрес_доставки: clientData[0].Адрес_доставки,
                                    Номер_телефона: clientData[0].Номер_телефона,
                                    История_заказов: clientData[0].История_заказов
                                };
                            }
                            res.redirect('/');
                    } else {
                        res.redirect('/');
                    }
                } else {
                    res.render('login', { error: 'Неверный пароль' });
                }
    } catch (error) {
        console.error('Ошибка при входе:', error);
        res.render('login', { error: 'Произошла ошибка при входе' });
    }
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { name, email, password, phone} = req.body;
    try {
        // Проверяем, не существует ли уже пользователь с таким email
        const [results] = await pool.query('SELECT * FROM users WHERE Email = ?', [email]);
        if (results.length > 0) {
            return res.render('register', { error: 'Пользователь с таким email уже существует' });
        }

        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);

        // Создаем пользователя
        const [result] = await pool.query('INSERT INTO users (ФИО, Email, Пароль, Роль) VALUES (?, ?, ?, "client")',
            [name, email, hashedPassword, 'client']);
                const userId = result.insertId;
        // Создаем профиль клиента
        await pool.query('INSERT INTO clients (UserID, Номер_телефона, История_заказов) VALUES (?, ?, "[]")',
            [userId, phone]);
                        res.redirect('/login');
    } catch (error) {
        console.error('Ошибка при регистрации:', error);
        res.render('register', { error: 'Произошла ошибка при регистрации' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Маршрут для корзины
app.get('/cart', checkAuth, async (req, res) => {
    try {
        // Проверяем структуру таблицы products
        const [columns] = await pool.query('SHOW COLUMNS FROM products');
        console.log('Структура таблицы products:', columns);

        const [cartArr] = await pool.query('SELECT * FROM carts WHERE UserID = ?', [req.session.user.id]);
        let cartData = cartArr[0];
        console.log('Данные корзины:', cartData);

        if (!cartData) {
            // Создаем новую корзину, если её нет
            const [result] = await pool.query('INSERT INTO carts (UserID, Список_товаров, Количество_товаров, Итоговая_цена, Наличие_рецептурных) VALUES (?, "[]", 0, 0, false)',
                [req.session.user.id]);
            cartData = {
                CartID: result.insertId,
                UserID: req.session.user.id,
                Список_товаров: '[]',
                Количество_товаров: 0,
                Итоговая_цена: 0,
                Наличие_рецептурных: false
            };
        }

        // Получаем подробную информацию о товарах
        let items = [];
        if (cartData.Список_товаров && cartData.Список_товаров !== '[]') {
            const cartItems = JSON.parse(cartData.Список_товаров);
            console.log('Товары в корзине:', cartItems);
            
            if (cartItems.length > 0) {
                // Получаем все ProductID из корзины
                const ids = cartItems.map(item => item.ProductID);
                console.log('ID товаров для поиска:', ids);
                
                const query = `SELECT * FROM products WHERE ProductID IN (${ids.map(() => '?').join(',')})`;
                console.log('SQL запрос:', query, 'с параметрами:', ids);
                
                const [products] = await pool.query(query, ids);
                console.log('Найденные товары:', products);
                
                // Собираем массив с подробной информацией
                items = cartItems.map(item => {
                    const product = products.find(p => p.ProductID === item.ProductID);
                    console.log(`Поиск товара ${item.ProductID}:`, product);
                    return {
                        ProductID: item.ProductID,
                        quantity: item.quantity,
                        Название: product ? product.Название : 'Не найдено',
                        Цена: product ? product.Цена : 0
                    };
                });
            }
        }
        
        console.log('Итоговые данные для шаблона:', items);
        
        // Передаем подробные товары в шаблон
        res.render('cart', { 
            user: req.session.user, // <-- добавляем это
            cart: { ...cartData, Список_товаров: JSON.stringify(items) }
        });
    } catch (err) {
        res.render('cart', { 
            user: req.session.user, // <-- даже если есть ошибка
            error: 'Ошибка при загрузке корзины'
        });
    }
});

// Маршрут для добавления в корзину
app.post('/cart/add', checkAuth, async (req, res) => {
    try {
        console.log('Получены данные:', req.body);
        const productId = parseInt(req.body.productId);
        const userId = req.session.user.id;

        if (!productId) {
            console.log('ID товара не указан');
            return res.status(400).json({ success: false, error: 'ID товара не указан' });
        }

        // Проверяем существование товара
        console.log('Поиск товара с ID:', productId);
        const [products] = await pool.query('SELECT * FROM products WHERE ProductID = ?', [productId]);
        
        if (!products || products.length === 0) {
            console.log('Товар не найден');
            return res.status(404).json({ success: false, error: 'Товар не найден' });
        }

        const product = products[0];
        console.log('Найден товар:', product);

        // Получаем адрес доставки пользователя
        const [clientData] = await pool.query('SELECT Адрес_доставки FROM clients WHERE UserID = ?', [userId]);
        if (!clientData || clientData.length === 0) {
            return res.status(400).json({ success: false, error: 'Адрес доставки не указан' });
        }

        const userPharmacy = clientData[0].Адрес_доставки;

        // Проверяем наличие товара в аптеке пользователя
        const [pharmacy] = await pool.query('SELECT * FROM pharmacies WHERE Адрес = ?', [userPharmacy]);
        if (!pharmacy || pharmacy.length === 0) {
            return res.status(400).json({ success: false, error: 'Аптека не найдена' });
        }

        const availableProducts = JSON.parse(pharmacy[0].Доступные_товары || '[]');
        if (!availableProducts.includes(product.Название)) {
            return res.status(400).json({ success: false, error: 'Товар недоступен в вашей аптеке' });
        }

        // Получаем корзину пользователя
        const [carts] = await pool.query('SELECT * FROM carts WHERE UserID = ?', [userId]);
        
        if (!carts || carts.length === 0) {
            console.log('Создание новой корзины');
            // Создаем новую корзину
            const cartItems = [{ ProductID: productId, quantity: 1 }];
            await pool.query(
                'INSERT INTO carts (UserID, Список_товаров, Количество_товаров, Итоговая_цена, Наличие_рецептурных) VALUES (?, ?, ?, ?, ?)',
                [userId, JSON.stringify(cartItems), 1, product.Цена, false]
            );
        } else {
            console.log('Обновление существующей корзины');
            const cart = carts[0];
            // Обновляем существующую корзину
            const items = JSON.parse(cart.Список_товаров || '[]');
            const existingItem = items.find(item => parseInt(item.ProductID) === productId);
            
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                items.push({ ProductID: productId, quantity: 1 });
            }

            const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
            
            // Получаем актуальные цены всех товаров
            const productIds = items.map(item => parseInt(item.ProductID));
            const [allProducts] = await pool.query(
                'SELECT ProductID, Цена FROM products WHERE ProductID IN (?)',
                [productIds]
            );

            const totalPrice = items.reduce((sum, item) => {
                const product = allProducts.find(p => p.ProductID === parseInt(item.ProductID));
                return sum + (product ? parseFloat(product.Цена) * item.quantity : 0);
            }, 0);

            console.log('Обновленные данные корзины:', {
                items,
                totalQuantity,
                totalPrice
            });

            await pool.query(
                'UPDATE carts SET Список_товаров = ?, Количество_товаров = ?, Итоговая_цена = ? WHERE UserID = ?',
                [JSON.stringify(items), totalQuantity, totalPrice, userId]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка при добавлении товара в корзину:', error);
        res.status(500).json({ success: false, error: 'Произошла ошибка при добавлении товара в корзину' });
    }
});

// Маршрут для удаления товара из корзины
app.post('/cart/remove', checkAuth, async (req, res) => {
    try {
        const productId = parseInt(req.body.productId);
        const userId = req.session.user.id;

        console.log('Попытка удаления товара:', { productId, userId });

        // Получаем текущую корзину
        const [carts] = await pool.query('SELECT * FROM carts WHERE UserID = ?', [userId]);
        if (!carts || carts.length === 0) {
            console.log('Корзина не найдена');
            return res.status(404).json({ success: false, error: 'Корзина не найдена' });
        }

        const cart = carts[0];
        console.log('Текущая корзина:', cart);

        // Парсим список товаров
        let items = JSON.parse(cart.Список_товаров || '[]');
        console.log('Товары до удаления:', items);

        // Удаляем товар
        items = items.filter(item => parseInt(item.ProductID) !== productId);
        console.log('Товары после удаления:', items);

        if (items.length === 0) {
            // Если корзина пуста, обнуляем итоги
            await pool.query(
                'UPDATE carts SET Список_товаров = "[]", Количество_товаров = 0, Итоговая_цена = 0 WHERE UserID = ?',
                [userId]
            );
        } else {
            // Пересчитываем общее количество и сумму
            const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
            
            // Получаем актуальные цены товаров
            const productIds = items.map(item => parseInt(item.ProductID));
            const [products] = await pool.query(
                'SELECT ProductID, Цена FROM products WHERE ProductID IN (?)',
                [productIds]
            );

            const totalPrice = items.reduce((sum, item) => {
                const product = products.find(p => p.ProductID === parseInt(item.ProductID));
                return sum + (product ? parseFloat(product.Цена) * item.quantity : 0);
            }, 0);

            console.log('Обновленные данные:', { totalQuantity, totalPrice });

            // Обновляем корзину
            await pool.query(
                'UPDATE carts SET Список_товаров = ?, Количество_товаров = ?, Итоговая_цена = ? WHERE UserID = ?',
                [JSON.stringify(items), totalQuantity, totalPrice, userId]
            );
        }

        console.log('Корзина успешно обновлена');
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка при удалении товара из корзины:', error);
        res.status(500).json({ success: false, error: 'Произошла ошибка при удалении товара из корзины' });
    }
});

app.post('/cart/update', checkAuth, async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.session.user.id;

        if (quantity < 1) {
            return res.json({ success: false, error: 'Количество не может быть меньше 1' });
        }

        const [cart] = await pool.query('SELECT * FROM carts WHERE UserID = ?', [userId]);
        if (!cart || cart.length === 0) {
            return res.json({ success: false, error: 'Корзина не найдена' });
        }

        const items = JSON.parse(cart[0].Список_товаров || '[]');
        const itemIndex = items.findIndex(item => parseInt(item.ProductID) === parseInt(productId));

        if (itemIndex === -1) {
            return res.json({ success: false, error: 'Товар не найден в корзине' });
        }

        // Обновляем количество
        items[itemIndex].quantity = parseInt(quantity);

        // Пересчитываем общее количество и сумму
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        
        const productIds = items.map(item => parseInt(item.ProductID));
        const [products] = await pool.query(
            'SELECT ProductID, Цена FROM products WHERE ProductID IN (?)',
            [productIds]
        );

        const totalPrice = items.reduce((sum, item) => {
            const product = products.find(p => p.ProductID === parseInt(item.ProductID));
            return sum + (product ? parseFloat(product.Цена) * item.quantity : 0);
        }, 0);

        // Обновляем БД
        await pool.query(
            'UPDATE carts SET Список_товаров = ?, Количество_товаров = ?, Итоговая_цена = ? WHERE UserID = ?',
            [JSON.stringify(items), totalQuantity, totalPrice, userId]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('Ошибка при обновлении количества товара:', error);
        res.status(500).json({ success: false, error: 'Произошла ошибка при обновлении количества товара' });
    }
});

// Маршруты для оформления заказа
app.get('/checkout', checkAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [carts] = await pool.query('SELECT * FROM carts WHERE UserID = ?', [userId]);
        let cartData = carts[0];
        if (!cartData) {
            return res.redirect('/cart');
        }
        let items = [];
        if (cartData.Список_товаров && cartData.Список_товаров !== '[]') {
            const cartItems = JSON.parse(cartData.Список_товаров);
            if (cartItems.length > 0) {
                const ids = cartItems.map(item => item.ProductID);
                const [products] = await pool.query(
                    `SELECT * FROM products WHERE ProductID IN (${ids.map(() => '?').join(',')})`,
                    ids
                );
                items = cartItems.map(item => {
                    const product = products.find(p => p.ProductID === item.ProductID);
                    return {
                        ProductID: item.ProductID,
                        quantity: item.quantity,
                        Название: product ? product.Название : 'Не найдено',
                        Цена: product ? product.Цена : 0
                    };
                });
            }
        }
        res.render('checkout', { 
            user: req.session.user,
            cart: { ...cartData, Список_товаров: JSON.stringify(items) }
        });
    } catch (err) {
        console.error('Ошибка при загрузке страницы оформления заказа:', err);
        res.redirect('/cart');
    }
});

app.post('/checkout', checkAuth, async (req, res) => {
    try {
        const { address, payment, promo } = req.body;
        const userId = req.session.user.id;

        const [carts] = await pool.query('SELECT * FROM carts WHERE UserID = ?', [userId]);
        if (!carts || carts.length === 0) {
            return res.redirect('/cart');
        }

        const cartData = carts[0];
        const items = cartData.Список_товаров && cartData.Список_товаров !== '[]' ? JSON.parse(cartData.Список_товаров) : [];
        const totalPrice = cartData.Итоговая_цена || 0;

        // Создаем заказ
        const [orderResult] = await pool.query(
            'INSERT INTO orders (UserID, Список_товаров, Итоговая_цена, Статус, Адрес_доставки, Способ_оплаты, Промокод, Дата_начала_заказа) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [userId, JSON.stringify(items), totalPrice, 'создан', address, payment, promo || null]
        );

        const orderId = orderResult.insertId;

        // Очищаем корзину
        await pool.query(
            'UPDATE carts SET Список_товаров = "[]", Количество_товаров = 0, Итоговая_цена = 0 WHERE UserID = ?',
            [userId]
        );

        // Обновляем историю заказов пользователя
        const [clientData] = await pool.query('SELECT История_заказов FROM clients WHERE UserID = ?', [userId]);
        let history = [];
        if (clientData.length > 0 && clientData[0].История_заказов) {
            history = JSON.parse(clientData[0].История_заказов);
        }
        history.push({
            id: orderId,
            date: new Date().toISOString(),
            status: 'создан',
            total: totalPrice
        });
        await pool.query(
            'UPDATE clients SET История_заказов = ? WHERE UserID = ?',
            [JSON.stringify(history), userId]
        );

        // Показываем страницу успеха
        res.render('order_success', { user: req.session.user });
    } catch (err) {
        console.error('Ошибка при оформлении заказа:', err);
        res.render('checkout', { 
            user: req.session.user,
            error: 'Произошла ошибка при оформлении заказа'
        });
    }
});

// Маршруты для администратора
app.get('/admin', checkAuth, checkRole(['admin']), (req, res) => {
    res.render('admin');
});

// Маршруты для фармацевта
app.get('/pharmacist', checkAuth, checkRole(['pharmacist']), async (req, res) => {
    try {
        // Получаем все аптеки
        const [pharmacies] = await pool.query('SELECT * FROM pharmacies');
        // pharmacyId из query или первая доступная
        const selectedPharmacyId = req.query.pharmacyId || (pharmacies[0] ? pharmacies[0].PharmacyID : null);
        let pharmacy = pharmacies.find(p => String(p.PharmacyID) === String(selectedPharmacyId));

        // Заказы только для выбранной аптеки
        const [newOrders] = await pool.query('SELECT * FROM orders WHERE Статус IN ("создан", "обработан") AND Адрес_доставки = ? ORDER BY Дата_начала_заказа DESC', [pharmacy ? pharmacy.Адрес : '']);
        const [doneOrders] = await pool.query('SELECT * FROM orders WHERE Статус = "выполнен" AND Адрес_доставки = ? ORDER BY Дата_окончания_заказа DESC', [pharmacy ? pharmacy.Адрес : '']);

        res.render('pharmacist', { 
            user: req.session.user, 
            newOrders, 
            doneOrders, 
            pharmacy, 
            pharmacies, 
            selectedPharmacyId 
        });
    } catch (err) {
        console.error('Ошибка при загрузке панели фармацевта:', err);
        res.status(500).send('Ошибка сервера фармацевта');
    }
});

// Маршрут для страницы обработки заказа фармацевтом
app.get('/pharmacist/order/:id', checkAuth, checkRole(['pharmacist']), async (req, res) => {
    try {
        const orderId = req.params.id;
        // Получаем заказ
        const [orders] = await pool.query('SELECT * FROM orders WHERE OrderID = ?', [orderId]);
        if (!orders.length) return res.status(404).send('Заказ не найден');
        const order = orders[0];
        // Получаем клиента
        const [clients] = await pool.query('SELECT * FROM clients WHERE UserID = ?', [order.UserID]);
        const client = clients[0] || {};
        // Получаем список товаров
        let items = [];
        if (order.Список_товаров) {
            try {
                const cartItems = JSON.parse(order.Список_товаров);
                if (cartItems.length > 0) {
                    const ids = cartItems.map(item => item.ProductID);
                    const [products] = await pool.query(
                        `SELECT * FROM products WHERE ProductID IN (${ids.map(() => '?').join(',')})`,
                        ids
                    );
                    items = cartItems.map(item => {
                        const product = products.find(p => p.ProductID === item.ProductID);
                        return {
                            ...item,
                            Название: product ? product.Название : 'Не найдено',
                            Цена: product ? product.Цена : 0,
                            Рецептурный: product ? product.Вид_товара === 'лекарство' && product.Действующее_вещество : false
                        };
                    });
                }
            } catch {}
        }
        res.render('pharmacist_order', { user: req.session.user, order, client, items });
    } catch (err) {
        console.error('Ошибка при загрузке заказа фармацевта:', err);
        res.status(500).send('Ошибка сервера фармацевта');
    }
});

app.post('/pharmacist/order/:id/complete', checkAuth, checkRole(['pharmacist']), async (req, res) => {
    try {
        const orderId = req.params.id;
        // Получаем заказ
        const [orders] = await pool.query('SELECT * FROM orders WHERE OrderID = ?', [orderId]);
        if (!orders.length) return res.status(404).send('Заказ не найден');
        const order = orders[0];

        // Обновляем статус заказа
        await pool.query('UPDATE orders SET Статус = "выполнен", Дата_окончания_заказа = NOW() WHERE OrderID = ?', [orderId]);

        // Обновляем историю заказов клиента
        const [orderData] = await pool.query('SELECT UserID FROM orders WHERE OrderID = ?', [orderId]);
        if (orderData.length > 0) {
            const userId = orderData[0].UserID;
            const [clients] = await pool.query('SELECT История_заказов FROM clients WHERE UserID = ?', [userId]);
            if (clients.length > 0) {
                let history = [];
                try {
                    history = JSON.parse(clients[0].История_заказов || '[]');
                } catch (e) {
                    console.error('Ошибка парсинга История_заказов:', e);
                    history = [];
                }
                
                let changed = false;
                history = history.map(order => {
                    if (Number(order.id) === Number(orderId)) {
                        changed = true;
                        return { ...order, status: 'выполнен' };
                    }
                    return order;
                });
                
                if (changed) {
                    await pool.query('UPDATE clients SET История_заказов = ? WHERE UserID = ?', 
                        [JSON.stringify(history), userId]);
                }
            }
        }
        res.redirect('/pharmacist');
    } catch (err) {
        console.error('Ошибка при завершении заказа:', err);
        res.status(500).send('Ошибка при завершении заказа');
    }
});

// Маршрут для профиля
app.get('/profile', checkAuth, async (req, res) => {
    try {
    if (req.session.user.role === 'client') {
            const [clientData] = await pool.query('SELECT * FROM clients WHERE UserID = ?', [req.session.user.id]);
            let userData = {
                ...req.session.user,
                ...clientData[0]
            };
            // Исправление: всегда массив
            if (typeof userData.История_заказов === 'string') {
                try {
                    userData.История_заказов = JSON.parse(userData.История_заказов);
                } catch {
                    userData.История_заказов = [];
                }
            }
            if (!Array.isArray(userData.История_заказов)) {
                userData.История_заказов = [];
            }
            // Гарантируем наличие Email
            userData.Email = clientData[0].Email || req.session.user.Email || req.session.user.email;
            // Получаем список аптек для выпадающего списка
            const [pharmacies] = await pool.query('SELECT PharmacyID, Адрес FROM pharmacies');
            res.render('profile', { user: userData, pharmacies });
        } else {
            res.render('profile', { user: req.session.user });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

// Тестовый маршрут для проверки данных
app.get('/debug-cart', checkAuth, async (req, res) => {
    try {
        console.log('=== Начало отладки ===');
        
        // Проверяем структуру таблицы products
        const [productsStructure] = await pool.query('SHOW COLUMNS FROM products');
        console.log('Структура таблицы products:', productsStructure);

        // Проверяем структуру таблицы carts
        const [cartsStructure] = await pool.query('SHOW COLUMNS FROM carts');
        console.log('Структура таблицы carts:', cartsStructure);

        // Получаем данные корзины пользователя
        const [carts] = await pool.query('SELECT * FROM carts WHERE UserID = ?', [req.session.user.id]);
        console.log('Данные корзины:', carts[0]);

        if (carts[0]) {
            const items = JSON.parse(carts[0].Список_товаров || '[]');
            console.log('Товары в корзине:', items);

            if (items.length > 0) {
                // Проверяем товары
                const productIds = items.map(item => item.ProductID);
                const [products] = await pool.query(
                    'SELECT * FROM products WHERE ProductID IN (?)',
                    [productIds]
                );
                console.log('Найденные товары:', products);
            }
        }

        console.log('=== Конец отладки ===');
        res.json({ 
            message: 'Проверьте консоль сервера для просмотра отладочной информации',
            cart: carts[0],
            session: req.session
        });
    } catch (error) {
        console.error('Ошибка при отладке:', error);
        res.status(500).json({ error: 'Ошибка при отладке' });
    }
});

app.post('/profile/edit', checkAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { name, email, phone, address } = req.body;
        
        // Проверяем, есть ли товары в корзине
        const [cart] = await pool.query('SELECT * FROM carts WHERE UserID = ?', [userId]);
        if (cart && cart.length > 0) {
            const cartItems = JSON.parse(cart[0].Список_товаров || '[]');
            if (cartItems.length > 0) {
                // Получаем информацию о новой аптеке
                const [pharmacy] = await pool.query('SELECT * FROM pharmacies WHERE Адрес = ?', [address]);
                if (pharmacy && pharmacy.length > 0) {
                    const availableProducts = JSON.parse(pharmacy[0].Доступные_товары || '[]');
                    
                    // Получаем информацию о товарах в корзине
                    const productIds = cartItems.map(item => item.ProductID);
                    const [products] = await pool.query('SELECT * FROM products WHERE ProductID IN (?)', [productIds]);
                    
                    // Проверяем каждый товар
                    const unavailableItems = cartItems.filter(item => {
                        const product = products.find(p => p.ProductID === item.ProductID);
                        return product && !availableProducts.includes(product.Название);
                    });

                    if (unavailableItems.length > 0) {
                        // Удаляем недоступные товары
                        const updatedItems = cartItems.filter(item => {
                            const product = products.find(p => p.ProductID === item.ProductID);
                            return product && availableProducts.includes(product.Название);
                        });

                        // Обновляем корзину
                        await pool.query(
                            'UPDATE carts SET Список_товаров = ?, Количество_товаров = ?, Итоговая_цена = ? WHERE UserID = ?',
                            [JSON.stringify(updatedItems), updatedItems.length, 0, userId]
                        );

                        // Обновляем профиль
                        await pool.query('UPDATE users SET ФИО = ?, Email = ? WHERE UserID = ?', [name, email, userId]);
                        await pool.query('UPDATE clients SET Номер_телефона = ?, Адрес_доставки = ? WHERE UserID = ?', [phone, address, userId]);
                        
                        // Обновляем сессию
                        req.session.user.ФИО = name;
                        req.session.user.Email = email;
                        req.session.user.Номер_телефона = phone;
                        req.session.user.Адрес_доставки = address;

                        // Перенаправляем с сообщением
                        return res.redirect('/profile?message=Некоторые товары были удалены из корзины, так как они недоступны в выбранной аптеке');
                    }
                }
            }
        }

        // Если нет товаров в корзине или все товары доступны, просто обновляем профиль
        await pool.query('UPDATE users SET ФИО = ?, Email = ? WHERE UserID = ?', [name, email, userId]);
        await pool.query('UPDATE clients SET Номер_телефона = ?, Адрес_доставки = ? WHERE UserID = ?', [phone, address, userId]);
        
        // Обновляем сессию
        req.session.user.ФИО = name;
        req.session.user.Email = email;
        req.session.user.Номер_телефона = phone;
        req.session.user.Адрес_доставки = address;
        
        res.redirect('/profile');
    } catch (err) {
        console.error('Ошибка при обновлении профиля:', err);
        res.status(500).send('Ошибка при обновлении профиля');
    }
});

// --- Админка: Пользователи ---
app.get('/admin/users', checkAuth, checkRole(['admin']), async (req, res) => {
    const [users] = await pool.query('SELECT * FROM users');
    res.render('admin_users', { user: req.session.user, users });
});

app.get('/admin/users/new', checkAuth, checkRole(['admin']), (req, res) => {
    res.render('admin_user_form', { user: req.session.user, formAction: '/admin/users/new', userData: {} });
});

app.post('/admin/users/new', checkAuth, checkRole(['admin']), async (req, res) => {
    const { ФИО, Email, Пароль, Роль } = req.body;
    const hashedPassword = await bcrypt.hash(Пароль, 10);
    await pool.query('INSERT INTO users (ФИО, Email, Пароль, Роль) VALUES (?, ?, ?, ?)', [ФИО, Email, hashedPassword, Роль]);
    res.redirect('/admin/users');
});

app.get('/admin/users/:id/edit', checkAuth, checkRole(['admin']), async (req, res) => {
    const [users] = await pool.query('SELECT * FROM users WHERE UserID = ?', [req.params.id]);
    if (!users.length) return res.status(404).send('Пользователь не найден');
    res.render('admin_user_form', { user: req.session.user, formAction: `/admin/users/${req.params.id}/edit`, userData: users[0] });
});

app.post('/admin/users/:id/edit', checkAuth, checkRole(['admin']), async (req, res) => {
    const { ФИО, Email, Пароль, Роль } = req.body;
    let query, params;
    if (Пароль) {
        const hashedPassword = await bcrypt.hash(Пароль, 10);
        query = 'UPDATE users SET ФИО = ?, Email = ?, Пароль = ?, Роль = ? WHERE UserID = ?';
        params = [ФИО, Email, hashedPassword, Роль, req.params.id];
    } else {
        query = 'UPDATE users SET ФИО = ?, Email = ?, Роль = ? WHERE UserID = ?';
        params = [ФИО, Email, Роль, req.params.id];
    }
    await pool.query(query, params);
    res.redirect('/admin/users');
});

app.post('/admin/users/:id/delete', checkAuth, checkRole(['admin']), async (req, res) => {
    await pool.query('DELETE FROM users WHERE UserID = ?', [req.params.id]);
    res.redirect('/admin/users');
});

// --- Админка: Товары ---
app.get('/admin/products', checkAuth, checkRole(['admin']), async (req, res) => {
    const [products] = await pool.query('SELECT * FROM products');
    res.render('admin_products', { user: req.session.user, products });
});

app.get('/admin/products/new', checkAuth, checkRole(['admin']), (req, res) => {
    res.render('admin_product_form', { user: req.session.user, formAction: '/admin/products/new', product: {} });
});

app.post('/admin/products/new', checkAuth, checkRole(['admin']), async (req, res) => {
    const { Название, Описание, Цена, Вид_товара, Производитель, Дозировка, Наличие } = req.body;
    await pool.query('INSERT INTO products (Название, Описание, Цена, Вид_товара, Производитель, Дозировка, Наличие) VALUES (?, ?, ?, ?, ?, ?, ?)', [Название, Описание, Цена, Вид_товара, Производитель, Дозировка, Наличие === 'on']);
    res.redirect('/admin/products');
});

app.get('/admin/products/:id/edit', checkAuth, checkRole(['admin']), async (req, res) => {
    const [products] = await pool.query('SELECT * FROM products WHERE ProductID = ?', [req.params.id]);
    if (!products.length) return res.status(404).send('Товар не найден');
    res.render('admin_product_form', { user: req.session.user, formAction: `/admin/products/${req.params.id}/edit`, product: products[0] });
});

app.post('/admin/products/:id/edit', checkAuth, checkRole(['admin']), async (req, res) => {
    const { Название, Описание, Цена, Вид_товара, Производитель, Дозировка, Наличие } = req.body;
    await pool.query('UPDATE products SET Название=?, Описание=?, Цена=?, Вид_товара=?, Производитель=?, Дозировка=?, Наличие=? WHERE ProductID=?', [Название, Описание, Цена, Вид_товара, Производитель, Дозировка, Наличие === 'on', req.params.id]);
    res.redirect('/admin/products');
});

app.post('/admin/products/:id/delete', checkAuth, checkRole(['admin']), async (req, res) => {
    await pool.query('DELETE FROM products WHERE ProductID = ?', [req.params.id]);
    res.redirect('/admin/products');
});

// --- Админка: Аптеки ---
app.get('/admin/pharmacies', checkAuth, checkRole(['admin']), async (req, res) => {
    const [pharmacies] = await pool.query('SELECT * FROM pharmacies');
    res.render('admin_pharmacies', { user: req.session.user, pharmacies });
});

app.get('/admin/pharmacies/new', checkAuth, checkRole(['admin']), (req, res) => {
    res.render('admin_pharmacy_form', { user: req.session.user, formAction: '/admin/pharmacies/new', pharmacy: {} });
});

app.post('/admin/pharmacies/new', checkAuth, checkRole(['admin']), async (req, res) => {
    const { Название, Адрес, Доступные_товары } = req.body;
    await pool.query('INSERT INTO pharmacies (Название, Адрес, Доступные_товары) VALUES (?, ?, ?)', [Название, Адрес, Доступные_товары || '[]']);
    res.redirect('/admin/pharmacies');
});

app.get('/admin/pharmacies/:id/edit', checkAuth, checkRole(['admin']), async (req, res) => {
    const [pharmacies] = await pool.query('SELECT * FROM pharmacies WHERE PharmacyID = ?', [req.params.id]);
    if (!pharmacies.length) return res.status(404).send('Аптека не найдена');
    res.render('admin_pharmacy_form', { user: req.session.user, formAction: `/admin/pharmacies/${req.params.id}/edit`, pharmacy: pharmacies[0] });
});

app.post('/admin/pharmacies/:id/edit', checkAuth, checkRole(['admin']), async (req, res) => {
    const { Название, Адрес, Доступные_товары } = req.body;
    await pool.query('UPDATE pharmacies SET Название=?, Адрес=?, Доступные_товары=? WHERE PharmacyID=?', [Название, Адрес, Доступные_товары || '[]', req.params.id]);
    res.redirect('/admin/pharmacies');
});

app.post('/admin/pharmacies/:id/delete', checkAuth, checkRole(['admin']), async (req, res) => {
    await pool.query('DELETE FROM pharmacies WHERE PharmacyID = ?', [req.params.id]);
    res.redirect('/admin/pharmacies');
});

// Маршрут для отчетов по продажам
app.get('/admin/reports/sales', checkAuth, checkRole(['admin']), async (req, res) => {
    try {
        // Общая статистика по заказам
        const [orderStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(Итоговая_цена) as total_revenue,
                ROUND(AVG(Итоговая_цена), 2) as average_order_value,
                COUNT(CASE WHEN Статус = 'выполнен' THEN 1 END) as completed_orders,
                COUNT(CASE WHEN Статус = 'создан' THEN 1 END) as new_orders
            FROM orders
        `);

        // Статистика по аптекам
        const [pharmacyStats] = await pool.query(`
            SELECT 
                p.Адрес,
                COUNT(o.OrderID) as total_orders,
                SUM(o.Итоговая_цена) as total_revenue,
                COUNT(CASE WHEN o.Статус = 'выполнен' THEN 1 END) as completed_orders
            FROM pharmacies p
            LEFT JOIN orders o ON p.Адрес = o.Адрес_доставки
            GROUP BY p.Адрес
            ORDER BY total_revenue DESC
        `);

        res.render('admin_reports', {
            user: req.session.user,
            orderStats: orderStats[0],
            pharmacyStats
        });
    } catch (err) {
        console.error('Ошибка при получении отчетов:', err);
        res.status(500).send('Ошибка при получении отчетов');
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
}); 