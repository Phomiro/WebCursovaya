const bcrypt = require('bcrypt');

const password = 'test123';
bcrypt.hash(password, 10, function(err, hash) {
    if (err) {
        console.error('Ошибка при хешировании пароля:', err);
        return;
    }
    console.log('Хешированный пароль:', hash);
}); 