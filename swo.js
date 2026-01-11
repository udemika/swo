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

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0')) || 0;

        function sign(url) {
            if (!url) return '';
            if (url.indexOf('http') !== 0) url = BASE_DOMAIN + (url.indexOf('/') === 0 ? '' : '/') + url;
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') == -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
            return url;
        }

        // Вызов компонента как в on.js
        function openFilmix(movie, targetUrl) {
            var url = targetUrl || (BASE_DOMAIN + '/lite/fxapi?' + (movie.kinopoisk_id ? 'kinopoisk_id=' + movie.kinopoisk_id : 'postid=' + movie.id));
            
            Lampa.Activity.push({
                title: 'Filmix',
                component: 'interaction',
                object: {
                    movie: movie,
                    url: url,
                    create: function() {
                        this.load();
                    },
                    load: function() {
                        var _this = this;
                        var network = new Lampa.Reguest();
                        var proxy = PROXIES[currentProxyIdx];
                        
                        _this.activity.loader(true);

                        network.native(proxy + sign(_this.url), function (res) {
                            _this.activity.loader(false);
                            var items = [];
                            var $dom = $('<div>' + res + '</div>');

                            $dom.find('.selector, .videos__item, .videos__button').each(function() {
                                var el = $(this);
                                var jsonStr = el.attr('data-json');
                                if(!jsonStr) return;

                                try {
                                    var json = JSON.parse(jsonStr);
                                    var link = json.url || json.play;
                                    // Если в ссылке нет .m3u8 или .mp4 - это папка
                                    var isFolder = !!json.url && !(link.indexOf('.m3u8') > -1 || link.indexOf('.mp4') > -1);

                                    items.push({
                                        title: el.text().trim() || json.title || 'Видео',
                                        subtitle: json.quality || json.maxquality || '',
                                        url: link,
                                        is_folder: isFolder,
                                        template: 'selectbox_item'
                                    });
                                } catch(e) {}
                            });

                            if (items.length > 0) {
                                _this.activity.content(items);
                            } else {
                                Lampa.Noty.show('Контент не найден');
                                _this.activity.back();
                            }
                        }, function () {
                            currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                            Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                            _this.load();
                        }, false, { dataType: 'text' });
                    },
                    onItem: function(item) {
                        if (item.is_folder) {
                            // Для сезонов и озвучки подменяем URL и вызываем load() внутри того же окна
                            this.url = item.url;
                            this.load();
                        } else {
                            Lampa.Player.play({
                                url: sign(item.url),
                                title: item.title,
                                movie: this.movie
                            });
                        }
                    },
                    onBack: function() {
                        Lampa.Activity.backward();
                    }
                }
            });
        }

        // Добавление кнопки в шторку (как в on.js)
        function addButton(render, movie) {
            if (render.find('.fx-nexus-native').length) return;

            var target = render.find('.view--torrent, .button--play, .full-start__button').last();
            if (target.length) {
                var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Filmix</span></div>');
                btn.on('hover:enter', function () {
                    openFilmix(movie);
                });
                target.after(btn);
                // Принудительная перерисовка контроллера для навигации пультом
                Lampa.Controller.add('full_start', {
                    toggle: function () {},
                    up: function () {},
                    down: function () {},
                    right: function () {},
                    left: function () {},
                    gone: function () {},
                    enter: function () {}
                });
                Lampa.Controller.toggle('full_start');
            }
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                addButton(e.object.activity.render(), e.data.movie);
            }
        });

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