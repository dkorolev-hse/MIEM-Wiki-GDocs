FROM mediawiki:1.32

RUN apt-get update \
	&& apt install -y libtidy-dev pandoc \
	&& apt-get install -y pandoc \
    && docker-php-ext-install tidy \
    && docker-php-ext-enable tidy

RUN php -r "readfile('http://getcomposer.org/installer');" | php -- --install-dir=/usr/bin/ --filename=composer

COPY ./extensions/OAuth /var/www/html/extensions/OAuth
RUN cd /var/www/html/extensions/OAuth \
	&& composer install --no-dev