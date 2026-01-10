(function () {
    'use strict';

    /**
     * Filmix Nexus (v3.0 - Proxy Selector)
     * Добавлен выбор прокси прямо в интерфейсе
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        // Обновил домен на актуальный
        var BASE_DOMAIN = 'http://filmixapp.cyou';

        var PROXIES = [
            { name: 'Lampa Stream', url: 'https://cors.lampa.stream/' },
            { name: 'CorsProxy', url: 'https://corsproxy.io/?' },
            { name: 'AllOrigins', url: 'https://api.allorigins.win/raw?url=' },
            { name: 'Byskaz', url: 'https://cors.byskaz.ru/' }
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0'));
        if(currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

        $('<style>\
            .fx-view-window { height: 100%; display: flex; flex-direction: column; background: #000; }\
            .fx-view-head { flex-shrink: 0; padding: 15px 20px; display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.1); }\
            .fx-view-content { flex-grow: 1; overflow: hidden; position: relative; }\
            .fx-btn { padding: 8px 16px; border-radius: 6px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 15px; font-weight: 500; transition: all 0.2s; white-space: nowrap; }\
            .fx-btn.focus { background: #fff; color: #000; border-color: #fff; transform: scale(1.05); }\
            .fx-title-label { margin-left: auto; opacity: 0.5; font-size: 14px; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\
            .fx-item { padding: 14px; margin-bottom: 8px; border-radius: 8px; background: rgba(255,255,255,0.03); display: flex; align-items: center; gap: 15px; border: 1px solid transparent; }\
            .fx-item.focus { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.3); }\
            .fx-item-icon { width: 30px; height: 30px; background: #e50914; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }\
            .fx-item-info { flex: 1; overflow: hidden; }\
            .fx-item-title { font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\
            .fx-item-sub { font-size: 12px; color: rgba(255,255,255,0.5); }\
        </style>').appendTo('head');

        var safeLoading = {
            show: function() { try { Lampa.Loading.show(); } catch(e){} },
            hide: function() { try { Lampa.Loading.hide(); } catch(e){} }
        };

        function FilmixComponent(object) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            
            var html = $('<div class="fx-view-window"></div>');
            var head = $('<div class="fx-view-head"></div>');
            var body = $('<div class="fx-view-content"></div>');
            var list = $('<div class="fx-list-inner" style="padding: 20px;"></div>');

            var items_list = [];   
            var items_head = [];   
            var active_area = 'list';
            var last_list_index = 0;

            var filters = {
                season: '1 сезон',
                voice: 'Любой',
                voice_url: ''
            };

            var raw_data = [];
            var voice_links = {};
            var total_seasons = object.movie.number_of_seasons || (object.movie.seasons ? object.movie.seasons.length : 0);

            this.create = function () {
                html.append(head);
                html.append(body);
                body.append(scroll.render());
                scroll.append(list);
                this.loadContent();
                return html;
            };

            this.renderHead = function() {
                var self = this;
                head.empty();
                items_head = [];

                // Кнопка ПРОКСИ
                var btn_proxy = $('<div class="fx-btn selector">Proxy: ' + PROXIES[currentProxyIdx].name + '</div>');
                btn_proxy.on('hover:enter', function() { self.switchProxy(); });
                head.append(btn_proxy);
                items_head.push(btn_proxy);

                if (total_seasons > 0) {
                    var btn_season = $('<div class="fx-btn selector">' + filters.season + '</div>');
                    btn_season.on('hover:enter', function() { self.selectSeason(); });
                    head.append(btn_season);
                    items_head.push(btn_season);
                }

                var voices = this.getAvailableVoices();
                if (voices.length > 1) {
                    var btn_voice = $('<div class="fx-btn selector">' + (filters.voice === 'Любой' ? 'Все озвучки' : filters.voice) + '</div>');
                    btn_voice.on('hover:enter', function() { self.selectVoice(voices); });
                    head.append(btn_voice);
                    items_head.push(btn_voice);
                }

                head.append('<div class="fx-title-label">' + (object.movie.title || object.movie.name) + '</div>');
            };

            this.switchProxy = function() {
                currentProxyIdx++;
                if(currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;
                Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx);
                
                Lampa.Noty.show('Прокси изменен на: ' + PROXIES[currentProxyIdx].name);
                this.loadContent(); // Перезагружаем с новым прокси
            };

            this.renderList = function() {
                var self = this;
                list.empty();
                items_list = [];

                this.renderHead();

                var has_content = false;
                raw_data.forEach(function(data) {
                    var voice_name = (data.translate || data.translation || 'Оригинал').trim();
                    if (filters.voice !== 'Любой' && voice_name !== filters.voice && !filters.voice_url) return;

                    has_content = true;
                    var title = data.title || (data.translate ? voice_name : 'Серия');
                    var quality = data.quality ? Object.keys(data.quality).join(', ') : (data.maxquality || 'HD');

                    var item = $('<div class="fx-item selector">\
                        <div class="fx-item-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>\
                        <div class="fx-item-info">\
                            <div class="fx-item-title">' + title + '</div>\
                            <div class="fx-item-sub">' + quality + ' | ' + voice_name + '</div>\
                        </div>\
                    </div>');

                    item.on('hover:enter', function() {
                        Lampa.Player.play({ url: data.url, title: title, movie: object.movie });
                    });

                    list.append(item);
                    items_list.push(item);
                });

                if (!has_content && raw_data.length > 0) {
                     list.append('<div style="text-align:center; padding: 50px; opacity: 0.5;">Нет видео для выбранного фильтра</div>');
                } else if (raw_data.length === 0) {
                     // Если список пуст, возможно это ошибка загрузки, но renderList вызвался
                     list.append('<div style="text-align:center; padding: 50px; opacity: 0.5;">Список пуст или загрузка не удалась</div>');
                }
                
                this.controller();
            };

            this.getAvailableVoices = function() {
                var v = ['Любой'];
                raw_data.forEach(function(d) {
                    var name = (d.translate || d.translation || d.voice || '').trim();
                    if (name && v.indexOf(name) === -1) v.push(name);
                });
                Object.keys(voice_links).forEach(function(name) {
                    if (v.indexOf(name) === -1) v.push(name);
                });
                return v;
            };

            this.selectSeason = function() {
                var self = this;
                var menu = [];
                for (var i = 1; i <= total_seasons; i++) menu.push({ title: i + ' сезон', value: i });
                Lampa.Select.show({
                    title: 'Выбор сезона',
                    items: menu,
                    onSelect: function(item) {
                        filters.season = item.title;
                        filters.voice = 'Любой';
                        filters.voice_url = '';
                        self.loadContent();
                    },
                    onBack: function() { self.controller(); }
                });
            };

            this.selectVoice = function(voices) {
                var self = this;
                Lampa.Select.show({
                    title: 'Выбор озвучки',
                    items: voices.map(function(v){ return {title: v, value: v}; }),
                    onSelect: function(item) {
                        filters.voice = item.value;
                        if (voice_links[item.value]) {
                            filters.voice_url = voice_links[item.value];
                            self.loadContent(filters.voice_url);
                        } else {
                            filters.voice_url = '';
                            self.renderList();
                        }
                    },
                    onBack: function() { self.controller(); }
                });
            };

            this.loadContent = function(custom_url) {
                var self = this;
                var s_num = (filters.season.match(/\d+/) || [1])[0];
                var kp_id = object.movie.kinopoisk_id || object.movie.kp_id;
                var id_param = kp_id ? 'kinopoisk_id=' + kp_id : 'postid=' + object.movie.id;
                
                var url = custom_url || (BASE_DOMAIN + '/lite/fxapi?rjson=False&' + id_param + '&s=' + s_num + '&uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rchtype=cors');
                if (url.indexOf('http') !== 0) url = BASE_DOMAIN + (url.indexOf('/') === 0 ? '' : '/') + url;

                safeLoading.show();
                network.native(PROXIES[currentProxyIdx].url + url, function (res) {
                    safeLoading.hide();
                    self.parseData(res);
                }, function () {
                    safeLoading.hide();
                    Lampa.Noty.show('Ошибка сети. Пробуем другой прокси? Нажмите кнопку Proxy');
                    // Важно: рендерим шапку, чтобы была доступна кнопка смены прокси
                    self.renderHead();
                    list.empty().append('<div style="text-align:center; padding:50px;">Ошибка подключения.<br>Нажмите кнопку <b>Proxy</b> сверху.</div>');
                    self.controller();
                }, false, { dataType: 'text' });
            };

            this.parseData = function(res) {
                raw_data = [];
                voice_links = {};
                var $dom = $('<div>' + res + '</div>');
                
                $dom.find('.videos__button').each(function() {
                    try {
                        var json = JSON.parse($(this).attr('data-json'));
                        var name = $(this).text().trim();
                        if (json && json.method === 'link' && json.url && name) voice_links[name] = json.url;
                    } catch(e) {}
                });

                $dom.find('.videos__item').each(function() {
                    try {
                        var json = JSON.parse($(this).attr('data-json'));
                        if (json) {
                            if (!json.translate && json.translation) json.translate = json.translation;
                            raw_data.push(json);
                        }
                    } catch(e) {}
                });

                if(raw_data.length === 0 && Object.keys(voice_links).length > 0) {
                     var vs = this.getAvailableVoices();
                     this.selectVoice(vs);
                } else {
                    this.renderList();
                }
            };

            this.controller = function() {
                var self = this;
                Lampa.Controller.add('fx_nexus_ctrl', {
                    toggle: function () {
                        if (active_area === 'head') {
                            Lampa.Controller.collectionSet(head);
                            Lampa.Controller.collectionFocus(items_head.length ? items_head[0][0] : null, head);
                        } else {
                            Lampa.Controller.collectionSet(list);
                            var item_to_focus = items_list[last_list_index] ? items_list[last_list_index][0] : (items_list[0] ? items_list[0][0] : null);
                            Lampa.Controller.collectionFocus(item_to_focus, list);
                        }
                    },
                    up: function () {
                        if (active_area === 'list') {
                            var current = list.find('.focus');
                            if (items_head.length && (!current.length || current.is(items_list[0]))) {
                                active_area = 'head';
                                Lampa.Controller.toggle('fx_nexus_ctrl');
                            }
                        }
                    },
                    down: function () {
                        if (active_area === 'head') {
                            if (items_list.length) {
                                active_area = 'list';
                                Lampa.Controller.toggle('fx_nexus_ctrl');
                            }
                        }
                    },
                    left: function() { if(active_area === 'list') Lampa.Controller.collectionFocus(null, list); },
                    right: function() { if(active_area === 'list') Lampa.Controller.collectionFocus(null, list); },
                    back: function () { Lampa.Activity.backward(); }
                });
                Lampa.Controller.toggle('fx_nexus_ctrl');
            };

            this.start = function() {
                this.controller();
            };

            this.pause = function () {};
            this.stop = function () {};
            this.render = function () { return html; };
            this.destroy = function () {
                network.clear();
                scroll.destroy();
                html.remove();
                safeLoading.hide();
            };
        }

        Lampa.Component.add('fx_hybrid_v9', FilmixComponent);

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.activity.render();
                if (render.find('.fx-nexus-native').length) return;

                var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Filmix Nexus</span></div>');
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