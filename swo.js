(function () {
    'use strict';

    /**
     * Filmix Nexus (Native Engine) v2.1.0
     * - Переход на "командную" модель Lampac
     * - Прямое выполнение URL из data-json кнопок озвучек
     * - Минимум локальной логики, максимум доверия серверу
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
            show: function() { try { if(window.Lampa && Lampa.Loading) Lampa.Loading.show(); } catch(e){} },
            hide: function() { try { if(window.Lampa && Lampa.Loading) Lampa.Loading.hide(); } catch(e){} }
        };

        // Просто подписываем URL необходимыми ключами для авторизации
        function signUrl(url) {
            url = url + '';
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            
            var email = Lampa.Storage.get('account_email');
            if (email && url.indexOf('account_email=') == -1) url = Lampa.Utils.addUrlComponent(url, 'account_email=' + encodeURIComponent(email));
            
            if (window.rch_nws && window.rch_nws[HOST_KEY]) {
                var nws_id = window.rch_nws[HOST_KEY].connectionId;
                if (nws_id && url.indexOf('nws_id=') == -1) url = Lampa.Utils.addUrlComponent(url, 'nws_id=' + nws_id);
            }
            return url;
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

            var state = {
                current_url: '',
                current_voice_name: 'По умолчанию',
                current_season: '1 сезон'
            };

            var voices = []; // {title, url, active}
            var episodes = []; // {title, url, quality}

            this.create = function () {
                html.append(header).append(scroll.render());
                scroll.append(container);
                this.load(signUrl(BASE_DOMAIN + '/lite/fxapi?rjson=False&kinopoisk_id=' + (object.movie.kinopoisk_id || object.movie.kp_id) + '&s=1'));
                return html;
            };

            this.load = function(url) {
                var self = this;
                state.current_url = url;
                
                safeLoading.show();
                network.native(PROXIES[currentProxyIdx] + url, function (res) {
                    safeLoading.hide();
                    
                    // Если пришел RCH (Remote Connection Hub)
                    try {
                        var json = JSON.parse(res);
                        if (json.rch) {
                            Lampa.Utils.putScript([BASE_DOMAIN + "/js/nws-client-es5.js"], function() {
                                // @ts-ignore
                                var nws = new NativeWsClient(json.nws);
                                nws.on('Connected', function() { self.load(url); });
                                nws.connect();
                            });
                            return;
                        }
                    } catch(e) {}

                    self.parse(res);
                }, function () {
                    safeLoading.hide();
                    Lampa.Noty.show('Ошибка загрузки данных');
                }, false, { dataType: 'text' });
            };

            this.parse = function(html_str) {
                var self = this;
                voices = [];
                episodes = [];
                var $dom = $('<div>' + html_str + '</div>');

                // 1. Ищем кнопки озвучек/сезонов (команды типа "link")
                $dom.find('.videos__button, .selector[data-json*="link"]').each(function() {
                    try {
                        var json = JSON.parse($(this).attr('data-json'));
                        if (json.method === 'link' || json.url) {
                            var title = $(this).text().trim() || json.title;
                            var isActive = $(this).hasClass('active') || $(this).hasClass('focused') || $(this).hasClass('videos__button--active');
                            
                            if (isActive) state.current_voice_name = title;
                            
                            voices.push({ title: title, url: json.url, active: isActive });
                        }
                    } catch(e) {}
                });

                // 2. Ищем видео-файлы (команды типа "play")
                $dom.find('.videos__item, .selector[data-json*="play"]').each(function() {
                    try {
                        var json = JSON.parse($(this).attr('data-json'));
                        if (json.url) {
                            episodes.push({
                                title: $(this).find('.videos__item-title').text().trim() || json.title || 'Серия',
                                url: json.url,
                                quality: json.maxquality || 'HD'
                            });
                        }
                    } catch(e) {}
                });

                this.render();
            };

            this.render = function() {
                var self = this;
                container.empty();
                header.empty();
                items = [];
                header_items = [];
                active_item = 0;

                // Рендерим шапку (Сезоны / Озвучки)
                if (voices.length > 0) {
                    var v_btn = $('<div class="fx-nexus-pill selector focusable">Озвучка: ' + state.current_voice_name + '</div>');
                    v_btn.on('hover:enter', function() {
                        Lampa.Select.show({
                            title: 'Выберите вариант',
                            items: voices.map(function(v) { return { title: v.title, value: v.url }; }),
                            onSelect: function(item) {
                                state.current_voice_name = item.title;
                                self.load(signUrl(item.value));
                            },
                            onBack: function() { Lampa.Controller.toggle('fx_nexus_ctrl'); }
                        });
                    });
                    header.append(v_btn);
                    header_items.push(v_btn);
                }
                header.append('<div class="fx-nexus-title">' + (object.movie.title || object.movie.name) + '</div>');

                // Рендерим список серий
                episodes.forEach(function(ep) {
                    var card = $('<div class="selector focusable" style="padding:16px; margin:8px 20px; background:rgba(255,255,255,0.05); border-radius:12px; display:flex; align-items:center; gap:16px; border:1px solid rgba(255,255,255,0.03);">\
                        <div class="fx-card-play"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>\
                        <div style="flex:1; overflow:hidden;">\
                            <div style="font-size:16px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + ep.title + '</div>\
                            <div class="fx-episode-info">' + ep.quality + '</div>\
                        </div>\
                    </div>');

                    card.on('hover:enter', function() {
                        Lampa.Player.play({ url: signUrl(ep.url), title: ep.title, movie: object.movie });
                    });

                    container.append(card);
                    items.push(card);
                });

                if (episodes.length === 0) {
                    container.append('<div style="padding:60px; text-align:center; opacity:0.3;">Список пуст. Попробуйте выбрать другую озвучку.</div>');
                }

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
