(function () {
    'use strict';

    console.log('Filmix: Plugin v1.1.3 initialization...');

    // Метаданные для Lampa
    Lampa.Plugins.add({
        name: 'Filmix Online',
        version: '1.1.3',
        description: 'Просмотр Filmix через ShowyPro API (Fixed for zrovid)',
        author: 'ShowyPro',
        help: 'Для работы требуется PRO аккаунт Filmix'
    });

    function FilmixSwo(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true, parent: object.display });
        
        this.create = function () {
            var self = this;
            var id = object.movie.id;
            var url = 'http://showypro.com/lite/fxapi?rjson=False&postid=' + id + '&s=1&uid=i8nqb9vw&showy_token=f8377057-90eb-4d76-93c9-7605952a096l';

            Lampa.Select.show({
                title: 'Filmix',
                items: [{ title: 'Поиск потоков...', wait: true }],
                onBack: function() { network.clear(); }
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
            } catch (e) { console.warn('Filmix: Parse error', e); }

            if (streams.length === 0) {
                streams = [
                    { title: 'Filmix: 720p', url: 'http://showypro.com/get_video?id=' + object.movie.id + '&q=720&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l' },
                    { title: 'Filmix: 1080p', url: 'http://showypro.com/get_video?id=' + object.movie.id + '&q=1080&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l' }
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
                    Lampa.Timeline.view(item.url);
                }
            });
        };

        this.empty = function () {
            Lampa.Noty.show('Потоки Filmix не найдены.');
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

        // 1. Добавляем в список "Онлайн" (если есть такая кнопка)
        Lampa.Listener.follow('online', function (e) {
            if (e.type == 'before') {
                e.items.push({
                    title: 'Filmix',
                    source: 'online_fxapi'
                });
            }
        });

        // 2. Добавляем отдельную кнопку на карточку
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var tryInject = function(attempts) {
                    try {
                        var render;
                        if (e.object && typeof e.object.render === 'function') render = e.object.render();
                        else if (e.object && e.object.activity && typeof e.object.activity.render === 'function') render = e.object.activity.render();

                        if (!render) {
                            if (attempts > 0) setTimeout(function() { tryInject(attempts - 1); }, 300);
                            return;
                        }

                        if (render.find('.btn--filmix').length > 0) return;

                        var button = $('<div class="full-start__button selector btn--filmix" style="background: #e67e22 !important; color: #fff !important; margin-bottom: 10px;"><span>Filmix</span></div>');

                        button.on('hover:enter', function () {
                            Lampa.Component.item('online_fxapi', {
                                movie: e.data.movie,
                                display: render
                            });
                        });

                        // Огромный список селекторов для разных сборок
                        var selectors = [
                            '.full-start__buttons',
                            '.full-movie__buttons',
                            '.full-start__actions',
                            '.full-movie__actions',
                            '.full-descr__buttons',
                            '.full-movie__main-info',
                            '.full-movie__btns',
                            '.buttons-list'
                        ];
                        
                        var container = render.find(selectors.join(', '));
                        
                        if (container.length > 0) {
                            container.append(button);
                            console.log('Filmix: Injected to container');
                        } else if (attempts > 0) {
                            setTimeout(function() { tryInject(attempts - 1); }, 400);
                        } else {
                            // Plan C: Вставляем просто перед описанием
                            var fallback = render.find('.full-movie__descr, .full-movie__text, .full-movie__info').first();
                            if (fallback.length > 0) {
                                fallback.before(button);
                                console.log('Filmix: Injected via fallback before description');
                            } else {
                                render.append(button);
                                console.log('Filmix: Appended to end of render');
                            }
                        }

                        if (Lampa.Controller.enabled().name == 'full') Lampa.Controller.enable('full');
                    } catch (err) { console.error('Filmix error:', err); }
                };

                tryInject(6);
            }
        });
    }

    if (window.Lampa) startPlugin();
    else {
        var timer = setInterval(function () {
            if (window.Lampa) {
                clearInterval(timer);
                startPlugin();
            }
        }, 100);
    }
})();