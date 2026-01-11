(function () {
    'use strict';

    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'http://showypro.com';
        
        var PROXIES = [
            'https://cors.byskaz.ru/',
            'http://85.198.110.239:8975/',
            'http://91.184.245.56:8975/',
            'https://apn10.akter-black.com/',
            'https://apn5.akter-black.com/',
            'https://cors557.deno.dev/'
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0'));
        if (isNaN(currentProxyIdx) || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

        function sign(url) {
            url = url + '';
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') == -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
            return url;
        }

        function loadFilmix(movie, targetUrl) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var url = targetUrl || (BASE_DOMAIN + '/lite/fxapi?' + (movie.kinopoisk_id ? 'kinopoisk_id=' + movie.kinopoisk_id : 'postid=' + movie.id));

            var fetchWithRetry = function(reqUrl) {
                var proxy = PROXIES[currentProxyIdx];
                if (Lampa.Loading && Lampa.Loading.show) Lampa.Loading.show();

                network.native(proxy + sign(reqUrl), function (res) {
                    if (Lampa.Loading && Lampa.Loading.hide) Lampa.Loading.hide();
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                    displayFilmix(res, movie, fetchWithRetry);
                }, function (err) {
                    currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                    fetchWithRetry(reqUrl);
                }, false, { dataType: 'text' });
            };
            fetchWithRetry(url);
        }

        function displayFilmix(res, movie, fetcher) {
            var $dom = $('<div>' + res + '</div>');
            var items = [];

            $dom.find('.videos__button, .videos__item, .selector').each(function() {
                var el = $(this);
                var jsonStr = el.attr('data-json');
                if(!jsonStr) return;
                try {
                    var json = JSON.parse(jsonStr);
                    var isFolder = !!json.url && !json.play; 
                    items.push({
                        title: el.text().trim() || json.title || 'Видео',
                        quality: json.maxquality || '',
                        url: isFolder ? json.url : sign(json.url || json.play || ''),
                        is_folder: isFolder,
                        template: 'selectbox_item'
                    });
                } catch(e) {}
            });

            if (!items.length) return Lampa.Noty.show('Контент не найден');

            Lampa.Activity.push({
                title: 'Filmix',
                component: 'interaction',
                object: {
                    create: function() { this.activity.content(items); },
                    onItem: function(item) {
                        if (item.is_folder) loadFilmix(movie, item.url);
                        else Lampa.Player.play({ url: item.url, title: item.title, movie: movie });
                    },
                    onBack: function() { Lampa.Activity.backward(); }
                }
            });
        }

        // --- ЛОГИКА ДЛЯ ШТОРКИ ---
        function injectButton(render, movie) {
            if (render.find('.fx-nexus-native').length) return;

            // Ищем кнопку Торренты внутри шторки
            var target = render.find('.view--torrent, .full-start__button').first();
            
            if (target.length) {
                var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Filmix</span></div>');
                btn.on('hover:enter', function () {
                    // Закрываем шторку перед открытием Filmix (опционально)
                    // Lampa.Activity.backward(); 
                    loadFilmix(movie);
                });
                
                target.after(btn);
                
                // Обновляем контроллер, чтобы кнопка стала кликабельной
                if (Lampa.Controller.toggle) Lampa.Controller.toggle(Lampa.Controller.enabled().name);
            }
        }

        // Следим за всеми изменениями в интерфейсе
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') {
                // Если открылась шторка выбора (online/torrents)
                var active = Lampa.Activity.active();
                if (active && (active.component == 'full_start' || active.component == 'select')) {
                    injectButton(active.activity.render(), active.card || active.object.movie);
                }
            }
        });

        // Дополнительный мониторинг через Listener full для обычных карточек
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                injectButton(e.object.activity.render(), e.data.movie);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();