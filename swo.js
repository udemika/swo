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

        function loadFilmix(movie, targetUrl) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var url = targetUrl || (BASE_DOMAIN + '/lite/fxapi?' + (movie.kinopoisk_id ? 'kinopoisk_id=' + movie.kinopoisk_id : 'postid=' + movie.id));

            var fetchWithRetry = function(reqUrl) {
                var proxy = PROXIES[currentProxyIdx];
                if (Lampa.Loading && Lampa.Loading.show) Lampa.Loading.show();

                network.native(proxy + sign(reqUrl), function (res) {
                    if (Lampa.Loading && Lampa.Loading.hide) Lampa.Loading.hide();
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                    displayFilmix(res, movie, fetchWithRetry);
                }, function (err) {
                    currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                    fetchWithRetry(reqUrl);
                }, false, { dataType: 'text' });
            };
            fetchWithRetry(url);
        }

        function displayFilmix(res, movie, fetcher) {
            var $dom = $('<div>' + res + '</div>');
            var items = [];

            // ПАРСИНГ: Мы помечаем элементы как 'folder' (сезоны) или 'video' (серии/фильмы)
            $dom.find('.videos__button, .videos__item, .selector').each(function() {
                var el = $(this);
                var jsonStr = el.attr('data-json');
                if(!jsonStr) return;
                try {
                    var json = JSON.parse(jsonStr);
                    var isFolder = !!json.url; // Если есть URL в JSON - это переход в папку
                    
                    items.push({
                        title: el.text().trim() || json.title || 'Видео',
                        quality: json.maxquality || '',
                        url: isFolder ? json.url : sign(json.url || ''),
                        is_folder: isFolder,
                        template: 'selectbox_item'
                    });
                } catch(e) {}
            });

            if (!items.length) return Lampa.Noty.show('Контент не найден');

            // ВЫЗОВ СИСТЕМНОГО ОКНА (как на скриншоте и в on.js)
            Lampa.Activity.push({
                title: 'Filmix',
                component: 'interaction',
                object: {
                    create: function() { 
                        this.activity.content(items); 
                    },
                    onItem: function(item) {
                        if (item.is_folder) {
                            // Если папка (сезон) - загружаем список серий в это же окно
                            loadFilmix(movie, item.url);
                        } else {
                            // Если видео - играем
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
            });
        }

        // ДОБАВЛЕНИЕ КНОПКИ: Ищем контейнер более агрессивно, как в on.js
        function addButton(e) {
            if (e.render.parent().find('.fx-nexus-native').length) return;

            var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Смотреть Filmix</span></div>');
            
            btn.on('hover:enter', function () {
                loadFilmix(e.movie);
            });

            // Пробуем вставить ПОСЛЕ кнопки торрентов (как в on.js)
            if (e.render.hasClass('selector')) {
                e.render.after(btn);
            } else {
                // Если не нашли конкретную кнопку, пихаем в контейнер кнопок
                e.render.append(btn);
            }

            if (Lampa.Controller.toggle) Lampa.Controller.toggle('full_start');
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var root = e.object.activity.render();
                // Ищем любую кнопку в блоке действий, чтобы привязаться к ней
                var target = root.find('.view--torrent, .view--online, .full-start__button').first();
                if(target.length) {
                    addButton({ render: target, movie: e.data.movie });
                } else {
                    // Если кнопок вообще нет, ищем сам контейнер
                    var container = root.find('.full-start__buttons, .full-start__actions');
                    if(container.length) addButton({ render: container, movie: e.data.movie });
                }
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();