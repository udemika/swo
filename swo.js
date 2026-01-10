(function () {
    'use strict';

    /**
     * Filmix Nexus (Legacy Support) v2.3.4
     * - Исправлена ошибка: Lampa.Interaction is not a constructor
     * - Добавлен fallback на Lampa.Select для старых версий
     * - Оптимизирован сетевой запрос (убраны лишние CORS вызовы)
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'http://showypro.com';
        
        var PROXIES = [
            'https://cors.nb557.workers.dev/',  
            'https://cors.byskaz.ru/',
            'https://apn10.akter-black.com/',  
            'http://85.198.110.239:8975//',
            'https://apn5.akter-black.com/',
            'http://91.184.245.56:8975/?'
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0'));

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

            var fetch = function(targetUrl) {
                toggleLoading(true);
                network.native(PROXIES[currentProxyIdx] + sign(targetUrl), function (res) {
                    toggleLoading(false);
                    displayFilmix(res, movie, fetch);
                }, function () {
                    toggleLoading(false);
                    Lampa.Noty.show('Filmix: Ошибка сети');
                }, false, { dataType: 'text' });
            };

            fetch(url);
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

            // ПРОВЕРКА НАЛИЧИЯ INTERACTION
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
                        title: 'Фильтр',
                        items: filters.map(function(f) { return { title: f.title, value: f.url }; }),
                        onSelect: function(item) { fetchCallback(item.value); }
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
                // FALLBACK: Используем нативные списки Lampa.Select, если Interaction сломан
                var showList = function() {
                    Lampa.Select.show({
                        title: movie.title || movie.name || 'Filmix',
                        items: items.map(function(i) { return { title: i.title + ' ['+i.quality+']', value: i }; }),
                        onSelect: function(item) {
                            Lampa.Player.play({ url: item.value.url, title: item.value.title, movie: movie });
                        },
                        onBack: function() {
                            Lampa.Controller.toggle('full_start');
                        }
                    });
                };

                if (filters.length > 0) {
                    Lampa.Select.show({
                        title: 'Выбор варианта',
                        items: filters.map(function(f) { return { title: f.title, value: f.url }; }),
                        onSelect: function(item) { fetchCallback(item.value); },
                        onBack: function() { showList(); }
                    });
                } else {
                    showList();
                }
            }
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.activity.render();
                if (!render) return;

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
