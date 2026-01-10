(function () {
    'use strict';

    /**
     * Filmix Nexus (Proxy Resilience) v2.4.3
     * - Авто-переключение прокси при ошибке 502/403
     * - Кнопка "Сменить прокси" в окне ошибки
     * - Улучшенная совместимость с CORS-прокси
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'https://showypro.com';
        
        var PROXIES = [
            'https://cors.lampa.stream/',
            'https://corsproxy.io/?',
            'https://api.allorigins.win/raw?url=',
            'https://cors.byskaz.ru/'
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0'));

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
            var lastUrl = '';
            var retryCount = 0;

            this.create = function () {
                html.append(scroll.render());
                scroll.append(container);
                container.html('<div class="fx-status" style="text-align:center; padding: 100px 20px; opacity:0.6; font-size: 1.3em;">Инициализация Filmix...</div>');
                if (object.url) this.load(object.url);
                return html;
            };

            this.load = function (targetUrl) {
                lastUrl = targetUrl;
                var proxy = PROXIES[currentProxyIdx];
                var finalUrl = sign(targetUrl);
                
                // Кодируем URL для определенных прокси
                if (proxy.indexOf('?') !== -1) {
                    finalUrl = proxy + encodeURIComponent(finalUrl);
                } else {
                    finalUrl = proxy + finalUrl;
                }

                toggleLoading(true);
                container.find('.fx-status').text('Загрузка через прокси #' + (currentProxyIdx + 1) + '...');

                network.native(finalUrl, function (res) {
                    toggleLoading(false);
                    retryCount = 0;
                    if (res && res.length > 100) {
                        _this.draw(res);
                    } else {
                        _this.showError('Пустой ответ от сервера');
                    }
                }, function (err) {
                    toggleLoading(false);
                    console.log('Filmix Proxy Error:', err);
                    
                    // Авто-ретрай с другим прокси (максимум 3 попытки)
                    if (retryCount < PROXIES.length - 1) {
                        retryCount++;
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx);
                        _this.load(lastUrl);
                    } else {
                        _this.showError('Все прокси-серверы вернули ошибку (502/403).');
                    }
                }, false, { dataType: 'text', timeout: 10000 });
            };

            this.showError = function(msg) {
                container.empty();
                var err_html = $(
                    '<div style="text-align:center; padding: 80px 20px;">' +
                        '<div style="color: #ff4b4b; font-size: 1.2em; margin-bottom: 20px;">' + msg + '</div>' +
                        '<div class="full-start__button selector fx-retry-btn" style="display:inline-block; background: #3d4450;"><span>Сменить прокси и повторить</span></div>' +
                    '</div>'
                );
                err_html.find('.fx-retry-btn').on('hover:enter', function() {
                    currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx);
                    _this.load(lastUrl);
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
                            f_btn.on('hover:enter', function() { _this.load(json.url); });
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
                                '<div class="category-full__item-title" style="font-size: 1.3em; font-weight: 500;">' + title + '</div>' +
                                '<div class="category-full__item-quality" style="opacity: 0.7; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 6px; font-size: 0.9em; font-weight: bold;">' + quality + '</div>' +
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
                    _this.showError('Контент не найден в ответе сервера.');
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
                    if (render.find('.fx-nexus-v7').length) return;

                    var btn = $('<div class="full-start__button selector view--online fx-nexus-v7"><span>Смотреть Filmix</span></div>');
                    btn.on('hover:enter', function () {
                        var id = e.data.movie.kinopoisk_id || e.data.movie.kp_id || e.data.movie.id;
                        var startUrl = BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + id;
                        
                        Lampa.Activity.push({
                            component: 'filmix_browser',
                            title: 'Filmix',
                            movie: e.data.movie,
                            url: startUrl
                        });
                    });

                    var container = render.find('.full-start__buttons, .full-start__actions, .full-start__left, .full-start').first();
                    var existingBtn = render.find('.full-start__button, .selector').first();

                    if (existingBtn.length && !existingBtn.hasClass('fx-nexus-v7')) existingBtn.before(btn);
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
