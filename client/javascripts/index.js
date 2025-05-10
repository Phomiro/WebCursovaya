document.addEventListener('DOMContentLoaded', function() {
    const addToCartButtons = document.querySelectorAll('.add-to-cart');
    
    addToCartButtons.forEach(button => {
        // Проверяем доступность товара
        const isAvailable = button.dataset.available === 'true';
        console.log('Доступность товара на главной:', button.dataset.available, isAvailable);
        
        if (!isAvailable) {
            button.classList.add('unavailable');
            button.disabled = true;
            button.textContent = 'Нет в наличии';
            return;
        }

        button.addEventListener('click', function(e) {
            e.preventDefault();
            const productId = this.dataset.id;
            const isAvailable = this.dataset.available === 'true';
            
            if (!isAvailable) {
                alert('Этот товар недоступен в вашей аптеке. Пожалуйста, выберите другую аптеку в профиле или выберите другой товар.');
                return;
            }
            
            fetch('/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ productId: productId })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Товар добавлен в корзину');
                } else {
                    alert(data.error || 'Ошибка при добавлении товара в корзину');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Произошла ошибка при добавлении товара в корзину');
            });
        });
    });
}); 