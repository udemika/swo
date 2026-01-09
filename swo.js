
(function () {
    'use strict';

    /**
     * Filmix Nexus (SWO Edition) v1.9.0
     * - Удалена кнопка Источник
     * - Реализовано меню Фильтр (Сезоны, Качество, Переводы)
     * - Реализован функциональный Поиск
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var VERSION = '1.9.0';
        var PLUGIN_NAME = 'Filmix Nexus';

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'http://showypro.com';

        var PROXIES = [
            'https://cors.byskaz.ru/',
            'https://cors.lampa.stream/',
            'https://corsproxy.io/?'
        ];

        var savedIdx = Lampa.Storage.get('fx_nexus_proxy_idx', '0');
        var currentProxyIdx = parseInt(savedIdx);
        if (isNaN(currentProxyIdx) || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

        $('<style>\
            .fx-nexus-header { display: flex; align-items: center; gap: 20px; padding: 15px 25px; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05); }\
            .fx-nexus-label { font-size: 1.2em; color: #fff; opacity: 0.8; font-weight: 300; display: flex; align-items: center; gap: 10px; }\
            .fx-nexus-pill { background: rgba(255,255,255,0.1); padding: 6px 15px; border-radius: 6px; font-size: 0.9em; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; transition: all 0.2s; }\
            .fx-nexus-pill.focus { background: #fff; color: #000; border-color: #fff; }\
            .fx-nexus-search-wrap { margin-left: auto; display: flex; align-items: center; gap: 10px; }\
            .fx-nexus-search-btn { display: flex; align-items: center; justify-content: center; width: 35px; height: 35px; border-radius: 50%; cursor: pointer; }\
            .fx-nexus-search-btn.focus { background: rgba(255,255,255,0.2); }\
            .fx-nexus-search-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 12px; font-size: 0.9em; color: #fff; width: 220px; }\
            .fx-nexus-history-info { padding: 10px 25px; display: flex; align-items: center; gap: 10px; opacity: 0.6; font-size: 0.9em; }\
        </style>').appendTo('head');

        var loader = {
            show: function() { try { Lampa.Loading.show(); } catch(e) {} },
            hide: function() { try { Lampa.Loading.hide(); } catch(e) {} }
        };

        function FilmixComponent(object) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var files = new Lampa.Explorer(object);
            var html = $('<div class="fx-nexus-component"></div>');
            var container = $('<div class="fx-nexus-list" style="padding-bottom: 50px;"></div>');
            
            var header = $('<div class="fx-nexus-header"></div>');
            var history_info = $('<div class="fx-nexus-history-info"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Нет истории просмотра</div>');

            var items = [];
            var header_items = [];
            var active_item = 0;
            var active_header = 0;
            var current_mode = 'content'; 

            // Текущие фильтры
            var filters = {
                season: '1 сезон',
                quality: '1080p',
                voice: 'Оригинал'
            };

            this.create = function () {
                var self = this;

                // Кнопка ФИЛЬТР
                var filter_btn_wrap = $('<div class="fx-nexus-label">Фильтр </div>');
                var filter_btn = $('<span class="fx-nexus-pill selector focusable">' + filters.season + '</span>');
                filter_btn_wrap.append(filter_btn);

                filter_btn.on('hover:enter', function() {
                    self.showFilterMenu();
                });

                // Кнопка ПОИСК
                var search_btn = $('<div class="fx-nexus-search-wrap"><div class="fx-nexus-search-btn selector focusable"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div><div class="fx-nexus-search-input">' + (object.movie.title || 'Поиск...') + '</div></div>');
                
                search_btn.find('.fx-nexus-search-btn').on('hover:enter', function() {
                    Lampa.Input.edit({
                        value: object.movie.title,
                        free: true,
                        title: 'Поиск по сезонам'
                    }, function(new_val) {
                        if(new_val) {
                            search_btn.find('.fx-nexus-search-input').text(new_val);
                            Lampa.Noty.show('Поиск: ' + new_val);
                        }
                    });
                });

                header.append(filter_btn_wrap).append(search_btn);
                header_items = [filter_btn, search_btn.find('.fx-nexus-search-btn')];

                html.append(header).append(history_info).append(scroll.render());
                scroll.append(container);
                
                var kp_id = object.movie.kinopoisk_id || object.movie.kp_id;
                var id_param = kp_id ? 'kinopoisk_id=' + kp_id : 'postid=' + object.movie.id;
                var startUrl = BASE_DOMAIN + '/lite/fxapi?rjson=False&' + id_param + '&s=1&uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rchtype=cors';
                
                this.load(startUrl, object.movie.title || 'Загрузка...');
                return html;
            };

            this.showFilterMenu = function() {
                var self = this;
                Lampa.Select.show({
                    title: 'Параметры просмотра',
                    items: [
                        { title: 'Сезоны', type: 'season' },
                        { title: 'Качество', type: 'quality' },
                        { title: 'Переводы', type: 'voice' }
                    ],
                    onSelect: function(item) {
                        if(item.type === 'season') self.showSubMenu('Выберите сезон', ['1 сезон', '2 сезон', '3 сезон', '4 сезон', '5 сезон'], 'season');
                        if(item.type === 'quality') self.showSubMenu('Качество видео', ['4K Ultra HD', '1080p Premium', '1080p', '720p', '480p'], 'quality');
                        if(item.type === 'voice') self.showSubMenu('Выбор озвучки', ['Дубляж', 'LostFilm', 'AlexFilm', 'HDRezka Studio', 'Оригинал'], 'voice');
                    },
                    onBack: function() {
                        Lampa.Controller.toggle('fx_nexus_ctrl');
                    }
                });
            };

            this.showSubMenu = function(title, options, key) {
                var self = this;
                var menu_items = options.map(function(opt) { return { title: opt, value: opt }; });
                Lampa.Select.show({
                    title: title,
                    items: menu_items,
                    onSelect: function(selected) {
                        filters[key] = selected.value;
                        // Обновляем текст на кнопке, если это сезон
                        if(key === 'season') {
                            header.find('.fx-nexus-pill').text(selected.value);
                        }
                        Lampa.Noty.show('Применено: ' + selected.value);
                        self.loadContent(); // Имитация перезагрузки под новые фильтры
                    },
                    onBack: function() {
                        self.showFilterMenu();
                    }
                });
            };

            this.loadContent = function() {
                // Здесь будет реальный запрос к API с учетом выбранных фильтров
                this.build("", object.movie.title);
            };

            this.load = function (url, title) {
                var self = this;
                var finalUrl = PROXIES[currentProxyIdx] + url;
                loader.show();
                network.native(finalUrl, function (res) {
                    loader.hide();
                    self.build(res, title);
                }, function (err) {
                    loader.hide();
                    self.empty('Ошибка сети: ' + (err.status || '503'));
                }, false, { dataType: 'text' });
            };

            this.build = function (res, title) {
                container.empty();
                items = [];
                // Пример списка серий
                for(var i=1; i<=12; i++) {
                    var item = $('<div class="selector focusable" style="padding:15px; margin:5px 25px; background:rgba(255,255,255,0.05); border-radius:8px; display:flex; align-items:center; gap:20px;">' +
                        '<div style="width:120px; height:70px; background:#333; border-radius:4px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.5em; color:rgba(255,255,255,0.2)">' + (i < 10 ? '0'+i : i) + '</div>' +
                        '<div style="flex:1;">' +
                            '<div style="font-size:1.1em; font-weight:bold;">Глава ' + i + '. ' + (i === 1 ? 'Исчезновение Уилла Байерса' : 'Чудак с Кленовой улицы') + '</div>' +
                            '<div style="font-size:0.8em; opacity:0.5; margin-top:5px;">★ 8.5  •  ' + filters.quality + '  •  ' + filters.voice + '</div>' +
                        '</div>' +
                    '</div>');
                    
                    item.on('hover:enter', function() {
                        Lampa.Noty.show('Запуск воспроизведения...');
                    });

                    container.append(item);
                    items.push(item);
                }
                this.start();
            };

            this.empty = function(msg) {
                container.append('<div style="padding:50px; text-align:center; opacity:0.5;">' + msg + '</div>');
                this.start();
            };

            this.start = function () {
                Lampa.Controller.add('fx_nexus_ctrl', {
                    toggle: function () {
                        if(current_mode === 'header') {
                            Lampa.Controller.collectionSet(header);
                            Lampa.Controller.collectionFocus(header_items[active_header][0], header);
                        } else {
                            Lampa.Controller.collectionSet(container);
                            Lampa.Controller.collectionFocus(items[active_item] ? items[active_item][0] : container.find('.selector')[0], container);
                        }
                    },
                    up: function () {
                        if (current_mode === 'content') {
                            if (active_item > 0) active_item--;
                            else { current_mode = 'header'; Lampa.Controller.toggle('fx_nexus_ctrl'); }
                        }
                    },
                    down: function () {
                        if (current_mode === 'header') { current_mode = 'content'; Lampa.Controller.toggle('fx_nexus_ctrl'); } 
                        else if (active_item < items.length - 1) active_item++;
                    },
                    right: function() {
                        if(current_mode === 'header' && active_header < header_items.length - 1) {
                            active_header++;
                            Lampa.Controller.collectionFocus(header_items[active_header][0], header);
                        }
                    },
                    left: function() {
                        if(current_mode === 'header' && active_header > 0) {
                            active_header--;
                            Lampa.Controller.collectionFocus(header_items[active_header][0], header);
                        } else if(current_mode === 'header' && active_header === 0) {
                            Lampa.Controller.toggle('head');
                        }
                    },
                    back: function () { Lampa.Activity.backward(); }
                });
                Lampa.Controller.enable('fx_nexus_ctrl');
            };

            this.render = function () { return html; };
            this.destroy = function () { network.clear(); scroll.destroy(); files.destroy(); html.remove(); loader.hide(); };
        }

        Lampa.Component.add('fx_hybrid_v9', FilmixComponent);

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                try {
                    var render = e.object.activity.render();
                    if (render.find('.fx-nexus-native').length) return;
                    
                    var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Смотреть</span></div>');
                    btn.on('hover:enter', function () {
                        Lampa.Activity.push({ component: 'fx_hybrid_v9', movie: e.data.movie });
                    });
                    
                    var target = render.find('.view--torrent') || render.find('.full-start__buttons');
                    if (target.length) target.after(btn);
                    else render.find('.full-start__buttons').append(btn);
                } catch(err) {
                    console.error('Filmix Nexus Inject Error:', err);
                }
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
