
(function () {
    'use strict';

    // Конфигурация доступа
    var WORKING_UID = 'i8nqb9vw';
    var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
    var API_MIRRORS = ['https://showypro.com', 'https://showy.online', 'https://showypro.xyz'];
    var PROXIES = ['https://apn5.akter-black.com/', 'https://apn10.akter-black.com/', 'https://corsproxy.io/?'];

    function FilmixPlugin(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var items = [];
        var html = $('<div></div>');
        var active_mirror_idx = 0;
        var active_proxy_idx = 0;

        this.create = function () {
            var _this = this;
            this.activity.loader(true);
            
            // Загрузка главной страницы или поиска
            this.load();
            
            return this.render();
        };

        this.load = function () {
            var _this = this;
            var url = this.getApiUrl('/lite/fxapi'); // Базовый путь
            
            if (object.search) {
                url = this.getApiUrl('/lite/fxapi?search=' + encodeURIComponent(object.search));
            }

            this.fetch(url, function (data) {
                _this.activity.loader(false);
                if (data && data.items) {
                    _this.build(data.items);
                } else {
                    _this.empty();
                }
            }, function () {
                _this.activity.loader(false);
                _this.empty('Ошибка сети или доступа к Filmix');
            });
        };

        this.getApiUrl = function(path) {
            var mirror = API_MIRRORS[active_mirror_idx % API_MIRRORS.length];
            var proxy = PROXIES[active_proxy_idx % PROXIES.length];
            var signed = mirror + path + (path.includes('?') ? '&' : '?') + 'uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rjson=True';
            
            if (proxy.includes('?')) return proxy + encodeURIComponent(signed);
            return proxy + signed;
        };

        this.fetch = function (url, success, error, retryCount) {
            var _this = this;
            retryCount = retryCount || 0;

            network.silent(url, function (data) {
                success(data);
            }, function () {
                if (retryCount < (API_MIRRORS.length + PROXIES.length)) {
                    active_proxy_idx++;
                    if (retryCount % 2 === 0) active_mirror_idx++;
                    _this.fetch(_this.getApiUrl('/lite/fxapi'), success, error, retryCount + 1);
                } else {
                    error();
                }
            });
        };

        this.build = function (data_items) {
            var _this = this;
            data_items.forEach(function (item) {
                var card = Lampa.Template.get('card', {
                    title: item.title,
                    release_year: item.year || ''
                });

                card.on('hover:focus', function () {
                    Lampa.Background.change(item.poster);
                });

                card.on('click:select', function () {
                    // Переход к выбору серий/качеств
                    Lampa.Activity.push({
                        url: item.url,
                        title: item.title,
                        component: 'filmix_view',
                        page: 1
                    });
                });

                html.append(card);
            });
        };

        this.empty = function (msg) {
            html.append('<div class="empty">' + (msg || 'Ничего не найдено') + '</div>');
        };

        this.render = function () {
            return html;
        };
    }

    // Регистрация плагина в Lampa
    function startPlugin() {
        window.filmix_plugin_installed = true;

        // Добавляем в меню
        Lampa.Menu.add({
            id: 'filmix',
            title: 'Filmix',
            icon: '<svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org/2000/svg"><path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="white"/></svg>',
            onSelect: function () {
                Lampa.Activity.push({
                    url: '',
                    title: 'Filmix',
                    component: 'filmix',
                    page: 1
                });
            }
        });

        // Регистрируем компонент
        Lampa.Component.add('filmix', FilmixPlugin);
        
        // Интеграция в карточку фильма (как источник)
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite') {
                var btn = $('<div class="full-start__button selector"><span>Filmix</span></div>');
                btn.on('click:select', function () {
                    Lampa.Activity.push({
                        title: 'Filmix',
                        component: 'filmix',
                        search: e.data.movie.title,
                        kp_id: e.data.movie.kinopoisk_id
                    });
                });
                e.object.container.find('.full-start__buttons').append(btn);
            }
        });
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
