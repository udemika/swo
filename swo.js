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

        // Универсальный лоадер (исправляет Script Error)
        function toggleLoading(show) {
            try {
                if (typeof Lampa.Loading === 'function') Lampa.Loading(show);
                else if (Lampa.Loading && Lampa.Loading.show) show ? Lampa.Loading.show() : Lampa.Loading.hide();
            } catch (e) {}
        }

        function sign(url) {
            if (!url) return '';
            if (url.indexOf('http') !== 0) url = BASE_DOMAIN + (url.indexOf('/') === 0 ? '' : '/') + url;
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') == -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
            return url;
        }

        function loadFilmix(movie, targetUrl) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var url = targetUrl || (BASE_DOMAIN + '/lite/fxapi?' + (movie.kinopoisk_id ? 'kinopoisk_id=' + movie.kinopoisk_id : 'postid=' + movie.id));

            var fetch = function(reqUrl) {
                var proxy = PROXIES[currentProxyIdx];
                toggleLoading(true);

                network.native(proxy + sign(reqUrl), function (res) {
                    toggleLoading(false);
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                    
                    var items = parseResponse(res);
                    if (items.length > 0) {
                        displayInteraction(items, movie, fetch);
                    } else {
                        Lampa.Noty.show('Контент не найден');
                    }
                }, function () {
                    toggleLoading(false);
                    currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                    fetch(reqUrl);
                }, false, { dataType: 'text' });
            };
            fetch(url);
        }

        function parseResponse(html) {
            var $dom = $('<div>' + html + '</div>');
            var items = [];

            $dom.find('.selector, .videos__item, .videos__button').each(function() {
                var el = $(this);
                var jsonStr = el.attr('data-json');
                if(!jsonStr) return;

                try {
                    var json = JSON.parse(jsonStr);
                    var title = el.find('.videos__item-title').text().trim() || el.text().trim() || json.title || '???';
                    
                    var link = json.url || json.play;
                    // Если в ссылке есть s= (сезон) или p= (перевод) и нет .m3u8 - это папка
                    var isFolder = !!json.url && !(link.indexOf('.m3u8') > -1 || link.indexOf('.mp4') > -1);

                    items.push({
                        title: title,
                        url: link,
                        is_folder: isFolder,
                        quality: json.quality || json.maxquality || '',
                        template: 'selectbox_item'
                    });
                } catch(e) {}
            });
            return items;
        }

        function displayInteraction(items, movie, fetcher) {
            var active = Lampa.Activity.active();
            // Если мы уже в окне Filmix, просто обновляем список (для сезонов и озвучек)
            if (active && active.component === 'interaction' && active.title === 'Filmix') {
                active.activity.content(items);
            } else {
                Lampa.Activity.push({
                    title: 'Filmix',
                    component: 'interaction',
                    object: {
                        create: function() {
                            this.activity.content(items);
                        },
                        onItem: function(item) {
                            if (item.is_folder) {
                                fetcher(item.url); 
                            } else {
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
        }

        function addButton(render, movie) {
            if (render.find('.fx-nexus-native').length) return;

            // Ищем кнопку Торренты или Онлайн в карточке
            var target = render.find('.view--torrent, .view--online').last();
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

        // Слушатель для полной карточки
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                addButton(e.object.activity.render(), e.data.movie);
            }
        });

        // Слушатель для шторки (если кнопка "Смотреть" открывает подменю)
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