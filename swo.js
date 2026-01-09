(function () {
    'use strict';

    var PLUGIN_ID = 'filmix_showy_zfix';
    var PLUGIN_VER = '1.1.7';
    // Используем пустой пиксель для иконок, чтобы не было 404
    var SAFE_EMPTY = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    console.log('Filmix Z-FIX: Booting v' + PLUGIN_VER);

    // 1. Стили
    var style = `
        <style>
        .online-fx-item{position:relative;border-radius:.5em;background:rgba(255,255,255,0.05);display:flex;margin-top:10px;transition:all 0.2s}
        .online-fx-item.focus{background:#fff;color:#000;transform:scale(1.02)}
        .online-fx-item__body{padding:15px;flex-grow:1}
        .online-fx-item__title{font-size:1.2em;font-weight:bold}
        .online-fx-item__quality{color:#e67e22;margin-left:10px}
        .btn--filmix-main{background:#e67e22 !important;color:#fff !important;box-shadow: 0 4px 15px rgba(230,126,34,0.3)}
        </style>
    `;
    if (!$('style:contains("online-fx-item")').length) $('body').append(style);

    // 2. Регистрация (устраняем TypeError и 404)
    var manifest = {
        name: 'Filmix Z-FIX',
        version: PLUGIN_VER,
        description: 'Adapted Filmix for zrovid.com',
        author: 'Showy',
        icon: SAFE_EMPTY,
        url: SAFE_EMPTY, // Фикс для rewriteIfHTTPS
        link: SAFE_EMPTY
    };

    Lampa.Plugins.add(manifest);

    function FilmixComponent(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true, parent: object.display });
        
        this.create = function () {
            var self = this;
            // Используем HTTPS прокси для обхода Mixed Content
            var targetUrl = 'http://showypro.com/lite/fxapi?rjson=False&postid=' + object.movie.id + '&s=1&uid=i8nqb9vw&showy_token=f8377057-90eb-4d76-93c9-7605952a096l';
            var proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(targetUrl);

            Lampa.Select.show({
                title: 'Filmix',
                items: [{ title: 'Загрузка потоков...', wait: true }],
                onBack: function() { network.clear(); }
            });

            network.silent(proxyUrl, function (response) {
                Lampa.Select.close();
                try {
                    var data = JSON.parse(response.contents);
                    self.build(data);
                } catch(e) { self.empty(); }
            }, function () {
                Lampa.Select.close();
                self.empty();
            });

            return scroll.render();
        };

        this.build = function (data) {
            var streams = [];
            if (data && data.links) {
                data.links.forEach(function(l) {
                    streams.push({ title: l.name, quality: l.quality, url: l.url.replace('http://', 'https://') });
                });
            }

            if (!streams.length) {
                streams.push({ title: 'Filmix Direct 720p', quality: '720p', url: 'https://showypro.com/get_video?id='+object.movie.id+'&q=720&uid=i8nqb9vw' });
            }

            scroll.clear();
            streams.forEach(function(element) {
                var html = $(`
                    <div class="online-fx-item selector">
                        <div class="online-fx-item__body">
                            <span class="online-fx-item__title">${element.title}</span>
                            <span class="online-fx-item__quality">${element.quality}</span>
                        </div>
                    </div>
                `);

                html.on('hover:enter', function() {
                    Lampa.Player.play({ url: element.url, title: object.movie.title });
                }).on('hover:focus', function(e) {
                    scroll.update($(e.target), true);
                });

                scroll.append(html);
            });
            Lampa.Controller.enable('content');
        };

        this.empty = function () { Lampa.Noty.show('Потоки не найдены'); };
        this.destroy = function () { network.clear(); scroll.destroy(); };
    }

    function init() {
        if (window.filmix_z_init) return;
        window.filmix_z_init = true;

        Lampa.Component.add('online_filmix_z', FilmixComponent);

        // Инжекция кнопки
        var addBtn = function(container, data) {
            if (container.find('.btn--filmix-main').length) return;
            var btn = $('<div class="full-start__button selector btn--filmix-main"><span>Filmix</span></div>');
            btn.on('hover:enter', function() {
                Lampa.Component.item('online_filmix_z', { movie: data, display: container.closest('.activity') });
            });
            container.append(btn);
        };

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = (e.object && e.object.render) ? e.object.render() : null;
                if (!render) return;

                // Наблюдаем за появлением блоков кнопок
                var obs = new MutationObserver(function() {
                    var target = render.find('.full-start__buttons, .full-movie__buttons, .buttons-list, .full-movie__actions, .full-movie__main-info');
                    if (target.length) {
                        addBtn(target.first(), e.data.movie);
                        // Не отключаем, так как кнопки могут перерисовываться при смене вкладок
                    }
                });
                obs.observe(render[0], { childList: true, subtree: true });
            }
        });
    }

    if (window.Lampa) init();
    else {
        var interval = setInterval(function () {
            if (window.Lampa) { clearInterval(interval); init(); }
        }, 100);
    }
})();