(function () {
    'use strict';

    function StartSwo() {
        var network = new Lampa.Reguest();
        var base_proxy = 'https://cors.byskaz.ru/';
        var base_url = 'http://showypro.com/lite/fxapi';
        var showy_token = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var uid = 'i8nqb9vw';

        // Парсер HTML в массив объектов для Lampa.Select
        this.parseResponse = function(html) {
            var items = [];
            // Регулярка ищет блоки selector и забирает содержимое data-json
            var regex = /<div[^>]*class="[^"]*selector[^"]*"[^>]*data-json='([^']*)'[^>]*>([\s\S]*?)<\/div>/g;
            var match;

            while ((match = regex.exec(html)) !== null) {
                try {
                    var data = JSON.parse(match[1]);
                    // Извлекаем название из HTML-структуры внутри дива
                    var titleMatch = match[2].match(/class="videos__item-title[^>]*">([^<]+)<\/div>/);
                    var name = titleMatch ? titleMatch[1].trim() : 'Опция';

                    items.push({
                        title: name,
                        method: data.method,
                        url: data.url,
                        // Сохраняем оригинальные данные для плеера
                        quality: data.quality || {}
                    });
                } catch (e) { }
            }
            return items;
        };

        // Главная функция вызова
        this.start = function(params) {
            var url = base_url + '?rjson=False&kinopoisk_id=' + params.movie.kinopoisk_id + '&uid=' + uid + '&showy_token=' + showy_token;
            this.load(url, params.movie.title);
        };

        // Загрузка данных (рекурсивная для сезонов и серий)
        this.load = function(url, title) {
            var _this = this;
            // Всегда оборачиваем в прокси
            var full_url = base_proxy + url.replace(/https?:\/\//, '');

            Lampa.Select.show({
                title: 'Загрузка...',
                items: [{ title: 'Подождите...' }]
            });

            network.silent(full_url, function(str) {
                var items = _this.parseResponse(str);

                if (items.length > 0) {
                    _this.display(items, title);
                } else {
                    Lampa.Noty.show('Данные не найдены или ошибка сервера');
                }
            }, function() {
                Lampa.Noty.show('Ошибка сети через прокси');
            });
        };

        // Отрисовка системного окна
        this.display = function(items, title) {
            var _this = this;

            Lampa.Select.show({
                title: title,
                items: items,
                onSelect: function(item) {
                    if (item.method === 'link') {
                        // Если это ссылка на сезон или озвучку — идем вглубь
                        _this.load(item.url, item.title);
                    } else if (item.method === 'play') {
                        // Если это финальная ссылка на видео
                        _this.play(item);
                    }
                },
                onBack: function() {
                    Lampa.Controller.toggle('full');
                }
            });
        };

        // Запуск плеера
        this.play = function(item) {
            var video = {
                url: item.url,
                title: item.title
            };
            Lampa.Player.play(video);
            Lampa.Player.playlist([video]);
        };
    }

    // Регистрация плагина и создание кнопки
    function init() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite') {
                var btn = $('<div class="full-start__button selector"><span>Смотреть (Swo)</span></div>');
                
                btn.on('hover:enter', function () {
                    var swo = new StartSwo();
                    swo.start(e.data);
                });

                // Добавляем кнопку в стандартную панель кнопок карточки
                $('.full-start__buttons', e.object.render()).append(btn);
                
                // Пересчитываем навигацию, чтобы кнопка стала доступна для пульта
                Lampa.Controller.add('full', {
                    toggle: function () {
                        Lampa.Controller.collectionSet(e.object.render());
                        Lampa.Controller.render().find('.selector').first().focus();
                    }
                });
            }
        });
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') init();
    });

})();