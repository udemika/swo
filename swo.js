(function () {
    (function () {
        'use strict';

        var VERSION = '1.8.2';
        var PLUGIN_NAME = 'Filmix Prestige Ultra';

        function startPlugin() {
            if (window.filmix_prestige_ultra_loaded) return;
            window.filmix_prestige_ultra_loaded = true;

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

            // Локализация
            Lampa.Lang.add({
                fx_watch_online: {
                    ru: 'Смотреть Онлайн',
                    uk: 'Дивитись Онлайн',
                    en: 'Watch Online'
                }
            });

            // CSS
            var css = `
                .online-prestige{position:relative;border-radius:.3em;background-color:rgba(0,0,0,0.3);display:flex;margin-bottom:1.5em}
                .online-prestige__body{padding:1.2em;line-height:1.3;flex-grow:1;position:relative}
                .online-prestige__img{position:relative;width:13em;flex-shrink:0;min-height:8.2em}
                .online-prestige__img>img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:.3em;opacity:0;transition:opacity .3s}
                .online-prestige__img--loaded>img{opacity:1}
                .online-prestige__viewed{position:absolute;top:1em;left:1em;background:rgba(0,0,0,0.45);border-radius:100%;padding:.25em;font-size:.76em}
                .online-prestige__title{font-size:1.6em;font-weight:bold;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
                .online-prestige__info{display:flex;align-items:center;gap:10px;margin-top:10px;opacity:0.6;font-size:0.9em}
                .online-prestige.focus{background:rgba(255,255,255,0.1);outline: 3px solid #fff; z-index:10}
                .fx-pure-native svg { width: 1.8em; height: 1.8em; margin-right: 10px; vertical-align: middle; }
            `;
            $('<style>' + css + '</style>').appendTo('head');

            // Шаблоны
            var svgIcon = '<svg width="24" height="24" viewBox="0 0 48 48" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M29.3323,25.9072a2.2,2.2,0,0,0,0-3.8144l-5.3172-3.0592,5.4833-2.5569,2.3028,1.3248L39.26,22.0928a2.2,2.2,0,0,1,0,3.8144l-7.4561,4.29-.0017.0014-2.4851,1.43-5.4833-2.5569ZM12.5878,29.29v2.4473a2.2,2.2,0,0,0,3.2965,1.9069l.0009-.0006,2.7034-1.5553,5.4832,2.5569-5.7177,3.29-.0037.0023-7.4157,4.2666a2.2,2.2,0,0,1-3.2976-1.9074V26.9815ZM24.2543,13.46,18.771,16.0165l-2.8856-1.66-.0017-.0009a2.2,2.2,0,0,0-3.2958,1.9082V18.9L7.6371,21.2083V7.7036a2.2,2.2,0,0,1,3.2976-1.9072l7.4186,4.2682.0009,0Z"/></svg>';
            
            Lampa.Template.add('fx_nexus_button', `
                <div class="full-start__button selector view--online fx-pure-native" data-subtitle="${PLUGIN_NAME} v${VERSION}">
                    ${svgIcon}
                    <span>#{fx_watch_online}</span>
                </div>
            `);

            Lampa.Template.add('fx_prestige_item', `
                <div class="online-prestige selector">
                    <div class="online-prestige__img"><img src="" alt=""></div>
                    <div class="online-prestige__body">
                        <div class="online-prestige__title">{title}</div>
                        <div class="online-prestige__info">{info}</div>
                        <div style="margin-top:8px;">{badge}</div>
                    </div>
                </div>
            `);

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
                    if (url.indexOf('showy_token') === -1) url += (url.indexOf('?') === -1 ? '?' : '&') + 'uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rchtype=cors';

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
                    var items = [];
                    var buttons = [];
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
                        back.on('hover:enter', function () {
                            var prev = history.pop(); self.load(prev.url, prev.title);
                        });
                        container.append(back); items.push(back);
                    }

                    data.items.forEach(function (jd) {
                        var isFile = jd.method === 'play' || (jd.url && (jd.url.indexOf('.mp4') !== -1 || jd.url.indexOf('.m3u8') !== -1));
                        var quality = (isFile && jd.quality) ? '<span style="background:#3b82f6; padding:2px 6px; border-radius:4px; font-size:10px;">' + (typeof jd.quality === 'object' ? Object.keys(jd.quality)[0] : jd.quality) + '</span>' : '';
                        
                        var item = Lampa.Template.get('fx_prestige_item', { title: jd.text, info: isFile ? 'Видео' : 'Папка', badge: quality });
                        var img = item.find('img')[0];
                        if (object.movie.backdrop_path) img.src = Lampa.TMDB.image('t/p/w300' + object.movie.backdrop_path);
                        else $(img).parent().hide();

                        item.on('hover:enter', function () {
                            if (!isFile) {
                                history.push({ url: url, title: title });
                                self.load(jd.url, jd.text);
                            } else {
                                var playlist = [];
                                data.items.forEach(function(it) {
                                    if (it.method === 'play') playlist.push({ title: it.text, url: it.url.replace('http://', 'https://') });
                                });
                                Lampa.Player.play({ url: jd.url.replace('http://', 'https://'), title: object.movie.title + ' - ' + jd.text });
                                Lampa.Player.playlist(playlist);
                            }
                        }).on('hover:focus', function (e) {
                            active_item = items.indexOf(item);
                            scroll.update($(e.target), true);
                        });
                        container.append(item); items.push(item);
                    });
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
                        back: function () { if (history.length > 0) { var prev = history.pop(); this.load(prev.url, prev.title); } else Lampa.Activity.backward(); }.bind(this)
                    });
                    Lampa.Controller.enable('fx_prestige_ctrl');
                };

                this.render = function () { return files.render(); };
                this.destroy = function () { network.clear(); scroll.destroy(); files.destroy(); container.remove(); };
            }

            Lampa.Component.add('fx_hybrid_v9', FilmixComponent);

            function injectButton(render, movie) {
                if (render.find('.fx-pure-native').length) return;
                var btn = Lampa.Template.get('fx_nexus_button');
                btn.on('hover:enter', function () {
                    Lampa.Activity.push({ url: '', title: PLUGIN_NAME, component: 'fx_hybrid_v9', movie: movie, page: 1 });
                });
                
                // Пробуем несколько точек вставки
                var target = render.find('.button--play, .view--torrent, .full-start__buttons').first();
                if (target.length) target.after(btn);
            }

            Lampa.Listener.follow('full', function (e) {
                if (e.type == 'complete' || e.type == 'complite') {
                    injectButton(e.object.activity.render(), e.data.movie);
                }
            });
        }

        if (typeof Lampa !== 'undefined') startPlugin();
    })();
})();