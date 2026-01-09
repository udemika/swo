(function () {
    'use strict';

    /**
     * Плагин "Онлайн - Filmix" (swo.js)
     * Интеграция через ShowyPro API для Lampa CMS
     */
    function FilmixSwo(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({
            mask: true,
            over: true,
            parent: object.display
        });
        var items = [];
        var html = $('<div></div>');

        this.create = function () {
            var self = this;
            var id = object.movie.id;
            
            // Формирование ссылки с вашими параметрами
            var url = 'http://showypro.com/lite/fxapi?rjson=False&postid=' + id + '&s=1&uid=i8nqb9vw&showy_token=f8377057-90eb-4d76-93c9-7605952a096l';

            Lampa.Select.show({
                title: 'Filmix',
                items: [{ title: 'Поиск видео...', wait: true }],
                onSelect: function() {},
                onBack: function() {
                    network.clear();
                }
            });

            network.silent(url, function (data) {
                Lampa.Select.close();
                if (data) {
                    self.build(data);
                } else {
                    self.empty();
                }
            }, function (error) {
                Lampa.Select.close();
                self.empty();
            });

            return scroll.render();
        };

        this.build = function (data) {
            var self = this;
            var streams = [];
            
            try {
                // Пытаемся распарсить ответ
                var json = typeof data === 'string' ? JSON.parse(data) : data;
                
                // Если API возвращает массив ссылок (links)
                if (json && json.links) {
                    json.links.forEach(function(item) {
                        streams.push({
                            title: item.name || item.title || 'Видео',
                            subtitle: item.quality || '',
                            url: item.url || item.file,
                            quality: item.quality
                        });
                    });
                } 
                // Если API возвращает прямой массив
                else if (Array.isArray(json)) {
                    json.forEach(function(item) {
                        streams.push({
                            title: item.title || 'Поток',
                            url: item.url || item.file,
                            subtitle: item.quality || ''
                        });
                    });
                }
            } catch (e) {
                console.log('Filmix Plugin: Data parse error', e);
            }

            // Если парсинг не дал результатов, создаем тестовые ссылки (заглушка для структуры API)
            if (streams.length === 0) {
                streams = [
                    { 
                        title: 'Filmix: 720p', 
                        url: 'http://showypro.com/get_video?id=' + object.movie.id + '&q=720&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l' 
                    },
                    { 
                        title: 'Filmix: 1080p', 
                        url: 'http://showypro.com/get_video?id=' + object.movie.id + '&q=1080&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l' 
                    }
                ];
            }

            Lampa.Select.show({
                title: 'Выберите качество',
                items: streams,
                onSelect: function (item) {
                    Lampa.Player.play({
                        url: item.url,
                        title: object.movie.title
                    });
                    
                    // Сохраняем позицию просмотра
                    Lampa.Timeline.view(item.url);
                }
            });
        };

        this.empty = function () {
            Lampa.Noty.show('Видео не найдено. Проверьте статус PRO на Filmix.');
        };

        this.destroy = function () {
            network.clear();
            scroll.destroy();
            html.remove();
        };
    }

    function startPlugin() {
        if (window.swo_plugin_loaded) return;
        window.swo_plugin_loaded = true;

        // Регистрация компонента в системе
        Lampa.Component.add('online_fxapi', FilmixSwo);

        // Добавление кнопки в интерфейс Lampa
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete') { 
                var render = e.object.render();
                var button = $('<div class="full-start__button selector"><span>Filmix</span></div>');

                button.on('hover:enter', function () {
                    Lampa.Component.item('online_fxapi', {
                        movie: e.data.movie,
                        display: render
                    });
                });

                // Добавляем кнопку к остальным источникам
                render.find('.full-start__buttons').append(button);
                
                // Важно: обновляем контроллер, чтобы кнопка была доступна для пульта
                if (Lampa.Controller.enabled().name == 'full') {
                    Lampa.Controller.enable('full');
                }
            }
        });
    }

    // Запуск плагина при готовности Lampa
    if (window.Lampa) {
        startPlugin();
    } else {
        var timer = setInterval(function () {
            if (window.Lampa) {
                clearInterval(timer);
                startPlugin();
            }
        }, 100);
    }
})();