CREATE DATABASE IF NOT EXISTS pharmacy_db;
USE pharmacy_db;

-- Создание таблицы пользователей
CREATE TABLE users (
    UserID INT PRIMARY KEY AUTO_INCREMENT,
    ФИО VARCHAR(255),
    Email VARCHAR(255) UNIQUE,
    Пароль VARCHAR(255),
    Роль ENUM('client', 'admin', 'pharmacist')
);

-- Создание таблицы клиентов
CREATE TABLE clients (
    UserID INT PRIMARY KEY,
    Адрес_доставки VARCHAR(255),
    Номер_телефона VARCHAR(20),
    История_заказов TEXT,
    FOREIGN KEY (UserID) REFERENCES users(UserID)
);

-- Создание таблицы фармацевтов
CREATE TABLE pharmacists (
    UserID INT PRIMARY KEY,
    PharmacyID INT,
    Обработанные_заказы TEXT,
    FOREIGN KEY (UserID) REFERENCES users(UserID)
);

-- Создание таблицы аптек
CREATE TABLE pharmacies (
    PharmacyID INT PRIMARY KEY AUTO_INCREMENT,
    Название VARCHAR(255),
    Адрес VARCHAR(255),
    Сотрудники TEXT,
    Доступные_товары TEXT,
    Часы_работы VARCHAR(255)
);

-- Создание таблицы продуктов
CREATE TABLE products (
    ProductID INT PRIMARY KEY AUTO_INCREMENT,
    Название VARCHAR(255),
    Описание TEXT,
    Производитель VARCHAR(255),
    Страна_производитель VARCHAR(255),
    Срок_годности DATE,
    Форма VARCHAR(255),
    Дозировка VARCHAR(255),
    В_упаковке INT,
    Вид_товара ENUM('лекарство', 'медицинское изделие', 'косметика'),
    Действующее_вещество VARCHAR(255),
    Цена DECIMAL(10,2),
    Наличие BOOLEAN
);

-- Создание таблицы заказов
CREATE TABLE orders (
    OrderID INT PRIMARY KEY AUTO_INCREMENT,
    UserID INT,
    Список_товаров TEXT,
    Итоговая_цена DECIMAL(10,2),
    Статус ENUM('создан', 'обработан', 'доставляется', 'выполнен'),
    Адрес_доставки VARCHAR(255),
    Способ_оплаты VARCHAR(50),
    Промокод VARCHAR(50),
    Дата_начала_заказа DATETIME,
    Дата_окончания_заказа DATETIME,
    FOREIGN KEY (UserID) REFERENCES users(UserID)
);

-- Создание таблицы корзины
CREATE TABLE carts (
    CartID INT PRIMARY KEY AUTO_INCREMENT,
    UserID INT,
    Список_товаров TEXT,
    Количество_товаров INT,
    Итоговая_цена DECIMAL(10,2),
    Наличие_рецептурных BOOLEAN,
    FOREIGN KEY (UserID) REFERENCES users(UserID)
);
