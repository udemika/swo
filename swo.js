
(function () {
    'use strict';

    /**
     * Исправленный плагин swo.js для Lampa
     * Устраняет: TypeError (Loading), дубликаты кнопок, пустые экраны.
     */
    function startPlugin() {
        // Слой безопасности для работы с API Lampa
        var UI = {
            loading: function(status) {
                try {
                    if (window.Lampa && Lampa.Loading) {
                        if (status && typeof Lampa.Loading.show === 'function') Lampa.Loading.show();
                        else if (!status && typeof Lampa.Loading.hide === 'function') Lampa.Loading.hide();
                    } else if (window.Loading) {
                        if (status && typeof Loading.show === 'function') Loading.show();
                        else if (!status && typeof Loading.hide === 'function') Loading.hide();
                    }
                } catch (e) {
                    console.error('[SWO] UI Error:', e);
                }
            }
        };

        /**
         * Основной компонент FilmixComponent
         */
        function FilmixComponent(object) {
            var _this = this;
            var network = new Lampa.Reguest();
            var scroll = new Lampa.Scroll({mask: true, over: true});
            var items = [];
            var html = $('<div class="swo-component"></div>');
            var body = $('<div class="category-full"></div>');
            var active = 0;

            this.create = function() {
                try {
                    this.load();
                    return this.render();
                } catch (e) {
                    console.error('[SWO] Create error:', e);
                    return $('<div class="empty">Ошибка инициализации компонента</div>');
                }
            };

            this.load = function() {
                UI.loading(true);
                
                // Эмуляция загрузки. Здесь должен быть ваш сетевой запрос.
                setTimeout(function() {
                    try {
                        items = [
                            {title: 'Источник 1: Filmix UHD', quality: '2160p', url: 'https://vjs.zencdn.net/v/oceans.mp4'},
                            {title: 'Источник 2: Filmix HD', quality: '1080p', url: 'https://vjs.zencdn.net/v/oceans.mp4'}
                        ];

                        if (items.length) _this.draw();
                        else _this.empty();
                    } catch (e) {
                        _this.empty('Ошибка обработки данных');
                    } finally {
                        UI.loading(false);
                    }
                }, 500);
            };

            this.draw = function() {
                html.append(scroll.render());
                scroll.append(body);

                items.forEach(function(item, index) {
                    var element = $('<div class="selector-item focusable">\\
                        <div class="selector-item__title">' + item.title + '</div>\\
                        <div class="selector-item__label">' + item.quality + '</div>\\
                    </div>');
                    
                    element.on('hover:focus', function() {
                        active = index;
                    }).on('hover:enter', function() {
                        Lampa.Player.play({
                            url: item.url,
                            title: item.title
                        });
                    });
                    
                    body.append(element);
                });
                
                _this.enable();
            };

            this.empty = function(msg) {
                html.append('<div class="empty">' + (msg || 'Контент не найден') + '</div>');
                _this.enable();
            };

            this.enable = function() {
                Lampa.Controller.add('content', {
                    toggle: function() {
                        Lampa.Controller.collectionSet(html);
                        Lampa.Controller.collectionFocus(active === -1 ? false : body.children().eq(active), html);
                    },
                    left: function() { Lampa.Controller.toggle('head'); },
                    up: function() { Lampa.Controller.toggle('head'); },
                    back: function() { Lampa.Activity.backward(); }
                });
                Lampa.Controller.toggle('content');
            };

            this.render = function() {
                return html;
            };

            this.terminate = function() {
                network.clear();
                scroll.destroy();
                html.remove();
            };
        }

        // Слушатель для карточки фильма
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite' || e.type == 'ready') {
                var render = e.render;
                
                // ЗАЩИТА ОТ ДУБЛИКАТОВ
                if ($('.button--swo-watch', render).length > 0) return;

                var button = $('<div class="full-start__button button--swo-watch focusable">\\
                    <svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z" fill="white"/></svg>\\
                    <span>Смотреть Online</span>\\
                </div>');

                button.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url: '',
                        title: 'Выбор источника (SWO)',
                        component: 'swo_component',
                        object: e.data
                    });
                });

                render.find('.full-start__buttons').append(button);
            }
        });

        // Регистрация компонента
        Lampa.Component.add('swo_component', FilmixComponent);
        console.log('[SWO] Plugin swo.js version 1.1.0 loaded');
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') startPlugin();
    });
})();
