(function () {
    'use strict';

    // Константы для предотвращения ошибок undefined
    var EMPTY_URL = 'about:blank';
    var PLUGIN_NAME = 'Filmix Online';
    var PLUGIN_VER = '1.1.5';

    console.log('Filmix: Starting v' + PLUGIN_VER + ' for zrovid.com');

    // 1. Стили
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
    if (!$('style:contains("online-prestige")').length) $('body').append(style);

    // 2. Регистрация плагина с защитой от 404 (добавляем иконку)
    Lampa.Plugins.add({
        name: PLUGIN_NAME,
        version: PLUGIN_VER,
        description: 'Просмотр Filmix через ShowyPro API',
        author: 'ShowyPro',
        icon: EMPTY_URL, // Предотвращает 404 /undefined
        help: 'Версия адаптированная под zrovid.com'
    });

    function FilmixSwo(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true, parent: object.display });
        
        this.create = function () {
            var self = this;
            var id = object.movie.id;
            // API ShowyPro
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
            var streams = [];
            try {
                var json = typeof data === 'string' ? JSON.parse(data) : data;
                if (json && json.links) {
                    json.links.forEach(function(item) {
                        streams.push({
                            title: item.name || item.title || 'Видео',
                            quality: item.quality || '720p',
                            url: item.url || item.file || EMPTY_URL
                        });
                    });
                }
            } catch (e) { console.error('Filmix: Data error', e); }

            if (streams.length === 0) {
                streams = [
                    { title: 'Filmix 720p', quality: '720p', url: 'http://showypro.com/get_video?id=' + object.movie.id + '&q=720&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l' },
                    { title: 'Filmix 1080p', quality: '1080p', url: 'http://showypro.com/get_video?id=' + object.movie.id + '&q=1080&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l' }
                ];
            }

            scroll.clear();
            streams.forEach(function(element, index) {
                var html = $(`
                    <div class="online-prestige selector">
                        <div class="online-prestige__img">
                            <img src="${Lampa.TMDB.image('t/p/w300' + object.movie.backdrop_path)}" alt="">
                            <div class="online-prestige__episode-number">${index + 1}</div>
                        </div>
                        <div class="online-prestige__body">
                            <div class="online-prestige__title">${element.title}</div>
                            <div class="online-prestige__info">
                                <span>Источник Filmix</span>
                                <span class="online-prestige__quality">${element.quality}</span>
                            </div>
                        </div>
                    </div>
                `);

                html.on('hover:enter', function() {
                    if (element.url === EMPTY_URL) return Lampa.Noty.show('Ссылка не найдена');
                    Lampa.Player.play({
                        url: element.url,
                        title: object.movie.title + ' (' + element.quality + ')'
                    });
                }).on('hover:focus', function(e) {
                    scroll.update($(e.target), true);
                });

                scroll.append(html);
            });

            Lampa.Controller.enable('content');
        };

        this.empty = function () {
            Lampa.Noty.show('Потоки не найдены.');
        };

        this.destroy = function () {
            network.clear();
            scroll.destroy();
        };
    }

    function startPlugin() {
        if (window.filmix_swo_loaded) return;
        window.filmix_swo_loaded = true;

        Lampa.Component.add('online_fxapi', FilmixSwo);

        // Кнопка в меню "Онлайн"
        Lampa.Listener.follow('online', function (e) {
            if (e.type == 'before') {
                e.items.push({
                    title: 'Filmix',
                    source: 'online_fxapi'
                });
            }
        });

        // Кнопка в карточке (Ultimate Inject)
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var injectTimer = 0;
                var tryInject = function() {
                    var render = (e.object && e.object.render) ? e.object.render() : 
                                 (e.object && e.object.activity && e.object.activity.render) ? e.object.activity.render() : null;

                    if (!render) {
                        if (injectTimer < 10) { injectTimer++; setTimeout(tryInject, 500); }
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

                    // Ищем куда вставить
                    var containers = ['.full-start__buttons', '.full-movie__buttons', '.full-descr__buttons', '.buttons-list', '.full-movie__main-info'];
                    var found = false;
                    
                    for (var i = 0; i < containers.length; i++) {
                        var c = render.find(containers[i]);
                        if (c.length) {
                            c.append(button);
                            found = true;
                            break;
                        }
                    }

                    if (!found) {
                        // Если контейнеры не найдены, ищем любую кнопку и встаем после нее
                        var anyBtn = render.find('.full-start__button, .selector').first();
                        if (anyBtn.length) {
                            anyBtn.after(button);
                        } else {
                            render.append(button);
                        }
                    }
                    
                    // Обновляем контроллер, чтобы кнопка стала кликабельной
                    if (Lampa.Controller.enabled().name == 'full') Lampa.Controller.enable('full');
                };
                tryInject();
            }
        });
    }

    // Запуск
    if (window.Lampa) startPlugin();
    else {
        var waitLampa = setInterval(function () {
            if (window.Lampa) { clearInterval(waitLampa); startPlugin(); }
        }, 100);
    }
})();