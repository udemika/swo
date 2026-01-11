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

        function loadFilmix(movie) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var id = movie.kinopoisk_id || movie.kp_id || movie.id;
            var url = BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + id;
            if (!movie.kinopoisk_id && !movie.kp_id) url = BASE_DOMAIN + '/lite/fxapi?postid=' + id;

            var attempts = 0;
            
            // Рекурсивная функция загрузки (используется и для первого входа, и для клика по папкам)
            var fetchWithRetry = function(targetUrl) {
                var proxy = PROXIES[currentProxyIdx];
                toggleLoading(true);

                network.native(proxy + sign(targetUrl), function (res) {
                    toggleLoading(false);
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                    displayFilmix(res, movie, fetchWithRetry);
                }, function (err) {
                    attempts++;
                    console.log('Filmix: Proxy ' + proxy + ' failed. Switching...');
                    
                    if (attempts < PROXIES.length) {
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        fetchWithRetry(targetUrl);
                    } else {
                        toggleLoading(false);
                        Lampa.Noty.show('Filmix: Ошибка сети (все прокси недоступны)');
                    }
                }, false, { dataType: 'text' });
            };

            fetchWithRetry(url);
        }

        // --- ГЛАВНОЕ ИЗМЕНЕНИЕ: Формирование системного списка ---
        function displayFilmix(res, movie, fetchCallback) {
            var $dom = $('<div>' + res + '</div>');
            var items = [];

            // 1. Собираем Папки (Сезоны, Переводы) - помечаем их как folder
            $dom.find('.videos__button, .selector[data-json*="link"]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    items.push({
                        title: $(this).text().trim(),
                        url: json.url,
                        type: 'folder' // Это папка, ее надо открыть
                    });
                } catch(e) {}
            });

            // 2. Собираем Видео (Серии, Фильмы) - помечаем их как video
            $dom.find('.videos__item, .selector[data-json*="play"]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    items.push({
                        title: $(this).find('.videos__item-title').text().trim() || json.title || 'Видео',
                        quality: json.maxquality || 'HD',
                        url: sign(json.url),
                        type: 'video', // Это видео, его надо играть
                        subtitle: json.quality ? json.quality : (json.maxquality || '')
                    });
                } catch(e) {}
            });

            if (items.length === 0) {
                Lampa.Noty.show('Filmix: Видео не найдено');
                return;
            }

            // Создаем объект Activity вручную, чтобы не зависеть от версии Lampa
            var activityObject = {
                create: function() {
                    // Используем стандартный метод activity.content для отрисовки списка
                    // Это создает тот самый вид "как на скриншоте"
                    this.activity.content(items);
                    
                    // Если список пуст или грузится
                    if (!items.length) this.activity.empty();
                },
                // Обработчик нажатия (enter/ok)
                onItem: function(item) {
                    if (item.type === 'folder') {
                        // Если это папка (сезон/перевод), загружаем её содержимое
                        fetchCallback(item.url);
                    } else {
                        // Если это видео, играем
                        Lampa.Player.play({
                            url: item.url,
                            title: item.title,
                            movie: movie
                        });
                    }
                }
            };

            // Открываем полноценное системное окно
            Lampa.Activity.push({
                url: '',
                title: 'Filmix',
                component: 'interaction', // Указываем системный компонент
                page: 1,
                object: activityObject, // Передаем нашу логику
                onBack: function() {
                    Lampa.Activity.backward();
                }
            });
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.activity.render();
                var inject = function() {
                    if (render.find('.fx-nexus-native').length) return;
                    
                    var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Смотреть Filmix</span></div>');
                    btn.on('hover:enter', function () {
                        loadFilmix(e.data.movie);
                    });

                    var container = render.find('.full-start__buttons, .full-start__actions, .full-start');
                    var watchBtn = render.find('.watch-button, .full-start__button').first();

                    if (watchBtn.length) watchBtn.before(btn);
                    else if (container.length) container.prepend(btn);
                    
                    if (Lampa.Controller.toggle) Lampa.Controller.toggle('full_start');
                };
                inject();
                setTimeout(inject, 200);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();