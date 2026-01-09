
(function () {
    'use strict';

    /**
     * Filmix Nexus (Ultimate) v1.9.8
     * - Исправлена ошибка component.pause (белый экран при выходе)
     * - Кнопка "Перевод" появляется только при наличии выбора
     * - Фильтрация списка по выбранному переводу
     * - Сезоны только для сериалов, кол-во из метаданных
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
            .fx-nexus-header { display: flex; align-items: center; gap: 15px; padding: 15px 25px; background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,255,255,0.05); }\
            .fx-nexus-pill { background: rgba(255,255,255,0.08); padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; color: #ccc; transition: all 0.2s; }\
            .fx-nexus-pill.focus { background: #fff; color: #000; border-color: #fff; transform: scale(1.03); }\
            .fx-nexus-search-input { background: rgba(255,255,255,0.03); border-radius: 6px; padding: 6px 12px; font-size: 0.85em; color: rgba(255,255,255,0.4); margin-left: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }\
            .fx-card-play { width: 42px; height: 42px; background: #e50914; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }\
        </style>').appendTo('head');

        function FilmixComponent(object) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var html = $('<div class="fx-nexus-component"></div>');
            var container = $('<div class="fx-nexus-list" style="padding-bottom: 60px;"></div>');
            var header = $('<div class="fx-nexus-header"></div>');
            
            var items = [];
            var header_items = [];
            var active_item = 0;
            var current_mode = 'content'; 

            var filters = {
                season: '1 сезон',
                voice: 'Любой'
            };

            var raw_data = [];
            var total_seasons = object.movie.number_of_seasons || 0;

            this.create = function () {
                var self = this;
                html.append(header).append(scroll.render());
                scroll.append(container);
                this.loadContent();
                return html;
            };

            this.updateHeader = function() {
                var self = this;
                header.empty();
                header_items = [];

                // Кнопка сезонов (только для сериалов)
                if (total_seasons > 0) {
                    var s_btn = $('<div class="fx-nexus-pill selector focusable">' + filters.season + '</div>');
                    s_btn.on('hover:enter', function() { self.showSeasonMenu(); });
                    header.append(s_btn);
                    header_items.push(s_btn);
                }

                // Кнопка озвучки (только если их > 1)
                var voices = this.getUniqueVoices();
                if (voices.length > 2) { // "Любой" + еще минимум 2
                    var v_btn = $('<div class="fx-nexus-pill selector focusable">Перевод: ' + filters.voice + '</div>');
                    v_btn.on('hover:enter', function() { self.showVoiceMenu(voices); });
                    header.append(v_btn);
                    header_items.push(v_btn);
                }

                header.append('<div class="fx-nexus-search-input">' + (object.movie.title || object.movie.name) + '</div>');
            };

            this.getUniqueVoices = function() {
                var v = ['Любой'];
                raw_data.forEach(function(d) {
                    if (d.translate && v.indexOf(d.translate) === -1) v.push(d.translate);
                });
                return v;
            };

            this.showSeasonMenu = function() {
                var self = this;
                var menu = [];
                for (var i = 1; i <= total_seasons; i++) {
                    menu.push({ title: i + ' сезон', value: i });
                }
                Lampa.Select.show({
                    title: 'Выберите сезон',
                    items: menu,
                    onSelect: function(item) {
                        filters.season = item.title;
                        self.loadContent();
                    },
                    onBack: function() { Lampa.Controller.toggle('fx_nexus_ctrl'); }
                });
            };

            this.showVoiceMenu = function(voices) {
                var self = this;
                Lampa.Select.show({
                    title: 'Выберите перевод',
                    items: voices.map(function(v){ return {title: v, value: v}; }),
                    onSelect: function(item) {
                        filters.voice = item.value;
                        self.renderList();
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
                    self.parseData(res);
                }, function () {
                    safeLoading.hide();
                    self.empty('Ошибка связи с сервером');
                }, false, { dataType: 'text' });
            };

            this.parseData = function(res) {
                var self = this;
                raw_data = [];
                var $dom = $('<div>' + res + '</div>');
                $dom.find('.videos__item').each(function() {
                    try {
                        var json = JSON.parse($(this).attr('data-json'));
                        if (json) raw_data.push(json);
                    } catch(e) {}
                });
                
                if (raw_data.length === 0) return this.empty('Видео не найдено');
                this.renderList();
            };

            this.renderList = function() {
                var self = this;
                container.empty();
                items = [];
                active_item = 0;

                this.updateHeader();

                raw_data.forEach(function(data) {
                    // Фильтрация по озвучке
                    if (filters.voice !== 'Любой' && data.translate !== filters.voice) return;

                    var title = data.translate || 'Стандартный поток';
                    var card = $('<div class="selector focusable" style="padding:15px; margin:6px 20px; background:rgba(255,255,255,0.05); border-radius:10px; display:flex; align-items:center; gap:15px; border:1px solid rgba(255,255,255,0.02);">\
                        <div class="fx-card-play"><svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>\
                        <div style="flex:1; overflow:hidden;">\
                            <div style="font-size:15px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + title + '</div>\
                            <div style="font-size:11px; opacity:0.4; margin-top:2px;">' + (data.maxquality || 'Full HD') + '</div>\
                        </div>\
                    </div>');

                    card.on('hover:enter', function() {
                        Lampa.Player.play({ url: data.url, title: title, movie: object.movie });
                    });

                    container.append(card);
                    items.push(card);
                });

                if (items.length === 0) container.append('<div style="padding:50px; text-align:center; opacity:0.3;">Нет видео с таким переводом</div>');
                this.start();
            };

            this.empty = function(msg) {
                container.empty().append('<div style="padding:100px 20px; text-align:center; opacity:0.4;">' + msg + '</div>');
                this.updateHeader();
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

            this.pause = function () {}; 
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
