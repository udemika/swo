(function () {
    'use strict';

    /**
     * Плагин: Filmix Online (swo.js)
     * Описание: Просмотр контента с Filmix через ShowyPro API
     */
    
    // Регистрируем плагин в системе Lampa для отображения в настройках
    Lampa.Plugins.add({
        name: 'Filmix Online',
        version: '1.0.8',
        description: 'Просмотр фильмов и сериалов через Filmix API',
        author: 'ShowyPro'
    });

    function FilmixSwo(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({
            mask: true,
            over: true,
            parent: object.display
        });
        
        this.create = function () {
            var self = this;
            var id = object.movie.id;
            var url = 'http://showypro.com/lite/fxapi?rjson=False&postid=' + id + '&s=1&uid=i8nqb9vw&showy_token=f8377057-90eb-4d76-93c9-7605952a096l';

            Lampa.Select.show({
                title: 'Filmix',
                items: [{ title: 'Загрузка...', wait: true }],
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
            var streams = [];
            try {
                var json = typeof data === 'string' ? JSON.parse(data) : data;
                if (json && json.links) {
                    json.links.forEach(function(item) {
                        streams.push({
                            title: item.name || item.title || 'Видео',
                            subtitle: item.quality || '',
                            url: item.url || item.file
                        });
                    });
                }
            } catch (e) { }

            if (streams.length === 0) {
                // Прямые ссылки на Filmix (fallback)
                streams = [
                    { title: 'Filmix: 720p', url: 'http://showypro.com/get_video?id=' + object.movie.id + '&q=720&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l' },
                    { title: 'Filmix: 1080p', url: 'http://showypro.com/get_video?id=' + object.movie.id + '&q=1080&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l' }
                ];
            }

            Lampa.Select.show({
                title: 'Качество',
                items: streams,
                onSelect: function (item) {
                    Lampa.Player.play({
                        url: item.url,
                        title: object.movie.title
                    });
                    Lampa.Timeline.view(item.url);
                }
            });
        };

        this.empty = function () {
            Lampa.Noty.show('Видео не найдено. Проверьте PRO-аккаунт.');
        };

        this.destroy = function () {
            network.clear();
            scroll.destroy();
        };
    }

    function startPlugin() {
        if (window.swo_plugin_loaded) return;
        window.swo_plugin_loaded = true;

        Lampa.Component.add('online_fxapi', FilmixSwo);

        // Слушаем оба варианта события для совместимости
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.render();
                
                // Проверяем, не добавлена ли кнопка уже
                if (render.find('.btn--filmix').length > 0) return;

                var button = $('<div class="full-start__button selector btn--filmix"><span>Filmix</span></div>');

                button.on('hover:enter', function () {
                    Lampa.Component.item('online_fxapi', {
                        movie: e.data.movie,
                        display: render
                    });
                });

                // Вставляем кнопку в карточку
                var container = render.find('.full-start__buttons');
                if (container.length > 0) {
                    container.append(button);
                    if (Lampa.Controller.enabled().name == 'full') {
                        Lampa.Controller.enable('full');
                    }
                }
            }
        });
    }

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