$(document).ready(function () {
    $('.add-to-cart').each(function () {
        const button = $(this);
        const isAvailable = button.data('available') === true || button.data('available') === 'true';

        if (!isAvailable) {
            button.addClass('unavailable').prop('disabled', true).text('Нет в наличии');
        } else {
            button.removeClass('unavailable').prop('disabled', false).text('В корзину');
        }
    });

    $('.add-to-cart').on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const button = $(this);
        const productId = button.data('id');
        const isAvailable = button.data('available') === true || button.data('available') === 'true';

        if (!isAvailable) {
            alert('Этот товар недоступен в вашей аптеке. Пожалуйста, выберите другую аптеку или другой товар.');
            return;
        }

        $.ajax({
            url: '/cart/add',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ productId: productId }),
            success: function (response) {
                if (response.success) {
                    alert('Товар успешно добавлен в корзину!');
                    location.reload(); 
                } else {
                    alert(response.error || 'Не удалось добавить товар в корзину');
                }
            },
            error: function (xhr, status, error) {
                console.error('Ошибка при добавлении товара:', error);
                alert('Произошла ошибка при добавлении товара в корзину');
            }
        });
    });

    $('.remove-from-cart').on('click', function (e) {
        e.preventDefault();
        const productId = $(this).data('id');

        $.ajax({
            url: '/cart/remove',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ productId: productId }),
            success: function (response) {
                if (response.success) {
                    alert('Товар удален из корзины');
                    location.reload();
                } else {
                    alert(response.error || 'Не удалось удалить товар');
                }
            },
            error: function (xhr, status, error) {
                console.error('Ошибка при удалении товара:', error);
                alert('Произошла ошибка при удалении товара');
            }
        });
    });

    $('.quantity-input').on('change', function () {
        const input = $(this);
        const productId = input.data('id');
        const quantity = parseInt(input.val());

        if (isNaN(quantity) || quantity < 1) {
            alert('Количество должно быть больше нуля');
            input.val(1);
            return;
        }

        $.ajax({
            url: '/cart/update',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ productId: productId, quantity: quantity }),
            success: function (response) {
                if (response.success) {
                    location.reload();
                } else {
                    alert(response.error || 'Не удалось обновить количество');
                }
            },
            error: function (xhr, status, error) {
                console.error('Ошибка при обновлении количества:', error);
                alert('Произошла ошибка при обновлении количества');
            }
        });
    });

    $('#checkout-form').on('submit', function (e) {
        e.preventDefault();

        const form = $(this);
        const address = form.find('#address').val();
        const payment = form.find('#payment').val();
        const promo = form.find('#promo').val();

        $.ajax({
            url: '/checkout',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ address: address, payment: payment, promo: promo }),
            success: function (response) {
                window.location.href = '/order_success';
            },
            error: function (xhr, status, error) {
                console.error('Ошибка при оформлении заказа:', error);
                alert('Произошла ошибка при оформлении заказа');
            }
        });
    });
});