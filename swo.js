(function () {
    'use strict';

    var PLUGIN_NAME = 'Filmix Online';
    var PLUGIN_VER = '1.1.6';
    var EMPTY_URL = 'https://localhost/empty.png'; // Валидный HTTPS URL для заглушки

    console.log('Filmix: Init v' + PLUGIN_VER + ' for HTTPS origin');

    // 1. Стили (без изменений, они стабильны)
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
        .full-start__button.btn--filmix{background:#e67e22 !important;color:#fff !important;margin-right:10px}
        </style>
    `;
    if (!$('style:contains("online-prestige")').length) $('body').append(style);

    // 2. Регистрация с защитой от TypeError: replace
    // Передаем ВСЕ возможные поля, которые может дергать ядро Лампы
    Lampa.Plugins.add({
        name: PLUGIN_NAME,
        version: PLUGIN_VER,
        description: 'Filmix for Zrovid',
        author: 'ShowyPro',
        icon: EMPTY_URL,
        url: EMPTY_URL,
        link: EMPTY_URL,
        help: 'https://lampa.mx'
    });

    function FilmixSwo(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true, parent: object.display });
        
        this.create = function () {
            var self = this;
            var id = object.movie.id;
            // Используем HTTPS прокси и HTTPS API
            var url = 'https://corsproxy.io/?' + encodeURIComponent('http://showypro.com/lite/fxapi?rjson=False&postid=' + id + '&s=1&uid=i8nqb9vw&showy_token=f8377057-90eb-4d76-93c9-7605952a096l');

            Lampa.Select.show({
                title: 'Filmix',
                items: [{ title: 'Поиск (HTTPS)...', wait: true }],
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
                            title: item.name || 'Видео',
                            quality: item.quality || '720p',
                            url: (item.url || item.file || "").replace('http://', 'https://')
                        });
                    });
                }
            } catch (e) { console.error('Filmix: Parse fail', e); }

            if (streams.length === 0) {
                streams = [
                    { title: 'Filmix 720p (Direct)', quality: '720p', url: 'https://corsproxy.io/?' + encodeURIComponent('http://showypro.com/get_video?id=' + object.movie.id + '&q=720&uid=i8nqb9vw&token=f8377057-90eb-4d76-93c9-7605952a096l') }
                ];
            }

            scroll.clear();
            streams.forEach(function(element, index) {
                var html = $(`
                    <div class="online-prestige selector">
                        <div class="online-prestige__img">
                            <img src="${Lampa.TMDB.image('t/p/w300' + object.movie.backdrop_path)}" alt="">
                        </div>
                        <div class="online-prestige__body">
                            <div class="online-prestige__title">${element.title}</div>
                            <div class="online-prestige__quality">${element.quality}</div>
                        </div>
                    </div>
                `);

                html.on('hover:enter', function() {
                    Lampa.Player.play({
                        url: element.url,
                        title: object.movie.title
                    });
                }).on('hover:focus', function(e) {
                    scroll.update($(e.target), true);
                });

                scroll.append(html);
            });
            Lampa.Controller.enable('content');
        };

        this.empty = function () { Lampa.Noty.show('Ничего не найдено'); };
        this.destroy = function () { network.clear(); scroll.destroy(); };
    }

    function startPlugin() {
        if (window.filmix_swo_v116) return;
        window.filmix_swo_v116 = true;

        Lampa.Component.add('online_fxapi', FilmixSwo);

        // Инжекция кнопки через MutationObserver (самый надежный способ)
        var injectButton = function(container, movieData) {
            if (container.find('.btn--filmix').length > 0) return;
            
            var button = $('<div class="full-start__button selector btn--filmix"><span>Filmix</span></div>');
            button.on('hover:enter', function () {
                Lampa.Component.item('online_fxapi', {
                    movie: movieData,
                    display: container.closest('.activity')
                });
            });
            
            // Вставляем перед первой кнопкой или в конец
            var firstBtn = container.find('.selector').first();
            if (firstBtn.length) firstBtn.before(button);
            else container.append(button);
            
            console.log('Filmix: Button injected into', container.attr('class'));
        };

        // Следим за открытием карточки
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = (e.object && e.object.render) ? e.object.render() : null;
                if (!render) return;

                // Запускаем наблюдатель за DOM
                var observer = new MutationObserver(function(mutations) {
                    var target = render.find('.full-start__buttons, .full-movie__buttons, .buttons-list');
                    if (target.length) {
                        injectButton(target, e.data.movie);
                        observer.disconnect(); // Перестаем следить после успеха
                    }
                });

                observer.observe(render[0], { childList: true, subtree: true });
                
                // Пробуем сразу (на случай если уже отрендерено)
                setTimeout(function() {
                    var target = render.find('.full-start__buttons, .full-movie__buttons, .buttons-list');
                    if (target.length) injectButton(target, e.data.movie);
                }, 100);
            }
        });
    }

    if (window.Lampa) startPlugin();
    else {
        var wait = setInterval(function () {
            if (window.Lampa) { clearInterval(wait); startPlugin(); }
        }, 100);
    }
})();