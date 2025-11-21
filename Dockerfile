# PHP 8.2 com servidor embutido
FROM php:8.2-cli

# Dependências p/ GD e ZIP
RUN apt-get update && apt-get install -y \
    libpng-dev libjpeg-dev libfreetype6-dev libzip-dev unzip git curl \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install -j$(nproc) gd zip opcache

# Instala Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Copia o projeto
WORKDIR /app
COPY . /app

# Instala as deps (gera vendor no container)
RUN composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction

# Porta do Railway
ENV PORT=8080
EXPOSE 8080

# Se seu index.php está em ./public
CMD ["php", "-S", "0.0.0.0:8080", "-t", "public"]
# Se estiver em juliano-dashboard/public, troque a linha acima por:
# CMD ["php", "-S", "0.0.0.0:8080", "-t", "juliano-dashboard/public"]
