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

        // Подпись URL всеми необходимыми параметрами
        function sign(url) {
            if (!url) return '';
            if (url.indexOf('http') !== 0) url = BASE_DOMAIN + (url.indexOf('/') === 0 ? '' : '/') + url;
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') == -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
            return url;
        }

        // ГЛАВНЫЙ ОБРАБОТЧИК: Превращает HTML в понятный Лампе JSON-формат
        function parseHtmlToLampaItems(htmlString) {
            var items = [];
            // Создаем виртуальный контейнер для парсинга через jQuery
            var $dom = $('<div>' + htmlString + '</div>');

            $dom.find('.selector, .videos__item, .videos__button').each(function() {
                var el = $(this);
                var jsonStr = el.attr('data-json');
                if(!jsonStr) return;

                try {
                    var json = JSON.parse(jsonStr);
                    var link = json.url || json.play;
                    
                    // Определяем: это папка (сезон/озвучка) или файл (серия/фильм)
                    var isFolder = (json.method === 'link'); 
                    
                    // Извлекаем название: сначала из текста внутри тега, если нет - из JSON
                    var title = el.find('.videos__item-title').text().trim() || 
                                el.text().trim() || 
                                json.title || 'Видео';

                    // Формируем объект, который "понимает" системное окно Lampa
                    items.push({
                        title: title,
                        subtitle: json.quality || json.maxquality || '',
                        url: link,
                        is_folder: isFolder, // Наша метка для логики переходов
                        method: json.method,
                        template: 'selectbox_item' // Используем стандартный шаблон Лампы
                    });
                } catch(e) { console.log('Filmix Parse Error:', e); }
            });
            return items;
        }

        function loadFilmix(movie, targetUrl) {
            var url = targetUrl || (BASE_DOMAIN + '/lite/fxapi?' + (movie.kinopoisk_id ? 'kinopoisk_id=' + movie.kinopoisk_id : 'postid=' + movie.id));
            
            if (Lampa.Loading) Lampa.Loading.show();

            var network = new Lampa.Reguest();
            var proxy = PROXIES[currentProxyIdx];
            var signedUrl = sign(url);

            network.native(proxy + signedUrl, function (res) {
                if (Lampa.Loading) Lampa.Loading.hide();

                // ПРЕОБРАЗОВАНИЕ: из HTML в массив объектов
                var items = parseHtmlToLampaItems(res);

                if (items.length > 0) {
                    // Открываем системное окно Лампы с нашими обработанными данными
                    Lampa.Select.show({
                        title: 'Filmix',
                        items: items,
                        onSelect: function(item) {
                            if (item.is_folder) {
                                // Если это папка (сезон/озвучка) - идем глубже (рекурсия)
                                loadFilmix(movie, item.url);
                            } else {
                                // Если это финальное видео - запускаем плеер
                                Lampa.Player.play({
                                    url: sign(item.url),
                                    title: item.title,
                                    movie: movie
                                });
                                Lampa.Player.playlist([{
                                    url: sign(item.url),
                                    title: item.title
                                }]);
                            }
                        },
                        onBack: function() {
                            // Логика возврата назад
                            Lampa.Controller.toggle('full');
                        }
                    });
                } else {
                    Lampa.Noty.show('Ничего не найдено');
                }
            }, function () {
                if (Lampa.Loading) Lampa.Loading.hide();
                // Ротация прокси при ошибке
                currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                Lampa.Noty.show('Смена прокси...');
                loadFilmix(movie, url);
            }, false, { dataType: 'text' });
        }

        // Функции добавления кнопки в интерфейс (без изменений)
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