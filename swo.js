(function () {
    'use strict';

    /**
     * Filmix Nexus (Maximum Stability) v2.4.6
     * - Приоритет на стабильные прокси: Akter-Black & Dedicated IPs
     * - Авто-переключение HTTP/HTTPS для зеркал (обход 521 ошибки)
     * - Улучшенная ротация при сбоях Cloudflare
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        
        // Зеркала с поддержкой смены протокола
        var API_MIRRORS = [
            'https://showypro.com',
            'http://showypro.com',
            'https://showy.online',
            'https://showypro.xyz'
        ];
        
        // Прокси в порядке приоритета стабильности
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

            this.create = function () {
                html.append(scroll.render());
                scroll.append(container);
                container.html('<div class="fx-status" style="text-align:center; padding: 100px 20px; opacity:0.6; font-size: 1.2em;">Инициализация Filmix...</div>');
                if (object.url) {
                    var path = object.url.split('fxapi')[1] || '';
                    this.load('/lite/fxapi' + path);
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
                container.find('.fx-status').html(
                    '<div style="margin-bottom:10px;">Загрузка данных...</div>' +
                    '<div style="font-size:0.75em; opacity:0.5; overflow:hidden;">' + 
                        (proxy.indexOf('akter') > -1 ? 'Akter Proxy' : (proxy.indexOf('8975') > -1 ? 'Direct Node' : 'CORS Proxy')) + 
                    '</div>'
                );

                network.native(finalUrl, function (res) {
                    toggleLoading(false);
                    retryCount = 0;
                    if (res && res.length > 200) {
                        // Проверка на Cloudflare Error 521 / 502 / 504
                        if (res.indexOf('Web server is down') !== -1 || res.indexOf('521') !== -1 || res.indexOf('502 Bad Gateway') !== -1) {
                            _this.handleServerError('Сервер Filmix недоступен (521/502)');
                        } else {
                            _this.draw(res);
                        }
                    } else {
                        _this.handleServerError('Ошибка данных API');
                    }
                }, function (err) {
                    toggleLoading(false);
                    _this.handleServerError('Сбой сетевого узла');
                }, false, { dataType: 'text', timeout: 7000 });
            };

            this.handleServerError = function(msg) {
                if (retryCount < (PROXIES.length + API_MIRRORS.length)) {
                    retryCount++;
                    // Сначала перебираем прокси для текущего домена, потом меняем домен
                    currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                    if (retryCount % 2 === 0) {
                        currentMirrorIdx = (currentMirrorIdx + 1) % API_MIRRORS.length;
                    }
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx);
                    Lampa.Storage.set('fx_nexus_mirror_idx', currentMirrorIdx);
                    _this.load(lastPath);
                } else {
                    _this.showError('Все каналы связи недоступны. Проверьте настройки сети.');
                }
            };

            this.showError = function(msg) {
                container.empty();
                var err_html = $(
                    '<div style="text-align:center; padding: 60px 20px;">' +
                        '<div style="color: #ff4b4b; font-size: 1.1em; margin-bottom: 25px;">' + msg + '</div>' +
                        '<div class="flex" style="display:flex; flex-direction:column; gap:12px; align-items:center;">' +
                            '<div class="full-start__button selector fx-retry-proxy" style="width:250px; background: #3d4450;"><span>Переключить Прокси</span></div>' +
                            '<div class="full-start__button selector fx-retry-mirror" style="width:250px; background: #2d3440;"><span>Сменить Зеркало API</span></div>' +
                        '</div>' +
                    '</div>'
                );
                
                err_html.find('.fx-retry-proxy').on('hover:enter', function() {
                    currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx);
                    _this.load(lastPath);
                });

                err_html.find('.fx-retry-mirror').on('hover:enter', function() {
                    currentMirrorIdx = (currentMirrorIdx + 1) % API_MIRRORS.length;
                    Lampa.Storage.set('fx_nexus_mirror_idx', currentMirrorIdx);
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
                    var filter_wrap = $('<div class="category-full__external" style="margin-bottom: 30px; display: flex; flex-wrap: wrap; gap: 10px; padding: 0 10px;"></div>');
                    filters.each(function() {
                        try {
                            var json = JSON.parse($(this).attr('data-json'));
                            var f_btn = $('<div class="full-start__button selector"><span>' + $(this).text().trim() + '</span></div>');
                            f_btn.on('hover:enter', function() { 
                                var path = json.url.split('fxapi')[1] || '';
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
                            '<div class="category-full__item selector" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 25px; border-bottom: 1px solid rgba(255,255,255,0.08);">' +
                                '<div class="category-full__item-title" style="font-size: 1.25em; font-weight: 500;">' + title + '</div>' +
                                '<div class="category-full__item-quality" style="opacity: 0.8; background: rgba(255,255,255,0.12); padding: 4px 10px; border-radius: 6px; font-size: 0.8em; font-weight: bold; color: #fff;">' + quality + '</div>' +
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
                    _this.showError('Контент не найден. Попробуйте сменить прокси или зеркало.');
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

                    if (Lampa.Controller.toggle) Lampa.Controller.toggle('full_start');
                };

                inject();
                setTimeout(inject, 600);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
