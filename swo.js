(function () {
    'use strict';

    console.log('Filmix: Plugin initialization started...');

    // Метаданные для Lampa
    Lampa.Plugins.add({
        name: 'Filmix Online',
        version: '1.1.2',
        description: 'Просмотр Filmix через ShowyPro API',
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

            console.log('Filmix: Requesting URL:', url);

            Lampa.Select.show({
                title: 'Filmix',
                items: [{ title: 'Поиск потоков...', wait: true }],
                onBack: function() { network.clear(); }
            });

            network.silent(url, function (data) {
                Lampa.Select.close();
                if (data) {
                    console.log('Filmix: Data received successfully');
                    self.build(data);
                } else {
                    console.error('Filmix: No data returned from API');
                    self.empty();
                }
            }, function (error) {
                console.error('Filmix: Network error', error);
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
                    { title: 'Filmix: 720p (Direct)', url: 'http://showypro.com/get_video?id=' + object.movie.id + '&q=720&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l' },
                    { title: 'Filmix: 1080p (Direct)', url: 'http://showypro.com/get_video?id=' + object.movie.id + '&q=1080&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l' }
                ];
            }

            Lampa.Select.show({
                title: 'Выберите качество',
                items: streams,
                onSelect: function (item) {
                    console.log('Filmix: Playing URL:', item.url);
                    Lampa.Player.play({
                        url: item.url,
                        title: object.movie.title
                    });
                    Lampa.Timeline.view(item.url);
                }
            });
        };

        this.empty = function () {
            Lampa.Noty.show('Потоки не найдены. Проверьте подписку.');
        };

        this.destroy = function () {
            network.clear();
            scroll.destroy();
        };
    }

    function startPlugin() {
        if (window.swo_plugin_loaded) return;
        window.swo_plugin_loaded = true;

        console.log('Filmix: Plugin registered as online_fxapi');
        Lampa.Component.add('online_fxapi', FilmixSwo);

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                console.log('Filmix: Full event triggered', e.type);

                var tryInject = function(attempts) {
                    try {
                        var render;
                        if (e.object && typeof e.object.render === 'function') {
                            render = e.object.render();
                        } else if (e.object && e.object.activity && typeof e.object.activity.render === 'function') {
                            render = e.object.activity.render();
                        } else if (e.object && e.object.activity && e.object.activity.component && typeof e.object.activity.component.render === 'function') {
                            render = e.object.activity.component.render();
                        }

                        if (!render) {
                            if (attempts > 0) setTimeout(function() { tryInject(attempts - 1); }, 200);
                            return;
                        }

                        if (render.find('.btn--filmix').length > 0) return;

                        var button = $('<div class="full-start__button selector btn--filmix" style="background: #e67e22 !important; color: #fff !important;"><span>Filmix</span></div>');

                        button.on('hover:enter', function () {
                            console.log('Filmix: Button clicked');
                            Lampa.Component.item('online_fxapi', {
                                movie: e.data.movie,
                                display: render
                            });
                        });

                        // Еще более широкий список селекторов
                        var selectors = [
                            '.full-start__buttons',
                            '.full-movie__buttons',
                            '.full-start__actions',
                            '.full-movie__actions',
                            '.full-descr__buttons',
                            '.full-movie__main-info'
                        ];
                        
                        var container = render.find(selectors.join(', '));
                        
                        if (container.length > 0) {
                            container.append(button);
                            console.log('Filmix: Button injected successfully into:', container.attr('class'));
                            
                            if (Lampa.Controller.enabled().name == 'full') {
                                Lampa.Controller.enable('full');
                            }
                        } else {
                            if (attempts > 0) {
                                console.log('Filmix: Container not found, retrying... Attempts left:', attempts);
                                setTimeout(function() { tryInject(attempts - 1); }, 300);
                            } else {
                                console.warn('Filmix: Final attempt failed. Container not found.');
                                // Крайний случай: добавляем просто в конец render
                                render.append(button);
                                console.log('Filmix: Button appended to main render as fallback');
                            }
                        }
                    } catch (err) {
                        console.error('Filmix: Injection error', err);
                    }
                };

                // Запускаем попытки вставки (5 попыток с интервалом)
                tryInject(5);
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