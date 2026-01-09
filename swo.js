(function () {
    (function () {
        'use strict';

        var VERSION = '1.8.0';
        var PLUGIN_NAME = 'Filmix Prestige';

        function startPlugin() {
            if (window.filmix_prestige_loaded) return;
            window.filmix_prestige_loaded = true;

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

            // Добавляем стили из референса
            $('<style>' +
                '.fx-prestige-item { margin-bottom: 1em; }' +
                '.fx-prestige-header { padding: 1.5em; background: rgba(255,255,255,0.05); border-radius: 1em; margin-bottom: 1.5em; border-left: 5px solid #3b82f6; }' +
                '.fx-prestige-buttons { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 1.5em; padding: 0 5px; }' +
                '.fx-btn { padding: 0.6em 1.2em; background: rgba(255,255,255,0.1); border-radius: 0.5em; font-size: 1.1em; font-weight: bold; }' +
                '.fx-btn.focus { background: #3b82f6; color: #fff; }' +
                '.fx-badge-q { background: #3b82f6; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 10px; }' +
            '</style>').appendTo('head');

            function FilmixComponent(object) {
                var network = new (Lampa.Request || Lampa.Reguest)();
                var scroll = new Lampa.Scroll({ mask: true, over: true });
                var files = new Lampa.Explorer(object);
                var container = $('<div class="fx-prestige-list" style="padding-bottom: 150px;"></div>');
                
                var history = [];
                var items = [];
                var active_item = 0;
                var retry_count = 0;

                this.create = function () {
                    files.appendFiles(scroll.render());
                    scroll.append(container);
                    
                    var kp_id = object.movie.kinopoisk_id || object.movie.kp_id;
                    var id_param = kp_id ? 'kinopoisk_id=' + kp_id : 'postid=' + object.movie.id;
                    
                    var startUrl = BASE_DOMAIN + '/lite/fxapi?rjson=False&' + id_param + '&s=1&uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rchtype=cors';
                    this.load(startUrl, object.movie.title || 'Главная');
                    return files.render();
                };

                this.load = function (url, title) {
                    var self = this;
                    if (url.indexOf('http') !== 0) url = BASE_DOMAIN + (url.indexOf('/') === 0 ? '' : '/') + url;
                    if (url.indexOf('showy_token') === -1) url += (url.indexOf('?') === -1 ? '?' : '&') + 'uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rchtype=cors';

                    var proxyUrl = PROXIES[currentProxyIdx];
                    var finalUrl = proxyUrl + url;
                    if (proxyUrl.includes('allorigins')) finalUrl = proxyUrl + encodeURIComponent(url);

                    Lampa.Loading.show();
                    network.native(finalUrl, function (res) {
                        Lampa.Loading.hide();
                        var data = self.parse(res);
                        
                        // Логика авто-входа в единственный сезон (как в референсе)
                        if (data.items.length === 1 && data.items[0].method === 'link' && history.length === 0) {
                            self.load(data.items[0].url, data.items[0].text);
                        } else if (data.items.length > 0 || data.buttons.length > 0) {
                            retry_count = 0;
                            Lampa.Storage.set('fx_prestige_proxy_idx', currentProxyIdx.toString());
                            self.build(data, title, url);
                        } else {
                            self.empty('Контент не найден или список пуст.');
                        }
                    }, function (err) {
                        retry_count++;
                        if (retry_count < PROXIES.length) {
                            currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                            self.load(url, title);
                        } else {
                            Lampa.Loading.hide();
                            self.empty('Ошибка сети. Проверьте подключение или смените прокси.');
                        }
                    }, false, { dataType: 'text', timeout: 15000 });
                };

                this.parse = function (str) {
                    var html = $('<div>' + str + '</div>');
                    var items = [];
                    var buttons = [];

                    // Парсим видео и папки
                    html.find('.videos__item').each(function () {
                        try {
                            var jd = JSON.parse($(this).attr('data-json'));
                            jd.text = $(this).text().trim() || jd.title;
                            items.push(jd);
                        } catch (e) {}
                    });

                    // Парсим кнопки перевода (как в референсе)
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
                    container.empty();
                    items = [];
                    active_item = 0;

                    // Header
                    var head = $('<div class="fx-prestige-header">' +
                        '<div style="opacity:0.5; font-size:0.8em; text-transform:uppercase;">' + PLUGIN_NAME + ' v' + VERSION + '</div>' +
                        '<div style="font-size:1.5em; font-weight:bold; margin-top:5px;">' + title + '</div>' +
                    '</div>');
                    container.append(head);

                    // Секция кнопок (Озвучки)
                    if (data.buttons.length > 0) {
                        var btn_cont = $('<div class="fx-prestige-buttons"></div>');
                        data.buttons.forEach(function (b) {
                            var btn = $('<div class="fx-btn selector">' + b.text + '</div>');
                            btn.on('hover:enter', function () {
                                self.load(b.url, title);
                            });
                            btn_cont.append(btn);
                            items.push(btn);
                        });
                        container.append(btn_cont);
                    }

                    // Кнопка назад
                    if (history.length > 0) {
                        var back = $('<div class="online-fx-item selector" style="padding:1.2em; margin-bottom:10px; background:rgba(255,255,255,0.05); border-radius:0.5em; display:flex; align-items:center; gap:15px;">' +
                            '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>' +
                            '<span style="font-size:1.2em;">Назад</span>' +
                        '</div>');
                        back.on('hover:enter', function () {
                            var prev = history.pop();
                            self.load(prev.url, prev.title);
                        });
                        container.append(back);
                        items.push(back);
                    }

                    // Список контента
                    data.items.forEach(function (jd) {
                        var isFile = jd.method === 'play' || (jd.url && (jd.url.indexOf('.mp4') !== -1 || jd.url.indexOf('.m3u8') !== -1));
                        var icon = isFile ? 
                            '<svg width="24" height="24" viewBox="0 0 24 24" fill="#3b82f6"><path d="M8 5v14l11-7z"/></svg>' : 
                            '<svg width="24" height="24" viewBox="0 0 24 24" fill="#f59e0b"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
                        
                        var badge = '';
                        if (isFile && jd.quality) {
                            var q = typeof jd.quality === 'object' ? Object.keys(jd.quality)[0] : jd.quality;
                            badge = '<span class="fx-badge-q">' + q + '</span>';
                        }

                        var item = $('<div class="online-fx-item selector" style="padding:1.2em; margin-bottom:8px; background:rgba(255,255,255,0.03); border-radius:0.8em; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(255,255,255,0.05);">' +
                            '<div style="display:flex; align-items:center; gap:15px;">' + icon + '<span style="font-size:1.2em;">' + jd.text + '</span></div>' +
                            '<div>' + badge + '</div>' +
                        '</div>');

                        item.on('hover:enter', function () {
                            if (!isFile) {
                                history.push({ url: url, title: title });
                                self.load(jd.url, jd.text);
                            } else {
                                self.play(jd, data.items);
                            }
                        }).on('hover:focus', function (e) {
                            active_item = items.indexOf(item);
                            scroll.update($(e.target), true);
                        });

                        container.append(item);
                        items.push(item);
                    });

                    this.start();
                    setTimeout(function() {
                        scroll.update();
                        scroll.scrollTo(0);
                    }, 100);
                };

                this.play = function (current, all) {
                    var playlist = [];
                    all.forEach(function(item) {
                        if (item.method === 'play' || (item.url && item.url.indexOf('.mp4') !== -1)) {
                            var q_url = item.url;
                            if (item.quality && typeof item.quality === 'object') {
                                q_url = item.quality[Object.keys(item.quality)[0]];
                            }
                            playlist.push({
                                title: item.text,
                                url: q_url.replace('http://', 'https://')
                            });
                        }
                    });

                    var start_index = playlist.findIndex(function(p) { return p.title === current.text; });
                    
                    Lampa.Player.play({
                        url: playlist[start_index].url,
                        title: object.movie.title + ' - ' + current.text
                    });
                    Lampa.Player.playlist(playlist);
                };

                this.empty = function (msg) {
                    container.empty().append('<div class="selector" style="padding:50px; text-align:center; opacity:0.5;">' + msg + '</div>');
                    this.start();
                };

                this.start = function () {
                    Lampa.Controller.add('fx_prestige_ctrl', {
                        toggle: function () {
                            Lampa.Controller.collectionSet(container);
                            Lampa.Controller.collectionFocus(items[active_item] ? items[active_item][0] : container.find('.selector')[0], container);
                        },
                        up: function () { if (active_item > 0) active_item--; else Lampa.Controller.toggle('head'); },
                        down: function () { if (active_item < items.length - 1) active_item++; },
                        back: function () { 
                            if (history.length > 0) { var prev = history.pop(); this.load(prev.url, prev.title); } 
                            else Lampa.Activity.backward(); 
                        }.bind(this)
                    });
                    Lampa.Controller.enable('fx_prestige_ctrl');
                };

                this.render = function () { return files.render(); };
                this.destroy = function () { network.clear(); scroll.destroy(); files.destroy(); container.remove(); };
            }

            Lampa.Component.add('fx_hybrid_v9', FilmixComponent);

            function injectButton(render, movie) {
                if (render.find('.fx-prestige-native').length) return;
                var btn = Lampa.Template.get('fx_nexus_button');
                btn.on('hover:enter', function () {
                    Lampa.Activity.push({ url: '', title: PLUGIN_NAME, component: 'fx_hybrid_v9', movie: movie, page: 1 });
                });
                var target = render.find('.view--torrent') || render.find('.full-start__buttons');
                if (target.length) target.after(btn);
            }

            Lampa.Listener.follow('full', function (e) {
                if (e.type == 'complete' || e.type == 'complite') injectButton(e.object.activity.render(), e.data.movie);
            });
        }

        if (typeof Lampa !== 'undefined') startPlugin();
    })();
})();