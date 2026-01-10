(function () {
    'use strict';

    /**
     * Filmix Nexus (Stable UI) v2.4.2
     * - Исправлен "пустой экран" при открытии
     * - Автозагрузка данных при создании компонента
     * - Обработка ошибок сети и прокси
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'https://showypro.com'; // Используем HTTPS
        
        var PROXIES = [
            'https://cors.byskaz.ru/',
            'https://cors.lampa.stream/',
            'https://corsproxy.io/?'
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

            this.create = function () {
                html.append(scroll.render());
                scroll.append(container);
                
                // Сразу показываем статус загрузки
                container.html('<div class="fx-status" style="text-align:center; padding: 100px 20px; opacity:0.6; font-size: 1.3em;">Загрузка данных Filmix...</div>');
                
                // Если URL передан в объекте - грузим сразу
                if (object.url) {
                    this.load(object.url);
                }
                
                return html;
            };

            this.load = function (targetUrl) {
                toggleLoading(true);
                network.native(PROXIES[currentProxyIdx] + sign(targetUrl), function (res) {
                    toggleLoading(false);
                    if (res) _this.draw(res);
                    else container.html('<div style="text-align:center; padding: 100px 20px; color: #ffae00;">Сервер вернул пустой ответ</div>');
                }, function () {
                    toggleLoading(false);
                    container.html('<div style="text-align:center; padding: 100px 20px; color: #ff4b4b;">Ошибка загрузки. Попробуйте сменить прокси в настройках.</div>');
                }, false, { dataType: 'text' });
            };

            this.draw = function (res) {
                var $dom = $('<div>' + res + '</div>');
                container.empty();

                // Отрисовка фильтров (Сезоны, Озвучки)
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

                // Отрисовка списка серий
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
                    container.append('<div style="text-align:center; padding: 100px; opacity:0.5;">Контент не найден или недоступен</div>');
                }

                // Включаем контроллер и фокусируемся
                _this.start();
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
                    if (render.find('.fx-nexus-v6').length) return;

                    var btn = $('<div class="full-start__button selector view--online fx-nexus-v6"><span>Смотреть Filmix</span></div>');
                    btn.on('hover:enter', function () {
                        var id = e.data.movie.kinopoisk_id || e.data.movie.kp_id || e.data.movie.id;
                        var startUrl = BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + id;
                        if (!e.data.movie.kinopoisk_id && !e.data.movie.kp_id) startUrl = BASE_DOMAIN + '/lite/fxapi?postid=' + id;

                        // Передаем URL сразу в активность
                        Lampa.Activity.push({
                            component: 'filmix_browser',
                            title: 'Filmix: ' + (e.data.movie.title || e.data.movie.name),
                            movie: e.data.movie,
                            url: startUrl
                        });
                    });

                    var container = render.find('.full-start__buttons, .full-start__actions, .full-start__left, .full-start').first();
                    var existingBtn = render.find('.full-start__button, .selector').first();

                    if (existingBtn.length && !existingBtn.hasClass('fx-nexus-v6')) existingBtn.before(btn);
                    else if (container.length) container.prepend(btn);

                    if (Lampa.Controller.toggle) Lampa.Controller.toggle('full_start');
                };

                inject();
                setTimeout(inject, 500);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
