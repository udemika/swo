(function () {
    'use strict';

    /**
     * Filmix Nexus (Series Pro Fix) v2.0.9
     * - Имитация поведения оригинального Lampac для работы с кнопками озвучек
     * - Исправлен баг, когда список серий не обновлялся при смене перевода
     * - Добавлен принудительный переход по ссылке кнопки (method: link), если она не активна
     * - Улучшен парсинг названий озвучек (удаление лишних пробелов и спецсимволов)
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'http://showypro.com';
        var HOST_KEY = BASE_DOMAIN.replace('http://', '').replace('https://', '');

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

        function account(url) {
            url = url + '';
            if (url.indexOf('account_email=') == -1) {
                var email = Lampa.Storage.get('account_email');
                if (email) url = Lampa.Utils.addUrlComponent(url, 'account_email=' + encodeURIComponent(email));
            }
            if (url.indexOf('uid=') == -1) {
                var uid = Lampa.Storage.get('lampac_unic_id', WORKING_UID);
                if (uid) url = Lampa.Utils.addUrlComponent(url, 'uid=' + encodeURIComponent(uid));
            }
            if (url.indexOf('nws_id=') == -1 && window.rch_nws && window.rch_nws[HOST_KEY]) {
                var nws_id = window.rch_nws[HOST_KEY].connectionId || Lampa.Storage.get('lampac_nws_id', '');
                if (nws_id) url = Lampa.Utils.addUrlComponent(url, 'nws_id=' + encodeURIComponent(nws_id));
            }
            return url;
        }

        function rchRun(json, call) {
            if (typeof NativeWsClient == 'undefined') {
                Lampa.Utils.putScript([BASE_DOMAIN + "/js/nws-client-es5.js"], function() {}, false, function() {
                    rchInvoke(json, call);
                }, true);
            } else {
                rchInvoke(json, call);
            }
        }

        function rchInvoke(json, call) {
            if (!window.nwsClient) window.nwsClient = {};
            if (window.nwsClient[HOST_KEY] && window.nwsClient[HOST_KEY].socket)
                window.nwsClient[HOST_KEY].socket.close();
            
            // @ts-ignore
            window.nwsClient[HOST_KEY] = new NativeWsClient(json.nws, { autoReconnect: false });
            window.nwsClient[HOST_KEY].on('Connected', function(connectionId) {
                if (window.rch_nws && window.rch_nws[HOST_KEY] && typeof window.rch_nws[HOST_KEY].Registry === 'function') {
                    window.rch_nws[HOST_KEY].Registry(window.nwsClient[HOST_KEY], call);
                } else {
                    call();
                }
            });
            window.nwsClient[HOST_KEY].connect();
        }

        $('<style>\
            .fx-nexus-header { display: flex; align-items: center; gap: 10px; padding: 12px 20px; background: rgba(0,0,0,0.8); border-bottom: 1px solid rgba(255,255,255,0.1); position: sticky; top: 0; z-index: 10; }\
            .fx-nexus-pill { background: rgba(255,255,255,0.12); padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 700; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; color: #fff; transition: all 0.2s; white-space: nowrap; }\
            .fx-nexus-pill.focus { background: #fff; color: #000; border-color: #fff; transform: scale(1.05); }\
            .fx-nexus-title { font-size: 12px; color: rgba(255,255,255,0.4); margin-left: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; }\
            .fx-card-play { width: 36px; height: 36px; background: #ff0000; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }\
            .fx-episode-info { font-size: 11px; opacity: 0.5; margin-top: 2px; }\
        </style>').appendTo('head');

        function FilmixComponent(object) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var html = $('<div class="fx-nexus-component"></div>');
            var container = $('<div class="fx-nexus-list" style="padding-bottom: 80px;"></div>');
            var header = $('<div class="fx-nexus-header"></div>');
            
            var items = [];
            var header_items = [];
            var active_item = 0;
            var current_mode = 'content'; 

            var filters = {
                season: '1 сезон',
                voice: 'Любой',
                voice_url: ''
            };

            var raw_data = [];
            var voice_links = {}; 
            var total_seasons = object.movie.number_of_seasons || (object.movie.seasons ? object.movie.seasons.length : 0);

            this.create = function () {
                html.append(header).append(scroll.render());
                scroll.append(container);
                this.loadContent();
                return html;
            };

            this.updateHeader = function() {
                var self = this;
                header.empty();
                header_items = [];

                if (total_seasons > 0) {
                    var s_btn = $('<div class="fx-nexus-pill selector focusable">' + filters.season + '</div>');
                    s_btn.on('hover:enter', function() { self.showSeasonMenu(); });
                    header.append(s_btn);
                    header_items.push(s_btn);
                }

                var voices = this.getAvailableVoices();
                if (voices.length > 1) { 
                    var v_btn = $('<div class="fx-nexus-pill selector focusable">Озвучка: ' + filters.voice + '</div>');
                    v_btn.on('hover:enter', function() { self.showVoiceMenu(voices); });
                    header.append(v_btn);
                    header_items.push(v_btn);
                }

                header.append('<div class="fx-nexus-title">' + (object.movie.title || object.movie.name) + '</div>');
            };

            this.getAvailableVoices = function() {
                var v = ['Любой'];
                Object.keys(voice_links).forEach(function(name) {
                    if (v.indexOf(name) === -1) v.push(name);
                });
                raw_data.forEach(function(d) {
                    var name = (d.translate || d.translation || d.voice || '').trim();
                    if (name && v.indexOf(name) === -1) v.push(name);
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
                    title: 'Выбор сезона',
                    items: menu,
                    onSelect: function(item) {
                        filters.season = item.title;
                        filters.voice = 'Любой';
                        filters.voice_url = '';
                        voice_links = {}; 
                        self.loadContent();
                    },
                    onBack: function() { Lampa.Controller.toggle('fx_nexus_ctrl'); }
                });
            };

            this.showVoiceMenu = function(voices) {
                var self = this;
                Lampa.Select.show({
                    title: 'Выбор перевода',
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
                    onBack: function() { Lampa.Controller.toggle('fx_nexus_ctrl'); }
                });
            };

            this.loadContent = function(custom_url) {
                var self = this;
                var s_num = (filters.season.match(/\d+/) || [1])[0];
                var kp_id = object.movie.kinopoisk_id || object.movie.kp_id;
                var id_param = kp_id ? 'kinopoisk_id=' + kp_id : 'postid=' + object.movie.id;
                
                var url = custom_url || (BASE_DOMAIN + '/lite/fxapi?rjson=False&' + id_param + '&s=' + s_num + '&uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rchtype=cors');
                
                if (url.indexOf('http') !== 0) url = BASE_DOMAIN + (url.indexOf('/') === 0 ? '' : '/') + url;
                
                url = account(url);

                safeLoading.show();
                network.native(PROXIES[currentProxyIdx] + url, function (res) {
                    safeLoading.hide();
                    
                    var json = {};
                    try { json = JSON.parse(res); } catch(e) {}
                    if (json.rch) {
                        rchRun(json, function() { self.loadContent(custom_url); });
                        return;
                    }
                    
                    self.parseData(res, !!custom_url);
                }, function () {
                    safeLoading.hide();
                    self.empty('Ошибка сети. Попробуйте сменить прокси в шапке Lampac.');
                }, false, { dataType: 'text' });
            };

            this.parseData = function(res, is_subview) {
                var self = this;
                raw_data = [];
                var $dom = $('<div>' + res + '</div>');
                
                var found_buttons = [];
                $dom.find('.videos__button, .videos__item[data-json*="link"]').each(function() {
                    try {
                        var json = JSON.parse($(this).attr('data-json'));
                        var name = $(this).text().trim() || json.title || json.text;
                        if (json && (json.method === 'link' || json.method === 'playlist') && json.url && name) {
                            voice_links[name] = json.url;
                            found_buttons.push({
                                name: name,
                                url: json.url,
                                active: $(this).hasClass('active') || $(this).hasClass('focused') || $(this).hasClass('videos__button--active')
                            });
                        }
                    } catch(e) {}
                });

                $dom.find('.videos__item, [data-json*="play"]').each(function() {
                    try {
                        var json = JSON.parse($(this).attr('data-json'));
                        if (json && (json.method === 'play' || json.url)) {
                            if (is_subview && filters.voice !== 'Любой') {
                                json.translate = filters.voice;
                            }
                            if (!json.translate && json.translation) json.translate = json.translation;
                            
                            var is_dup = raw_data.some(function(r) { return r.url === json.url; });
                            if (!is_dup) raw_data.push(json);
                        }
                    } catch(e) {}
                });
                
                // РЕКУРСИВНЫЙ ПЕРЕХОД ПО КНОПКАМ ОЗВУЧЕК
                if (filters.voice !== 'Любой') {
                    var match = found_buttons.find(function(b) { return b.name === filters.voice; });
                    // Если кнопка найдена, но она не была активной в этом ответе - переходим по ее ссылке
                    if (match && !match.active) {
                        filters.voice_url = match.url;
                        this.loadContent(match.url);
                        return;
                    }
                }

                if (raw_data.length === 0 && found_buttons.length === 0) {
                    this.empty('Контент не найден или заблокирован');
                } else {
                    this.renderList();
                }
            };

            this.renderList = function() {
                var self = this;
                container.empty();
                items = [];
                active_item = 0;

                this.updateHeader();

                raw_data.forEach(function(data) {
                    var voice_name = (data.translate || data.translation || 'Стандарт').trim();
                    
                    // Если мы НЕ в режиме subview по прямой ссылке, фильтруем по имени
                    if (!filters.voice_url && filters.voice !== 'Любой' && voice_name !== filters.voice) {
                        return;
                    }

                    var display_title = (data.title || 'Серия').replace(/^\s*\((.*)\)\s*$/, '$1').trim();
                    var card = $('<div class="selector focusable" style="padding:16px; margin:8px 20px; background:rgba(255,255,255,0.05); border-radius:12px; display:flex; align-items:center; gap:16px; border:1px solid rgba(255,255,255,0.03);">\
                        <div class="fx-card-play"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>\
                        <div style="flex:1; overflow:hidden;">\
                            <div style="font-size:16px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + display_title + '</div>\
                            <div class="fx-episode-info">' + (voice_name !== 'Стандарт' ? voice_name + ' • ' : '') + (data.maxquality || 'HD') + '</div>\
                        </div>\
                    </div>');

                    card.on('hover:enter', function() {
                        Lampa.Player.play({ url: account(data.url), title: display_title, movie: object.movie });
                    });

                    container.append(card);
                    items.push(card);
                });

                if (items.length === 0) {
                    container.append('<div style="padding:60px; text-align:center; opacity:0.3;">Для отображения серий выберите озвучку из списка выше</div>');
                }
                
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
            this.destroy = function () { 
                network.clear(); 
                scroll.destroy(); 
                html.remove(); 
                safeLoading.hide();
                Lampa.Controller.enable('content');
            };
        }

        Lampa.Component.add('fx_hybrid_v9', FilmixComponent);

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.activity.render();
                if (render && !render.find('.fx-nexus-native').length) {
                    var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Смотреть</span></div>');
                    btn.on('hover:enter', function () {
                        Lampa.Activity.push({ component: 'fx_hybrid_v9', movie: e.data.movie });
                    });

                    var target = render.find('.view--torrent');
                    if (target.length) target.after(btn);
                    else render.find('.full-start__buttons').append(btn);
                }
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
