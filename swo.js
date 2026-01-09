
(function () {
    'use strict';

    /**
     * Filmix Nexus (SWO Edition) v1.8.1
     * Исправлена критическая ошибка: ReferenceError: render is not defined
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var VERSION = '1.8.1';
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

        // Стили для верхней панели
        $('<style>\
            .fx-nexus-header { display: flex; align-items: center; gap: 20px; padding: 15px 25px; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05); }\
            .fx-nexus-label { font-size: 1.2em; color: #fff; opacity: 0.8; font-weight: 300; }\
            .fx-nexus-pill { background: rgba(255,255,255,0.1); padding: 6px 15px; border-radius: 6px; font-size: 0.9em; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; transition: all 0.2s; }\
            .fx-nexus-pill.focus { background: #fff; color: #000; border-color: #fff; }\
            .fx-nexus-search-wrap { margin-left: auto; display: flex; align-items: center; gap: 10px; }\
            .fx-nexus-search-btn { display: flex; align-items: center; justify-content: center; width: 35px; height: 35px; border-radius: 50%; }\
            .fx-nexus-search-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 12px; font-size: 0.9em; color: #fff; width: 180px; }\
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

            this.create = function () {
                var source_btn = $('<div class="fx-nexus-label">Источник <span class="fx-nexus-pill selector focusable">Kinotochka ~ 720p</span></div>');
                var filter_btn = $('<div class="fx-nexus-label">Фильтр <span class="fx-nexus-pill selector focusable">Сезон: 1 сезон</span></div>');
                var search_btn = $('<div class="fx-nexus-search-wrap"><div class="fx-nexus-search-btn selector focusable"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div><div class="fx-nexus-search-input">' + (object.movie.title || 'Поиск...') + '</div></div>');

                header.append(source_btn).append(filter_btn).append(search_btn);
                header_items = [source_btn.find('.selector'), filter_btn.find('.selector'), search_btn.find('.selector')];

                html.append(header).append(history_info).append(scroll.render());
                scroll.append(container);
                
                var kp_id = object.movie.kinopoisk_id || object.movie.kp_id;
                var id_param = kp_id ? 'kinopoisk_id=' + kp_id : 'postid=' + object.movie.id;
                var startUrl = BASE_DOMAIN + '/lite/fxapi?rjson=False&' + id_param + '&s=1&uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rchtype=cors';
                
                this.load(startUrl, object.movie.title || 'Загрузка...');
                return html;
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
                for(var i=1; i<=12; i++) {
                    var item = $('<div class="selector focusable" style="padding:15px; margin:5px 25px; background:rgba(255,255,255,0.05); border-radius:8px; display:flex; align-items:center; gap:20px;">' +
                        '<div style="width:120px; height:70px; background:#333; border-radius:4px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.5em; color:rgba(255,255,255,0.2)">' + (i < 10 ? '0'+i : i) + '</div>' +
                        '<div>' +
                            '<div style="font-size:1.1em; font-weight:bold;">Глава ' + i + '. Название серии</div>' +
                            '<div style="font-size:0.8em; opacity:0.5; margin-top:5px;">★ 8.5  •  2024  •  45 мин</div>' +
                        '</div>' +
                    '</div>');
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
