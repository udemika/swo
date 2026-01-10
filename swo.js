(function () {
    'use strict';

    /**
     * Filmix Nexus (Full Native) v2.3.0
     * - Полный отказ от своего UI в пользу Lampa.Interaction
     * - Визуальное соответствие стандартным плагинам Лампы
     * - Работа через нативные команды Select и Play
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
            var interaction; // Lampa.Interaction instance
            
            this.create = function () {
                var id = object.movie.kinopoisk_id || object.movie.kp_id || object.movie.id;
                var url = BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + id;
                if (!object.movie.kinopoisk_id && !object.movie.kp_id) url = BASE_DOMAIN + '/lite/fxapi?postid=' + id;
                
                this.load(sign(url));
                // Мы не возвращаем свой HTML, мы ждем когда interaction отрисуется сам
                return null; 
            };

            this.load = function (url) {
                var self = this;
                if (url.indexOf('http') !== 0) url = BASE_DOMAIN + (url.indexOf('/') === 0 ? '' : '/') + url;
                
                Lampa.Loading.show();
                network.native(PROXIES[currentProxyIdx] + url, function (res) {
                    Lampa.Loading.hide();
                    self.display(res, url);
                }, function () {
                    Lampa.Loading.hide();
                    Lampa.Noty.show('Ошибка соединения');
                }, false, { dataType: 'text' });
            };

            this.display = function (res, current_url) {
                var self = this;
                var $dom = $('<div>' + res + '</div>');
                
                var items = [];
                var filters = [];

                // Собираем фильтры (Кнопки озвучек/сезонов из Лампака)
                $dom.find('.videos__button, .selector[data-json*="link"]').each(function() {
                    try {
                        var json = JSON.parse($(this).attr('data-json'));
                        filters.push({
                            title: $(this).text().trim(),
                            url: json.url,
                            active: $(this).hasClass('active') || $(this).hasClass('videos__button--active')
                        });
                    } catch(e) {}
                });

                // Собираем контент (Серии)
                $dom.find('.videos__item, .selector[data-json*="play"]').each(function() {
                    try {
                        var json = JSON.parse($(this).attr('data-json'));
                        var title = $(this).find('.videos__item-title').text().trim() || json.title || 'Видео';
                        items.push({
                            title: title,
                            quality: json.maxquality || 'HD',
                            url: sign(json.url),
                            data: json
                        });
                    } catch(e) {}
                });

                // Если уже есть открытое окно взаимодействия - обновляем его, иначе создаем
                if (!interaction) {
                    interaction = new Lampa.Interaction({
                        card: object.movie,
                        filter: filters.length > 0
                    });

                    interaction.onBack = function() {
                        Lampa.Activity.backward();
                    };

                    // При нажатии на серию
                    interaction.onPlay = function(item) {
                        Lampa.Player.play({
                            url: item.url,
                            title: item.title,
                            movie: object.movie
                        });
                    };

                    // При нажатии на фильтр (Озвучка/Сезон)
                    interaction.onFilter = function() {
                        Lampa.Select.show({
                            title: 'Выбор',
                            items: filters.map(function(f) { return { title: f.title, value: f.url }; }),
                            onSelect: function(item) {
                                self.load(sign(item.value));
                            },
                            onBack: function() {
                                Lampa.Controller.toggle('interaction');
                            }
                        });
                    };

                    Lampa.Activity.push({
                        component: 'interaction',
                        title: 'Filmix Online',
                        object: interaction,
                        onBack: function(){ Lampa.Activity.backward(); }
                    });
                }

                // Передаем данные в нативный движок Lampa
                interaction.content(items);
            };

            this.destroy = function () { 
                network.clear(); 
                if (interaction && interaction.destroy) interaction.destroy();
            };
        }

        // Регистрируем компонент
        Lampa.Component.add('fx_hybrid_v9', FilmixComponent);

        // Кнопка "Смотреть" в карточке
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.activity.render();
                if (render && !render.find('.fx-nexus-native').length) {
                    var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Смотреть</span></div>');
                    btn.on('hover:enter', function () {
                        // Запускаем наш компонент-прослойку
                        new FilmixComponent({ movie: e.data.movie }).create();
                    });
                    render.find('.full-start__buttons').append(btn);
                }
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
