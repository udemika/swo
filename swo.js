(function () {
    'use strict';

    /**
     * Filmix Nexus (Stability & SSL Fix) v2.5.2
     * - Исправлена ошибка 526 (Invalid SSL certificate) на showy.online
     * - Исправлен Mixed Content для IP-прокси
     * - Авто-ротация при CORS/SSL ошибках
     * - Системный интерфейс Interaction
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        
        // Перемещаем проблемный showy.online в конец списка
        var API_MIRRORS = [
            'https://showypro.com',
            'https://showypro.xyz',
            'https://showy.online'
        ];
        
        // Список прокси. Те, что без HTTPS (IP), будут работать только если Lampa открыта по HTTP.
        // Для HTTPS (zrovid.com) используем только HTTPS прокси.
        var isHttps = window.location.protocol === 'https:';
        var ALL_PROXIES = [
            'https://corsproxy.io/?',
            'https://cors.lampa.stream/',
            'https://apn5.akter-black.com/',
            'https://apn10.akter-black.com/',
            'https://cors.byskaz.ru/',
            'http://85.198.110.239:8975/',
            'http://91.184.245.56:8975/'
        ];

        // Фильтруем прокси под протокол страницы
        var PROXIES = ALL_PROXIES.filter(function(p) {
            return !isHttps || p.indexOf('https') === 0;
        });

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
                    // Проверка на ошибки Cloudflare (526, 521, 403) или CORS заглушки
                    if (res && res.length > 250 && res.indexOf('Invalid SSL certificate') === -1 && res.indexOf('Error code 526') === -1) {
                        render(res, movie, lastPath);
                    } else {
                        next(); // SSL 526 или пустой ответ -> пробуем следующий узел
                    }
                }, function (err) {
                    toggleLoading(false);
                    next(); // Ошибка сети/CORS -> пробуем следующий узел
                }, false, { dataType: 'text', timeout: 6000 });
            };

            var next = function() {
                if (retryCount < (PROXIES.length * API_MIRRORS.length)) {
                    retryCount++;
                    // Ротация прокси и зеркал
                    currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                    if (currentProxyIdx === 0) currentMirrorIdx = (currentMirrorIdx + 1) % API_MIRRORS.length;
                    
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx);
                    Lampa.Storage.set('fx_nexus_mirror_idx', currentMirrorIdx);
                    request();
                } else {
                    Lampa.Noty.show('Filmix: Ошибка узлов (SSL/CORS/526). Попробуйте сменить зеркало в настройках.');
                }
            };

            request();
        }

        function render(res, movie, currentPath) {
            var $dom = $('<div>' + res + '</div>');
            var items = [], filters = [];

            $dom.find('.selector[data-json]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    var title = $(this).text().trim() || json.title || 'Видео';
                    
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
                    // Если это не прямая ссылка на видео (m3u8/mp4), а API URL - грузим дальше
                    if (item.url.indexOf('fxapi') > -1 && item.url.indexOf('.mp4') === -1 && item.url.indexOf('.m3u8') === -1) {
                         var path = item.url.split('fxapi')[1] || '';
                         loadFilmix(movie, '/lite/fxapi' + path);
                         return;
                    }
                    Lampa.Player.play({ url: item.url, title: item.title, movie: movie });
                };

                interaction.onFilter = function() {
                    Lampa.Select.show({
                        title: 'Выбор раздела',
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
                    if (renderActivity.find('.fx-nexus-v13').length) return;

                    var btn = $('<div class="full-start__button selector view--online fx-nexus-v13"><span>Смотреть Filmix</span></div>');
                    btn.on('hover:enter', function () {
                        loadFilmix(e.data.movie);
                    });

                    var container = renderActivity.find('.full-start__buttons, .full-start__actions, .full-start__left, .full-start').first();
                    var existingBtn = renderActivity.find('.full-start__button, .selector').first();

                    if (existingBtn.length && !existingBtn.hasClass('fx-nexus-v13')) existingBtn.before(btn);
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
