$(document).ready(function() {
    // Инициализация кнопок добавления в корзину
    $('.add-to-cart').each(function() {
        const isAvailable = $(this).data('available') === 'true';
        console.log('Проверка доступности:', $(this).data('available'), isAvailable);
        if (!isAvailable) {
            $(this)
                .addClass('unavailable')
                .prop('disabled', true)
                .text('Нет в наличии');
        }
    });

    // Добавление товара в корзину
    $('.add-to-cart').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const productId = $(this).data('id');
        const isAvailable = $(this).data('available');
        
        if (!isAvailable) {
            alert('Этот товар недоступен в вашей аптеке. Пожалуйста, выберите другую аптеку в профиле или выберите другой товар.');
            return;
        }

        console.log('Попытка добавить товар в корзину:', productId);
        
        if (!productId) {
            alert('Ошибка: ID товара не найден');
            return;
        }

        const requestData = { productId: productId };
        console.log('Отправляемые данные:', requestData);

        $.ajax({
            url: '/cart/add',
            method: 'POST',
            data: JSON.stringify(requestData),
            contentType: 'application/json',
            dataType: 'json',
            success: function(response) {
                console.log('Ответ сервера:', response);
                if (response.success) {
                    alert('Товар успешно добавлен в корзину');
                } else {
                    alert(response.error || 'Произошла ошибка при добавлении товара');
                }
            },
            error: function(xhr, status, error) {
                console.error('Ошибка запроса:', {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    responseText: xhr.responseText
                });
                
                if (xhr.status === 401) {
                    window.location.href = '/login';
                } else {
                    alert('Произошла ошибка при добавлении товара. Пожалуйста, попробуйте позже.');
                }
            }
        });
    });

    // Удаление товара из корзины
    $('.remove-from-cart').on('click', function() {
        const productId = $(this).data('id');
        console.log('Удаление товара:', productId);
        
        $.ajax({
            url: '/cart/remove',
            method: 'POST',
            data: { productId: productId },
            success: function(response) {
                console.log('Ответ сервера:', response);
                if (response.success) {
                    location.reload();
                } else {
                    alert(response.error || 'Произошла ошибка при удалении товара');
                }
            },
            error: function(xhr, status, error) {
                console.error('Ошибка запроса:', {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    responseText: xhr.responseText
                });
                alert('Произошла ошибка при удалении товара');
            }
        });
    });

    // Обновление количества товара в корзине
    $('.update-quantity').on('change', function() {
        const productId = $(this).data('id');
        const quantity = $(this).val();
        $.post('/cart/update', { productId: productId, quantity: quantity })
            .done(function(response) {
                if (response.success) {
                    window.location.reload();
                } else {
                    alert(response.error || 'Произошла ошибка при обновлении количества');
                }
            })
            .fail(function() {
                alert('Произошла ошибка при обновлении количества');
            });
    });

    // Фильтрация товаров
    $('#product-filter').on('submit', function(e) {
        e.preventDefault();
        const formData = $(this).serialize();
        window.location.href = '/catalog?' + formData;
    });

    // Валидация форм
    $('.auth-form').on('submit', function(e) {
        const password = $('#password').val();
        if (password.length < 6) {
            e.preventDefault();
            alert('Пароль должен содержать минимум 6 символов');
        }
    });

    // Поиск товаров
    $('#search-form').on('submit', function(e) {
        e.preventDefault();
        const query = $('#search-input').val();
        window.location.href = '/search?q=' + encodeURIComponent(query);
    });
}); 