
(function () {
    'use strict';

    /**
     * Filmix Nexus v2.3.8
     * FIX: Принудительный ре-фокус контроллера после выбора озвучки.
     * FIX: Использование Lampa.Controller.enable('interaction') для мгновенной отрисовки.
     */
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
            var id = movie.kinopoisk_id || movie.kp_id || movie.id;
            var url = targetUrl || (BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + id);
            if (!targetUrl && !movie.kinopoisk_id && !movie.kp_id) url = BASE_DOMAIN + '/lite/fxapi?postid=' + id;

            var attempts = 0;
            var fetchWithRetry = function(apiUrl) {
                var proxy = PROXIES[currentProxyIdx];
                toggleLoading(true);

                network.native(proxy + sign(apiUrl), function (res) {
                    toggleLoading(false);
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                    displayFilmix(res, movie, function(newUrl) {
                        loadFilmix(movie, newUrl);
                    });
                }, function (err) {
                    attempts++;
                    if (attempts < PROXIES.length) {
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        fetchWithRetry(apiUrl);
                    } else {
                        toggleLoading(false);
                        Lampa.Noty.show('Filmix: Ошибка сети');
                    }
                }, false, { dataType: 'text' });
            };

            fetchWithRetry(url);
        }

        function displayFilmix(res, movie, fetchCallback) {
            var $dom = $('<div>' + res + '</div>');
            var items = [], filters = [];

            $dom.find('.videos__button, .selector[data-json*="link"]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    filters.push({ title: $(this).text().trim(), url: json.url });
                } catch(e) {}
            });

            $dom.find('.videos__item, .selector[data-json*="play"]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    items.push({
                        title: $(this).find('.videos__item-title').text().trim() || json.title || 'Видео',
                        quality: json.maxquality || 'HD',
                        url: sign(json.url)
                    });
                } catch(e) {}
            });

            if (typeof Lampa.Interaction !== 'undefined') {
                var active = Lampa.Activity.active();
                var is_same = active && active.component === 'interaction' && active.title === 'Filmix';
                
                var interaction = is_same ? active.object : new Lampa.Interaction({
                    card: movie,
                    filter: filters.length > 0
                });

                interaction.onPlay = function(item) {
                    Lampa.Player.play({ url: item.url, title: item.title, movie: movie });
                };

                interaction.onFilter = function() {
                    Lampa.Select.show({
                        title: 'Озвучка / Вариант',
                        items: filters.map(function(f) { return { title: f.title, value: f.url }; }),
                        onSelect: function(item) { 
                            // Очищаем текущий список перед загрузкой, чтобы UI не висел
                            interaction.content([]);
                            fetchCallback(item.value); 
                        },
                        onBack: function() {
                            Lampa.Controller.toggle('interaction');
                        }
                    });
                };

                if (!is_same) {
                    Lampa.Activity.push({
                        component: 'interaction',
                        title: 'Filmix',
                        object: interaction,
                        onBack: function() { Lampa.Activity.backward(); }
                    });
                }

                // Заполняем контент
                interaction.content(items);
                
                // РЕШЕНИЕ ПРОБЛЕМЫ:
                // После того как контент вставлен, нужно принудительно "разбудить" контроллер.
                // Используем setTimeout, чтобы дождаться закрытия модалки Select (если она была открыта).
                setTimeout(function() {
                    if (Lampa.Controller.enabled().name !== 'interaction') {
                        Lampa.Controller.enable('interaction');
                    }
                    // Хак: дергаем контроллер, чтобы он перерисовал сетку (grid)
                    Lampa.Controller.toggle('interaction');
                }, 50);

            } else {
                // Фоллбек для старых версий (простой Select)
                Lampa.Select.show({
                    title: movie.title || movie.name || 'Filmix',
                    items: items.map(function(i) { return { title: i.title + ' ['+i.quality+']', value: i }; }),
                    onSelect: function(item) {
                        Lampa.Player.play({ url: item.value.url, title: item.value.title, movie: movie });
                    }
                });
            }
        }

        function addButton(render, movie) {
            if (render.find('.fx-nexus-native').length) return;
            var target = render.find('.view--torrent, .view--online, .button--play, .full-start__buttons').last();
            if (target.length) {
                var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Filmix</span></div>');
                btn.on('hover:enter', function () { 
                    loadFilmix(movie); 
                });
                
                if(target.hasClass('full-start__buttons')) target.append(btn);
                else target.after(btn);

                if (Lampa.Controller.toggle) Lampa.Controller.toggle(Lampa.Controller.enabled().name);
            }
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                addButton(e.object.activity.render(), e.data.movie);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
