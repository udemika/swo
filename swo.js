(function () {
    'use strict';

    /**
     * Filmix Nexus (System UI Fix) v2.5.1
     * - Исправлен Mixed Content (HTTPS Everywhere)
     * - Исправлена работа пульта (Native Interaction)
     * - Исправлен запуск плеера на папках/сезонах
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        
        // Принудительно HTTPS для избежания Mixed Content
        var API_MIRRORS = [
            'https://showypro.com',
            'https://showy.online',
            'https://showypro.xyz'
        ];
        
        var PROXIES = [
            'https://apn5.akter-black.com/',
            'https://apn10.akter-black.com/',
            'http://85.198.110.239:8975/',
            'http://91.184.245.56:8975/',
            'https://cors.lampa.stream/',
            'https://corsproxy.io/?'
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0'));
        var currentMirrorIdx = parseInt(Lampa.Storage.get('fx_nexus_mirror_idx', '0'));

        function sign(url) {
            url = url + '';
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') == -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
            // Принудительная замена http на https для API доменов
            return url.replace('http://showypro.com', 'https://showypro.com');
        }

        function toggleLoading(show) {
            try {
                if (typeof Lampa.Loading === 'function') Lampa.Loading(show);
                else if (Lampa.Loading && Lampa.Loading.show) show ? Lampa.Loading.show() : Lampa.Loading.hide();
            } catch (e) {}
        }

        function loadFilmix(movie, path) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var retryCount = 0;
            var lastPath = path || '';

            if (!lastPath) {
                var id = movie.kinopoisk_id || movie.kp_id || movie.id;
                lastPath = '/lite/fxapi?kinopoisk_id=' + id;
                if (!movie.kinopoisk_id && !movie.kp_id) lastPath = '/lite/fxapi?postid=' + id;
            }

            var request = function() {
                var mirror = API_MIRRORS[currentMirrorIdx % API_MIRRORS.length];
                var proxy = PROXIES[currentProxyIdx % PROXIES.length];
                var targetUrl = sign(mirror + lastPath);
                
                var finalUrl = targetUrl;
                if (proxy.indexOf('?') !== -1) finalUrl = proxy + encodeURIComponent(targetUrl);
                else finalUrl = proxy + targetUrl;

                toggleLoading(true);

                network.native(finalUrl, function (res) {
                    toggleLoading(false);
                    if (res && res.length > 200) {
                        if (res.indexOf('521') !== -1 || res.indexOf('down') !== -1) next();
                        else render(res, movie, lastPath);
                    } else next();
                }, function () {
                    toggleLoading(false);
                    next();
                }, false, { dataType: 'text', timeout: 7000 });
            };

            var next = function() {
                if (retryCount < (PROXIES.length + 1)) {
                    retryCount++;
                    currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx);
                    request();
                } else {
                    Lampa.Noty.show('Filmix: Ошибка соединения (HTTP 521/CORS)');
                }
            };

            request();
        }

        function render(res, movie, currentPath) {
            var $dom = $('<div>' + res + '</div>');
            var items = [], filters = [];

            // Собираем всё содержимое
            $dom.find('.selector[data-json]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    var title = $(this).text().trim() || json.title || 'Видео';
                    
                    // Если это ссылка на раздел (сезон/перевод), а не поток
                    if (json.link || (json.url && json.url.indexOf('fxapi') > -1 && !json.play)) {
                        filters.push({ title: title, url: json.url });
                    } else {
                        items.push({
                            title: title,
                            quality: json.maxquality || 'HD',
                            url: sign(json.url),
                            info: json.maxquality ? ' [' + json.maxquality + ']' : ''
                        });
                    }
                } catch(e) {}
            });

            if (typeof Lampa.Interaction !== 'undefined') {
                var interaction = new Lampa.Interaction({
                    card: movie,
                    filter: filters.length > 0
                });

                interaction.onPlay = function(item) {
                    // Страховка: если по ошибке в список попал API URL
                    if (item.url.indexOf('fxapi') > -1 && item.url.indexOf('showy_token') > -1 && item.url.indexOf('.mp4') === -1 && item.url.indexOf('.m3u8') === -1) {
                         var path = item.url.split('fxapi')[1] || '';
                         loadFilmix(movie, '/lite/fxapi' + path);
                         return;
                    }
                    Lampa.Player.play({ url: item.url, title: item.title, movie: movie });
                };

                interaction.onFilter = function() {
                    Lampa.Select.show({
                        title: 'Сезоны / Переводы',
                        items: filters.map(function(f) { return { title: f.title, value: f.url }; }),
                        onSelect: function(item) {
                            var path = item.value.split('fxapi')[1] || '';
                            loadFilmix(movie, '/lite/fxapi' + path);
                        }
                    });
                };

                Lampa.Activity.push({
                    component: 'interaction',
                    title: 'Filmix',
                    object: interaction,
                    onBack: function() { Lampa.Activity.backward(); }
                });

                interaction.content(items);
            } else {
                Lampa.Select.show({
                    title: movie.title || 'Filmix',
                    items: items.map(function(i) { return { title: i.title + i.info, value: i }; }),
                    onSelect: function(item) {
                        Lampa.Player.play({ url: item.value.url, title: item.value.title, movie: movie });
                    }
                });
            }
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var renderActivity = e.object.activity.render();
                if (!renderActivity) return;

                var inject = function() {
                    if (renderActivity.find('.fx-nexus-v12').length) return;

                    var btn = $('<div class="full-start__button selector view--online fx-nexus-v12"><span>Смотреть Filmix</span></div>');
                    btn.on('hover:enter', function () {
                        loadFilmix(e.data.movie);
                    });

                    var container = renderActivity.find('.full-start__buttons, .full-start__actions, .full-start__left, .full-start').first();
                    var existingBtn = renderActivity.find('.full-start__button, .selector').first();

                    if (existingBtn.length && !existingBtn.hasClass('fx-nexus-v12')) existingBtn.before(btn);
                    else if (container.length) container.prepend(btn);

                    if (Lampa.Controller.toggle) Lampa.Controller.toggle('full_start');
                };

                inject();
                setTimeout(inject, 600);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
