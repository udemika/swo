(function () {
    (function () {
        'use strict';

        var VERSION = '1.8.3';
        var PLUGIN_NAME = 'Filmix Prestige Legacy';

        function startPlugin() {
            if (window.filmix_prestige_legacy_loaded) return;
            window.filmix_prestige_legacy_loaded = true;

            var WORKING_UID = 'i8nqb9vw';
            var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
            var BASE_DOMAIN = 'http://showypro.com';

            var PROXIES = [
                'https://cors.byskaz.ru/',
                'https://cors.lampa.stream/',
                'https://corsproxy.io/?',
                'https://thingproxy.freeboard.io/fetch/',
                'https://api.allorigins.win/raw?url='
            ];

            var savedIdx = Lampa.Storage.get('fx_prestige_proxy_idx', '0');
            var currentProxyIdx = parseInt(savedIdx);
            if (isNaN(currentProxyIdx) || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

            // Локализация (ключи из референса для совместимости)
            Lampa.Lang.add({
                title_online_prestige: {
                    ru: 'Смотреть Онлайн',
                    uk: 'Дивитись Онлайн',
                    en: 'Watch Online'
                }
            });

            // SVG Иконка из SHARA
            var svgIcon = '<svg width="24" height="24" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M29.3323,25.9072a2.2,2.2,0,0,0,0-3.8144l-5.3172-3.0592,5.4833-2.5569,2.3028,1.3248L39.26,22.0928a2.2,2.2,0,0,1,0,3.8144l-7.4561,4.29-.0017.0014-2.4851,1.43-5.4833-2.5569ZM12.5878,29.29v2.4473a2.2,2.2,0,0,0,3.2965,1.9069l.0009-.0006,2.7034-1.5553,5.4832,2.5569-5.7177,3.29-.0037.0023-7.4157,4.2666a2.2,2.2,0,0,1-3.2976-1.9074V26.9815ZM24.2543,13.46,18.771,16.0165l-2.8856-1.66-.0017-.0009a2.2,2.2,0,0,0-3.2958,1.9082V18.9L7.6371,21.2083V7.7036a2.2,2.2,0,0,1,3.2976-1.9072l7.4186,4.2682.0009,0Z"/></svg>';
            
            // Стиль кнопки
            $('<style>.prestige-button svg { width: 1.8em; height: 1.8em; margin-right: 10px; vertical-align: middle; }</style>').appendTo('head');

            function FilmixComponent(object) {
                var network = new (Lampa.Request || Lampa.Reguest)();
                var scroll = new Lampa.Scroll({ mask: true, over: true });
                var files = new Lampa.Explorer(object);
                var container = $('<div class="fx-prestige-container" style="padding-bottom:150px;"></div>');
                var history = [];
                var items = [];
                var active_item = 0;

                this.create = function () {
                    files.appendFiles(scroll.render());
                    scroll.append(container);
                    var kp_id = object.movie.kinopoisk_id || object.movie.kp_id;
                    var id_param = kp_id ? 'kinopoisk_id=' + kp_id : 'postid=' + object.movie.id;
                    var startUrl = BASE_DOMAIN + '/lite/fxapi?rjson=False&' + id_param + '&s=1&uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rchtype=cors';
                    this.load(startUrl, object.movie.title || 'Меню');
                    return files.render();
                };

                this.load = function (url, title) {
                    var self = this;
                    if (url.indexOf('http') !== 0) url = BASE_DOMAIN + (url.indexOf('/') === 0 ? '' : '/') + url;
                    var proxyUrl = PROXIES[currentProxyIdx];
                    var finalUrl = proxyUrl + (proxyUrl.includes('allorigins') ? encodeURIComponent(url) : url);

                    Lampa.Loading.show();
                    network.native(finalUrl, function (res) {
                        Lampa.Loading.hide();
                        if (!res || res.trim() === "") {
                            currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                            return self.load(url, title);
                        }
                        var data = self.parse(res);
                        if (data.items.length === 1 && data.items[0].method === 'link' && history.length === 0) {
                            self.load(data.items[0].url, data.items[0].text);
                        } else {
                            self.build(data, title, url);
                        }
                    }, function () {
                        Lampa.Loading.hide();
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        self.load(url, title);
                    }, false, { dataType: 'text', timeout: 10000 });
                };

                this.parse = function (str) {
                    var html = $('<div>' + str + '</div>');
                    var items = [], buttons = [];
                    html.find('.videos__item').each(function () {
                        try {
                            var jd = JSON.parse($(this).attr('data-json'));
                            jd.text = $(this).text().trim() || jd.title;
                            items.push(jd);
                        } catch (e) {}
                    });
                    html.find('.videos__button').each(function () {
                        try {
                            var jd = JSON.parse($(this).attr('data-json'));
                            jd.text = $(this).text().trim();
                            buttons.push(jd);
                        } catch (e) {}
                    });
                    return { items: items, buttons: buttons };
                };

                this.build = function (data, title, url) {
                    var self = this;
                    container.empty(); items = []; active_item = 0;
                    if (data.buttons.length > 0) {
                        var b_cont = $('<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:1.5em"></div>');
                        data.buttons.forEach(function(b) {
                            var btn = $('<div class="selector" style="padding:0.6em 1.2em; background:rgba(255,255,255,0.05); border-radius:0.4em;">' + b.text + '</div>');
                            btn.on('hover:enter', function() { self.load(b.url, title); });
                            b_cont.append(btn); items.push(btn);
                        });
                        container.append(b_cont);
                    }
                    if (history.length > 0) {
                        var back = $('<div class="selector" style="padding:1em; margin-bottom:10px; background:rgba(255,255,255,0.05); border-radius:0.5em;">Назад</div>');
                        back.on('hover:enter', function () { var prev = history.pop(); self.load(prev.url, prev.title); });
                        container.append(back); items.push(back);
                    }
                    data.items.forEach(function (jd) {
                        var isFile = jd.method === 'play' || (jd.url && (jd.url.indexOf('.mp4') !== -1 || jd.url.indexOf('.m3u8') !== -1));
                        var item = $('<div class="selector" style="padding:1.2em; margin-bottom:8px; background:rgba(255,255,255,0.03); border-radius:0.8em; display:flex; align-items:center; gap:15px; border:1px solid rgba(255,255,255,0.05);">' + (isFile ? '▶' : '📁') + ' ' + jd.text + '</div>');
                        item.on('hover:enter', function () {
                            if (!isFile) { history.push({ url: url, title: title }); self.load(jd.url, jd.text); }
                            else {
                                var playlist = [];
                                data.items.forEach(function(it) { if (it.method === 'play') playlist.push({ title: it.text, url: it.url.replace('http://', 'https://') }); });
                                Lampa.Player.play({ url: jd.url.replace('http://', 'https://'), title: object.movie.title + ' - ' + jd.text });
                                Lampa.Player.playlist(playlist);
                            }
                        }).on('hover:focus', function (e) { active_item = items.indexOf(item); scroll.update($(e.target), true); });
                        container.append(item); items.push(item);
                    });
                    this.start();
                };

                this.start = function () {
                    Lampa.Controller.add('fx_prestige_ctrl', {
                        toggle: function () { Lampa.Controller.collectionSet(container); Lampa.Controller.collectionFocus(items[active_item] ? items[active_item][0] : container.find('.selector')[0], container); },
                        up: function () { if (active_item > 0) active_item--; else Lampa.Controller.toggle('head'); },
                        down: function () { if (active_item < items.length - 1) active_item++; },
                        back: function () { if (history.length > 0) { var prev = history.pop(); this.load(prev.url, prev.title); } else Lampa.Activity.backward(); }.bind(this)
                    });
                    Lampa.Controller.enable('fx_prestige_ctrl');
                };
                this.render = function () { return files.render(); };
                this.destroy = function () { network.clear(); scroll.destroy(); files.destroy(); container.remove(); };
            }

            Lampa.Component.add('fx_hybrid_v9', FilmixComponent);

            function addButton(e) {
                if (e.render.find('.prestige-button').length) return;
                
                var btn = $(Lampa.Lang.translate('<div class="full-start__button selector prestige-button" data-subtitle="' + PLUGIN_NAME + '"> ' + svgIcon + ' <span>#{title_online_prestige}</span> </div>'));
                
                btn.on('hover:enter', function() {
                    Lampa.Activity.push({ url: '', title: PLUGIN_NAME, component: 'fx_hybrid_v9', movie: e.movie, page: 1 });
                });

                e.render.before(btn);
            }

            // Метод агрессивной инъекции (слушаем событие и проверяем DOM)
            Lampa.Listener.follow('full', function (e) {
                if (e.type == 'complete' || e.type == 'complite') {
                    var render = e.object.activity.render();
                    var inject = function() {
                        var playbtn = render.find('.button--play');
                        var target = playbtn.length > 0 ? playbtn : render.find('.view--torrent');
                        if (target.length) {
                            addButton({ render: target, movie: e.data.movie });
                        }
                    };
                    
                    inject();
                    // Double-check: перепроверяем наличие кнопки через 1 и 3 секунды (защита от RCH перерисовки)
                    setTimeout(inject, 1000);
                    setTimeout(inject, 3000);
                }
            });
        }

        if (typeof Lampa !== 'undefined') startPlugin();
    })();
})();