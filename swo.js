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

        function toggleLoading(show) {
            try {
                if (Lampa.Loading && Lampa.Loading.show) show ? Lampa.Loading.show() : Lampa.Loading.hide();
            } catch (e) {}
        }

        function loadFilmix(movie, targetUrl) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var url = targetUrl || (BASE_DOMAIN + '/lite/fxapi?' + (movie.kinopoisk_id ? 'kinopoisk_id=' + movie.kinopoisk_id : 'postid=' + movie.id));

            var attempts = 0;
            var fetchWithRetry = function(reqUrl) {
                var proxy = PROXIES[currentProxyIdx];
                toggleLoading(true);

                network.native(proxy + sign(reqUrl), function (res) {
                    toggleLoading(false);
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                    displayFilmix(res, movie, fetchWithRetry);
                }, function (err) {
                    attempts++;
                    if (attempts < PROXIES.length) {
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        fetchWithRetry(reqUrl);
                    } else {
                        toggleLoading(false);
                        Lampa.Noty.show('Ошибка загрузки Filmix');
                    }
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
                    items.push({
                        title: el.text().trim() || json.title || 'Видео',
                        quality: json.maxquality || '',
                        url: json.url || sign(json.url || ''),
                        is_folder: !!json.url,
                        template: 'selectbox_item'
                    });
                } catch(e) {}
            });

            if (!items.length) {
                Lampa.Noty.show('Контент не найден');
                return;
            }

            // Создаем активность как в системных плагинах
            var activity = {
                component: 'interaction',
                title: 'Filmix',
                object: {
                    create: function() {
                        this.activity.content(items);
                    },
                    onItem: function(item) {
                        if (item.is_folder) {
                            // Загружаем вложенную папку (сезон/перевод)
                            loadFilmix(movie, item.url);
                        } else {
                            // Играем видео
                            Lampa.Player.play({
                                url: item.url,
                                title: item.title,
                                movie: movie
                            });
                        }
                    },
                    onBack: function() {
                        Lampa.Activity.backward();
                    }
                }
            };

            Lampa.Activity.push(activity);
        }

        // --- ВОЗВРАТ КНОПКИ (оригинальная логика) ---
        function addButton(e) {
            if (e.render.find('.fx-nexus-native').length) return;

            var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Смотреть Filmix</span></div>');
            
            btn.on('hover:enter', function () {
                loadFilmix(e.movie);
            });

            // Вставляем перед кнопкой "Торренты" или в начало
            var container = e.render.find('.full-start__buttons, .full-start__actions');
            if (container.length) container.prepend(btn);
            else e.render.append(btn);

            if (Lampa.Controller.toggle) Lampa.Controller.toggle('full_start');
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                addButton({
                    render: e.object.activity.render(),
                    movie: e.data.movie
                });
            }
        });

        // Проверка при прямой загрузке страницы
        try {
            if (Lampa.Activity.active() && Lampa.Activity.active().component == 'full') {
                addButton({
                    render: Lampa.Activity.active().activity.render(),
                    movie: Lampa.Activity.active().card
                });
            }
        } catch (err) {}
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();