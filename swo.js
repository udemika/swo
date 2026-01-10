(function () {
    'use strict';

    /**
     * Filmix Nexus (System UI + High Stability) v2.5.0
     * - Возврат к системному интерфейсу Lampa.Interaction
     * - Полная поддержка пультов (Tizen, WebOS, Android TV)
     * - Использование стабильных прокси Akter-Black и IP-узлов
     * - Автоматическая ротация при ошибках Cloudflare (521/502)
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        
        var API_MIRRORS = [
            'https://showypro.com',
            'http://showypro.com',
            'https://showy.online',
            'https://showypro.xyz'
        ];
        
        var PROXIES = [
            'https://apn5.akter-black.com/',
            'https://apn10.akter-black.com/',
            'http://85.198.110.239:8975/',
            'http://91.184.245.56:8975/',
            'https://cors.lampa.stream/',
            'https://corsproxy.io/?',
            'https://cors.byskaz.ru/'
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0'));
        var currentMirrorIdx = parseInt(Lampa.Storage.get('fx_nexus_mirror_idx', '0'));

        function sign(url) {
            url = url + '';
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') == -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
            return url;
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
                        if (res.indexOf('Web server is down') !== -1 || res.indexOf('521') !== -1 || res.indexOf('502 Bad Gateway') !== -1) {
                            next();
                        } else {
                            render(res, movie, request);
                        }
                    } else {
                        next();
                    }
                }, function () {
                    toggleLoading(false);
                    next();
                }, false, { dataType: 'text', timeout: 7000 });
            };

            var next = function() {
                if (retryCount < (PROXIES.length + 2)) {
                    retryCount++;
                    currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                    if (retryCount % 2 === 0) currentMirrorIdx = (currentMirrorIdx + 1) % API_MIRRORS.length;
                    
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx);
                    Lampa.Storage.set('fx_nexus_mirror_idx', currentMirrorIdx);
                    request();
                } else {
                    Lampa.Noty.show('Filmix: Все узлы недоступны. Попробуйте позже.');
                }
            };

            request();
        }

        function render(res, movie, reloadCallback) {
            var $dom = $('<div>' + res + '</div>');
            var items = [], filters = [];

            // Собираем фильтры (сезоны/переводы)
            $dom.find('.videos__button, .selector[data-json*="link"]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    filters.push({ title: $(this).text().trim(), url: json.url });
                } catch(e) {}
            });

            // Собираем эпизоды
            $dom.find('.videos__item, .selector[data-json*="play"]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    var title = $(this).find('.videos__item-title').text().trim() || json.title || 'Видео';
                    items.push({
                        title: title,
                        quality: json.maxquality || 'HD',
                        url: sign(json.url),
                        info: json.maxquality ? ' [' + json.maxquality + ']' : ''
                    });
                } catch(e) {}
            });

            // Используем системный Interaction для дизайна как на скриншоте
            if (typeof Lampa.Interaction !== 'undefined') {
                var interaction = new Lampa.Interaction({
                    card: movie,
                    filter: filters.length > 0
                });

                interaction.onPlay = function(item) {
                    Lampa.Player.play({ url: item.url, title: item.title, movie: movie });
                };

                interaction.onFilter = function() {
                    Lampa.Select.show({
                        title: 'Выбор сезона / качества',
                        items: filters.map(function(f) { return { title: f.title, value: f.url }; }),
                        onSelect: function(item) {
                            var path = item.value.split('fxapi')[1] || '';
                            // Перезагружаем с новым путем
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
                // Fallback для совсем старых версий (Lampa.Select)
                Lampa.Select.show({
                    title: movie.title || movie.name || 'Filmix',
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
                    if (renderActivity.find('.fx-nexus-v11').length) return;

                    var btn = $('<div class="full-start__button selector view--online fx-nexus-v11"><span>Смотреть Filmix</span></div>');
                    btn.on('hover:enter', function () {
                        loadFilmix(e.data.movie);
                    });

                    var container = renderActivity.find('.full-start__buttons, .full-start__actions, .full-start__left, .full-start').first();
                    var existingBtn = renderActivity.find('.full-start__button, .selector').first();

                    if (existingBtn.length && !existingBtn.hasClass('fx-nexus-v11')) existingBtn.before(btn);
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
