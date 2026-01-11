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

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0')) || 0;

        // Безопасный вызов индикатора загрузки (исправляет Script Error)
        function toggleLoading(show) {
            try {
                if (typeof Lampa.Loading === 'function') {
                    Lampa.Loading(show);
                } else if (Lampa.Loading) {
                    if (show && typeof Lampa.Loading.show === 'function') Lampa.Loading.show();
                    else if (!show && typeof Lampa.Loading.hide === 'function') Lampa.Loading.hide();
                }
            } catch(e) { console.log('Swo: Loading error', e); }
        }

        // Подпись URL всеми необходимыми параметрами
        function sign(url) {
            if (!url) return '';
            var signed = url;
            if (signed.indexOf('http') !== 0) signed = BASE_DOMAIN + (signed.indexOf('/') === 0 ? '' : '/') + signed;
            if (signed.indexOf('uid=') == -1) signed = Lampa.Utils.addUrlComponent(signed, 'uid=' + WORKING_UID);
            if (signed.indexOf('showy_token=') == -1) signed = Lampa.Utils.addUrlComponent(signed, 'showy_token=' + WORKING_TOKEN);
            if (signed.indexOf('rjson=') == -1) signed = Lampa.Utils.addUrlComponent(signed, 'rjson=False');
            return signed;
        }

        // ПАРСЕР: Превращает HTML от Lampac в JSON для системного окна Lampa
        function parseHtmlToLampaItems(htmlString) {
            var items = [];
            var $dom = $('<div>' + htmlString + '</div>');

            $dom.find('.selector, .videos__item, .videos__button').each(function() {
                var el = $(this);
                var jsonStr = el.attr('data-json');
                if(!jsonStr) return;

                try {
                    var json = JSON.parse(jsonStr);
                    var link = json.url || json.play;
                    
                    // Если метод link - это папка (сезон/озвучка). Если play - это файл.
                    var isFolder = (json.method === 'link'); 
                    
                    // Извлекаем чистый заголовок
                    var title = el.find('.videos__item-title').text().trim() || 
                                el.find('.videos__button-title').text().trim() ||
                                el.text().trim() || 
                                json.title || 'Видео';

                    items.push({
                        title: title,
                        subtitle: json.quality || json.maxquality || '',
                        url: link,
                        is_folder: isFolder,
                        method: json.method,
                        template: 'selectbox_item'
                    });
                } catch(e) { }
            });
            return items;
        }

        function loadFilmix(movie, targetUrl) {
            var url = targetUrl || (BASE_DOMAIN + '/lite/fxapi?' + (movie.kinopoisk_id ? 'kinopoisk_id=' + movie.kinopoisk_id : 'postid=' + movie.id));
            
            toggleLoading(true);

            var network = new Lampa.Reguest();
            var proxy = PROXIES[currentProxyIdx];
            var signedUrl = sign(url);

            network.native(proxy + signedUrl, function (res) {
                toggleLoading(false);

                var items = parseHtmlToLampaItems(res);

                if (items.length > 0) {
                    Lampa.Select.show({
                        title: movie.title || 'Filmix',
                        items: items,
                        onSelect: function(item) {
                            if (item.is_folder) {
                                // Рекурсивный переход в папку
                                loadFilmix(movie, item.url);
                            } else {
                                // Запуск видео
                                var playUrl = sign(item.url);
                                Lampa.Player.play({
                                    url: playUrl,
                                    title: item.title,
                                    movie: movie
                                });
                                Lampa.Player.playlist([{
                                    url: playUrl,
                                    title: item.title
                                }]);
                            }
                        },
                        onBack: function() {
                            Lampa.Controller.toggle('full');
                        }
                    });
                } else {
                    Lampa.Noty.show('Ничего не найдено');
                }
            }, function () {
                toggleLoading(false);
                // Ротация прокси
                currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                Lampa.Noty.show('Прокси не ответил, меняю...');
                loadFilmix(movie, url);
            }, false, { dataType: 'text' });
        }

        function addButton(render, movie) {
            if (render.find('.fx-nexus-native').length) return;
            
            var target = render.find('.view--torrent, .view--online, .button--play').last();
            if (target.length) {
                var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Filmix (Swo)</span></div>');
                btn.on('hover:enter', function () { 
                    loadFilmix(movie); 
                });
                target.after(btn);
                
                // Обновляем контроллер навигации
                if (Lampa.Controller.toggle) Lampa.Controller.toggle(Lampa.Controller.enabled().name);
            }
        }

        // Слушатели событий
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                addButton(e.object.activity.render(), e.data.movie);
            }
        });

        // Дополнительная проверка для некоторых тем оформления
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') {
                var active = Lampa.Activity.active();
                if (active && (active.component == 'full_start' || active.component == 'select')) {
                    var card = active.card || (active.object && active.object.movie);
                    if (card) addButton(active.activity.render(), card);
                }
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();