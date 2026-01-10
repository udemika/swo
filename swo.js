(function () {
    'use strict';

    /**
     * Filmix Nexus (Ultimate UI) v2.4.0
     * - Полноценный интерфейс как на скриншоте
     * - Исправлена навигация: Сезон -> Озвучка -> Серии
     * - Полная совместимость с Activity.push
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'http://showypro.com';
        
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

        // ОСНОВНОЙ КОМПОНЕНТ ОТОБРАЖЕНИЯ
        function FilmixComponent(object) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var items = [];
            var html = $('<div class="category-full"></div>');
            var container = $('<div class="category-full__container"></div>');
            var _this = this;

            this.create = function () {
                html.append(scroll.render());
                scroll.append(container);
                return html;
            };

            this.load = function (targetUrl) {
                toggleLoading(true);
                container.empty();
                network.native(PROXIES[currentProxyIdx] + sign(targetUrl), function (res) {
                    toggleLoading(false);
                    _this.draw(res);
                }, function () {
                    toggleLoading(false);
                    Lampa.Noty.show('Ошибка загрузки Filmix');
                }, false, { dataType: 'text' });
            };

            this.draw = function (res) {
                var $dom = $('<div>' + res + '</div>');
                items = [];
                container.empty();

                // Если есть фильтры (сезоны/озвучки), выводим их сверху как кнопки
                var filters = $dom.find('.videos__button, .selector[data-json*="link"]');
                if (filters.length > 0) {
                    var filter_wrap = $('<div class="category-full__external" style="margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 10px;"></div>');
                    filters.each(function() {
                        try {
                            var json = JSON.parse($(this).attr('data-json'));
                            var f_btn = $('<div class="full-start__button selector"><span>' + $(this).text().trim() + '</span></div>');
                            f_btn.on('hover:enter', function() {
                                _this.load(json.url);
                            });
                            filter_wrap.append(f_btn);
                        } catch(e) {}
                    });
                    container.append(filter_wrap);
                }

                // Выводим список серий/видео
                $dom.find('.videos__item, .selector[data-json*="play"]').each(function() {
                    try {
                        var json = JSON.parse($(this).attr('data-json'));
                        var title = $(this).find('.videos__item-title').text().trim() || json.title || 'Видео';
                        var quality = json.maxquality || 'HD';
                        
                        var item_html = $(
                            '<div class="category-full__item selector" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1);">' +
                                '<div class="category-full__item-title" style="font-size: 1.2em;">' + title + '</div>' +
                                '<div class="category-full__item-quality" style="opacity: 0.6;">' + quality + '</div>' +
                            '</div>'
                        );

                        item_html.on('hover:enter', function() {
                            Lampa.Player.play({
                                url: sign(json.url),
                                title: title,
                                movie: object.movie
                            });
                        });

                        container.append(item_html);
                    } catch(e) {}
                });

                if (container.children().length === 0) {
                    container.append('<div style="text-align:center; padding: 50px; opacity:0.5;">Контент не найден</div>');
                }

                _this.start(); // Перефокусировка
            };

            this.start = function () {
                Lampa.Controller.add('fx_browser', {
                    toggle: function () {
                        Lampa.Controller.collectionSet(html);
                        Lampa.Controller.collectionFocus(container.find('.selector')[0], container);
                    },
                    back: function () {
                        Lampa.Activity.backward();
                    }
                });
                Lampa.Controller.enable('fx_browser');
            };

            this.pause = function () {};
            this.stop = function () {};
            this.render = function () { return html; };
            this.destroy = function () { 
                network.clear();
                html.remove(); 
            };
        }

        // Регистрируем компонент в Лампе
        Lampa.Component.add('filmix_browser', FilmixComponent);

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.activity.render();
                if (!render) return;

                var inject = function() {
                    if (render.find('.fx-nexus-v4').length) return;

                    var btn = $('<div class="full-start__button selector view--online fx-nexus-v4"><span>Смотреть Filmix</span></div>');
                    btn.on('hover:enter', function () {
                        var id = e.data.movie.kinopoisk_id || e.data.movie.kp_id || e.data.movie.id;
                        var startUrl = BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + id;
                        if (!e.data.movie.kinopoisk_id && !e.data.movie.kp_id) startUrl = BASE_DOMAIN + '/lite/fxapi?postid=' + id;

                        Lampa.Activity.push({
                            component: 'filmix_browser',
                            title: 'Filmix',
                            movie: e.data.movie,
                            page: 1
                        });

                        // Находим активную активность и загружаем данные
                        setTimeout(function() {
                            var active = Lampa.Activity.active();
                            if (active && active.component.load) {
                                active.component.load(startUrl);
                            }
                        }, 50);
                    });

                    var container = render.find('.full-start__buttons, .full-start__actions').first();
                    if (container.length) container.prepend(btn);

                    if (Lampa.Controller.toggle) Lampa.Controller.toggle('full_start');
                };

                inject();
                setTimeout(inject, 500);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
