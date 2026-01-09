
(function () {
    'use strict';

    /**
     * SWO.JS - Resilient Edition for Lampack
     * Фиксы: CORS, TypeError, No-Button, Empty Screen.
     */
    function startPlugin() {
        console.log('[SWO] Starting initialization...');

        // Слой защиты от падений UI
        var SafeUI = {
            loading: function(status) {
                try {
                    var L = window.Lampa || {};
                    var Loading = L.Loading || window.Loading;
                    if (Loading && typeof Loading.show === 'function' && status) Loading.show();
                    if (Loading && typeof Loading.hide === 'function' && !status) Loading.hide();
                } catch (e) {}
            },
            error: function(msg) {
                try {
                    if (window.Lampa && Lampa.Noty) Lampa.Noty.show(msg);
                    else alert(msg);
                } catch(e) { console.error(msg); }
            }
        };

        /**
         * Компонент выбора источников
         */
        function SWOComponent(object) {
            var _this = this;
            var network = new Lampa.Reguest();
            var scroll = new Lampa.Scroll({mask: true, over: true});
            var items = [];
            var html = $('<div class="swo-component overflow-hidden"></div>');
            var body = $('<div class="category-full"></div>');
            var active = 0;

            this.create = function() {
                this.load();
                return this.render();
            };

            this.load = function() {
                SafeUI.loading(true);
                
                // ВНИМАНИЕ: Если вы делаете запрос к GitHub, используйте raw.githubusercontent.com
                // Или прокси, иначе будет ошибка CORS.
                setTimeout(function() {
                    try {
                        // ТЕСТОВЫЕ ДАННЫЕ (Замените на реальный API)
                        items = [
                            {title: 'Filmix Online', quality: '1080p', url: 'https://vjs.zencdn.net/v/oceans.mp4'},
                            {title: 'Rezka Mirror', quality: '720p', url: 'https://vjs.zencdn.net/v/oceans.mp4'}
                        ];

                        if (items.length) _this.draw();
                        else _this.empty('Источники не найдены');
                    } catch (e) {
                        _this.empty('Ошибка: ' + e.message);
                    } finally {
                        SafeUI.loading(false);
                    }
                }, 400);
            };

            this.draw = function() {
                html.append(scroll.render());
                scroll.append(body);

                items.forEach(function(item, index) {
                    var element = $('<div class="selector-item focusable">\\
                        <div class="selector-item__title">' + item.title + '</div>\\
                        <div class="selector-item__label">' + item.quality + '</div>\\
                    </div>');
                    
                    element.on('hover:focus', function() { active = index; })
                           .on('hover:enter', function() {
                               Lampa.Player.play({ url: item.url, title: item.title });
                           });
                    
                    body.append(element);
                });
                
                _this.enable();
            };

            this.empty = function(msg) {
                html.append('<div class="empty" style="text-align:center;padding:40px;opacity:0.5">' + msg + '</div>');
                _this.enable();
            };

            this.enable = function() {
                Lampa.Controller.add('content', {
                    toggle: function() {
                        Lampa.Controller.collectionSet(html);
                        Lampa.Controller.collectionFocus(active >= 0 ? body.children().eq(active) : false, html);
                    },
                    left: function() { Lampa.Controller.toggle('head'); },
                    up: function() { Lampa.Controller.toggle('head'); },
                    back: function() { Lampa.Activity.backward(); }
                });
                Lampa.Controller.toggle('content');
            };

            this.render = function() { return html; };
            this.terminate = function() {
                network.clear();
                scroll.destroy();
                html.remove();
            };
        }

        /**
         * Внедрение кнопки (Исправлено для Lampack)
         */
        function injectButton(e) {
            var render = e.render;
            
            // Если кнопка уже есть — выходим
            if (render.find('.button--swo-act').length > 0) return;

            var button = $('<div class="full-start__button button--swo-act focusable">\\
                <svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg" style="margin-right:10px"><path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="white"/></svg>\\
                <span>Смотреть (SWO)</span>\\
            </div>');

            button.on('hover:enter', function () {
                Lampa.Activity.push({
                    title: 'Выбор источника',
                    component: 'swo_component',
                    object: e.data
                });
            });

            // Пытаемся найти контейнер кнопок (разные варианты для разных сборок)
            var container = render.find('.full-start__buttons');
            if (container.length) {
                container.append(button);
                console.log('[SWO] Button injected into .full-start__buttons');
            } else {
                // Если стандартный контейнер не найден, пробуем в любое место в карточке
                render.append(button); 
                console.log('[SWO] Button injected as fallback');
            }
        }

        // Слушаем события открытия карточки
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite' || e.type == 'ready') {
                // Небольшая задержка, чтобы DOM успел отрисоваться в Lampack
                setTimeout(function() { injectButton(e); }, 100);
            }
        });

        // Регистрация
        Lampa.Component.add('swo_component', SWOComponent);
        console.log('[SWO] Plugin Ready');
    }

    // Безопасный запуск
    try {
        if (window.appready) startPlugin();
        else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type == 'ready') startPlugin();
            });
        }
    } catch(e) {
        console.error('[SWO] Critical Init Error:', e);
    }
})();
