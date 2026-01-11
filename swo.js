
(function () {
    'use strict';

    /**
     * Filmix Nexus (Maximum Stability) v2.4.9
     * - Исправлена ошибка 503 (Service Unavailable) через Anti-Cache
     * - Принудительный сброс сетевого стека network.clear()
     * - Улучшена работа пульта при переходах из глубокого скролла
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        
        var API_MIRRORS = [
            'https://showypro.com',
            'http://showypro.com',
            'https://showy.online',
            'https://showypro.xyz'
        ];
        
        var PROXIES = [
            'https://apn5.akter-black.com/',
            'https://apn10.akter-black.com/',
            'http://85.198.110.239:8975/',
            'http://91.184.245.56:8975/',
            'https://cors.lampa.stream/',
            'https://corsproxy.io/?',
            'https://cors.byskaz.ru/'
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0'));
        var currentMirrorIdx = parseInt(Lampa.Storage.get('fx_nexus_mirror_idx', '0'));

        function sign(url) {
            url = url + '';
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') == -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
            // Кэш-бастер для обхода 503 ошибки прокси
            url = Lampa.Utils.addUrlComponent(url, '_fx=' + Math.floor(Math.random() * 1000000));
            return url;
        }

        function toggleLoading(show) {
            try {
                if (typeof Lampa.Loading === 'function') Lampa.Loading(show);
                else if (Lampa.Loading && Lampa.Loading.show) show ? Lampa.Loading.show() : Lampa.Loading.hide();
            } catch (e) {}
        }

        function FilmixComponent(object) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var html = $('<div class="category-full"></div>');
            var container = $('<div class="category-full__container"></div>');
            var _this = this;
            var lastPath = '';
            var retryCount = 0;
            var maxRetries = PROXIES.length + API_MIRRORS.length;

            this.create = function () {
                html.append(scroll.render());
                scroll.append(container);
                container.html('<div class="fx-status" style="text-align:center; padding: 100px 20px; opacity:0.6; font-size: 1.2em;">Подключение к Filmix...</div>');
                
                // Полный сброс перед созданием компонента
                network.clear();

                if (object.url) {
                    var path = object.url.split('fxapi')[1] || '';
                    this.load('/lite/fxapi' + path);
                } else if (object.search) {
                    this.load('/lite/fxapi?search=' + encodeURIComponent(object.search));
                }
                
                return html;
            };

            this.load = function (path) {
                lastPath = path;
                var mirror = API_MIRRORS[currentMirrorIdx % API_MIRRORS.length];
                var proxy = PROXIES[currentProxyIdx % PROXIES.length];
                var targetUrl = sign(mirror + path);
                
                var finalUrl = targetUrl;
                if (proxy.indexOf('?') !== -1) {
                    finalUrl = proxy + encodeURIComponent(targetUrl);
                } else {
                    finalUrl = proxy + targetUrl;
                }

                toggleLoading(true);
                network.clear(); // Очистка старых запросов перед новым

                container.find('.fx-status').html(
                    '<div style="margin-bottom:10px;">Загрузка Filmix...</div>' +
                    '<div style="font-size:0.7em; opacity:0.4;">Узел: ' + (currentProxyIdx + 1) + '/' + PROXIES.length + '</div>'
                );

                network.native(finalUrl, function (res) {
                    toggleLoading(false);
                    if (res && res.length > 200) {
                        // Проверка на ошибки Cloudflare и прокси
                        if (res.indexOf('Web server is down') !== -1 || res.indexOf('521') !== -1 || res.indexOf('502 Bad Gateway') !== -1 || res.indexOf('503 Service') !== -1) {
                            _this.handleServerError('Ошибка прокси (503)');
                        } else {
                            retryCount = 0;
                            _this.draw(res);
                        }
                    } else {
                        _this.handleServerError('Пустой ответ');
                    }
                }, function (err) {
                    toggleLoading(false);
                    _this.handleServerError('Ошибка сети (503)');
                }, false, { dataType: 'text', timeout: 9000 });
            };

            this.handleServerError = function(msg) {
                if (retryCount < maxRetries) {
                    retryCount++;
                    currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                    if (retryCount % 2 === 0) {
                        currentMirrorIdx = (currentMirrorIdx + 1) % API_MIRRORS.length;
                    }
                    
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx);
                    Lampa.Storage.set('fx_nexus_mirror_idx', currentMirrorIdx);
                    
                    setTimeout(function() {
                        _this.load(lastPath);
                    }, 100);
                } else {
                    _this.showError('Все узлы недоступны. Проверьте соединение.');
                }
            };

            this.showError = function(msg) {
                container.empty();
                var err_html = $(
                    '<div style="text-align:center; padding: 60px 20px;">' +
                        '<div style="color: #ff4b4b; font-size: 1.1em; margin-bottom: 25px;">' + msg + '</div>' +
                        '<div style="display:flex; flex-direction:column; gap:12px; align-items:center;">' +
                            '<div class="full-start__button selector fx-retry-auto" style="width:250px; background: #3b82f6;"><span>Повторить поиск</span></div>' +
                            '<div class="full-start__button selector fx-retry-proxy" style="width:250px; background: #3d4450;"><span>Сменить прокси</span></div>' +
                        '</div>' +
                    '</div>'
                );
                
                err_html.find('.fx-retry-auto').on('hover:enter', function() {
                    retryCount = 0;
                    _this.load(lastPath);
                });

                err_html.find('.fx-retry-proxy').on('hover:enter', function() {
                    currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx);
                    retryCount = 0;
                    _this.load(lastPath);
                });

                container.append(err_html);
                Lampa.Controller.collectionFocus(container.find('.selector')[0], container);
            };

            this.draw = function (res) {
                var $dom = $('<div>' + res + '</div>');
                container.empty();

                var filters = $dom.find('.videos__button, .selector[data-json*="link"]');
                if (filters.length > 0) {
                    var filter_wrap = $('<div class="category-full__external" style="margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 8px; padding: 0 10px;"></div>');
                    filters.each(function() {
                        try {
                            var json = JSON.parse($(this).attr('data-json'));
                            var f_btn = $('<div class="full-start__button selector" style="padding: 10px 15px; height: auto;"><span>' + $(this).text().trim() + '</span></div>');
                            f_btn.on('hover:enter', function() { 
                                var path = json.url.split('fxapi')[1] || '';
                                retryCount = 0;
                                _this.load('/lite/fxapi' + path); 
                            });
                            filter_wrap.append(f_btn);
                        } catch(e) {}
                    });
                    container.append(filter_wrap);
                }

                var items_count = 0;
                $dom.find('.videos__item, .selector[data-json*="play"]').each(function() {
                    try {
                        var json = JSON.parse($(this).attr('data-json'));
                        var title = $(this).find('.videos__item-title').text().trim() || json.title || 'Видео';
                        var quality = json.maxquality || 'HD';
                        
                        var item_html = $(
                            '<div class="category-full__item selector" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">' +
                                '<div style="font-size: 1.1em; flex: 1; margin-right: 10px;">' + title + '</div>' +
                                '<div style="background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); padding: 2px 8px; border-radius: 4px; font-size: 0.7em; font-weight: bold; color: #60a5fa;">' + quality + '</div>' +
                            '</div>'
                        );

                        item_html.on('hover:enter', function() {
                            Lampa.Player.play({ url: sign(json.url), title: title, movie: object.movie });
                        });

                        container.append(item_html);
                        items_count++;
                    } catch(e) {}
                });

                if (items_count === 0 && filters.length === 0) {
                    _this.showError('Контент не найден.');
                } else {
                    _this.start();
                }
            };

            this.start = function () {
                Lampa.Controller.add('fx_browser', {
                    toggle: function () {
                        Lampa.Controller.collectionSet(html);
                        var first = container.find('.selector').first();
                        if (first.length) Lampa.Controller.collectionFocus(first[0], container);
                    },
                    back: function () { Lampa.Activity.backward(); }
                });
                Lampa.Controller.enable('fx_browser');
            };

            this.pause = function () {};
            this.stop = function () {};
            this.render = function () { return html; };
            this.destroy = function () { network.clear(); html.remove(); };
        }

        Lampa.Component.add('filmix_browser', FilmixComponent);

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.activity.render();
                if (!render) return;

                var inject = function() {
                    if (render.find('.fx-nexus-v10').length) return;

                    var btn = $('<div class="full-start__button selector view--online fx-nexus-v10"><span>Смотреть Filmix</span></div>');
                    btn.on('hover:enter', function () {
                        var id = e.data.movie.kinopoisk_id || e.data.movie.kp_id || e.data.movie.id;
                        var startUrl = '/lite/fxapi?kinopoisk_id=' + id;
                        
                        Lampa.Activity.push({
                            component: 'filmix_browser',
                            title: 'Filmix',
                            movie: e.data.movie,
                            url: startUrl
                        });
                    });

                    var container = render.find('.full-start__buttons, .full-start__actions, .full-start__left, .full-start').first();
                    var existingBtn = render.find('.full-start__button, .selector').first();

                    if (existingBtn.length && !existingBtn.hasClass('fx-nexus-v10')) existingBtn.before(btn);
                    else if (container.length) container.prepend(btn);
                    
                    var current = Lampa.Controller.enabled();
                    if (current && (current.name == 'full_start' || current.name == 'full_descr')) {
                         Lampa.Controller.toggle(current.name);
                    }
                };

                inject();
                setTimeout(inject, 600);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
