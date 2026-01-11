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
            'https://cors557.deno.dev/',
            'https://apn10.akter-black.com/'
        ];

        var currentProxyIdx = 0;

        function toggleLoading(show) {
            try {
                if (typeof Lampa.Loading === 'function') Lampa.Loading(show);
                else if (Lampa.Loading && Lampa.Loading.show) {
                    show ? Lampa.Loading.show() : Lampa.Loading.hide();
                }
            } catch(e) {}
        }

        function sign(url) {
            if (!url) return '';
            var signed = url;
            if (signed.indexOf('http') !== 0) signed = BASE_DOMAIN + (signed.indexOf('/') === 0 ? '' : '/') + signed;
            if (signed.indexOf('uid=') == -1) signed = Lampa.Utils.addUrlComponent(signed, 'uid=' + WORKING_UID);
            if (signed.indexOf('showy_token=') == -1) signed = Lampa.Utils.addUrlComponent(signed, 'showy_token=' + WORKING_TOKEN);
            if (signed.indexOf('rjson=') == -1) signed = Lampa.Utils.addUrlComponent(signed, 'rjson=False');
            return signed;
        }

        // УЛУЧШЕННЫЙ ПАРСЕР: создает объекты, которые ТОЧНО понимает компонент interaction
        function parseToItems(htmlString) {
            var items = [];
            var $dom = $('<div>' + htmlString + '</div>');
            
            $dom.find('.selector, .videos__item, .videos__button').each(function() {
                var el = $(this);
                var jsonStr = el.attr('data-json');
                if(!jsonStr) return;
                try {
                    var json = JSON.parse(jsonStr);
                    var title = el.find('.videos__item-title, .videos__button-title').text().trim() || el.text().trim() || json.title;
                    
                    items.push({
                        title: title,
                        quality: json.quality || json.maxquality || '',
                        url: json.url || json.play,
                        is_folder: (json.method === 'link'),
                        // Обязательные поля для компонента interaction
                        display_title: title,
                        category: json.method === 'link' ? 'Папка' : 'Видео'
                    });
                } catch(e) {}
            });
            console.log('Swo Debug: Распарсено элементов:', items.length);
            return items;
        }

        function loadFilmix(movie, targetUrl) {
            var url = targetUrl || (BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + movie.kinopoisk_id);
            toggleLoading(true);

            var network = new Lampa.Reguest();
            var proxy = PROXIES[currentProxyIdx];

            network.native(proxy + sign(url), function (res) {
                toggleLoading(false);
                var items = parseToItems(res);

                if (items.length > 0) {
                    // Создаем активность
                    Lampa.Activity.push({
                        title: movie.title || 'Filmix',
                        component: 'interaction',
                        object: {
                            create: function() {
                                // Важно: очищаем и добавляем контент правильно
                                this.activity.loader(false); 
                                this.activity.render().find('.interaction__content').empty();
                                this.activity.append(items); // Используем append вместо content
                            },
                            onItem: function(item) {
                                if (item.is_folder) {
                                    loadFilmix(movie, item.url);
                                } else {
                                    var video = { 
                                        url: sign(item.url), 
                                        title: item.title, 
                                        movie: movie 
                                    };
                                    Lampa.Player.play(video);
                                    Lampa.Player.playlist([video]);
                                }
                            },
                            onBack: function() {
                                Lampa.Activity.backward();
                            }
                        }
                    });
                } else {
                    Lampa.Noty.show('Данные не найдены');
                }
            }, function () {
                toggleLoading(false);
                currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                loadFilmix(movie, url);
            }, false, { dataType: 'text' });
        }

        function addButton(render, movie) {
            if (render.find('.fx-nexus-native').length) return;
            var target = render.find('.view--torrent, .view--online, .button--play').last();
            if (target.length) {
                var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Filmix</span></div>');
                btn.on('hover:enter', function () { loadFilmix(movie); });
                target.after(btn);
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