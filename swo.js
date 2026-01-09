
(function () {
    'use strict';

    /**
     * Filmix Nexus (SWO Edition) v1.9.4
     * - Полная поддержка HTML/JSON парсинга (data-json)
     * - Динамические фильтры: скрываются если данных нет в ответе
     * - Авто-выбор качества из JSON объекта
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

        var safeLoading = {
            show: function() { try { if(window.Lampa && Lampa.Loading && Lampa.Loading.show) Lampa.Loading.show(); } catch(e){} },
            hide: function() { try { if(window.Lampa && Lampa.Loading && Lampa.Loading.hide) Lampa.Loading.hide(); } catch(e){} }
        };

        $('<style>\
            .fx-nexus-header { display: flex; align-items: center; gap: 20px; padding: 15px 25px; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05); }\
            .fx-nexus-pill { background: rgba(255,255,255,0.1); padding: 6px 15px; border-radius: 6px; font-size: 0.9em; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; }\
            .fx-nexus-pill.focus { background: #fff; color: #000; border-color: #fff; }\
            .fx-nexus-search-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 12px; font-size: 0.9em; color: #fff; width: 220px; margin-left: auto; }\
        </style>').appendTo('head');

        function FilmixComponent(object) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var html = $('<div class="fx-nexus-component"></div>');
            var container = $('<div class="fx-nexus-list" style="padding-bottom: 50px;"></div>');
            var header = $('<div class="fx-nexus-header"></div>');
            
            var items = [];
            var header_items = [];
            var active_item = 0;
            var active_header = 0;
            var current_mode = 'content'; 

            var filters = {
                season: '1 сезон',
                quality: '1080p',
                voice: 'Любой'
            };

            var available_filter_types = { seasons: false, qualities: false, voices: false };
            var raw_data = []; // Храним распарсенные объекты JSON

            this.create = function () {
                var self = this;
                var filter_btn = $('<span class="fx-nexus-pill selector focusable">Параметры</span>');
                var search_label = $('<div class="fx-nexus-search-input">' + (object.movie.title || 'Поиск...') + '</div>');

                filter_btn.on('hover:enter', function() { self.showFilterMenu(); });

                header.append(filter_btn).append(search_label);
                header_items = [filter_btn];

                html.append(header).append(scroll.render());
                scroll.append(container);
                
                this.loadContent();
                return html;
            };

            this.showFilterMenu = function() {
                var self = this;
                var menu = [];
                if (available_filter_types.seasons) menu.push({ title: 'Сезоны', type: 'season' });
                if (available_filter_types.qualities) menu.push({ title: 'Качество', type: 'quality' });
                if (available_filter_types.voices) menu.push({ title: 'Переводы', type: 'voice' });

                if (menu.length === 0) return Lampa.Noty.show('Настройки недоступны');

                Lampa.Select.show({
                    title: 'Параметры',
                    items: menu,
                    onSelect: function(item) {
                        if(item.type === 'season') self.showSubMenu('Сезоны', ['1 сезон', '2 сезон', '3 сезон', '4 сезон'], 'season');
                        if(item.type === 'quality') self.showSubMenu('Качество', ['2160p', '1440p', '1080p', '720p', '480p'], 'quality');
                        if(item.type === 'voice') self.showSubMenu('Перевод', ['Дубляж', 'Оригинал', 'MVO', 'DVO', 'Любой'], 'voice');
                    },
                    onBack: function() { Lampa.Controller.toggle('fx_nexus_ctrl'); }
                });
            };

            this.showSubMenu = function(title, options, key) {
                var self = this;
                Lampa.Select.show({
                    title: title,
                    items: options.map(function(o){ return {title:o, value:o}; }),
                    onSelect: function(selected) {
                        filters[key] = selected.value;
                        self.loadContent(); // Перезагружаем или фильтруем на лету
                    },
                    onBack: function() { self.showFilterMenu(); }
                });
            };

            this.loadContent = function() {
                var s_num = (filters.season.match(/\d+/) || [1])[0];
                var kp_id = object.movie.kinopoisk_id || object.movie.kp_id;
                var id_param = kp_id ? 'kinopoisk_id=' + kp_id : 'postid=' + object.movie.id;
                var url = BASE_DOMAIN + '/lite/fxapi?rjson=False&' + id_param + '&s=' + s_num + '&uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rchtype=cors';
                this.load(url);
            };

            this.load = function (url) {
                var self = this;
                safeLoading.show();
                network.native(PROXIES[currentProxyIdx] + url, function (res) {
                    safeLoading.hide();
                    self.build(res);
                }, function () {
                    safeLoading.hide();
                    self.empty('Ошибка загрузки');
                }, false, { dataType: 'text' });
            };

            this.build = function (res) {
                var self = this;
                container.empty();
                items = [];
                raw_data = [];
                
                // Сброс фильтров
                available_filter_types = { seasons: false, qualities: false, voices: false };

                // Парсим HTML
                var $dom = $('<div>' + res + '</div>');
                var $items = $dom.find('.videos__item');

                if ($items.length === 0) return this.empty('Сервер не вернул ссылки');

                $items.each(function() {
                    var $el = $(this);
                    var jsonStr = $el.attr('data-json');
                    if (!jsonStr) return;

                    try {
                        var data = JSON.parse(jsonStr);
                        raw_data.push(data);

                        // Проверка доступности типов фильтров
                        if (data.quality) available_filter_types.qualities = true;
                        if (data.translate || $items.length > 1) available_filter_types.voices = true;
                        
                        var title = data.translate || data.title || 'Видео файл';
                        if (title.toLowerCase().indexOf('сезон') > -1) available_filter_types.seasons = true;

                        // Создаем карточку
                        var card = $('<div class="selector focusable" style="padding:15px; margin:5px 25px; background:rgba(255,255,255,0.05); border-radius:8px; display:flex; align-items:center; gap:20px;">' +
                            '<div style="width:80px; height:50px; background:#e50914; border-radius:4px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:10px;">PLAY</div>' +
                            '<div style="flex:1;">' +
                                '<div style="font-size:1.1em; font-weight:bold;">' + title + '</div>' +
                                '<div style="font-size:0.8em; opacity:0.5; margin-top:5px;">' + (data.maxquality || '') + '</div>' +
                            '</div>' +
                        '</div>');

                        card.on('hover:enter', function() {
                            // Выбираем лучшее качество или то, что в фильтре
                            var play_url = data.url;
                            if (data.quality && data.quality[filters.quality]) {
                                play_url = data.quality[filters.quality];
                            } else if (data.quality) {
                                // Если выбранного качества нет, берем первое доступное
                                var keys = Object.keys(data.quality);
                                play_url = data.quality[keys[0]];
                            }
                            Lampa.Player.play({ url: play_url, title: title });
                        });

                        container.append(card);
                        items.push(card);
                    } catch(e) { console.error('JSON Parse Error', e); }
                });

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
                            var f = items[active_item] ? items[active_item][0] : container.find('.selector')[0];
                            if(f) Lampa.Controller.collectionFocus(f, container);
                        }
                    },
                    up: function () {
                        if (current_mode === 'content') {
                            if (active_item > 0) active_item--;
                            else { current_mode = 'header'; Lampa.Controller.toggle('fx_nexus_ctrl'); }
                        }
                    },
                    down: function () {
                        if (current_mode === 'header' && items.length) { current_mode = 'content'; Lampa.Controller.toggle('fx_nexus_ctrl'); } 
                        else if (active_item < items.length - 1) active_item++;
                    },
                    back: function () { Lampa.Activity.backward(); }
                });
                Lampa.Controller.enable('fx_nexus_ctrl');
            };

            this.render = function () { return html; };
            this.destroy = function () { network.clear(); scroll.destroy(); html.remove(); safeLoading.hide(); };
        }

        Lampa.Component.add('fx_hybrid_v9', FilmixComponent);

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.activity.render();
                if (render.find('.fx-nexus-native').length) return;
                var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Смотреть</span></div>');
                btn.on('hover:enter', function () {
                    Lampa.Activity.push({ component: 'fx_hybrid_v9', movie: e.data.movie });
                });
                render.find('.full-start__buttons').append(btn);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
