(function () {
    'use strict';

    var PLUGIN_ID = 'filmix_ultra_z';
    var PLUGIN_VER = '1.1.8';
    var OFFICIAL_URL = 'https://lampa.mx/';

    console.log('Filmix Ultra: Start v' + PLUGIN_VER);

    // 1. Стили
    var style = `
        <style>
        .online-fx-v2{position:relative;border-radius:.5em;background:rgba(255,255,255,0.05);display:flex;margin-top:10px;border:1px solid rgba(255,255,255,0.1)}
        .online-fx-v2.focus{background:#fff;color:#000;border-color:#fff}
        .online-fx-v2__body{padding:12px 15px;flex-grow:1;display:flex;justify-content:space-between;align-items:center}
        .online-fx-v2__title{font-size:1.1em;font-weight:bold}
        .online-fx-v2__quality{background:#e67e22;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.8em;font-weight:bold}
        .btn--filmix-ultra{background:#ff9800 !important;color:#fff !important;font-weight:bold !important}
        </style>
    `;
    if (!$('style:contains("online-fx-v2")').length) $('body').append(style);

    // 2. Регистрация (красивый вид в каталоге)
    Lampa.Plugins.add({
        name: 'Filmix Ultra',
        version: PLUGIN_VER,
        description: 'Специальный фикс Filmix для zrovid.com',
        author: 'Showy',
        icon: OFFICIAL_URL + 'favicon.ico',
        url: OFFICIAL_URL,
        link: OFFICIAL_URL
    });

    function FilmixComponent(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true, parent: object.display });
        
        this.create = function () {
            var self = this;
            var target = 'http://showypro.com/lite/fxapi?rjson=False&postid=' + object.movie.id + '&s=1&uid=i8nqb9vw&showy_token=f8377057-90eb-4d76-93c9-7605952a096l';
            var proxy = 'https://api.allorigins.win/get?url=' + encodeURIComponent(target);

            Lampa.Select.show({
                title: 'Filmix Ultra',
                items: [{ title: 'Поиск потоков...', wait: true }],
                onBack: function() { network.clear(); }
            });

            network.silent(proxy, function (res) {
                Lampa.Select.close();
                try {
                    var data = JSON.parse(res.contents);
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
                streams.push({ title: 'Поток 720p (Авто)', quality: '720p', url: 'https://showypro.com/get_video?id='+object.movie.id+'&q=720&uid=i8nqb9vw' });
            }

            scroll.clear();
            streams.forEach(function(element) {
                var html = $(`
                    <div class="online-fx-v2 selector">
                        <div class="online-fx-v2__body">
                            <span class="online-fx-v2__title">${element.title}</span>
                            <span class="online-fx-v2__quality">${element.quality}</span>
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

        this.empty = function () { Lampa.Noty.show('Ничего не найдено'); };
        this.destroy = function () { network.clear(); scroll.destroy(); };
    }

    function start() {
        if (window.filmix_ultra_loaded) return;
        window.filmix_ultra_loaded = true;

        Lampa.Component.add('filmix_ultra_comp', FilmixComponent);

        var tryInject = function(root, movieData) {
            // Список всех возможных контейнеров для кнопок на zrovid
            var selectors = [
                '.full-start__buttons', 
                '.full-movie__buttons', 
                '.buttons-list', 
                '.full-movie__actions',
                '.full-movie__buttons-list',
                '.full-movie__main-info'
            ];
            
            var container = null;
            for(var i=0; i < selectors.length; i++) {
                var found = root.find(selectors[i]);
                if (found.length) { container = found.first(); break; }
            }

            if (container && !container.find('.btn--filmix-ultra').length) {
                var btn = $('<div class="full-start__button selector btn--filmix-ultra"><span>Filmix</span></div>');
                btn.on('hover:enter', function() {
                    Lampa.Component.item('filmix_ultra_comp', { movie: movieData, display: container.closest('.activity') });
                });
                container.append(btn);
                console.log('Filmix Ultra: Button added to', container.attr('class'));
            }
        };

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = (e.object && e.object.render) ? e.object.render() : null;
                
                // 1. Попытка через MutationObserver
                if (render) {
                    var obs = new MutationObserver(function() {
                        tryInject(render, e.data.movie);
                    });
                    obs.observe(render[0], { childList: true, subtree: true });
                }

                // 2. Резервный цикл проверки (на случай если render не в DOM)
                var attempts = 0;
                var timer = setInterval(function() {
                    attempts++;
                    // Ищем глобально в DOM
                    tryInject($('body'), e.data.movie);
                    if (attempts > 15) clearInterval(timer);
                }, 500);
            }
        });
    }

    if (window.Lampa) start();
    else {
        var itv = setInterval(function () {
            if (window.Lampa) { clearInterval(itv); start(); }
        }, 100);
    }
})();