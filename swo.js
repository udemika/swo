(function () {
    'use strict';

    /**
     * Filmix Nexus (Robust Native) v2.3.2
     * - Исправлено появление кнопки "Смотреть" (используется логика из примера)
     * - Нативный интерфейс Lampa.Interaction
     * - Совместимость со всеми скинами Лампы
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'http://showypro.com';
        
        var PROXIES = [
            'https://cors.byskaz.ru/',
            'https://cors.lampa.stream/',
            'https://corsproxy.io/?'
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0'));

        function sign(url) {
            url = url + '';
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') == -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
            return url;
        }

        function FilmixComponent(object) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var interaction;
            var html = $('<div></div>');
            
            this.create = function () {
                var id = object.movie.kinopoisk_id || object.movie.kp_id || object.movie.id;
                var url = BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + id;
                if (!object.movie.kinopoisk_id && !object.movie.kp_id) url = BASE_DOMAIN + '/lite/fxapi?postid=' + id;
                this.load(sign(url));
                return html;
            };

            this.load = function (url) {
                var self = this;
                Lampa.Loading.show();
                network.native(PROXIES[currentProxyIdx] + url, function (res) {
                    Lampa.Loading.hide();
                    self.display(res, url);
                }, function () {
                    Lampa.Loading.hide();
                    Lampa.Noty.show('Ошибка Filmix');
                }, false, { dataType: 'text' });
            };

            this.display = function (res, current_url) {
                var self = this;
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

                if (!interaction) {
                    interaction = new Lampa.Interaction({
                        card: object.movie,
                        filter: filters.length > 0
                    });

                    interaction.onPlay = function(item) {
                        Lampa.Player.play({ url: item.url, title: item.title, movie: object.movie });
                    };

                    interaction.onFilter = function() {
                        Lampa.Select.show({
                            title: 'Выбор',
                            items: filters.map(function(f) { return { title: f.title, value: f.url }; }),
                            onSelect: function(item) { self.load(sign(item.value)); }
                        });
                    };

                    Lampa.Activity.push({
                        component: 'interaction',
                        title: 'Filmix',
                        object: interaction,
                        onBack: function(){ Lampa.Activity.backward(); }
                    });
                }
                interaction.content(items);
            };

            this.render = function() { return html; };
            this.destroy = function () { 
                network.clear(); 
                if (interaction && interaction.destroy) interaction.destroy();
                html.remove();
            };
        }

        Lampa.Component.add('fx_hybrid_v9', FilmixComponent);

        // Улучшенная логика вставки кнопки (по аналогии с вашим примером)
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.activity.render();
                if (!render) return;

                var inject = function() {
                    if (render.find('.fx-nexus-native').length) return;

                    var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Смотреть Filmix</span></div>');
                    btn.on('hover:enter', function () {
                        Lampa.Activity.push({ component: 'fx_hybrid_v9', movie: e.data.movie });
                    });

                    // Ищем куда вставить (как в вашем примере: перед или вместо существующих)
                    var container = render.find('.full-start__buttons, .full-start__actions, .full-start');
                    var watchBtn = render.find('.watch-button, .full-start__button').first();

                    if (watchBtn.length) {
                        // Вставляем ПЕРЕД оригинальной кнопкой "Смотреть"
                        watchBtn.before(btn);
                    } else if (container.length) {
                        // Или просто в начало контейнера
                        container.prepend(btn);
                    }

                    // Обновляем контроллер, чтобы кнопка стала фокусной
                    Lampa.Controller.toggle('full_start');
                };

                // Делаем несколько попыток, если DOM еще не готов
                inject();
                setTimeout(inject, 100);
                setTimeout(inject, 500);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
