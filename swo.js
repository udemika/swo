(function () {
    'use strict';

    console.log('Filmix: Ultimate Plugin v1.1.4 merging started...');

    // 1. Добавляем стили из референсного файла для красивого отображения
    var style = `
        <style>
        .online-prestige{position:relative;border-radius:.3em;background-color:rgba(0,0,0,0.3);display:flex;will-change:transform;margin-top:1em}
        .online-prestige__body{padding:1.2em;line-height:1.3;flex-grow:1;position:relative}
        .online-prestige__img{position:relative;width:13em;flex-shrink:0;min-height:8.2em;background:rgba(255,255,255,0.05);border-radius:.3em;overflow:hidden}
        .online-prestige__img img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .3s}
        .online-prestige__img--loaded img{opacity:1}
        .online-prestige__title{font-size:1.4em;font-weight:bold;margin-bottom:0.4em}
        .online-prestige__quality{color:#e67e22;font-weight:bold;margin-left:1em}
        .online-prestige.focus{background:#fff;color:#000}
        .online-prestige.focus .online-prestige__quality{color:#d35400}
        .online-prestige__episode-number{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:2em;font-weight:black;color:rgba(255,255,255,0.5)}
        .full-start__button.btn--filmix{background:#e67e22 !important;color:#fff !important}
        </style>
    `;
    $('body').append(style);

    // 2. Метаданные
    Lampa.Plugins.add({
        name: 'Filmix Online',
        version: '1.1.4',
        description: 'Просмотр Filmix (Ultimate Merge)',
        author: 'ShowyPro',
        help: 'Версия с исправленными ошибками инъекции'
    });

    function FilmixSwo(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true, parent: object.display });
        var files = new Lampa.Explorer(object);
        
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
                if (data) self.build(data);
                else self.empty();
            }, function () {
                Lampa.Select.close();
                self.empty();
            });

            return scroll.render();
        };

        this.build = function (data) {
            var self = this;
            var streams = [];
            try {
                var json = typeof data === 'string' ? JSON.parse(data) : data;
                if (json && json.links) {
                    json.links.forEach(function(item) {
                        streams.push({
                            title: item.name || item.title || 'Видео',
                            quality: item.quality || '720p',
                            url: item.url || item.file,
                            img: Lampa.TMDB.image('t/p/w300' + object.movie.backdrop_path)
                        });
                    });
                }
            } catch (e) { console.warn('Filmix Parse error', e); }

            if (streams.length === 0) {
                streams = [
                    { title: 'Filmix (Direct): 720p', quality: '720p', url: 'http://showypro.com/get_video?id=' + object.movie.id + '&q=720&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l' },
                    { title: 'Filmix (Direct): 1080p', quality: '1080p', url: 'http://showypro.com/get_video?id=' + object.movie.id + '&q=1080&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l' }
                ];
            }

            scroll.clear();
            streams.forEach(function(element, index) {
                // Защита от ошибок replace/undefined
                var streamUrl = element.url || "";
                
                var html = $(`
                    <div class="online-prestige selector">
                        <div class="online-prestige__img">
                            <img src="${Lampa.TMDB.image('t/p/w300' + object.movie.backdrop_path)}" alt="">
                            <div class="online-prestige__episode-number">${index + 1}</div>
                        </div>
                        <div class="online-prestige__body">
                            <div class="online-prestige__title">${element.title}</div>
                            <div class="online-prestige__info">
                                <span>Filmix Source</span>
                                <span class="online-prestige__quality">${element.quality}</span>
                            </div>
                        </div>
                    </div>
                `);

                html.find('img').on('load', function() {
                    $(this).parent().addClass('online-prestige__img--loaded');
                });

                html.on('hover:enter', function() {
                    if (!streamUrl) return Lampa.Noty.show('Ссылка отсутствует');
                    Lampa.Player.play({
                        url: streamUrl,
                        title: object.movie.title + (element.title ? ' / ' + element.title : '')
                    });
                }).on('hover:focus', function(e) {
                    scroll.update($(e.target), true);
                });

                scroll.append(html);
            });

            Lampa.Controller.enable('content');
        };

        this.empty = function () {
            Lampa.Noty.show('Потоки не найдены. Проверьте подписку ShowyPro.');
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

        // Интеграция в меню "Онлайн"
        Lampa.Listener.follow('online', function (e) {
            if (e.type == 'before') {
                e.items.push({
                    title: 'Filmix',
                    source: 'online_fxapi'
                });
            }
        });

        // Интеграция в карточку фильма (агрессивная)
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var tryInject = function(attempts) {
                    var render = (e.object && e.object.render) ? e.object.render() : 
                                 (e.object && e.object.activity && e.object.activity.render) ? e.object.activity.render() : null;

                    if (!render) {
                        if (attempts > 0) setTimeout(function() { tryInject(attempts - 1); }, 300);
                        return;
                    }

                    if (render.find('.btn--filmix').length > 0) return;

                    var button = $('<div class="full-start__button selector btn--filmix"><span>Filmix</span></div>');
                    button.on('hover:enter', function () {
                        Lampa.Component.item('online_fxapi', {
                            movie: e.data.movie,
                            display: render
                        });
                    });

                    var selectors = ['.full-start__buttons', '.full-movie__buttons', '.full-descr__buttons', '.buttons-list'];
                    var container = render.find(selectors.join(', '));
                    
                    if (container.length > 0) {
                        container.append(button);
                    } else if (attempts > 0) {
                        setTimeout(function() { tryInject(attempts - 1); }, 500);
                    } else {
                        // Фолбэк в описание
                        render.find('.full-movie__descr, .full-movie__text').first().before(button);
                    }
                };
                tryInject(6);
            }
        });
    }

    if (window.Lampa) startPlugin();
    else {
        var timer = setInterval(function () {
            if (window.Lampa) { clearInterval(timer); startPlugin(); }
        }, 100);
    }
})();