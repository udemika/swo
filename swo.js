
(function () {
    'use strict';

    /**
     * Filmix Nexus (Stable Edition) v1.9.7
     * - Исправлена ошибка component.pause
     * - Сезоны скрываются для фильмов автоматически
     * - Удален выбор качества (играет по умолчанию)
     * - Исправлено обновление ссылок при смене сезона
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
            .fx-nexus-header { display: flex; align-items: center; gap: 20px; padding: 15px 25px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.05); }\
            .fx-nexus-pill { background: rgba(255,255,255,0.1); padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; color: #fff; }\
            .fx-nexus-pill.focus { background: #fff; color: #000; border-color: #fff; transform: scale(1.02); }\
            .fx-nexus-search-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 12px; font-size: 0.9em; color: #fff; width: 220px; margin-left: auto; opacity: 0.6; }\
            .fx-card-play { width: 45px; height: 45px; background: #e50914; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(229,9,20,0.4); }\
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
            var current_mode = 'content'; 

            var filters = {
                season: '1 сезон',
                voice: 'Любой'
            };

            var list_data = [];
            var total_seasons = object.movie.number_of_seasons || 0;

            this.create = function () {
                var self = this;
                header.empty();
                header_items = [];

                // Фильтр сезонов только если это сериал
                if (total_seasons > 0) {
                    var filter_btn = $('<span class="fx-nexus-pill selector focusable">' + filters.season + '</span>');
                    filter_btn.on('hover:enter', function() { self.showSeasonMenu(); });
                    header.append(filter_btn);
                    header_items.push(filter_btn);
                }

                var search_label = $('<div class="fx-nexus-search-input">' + (object.movie.title || object.movie.name || 'Поиск...') + '</div>');
                header.append(search_label);

                html.append(header).append(scroll.render());
                scroll.append(container);
                
                this.loadContent();
                return html;
            };

            this.showSeasonMenu = function() {
                var self = this;
                var menu = [];
                for (var i = 1; i <= total_seasons; i++) {
                    menu.push({ title: i + ' сезон', value: i });
                }

                Lampa.Select.show({
                    title: 'Выбор сезона',
                    items: menu,
                    onSelect: function(item) {
                        filters.season = item.title;
                        header.find('.fx-nexus-pill').text(item.title);
                        self.loadContent();
                    },
                    onBack: function() { Lampa.Controller.toggle('fx_nexus_ctrl'); }
                });
            };

            this.loadContent = function() {
                var self = this;
                var s_num = (filters.season.match(/\d+/) || [1])[0];
                var kp_id = object.movie.kinopoisk_id || object.movie.kp_id;
                var id_param = kp_id ? 'kinopoisk_id=' + kp_id : 'postid=' + object.movie.id;
                var url = BASE_DOMAIN + '/lite/fxapi?rjson=False&' + id_param + '&s=' + s_num + '&uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rchtype=cors';
                
                safeLoading.show();
                network.native(PROXIES[currentProxyIdx] + url, function (res) {
                    safeLoading.hide();
                    self.build(res);
                }, function () {
                    safeLoading.hide();
                    self.empty('Ошибка загрузки данных');
                }, false, { dataType: 'text' });
            };

            this.build = function (res) {
                var self = this;
                container.empty();
                items = [];
                list_data = [];

                var $dom = $('<div>' + res + '</div>');
                var $items = $dom.find('.videos__item');

                if ($items.length === 0) return this.empty('Список ссылок пуст');

                $items.each(function() {
                    var $el = $(this);
                    var jsonStr = $el.attr('data-json');
                    if (!jsonStr) return;

                    try {
                        var data = JSON.parse(jsonStr);
                        list_data.push(data);

                        var display_title = data.translate || $el.find('.videos__item-title').text() || 'Видео файл';
                        
                        var card = $('<div class="selector focusable" style="padding:15px; margin:8px 25px; background:rgba(255,255,255,0.05); border-radius:10px; display:flex; align-items:center; gap:20px;">\
                            <div class="fx-card-play">\
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>\
                            </div>\
                            <div style="flex:1;">\
                                <div style="font-size:16px; font-weight:700; color:#fff;">' + display_title + '</div>\
                                <div style="font-size:12px; opacity:0.5; margin-top:3px;">' + (data.maxquality || 'Full HD') + '</div>\
                            </div>\
                        </div>');

                        card.on('hover:enter', function() {
                            Lampa.Player.play({ 
                                url: data.url, 
                                title: display_title,
                                movie: object.movie
                            });
                        });

                        container.append(card);
                        items.push(card);
                    } catch(e) {}
                });
                this.start();
            };

            this.empty = function(msg) {
                container.append('<div style="padding:80px 20px; text-align:center; opacity:0.4; font-size:16px;">' + msg + '</div>');
                this.start();
            };

            this.start = function () {
                Lampa.Controller.add('fx_nexus_ctrl', {
                    toggle: function () {
                        if(current_mode === 'header' && header_items.length) {
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
                            else if(header_items.length) { current_mode = 'header'; Lampa.Controller.toggle('fx_nexus_ctrl'); }
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

            this.pause = function () {}; // Обязательный метод для Lampa
            this.stop = function () {};
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

                var target = render.find('.view--torrent');
                if (target.length) target.after(btn);
                else render.find('.full-start__buttons').append(btn);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
