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
                if (typeof Lampa.Loading === 'function') Lampa.Loading(show);
                else if (Lampa.Loading && Lampa.Loading.show) show ? Lampa.Loading.show() : Lampa.Loading.hide();
            } catch (e) {}
        }

        function loadFilmix(movie, targetUrl) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var url = targetUrl;
            
            if(!url) {
                var id = movie.kinopoisk_id || movie.kp_id || movie.id;
                url = BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + id;
                if (!movie.kinopoisk_id && !movie.kp_id) url = BASE_DOMAIN + '/lite/fxapi?postid=' + id;
            }

            var attempts = 0;
            var fetchWithRetry = function(reqUrl) {
                var proxy = PROXIES[currentProxyIdx];
                toggleLoading(true);

                network.native(proxy + sign(reqUrl), function (res) {
                    toggleLoading(false);
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                    displayFilmix(res, movie);
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

        function displayFilmix(res, movie) {
            var $dom = $('<div>' + res + '</div>');
            var items = [];

            // Собираем всё в один список для Interaction
            $dom.find('.videos__button, .videos__item, .selector').each(function() {
                var element = $(this);
                var jsonStr = element.attr('data-json');
                if(!jsonStr) return;

                try {
                    var json = JSON.parse(jsonStr);
                    var isFolder = !!json.url; // Если есть url - это папка (сезон/перевод)
                    
                    items.push({
                        title: element.text().trim() || json.title || 'Видео',
                        quality: json.maxquality || '',
                        url: isFolder ? json.url : sign(json.url || ''),
                        type: isFolder ? 'folder' : 'video',
                        template: 'selectbox_item' // Используем стандартный шаблон списка
                    });
                } catch(e) {}
            });

            if (!items.length) {
                Lampa.Noty.show('Ничего не найдено');
                return;
            }

            // Создаем объект для управления окном
            var interactionObject = {
                create: function() {
                    this.activity.content(items);
                },
                onItem: function(item) {
                    if (item.type === 'folder') {
                        // Рекурсивно загружаем папку в том же окне
                        loadFilmix(movie, item.url);
                    } else {
                        // Запускаем видео
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
            };

            // Вызываем системное окно (как на скриншоте)
            Lampa.Activity.push({
                title: 'Filmix',
                component: 'interaction',
                object: interactionObject
            });
        }

        // Кнопка в карточке фильма
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.activity.render();
                var inject = function() {
                    if (render.find('.fx-nexus-native').length) return;
                    var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Смотреть Filmix</span></div>');
                    btn.on('hover:enter', function () {
                        loadFilmix(e.data.movie);
                    });
                    var container = render.find('.full-start__buttons, .full-start__actions').first();
                    if (container.length) container.prepend(btn);
                    if (Lampa.Controller.toggle) Lampa.Controller.toggle('full_start');
                };
                inject();
                setTimeout(inject, 200);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();