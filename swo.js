
(function () {
    'use strict';

    /**
     * Filmix Nexus (Classic Inject) v1.9.6
     * - Возвращен метод инъекции кнопки из v1.7.0
     * - Сохранен парсинг data-json (Пчеловод и др.)
     * - Исправлено отображение на zrovid.com
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
            show: function() { try { if(window.Lampa && Lampa.Loading && typeof Lampa.Loading.show === 'function') Lampa.Loading.show(); } catch(e){} },
            hide: function() { try { if(window.Lampa && Lampa.Loading && typeof Lampa.Loading.hide === 'function') Lampa.Loading.hide(); } catch(e){} }
        };

        $('<style>\
            .fx-nexus-header { display: flex; align-items: center; gap: 20px; padding: 15px 25px; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05); }\
            .fx-nexus-pill { background: rgba(255,255,255,0.1); padding: 8px 18px; border-radius: 8px; font-size: 14px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; color: #fff; }\
            .fx-nexus-pill.focus { background: #fff; color: #000; border-color: #fff; transform: scale(1.05); }\
            .fx-nexus-search-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 12px; font-size: 0.9em; color: #fff; width: 220px; margin-left: auto; opacity: 0.6; }\
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
            var list_data = [];

            this.create = function () {
                var self = this;
                var is_tv = (object.movie.number_of_seasons || object.movie.first_air_date || object.movie.name);
                var filter_label = is_tv ? filters.season : 'Параметры';
                
                var filter_btn = $('<span class="fx-nexus-pill selector focusable">' + filter_label + '</span>');
                var search_label = $('<div class="fx-nexus-search-input">' + (object.movie.title || object.movie.name || 'Поиск...') + '</div>');

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
                    title: 'Выбор параметров',
                    items: menu,
                    onSelect: function(item) {
                        if(item.type === 'season') self.showSubMenu('Сезоны', ['1 сезон', '2 сезон', '3 сезон', '4 сезон', '5 сезон', '6 сезон', '7 сезон'], 'season');
                        if(item.type === 'quality') self.showSubMenu('Качество', ['2160p', '1440p', '1080p', '720p', '480p'], 'quality');
                        if(item.type === 'voice') self.showSubMenu('Перевод', self.extractUniqueVoices(), 'voice');
                    },
                    onBack: function() { Lampa.Controller.toggle('fx_nexus_ctrl'); }
                });
            };

            this.extractUniqueVoices = function() {
                var v = ['Любой'];
                list_data.forEach(function(d) {
                    var name = d.translate || 'Стандарт';
                    if (v.indexOf(name) === -1) v.push(name);
                });
                return v;
            };

            this.showSubMenu = function(title, options, key) {
                var self = this;
                Lampa.Select.show({
                    title: title,
                    items: options.map(function(o){ return {title:o, value: (typeof o === 'string' && o.indexOf(' ') > -1) ? o.split(' ')[0] : o}; }),
                    onSelect: function(selected) {
                        filters[key] = selected.value;
                        if(key === 'season') header.find('.fx-nexus-pill').text(selected.value);
                        self.loadContent();
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
                list_data = [];
                
                available_filter_types = { 
                    seasons: (object.movie.number_of_seasons || object.movie.first_air_date) ? true : false, 
                    qualities: false, 
                    voices: false 
                };

                var $dom = $('<div>' + res + '</div>');
                var $items = $dom.find('.videos__item');

                if ($items.length === 0) return this.empty('Видео не найдено');

                $items.each(function() {
                    var $el = $(this);
                    var jsonStr = $el.attr('data-json');
                    if (!jsonStr) return;

                    try {
                        var data = JSON.parse(jsonStr);
                        list_data.push(data);

                        if (data.quality) available_filter_types.qualities = true;
                        if ($items.length > 1) available_filter_types.voices = true;

                        var display_title = data.translate || $el.find('.videos__item-title').text() || 'Видео файл';
                        
                        var card = $('<div class="selector focusable" style="padding:15px; margin:8px 25px; background:rgba(255,255,255,0.05); border-radius:10px; display:flex; align-items:center; gap:20px;">\
                            <div style="width:50px; height:50px; background:#e50914; border-radius:50%; display:flex; align-items:center; justify-content:center;">\
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>\
                            </div>\
                            <div style="flex:1;">\
                                <div style="font-size:16px; font-weight:700;">' + display_title + '</div>\
                                <div style="font-size:12px; opacity:0.5;">' + (data.maxquality || '') + '</div>\
                            </div>\
                        </div>');

                        card.on('hover:enter', function() {
                            var play_url = data.url;
                            if (data.quality && data.quality[filters.quality]) play_url = data.quality[filters.quality];
                            else if (data.quality) play_url = data.quality[Object.keys(data.quality)[0]];
                            Lampa.Player.play({ url: play_url, title: display_title });
                        });

                        container.append(card);
                        items.push(card);
                    } catch(e) {}
                });
                this.start();
            };

            this.empty = function(msg) {
                container.append('<div style="padding:50px; text-align:center; opacity:0.4;">' + msg + '</div>');
                this.start();
            };

            this.start = function () {
                Lampa.Controller.add('fx_nexus_ctrl', {
                    toggle: function () {
                        if(current_mode === 'header') {
                            Lampa.Controller.collectionSet(header);
                            Lampa.Controller.collectionFocus(header_items[0][0], header);
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

        // Инжекция кнопки как в версии 1.7.0 (Классический метод)
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.activity.render();
                if (render.find('.fx-nexus-native').length) return;

                var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Смотреть</span></div>');
                btn.on('hover:enter', function () {
                    Lampa.Activity.push({ component: 'fx_hybrid_v9', movie: e.data.movie });
                });

                // Поиск контейнера (Сначала пробуем встать после торрентов, потом в общую кучу)
                var target = render.find('.view--torrent');
                if (target.length) {
                    target.after(btn);
                } else {
                    render.find('.full-start__buttons').append(btn);
                }
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
