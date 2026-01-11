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
        if (isNaN(currentProxyIdx)) currentProxyIdx = 0;

        function sign(url) {
            if (!url) return '';
            // Если это уже полная ссылка с доменом, просто добавляем ключи
            if (url.indexOf('http') !== 0) url = BASE_DOMAIN + (url.indexOf('/') === 0 ? '' : '/') + url;
            
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

                // Применяем прокси к подписанной ссылке
                var finalUrl = proxy + sign(reqUrl);

                network.native(finalUrl, function (res) {
                    if (Lampa.Loading && Lampa.Loading.hide) Lampa.Loading.hide();
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                    displayFilmix(res, movie, loadFilmix);
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

            // ПАРСИНГ как в оригинальном swo.js, но с поддержкой Interaction
            $dom.find('.selector, .videos__item, .videos__button').each(function() {
                var el = $(this);
                var jsonStr = el.attr('data-json');
                if(!jsonStr) return;

                try {
                    var json = JSON.parse(jsonStr);
                    var title = el.text().trim() || json.title || '???';
                    
                    // В ответах Filmix: 
                    // Если есть json.url и это НЕ прямая ссылка на видео (m3u8/mp4) - это папка (сезон или озвучка)
                    var isFolder = !!json.url && !(json.url.indexOf('.m3u8') > -1 || json.url.indexOf('.mp4') > -1);
                    
                    // Если это видео, ссылка может быть в json.url или json.play
                    var link = json.url || json.play;

                    if (link) {
                        items.push({
                            title: title,
                            subtitle: json.quality || json.maxquality || '',
                            url: link,
                            is_folder: isFolder,
                            template: 'selectbox_item'
                        });
                    }
                } catch(e) {}
            });

            if (items.length === 0) return Lampa.Noty.show('Контент Filmix не найден');

            // Вызов системного окна Interaction (как на вашем скриншоте)
            Lampa.Activity.push({
                title: 'Filmix',
                component: 'interaction',
                object: {
                    create: function() {
                        this.activity.content(items);
                    },
                    onItem: function(item) {
                        if (item.is_folder) {
                            // Переход в сезон или выбор озвучки
                            fetcher(movie, item.url);
                        } else {
                            // Запуск видео
                            Lampa.Player.play({
                                url: sign(item.url),
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

        // Добавление кнопки в карточку
        function addButton(render, movie) {
            if (render.parent().find('.fx-nexus-native').length) return;

            // Ищем кнопку торрентов, чтобы встать рядом
            var target = render.find('.view--torrent').first();
            if (!target.length) target = render.find('.full-start__button').first();
            
            if (target.length) {
                var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Filmix</span></div>');
                btn.on('hover:enter', function () {
                    loadFilmix(movie);
                });
                
                target.after(btn);
                if (Lampa.Controller.toggle) Lampa.Controller.toggle(Lampa.Controller.enabled().name);
            }
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                addButton(e.object.activity.render(), e.data.movie);
            }
        });

        // Обработка шторки "Смотреть"
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') {
                var active = Lampa.Activity.active();
                if (active && (active.component == 'full_start' || active.component == 'select')) {
                    addButton(active.activity.render(), active.card || (active.object && active.object.movie));
                }
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();