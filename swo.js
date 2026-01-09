(function () {
    (function () {
        'use strict';

        var VERSION = '1.8.1';
        var PLUGIN_NAME = 'Filmix Prestige Pure';

        function startPlugin() {
            if (window.filmix_prestige_pure_loaded) return;
            window.filmix_prestige_pure_loaded = true;

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

            // Внедряем CSS из референса SHARA
            var css = `
                .online-prestige{position:relative;border-radius:.3em;background-color:rgba(0,0,0,0.3);display:flex;margin-bottom:1.5em}
                .online-prestige__body{padding:1.2em;line-height:1.3;flex-grow:1;position:relative}
                .online-prestige__img{position:relative;width:13em;flex-shrink:0;min-height:8.2em}
                .online-prestige__img>img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:.3em;opacity:0;transition:opacity .3s}
                .online-prestige__img--loaded>img{opacity:1}
                .online-prestige__viewed{position:absolute;top:1em;left:1em;background:rgba(0,0,0,0.45);border-radius:100%;padding:.25em;font-size:.76em}
                .online-prestige__viewed>svg{width:1.5em!important;height:1.5em!important}
                .online-prestige__title{font-size:1.6em;font-weight:bold;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
                .online-prestige__info{display:flex;align-items:center;gap:10px;margin-top:10px;opacity:0.6;font-size:0.9em}
                .online-prestige.focus{background:rgba(255,255,255,0.1);outline: 3px solid #fff; z-index:10}
                .online-prestige-watched{padding:1em; background:rgba(59,130,246,0.1); border-radius:0.5em; margin-bottom:1.5em; display:flex; align-items:center; gap:15px}
                .fx-voice-buttons { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:1.5em }
                .fx-voice-btn { padding:0.6em 1.2em; background:rgba(255,255,255,0.05); border-radius:0.4em; font-size:1.1em; border:1px solid rgba(255,255,255,0.1) }
                .fx-voice-btn.focus { background:#3b82f6; border-color:#3b82f6 }
            `;
            $('<style>' + css + '</style>').appendTo('head');

            // Шаблоны
            Lampa.Template.add('fx_prestige_item', `
                <div class="online-prestige selector">
                    <div class="online-prestige__img">
                        <img src="" alt="">
                    </div>
                    <div class="online-prestige__body">
                        <div class="online-prestige__title">{title}</div>
                        <div class="online-prestige__info">{info}</div>
                        <div class="fx-item-quality" style="margin-top:8px;">{badge}</div>
                        <div class="fx-item-timeline" style="margin-top:12px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                            <div class="fx-progress" style="width:0%; height:100%; background:#3b82f6;"></div>
                        </div>
                    </div>
                </div>
            `);

            Lampa.Template.add('fx_watched_bar', `
                <div class="online-prestige-watched">
                    <div style="color:#3b82f6;"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg></div>
                    <div style="font-size:1.1em;">{text}</div>
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
                var current_title = '';

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
                    current_title = title;
                    
                    if (url.indexOf('http') !== 0) url = BASE_DOMAIN + (url.indexOf('/') === 0 ? '' : '/') + url;
                    if (url.indexOf('showy_token') === -1) url += (url.indexOf('?') === -1 ? '?' : '&') + 'uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rchtype=cors';

                    var proxyUrl = PROXIES[currentProxyIdx];
                    var finalUrl = proxyUrl + url;
                    if (proxyUrl.includes('allorigins')) finalUrl = proxyUrl + encodeURIComponent(url);

                    Lampa.Loading.show();
                    network.native(finalUrl, function (res) {
                        Lampa.Loading.hide();
                        if (!res) return self.empty('Ошибка: Сервер вернул пустой ответ.');
                        
                        var data = self.parse(res);
                        
                        // Auto-entry для одиночных сезонов
                        if (data.items.length === 1 && data.items[0].method === 'link' && history.length === 0) {
                            self.load(data.items[0].url, data.items[0].text);
                        } else if (data.items.length > 0 || data.buttons.length > 0) {
                            self.build(data, title, url);
                        } else {
                            self.empty('В этой папке пока пусто.');
                        }
                    }, function (err) {
                        Lampa.Loading.hide();
                        // Ротация прокси при ошибке
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        Lampa.Storage.set('fx_prestige_proxy_idx', currentProxyIdx.toString());
                        self.empty('Ошибка сети. Прокси переключен, попробуйте еще раз.');
                    }, false, { dataType: 'text', timeout: 15000 });
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
                    container.empty();
                    items = [];
                    active_item = 0;

                    // Блок "Последнее просмотренное"
                    var last_view = Lampa.Storage.get('fx_last_view_' + object.movie.id, false);
                    if (last_view) {
                        var watched = Lampa.Template.get('fx_watched_bar', { text: 'Вы остановились на: ' + last_view.name });
                        container.append(watched);
                    }

                    // Кнопки перевода
                    if (data.buttons.length > 0) {
                        var b_cont = $('<div class="fx-voice-buttons"></div>');
                        data.buttons.forEach(function(b) {
                            var btn = $('<div class="fx-voice-btn selector">' + b.text + '</div>');
                            btn.on('hover:enter', function() { self.load(b.url, title); });
                            b_cont.append(btn);
                            items.push(btn);
                        });
                        container.append(b_cont);
                    }

                    // Кнопка Назад
                    if (history.length > 0) {
                        var back = $('<div class="online-fx-item selector" style="padding:1em; margin-bottom:10px; background:rgba(255,255,255,0.05); border-radius:0.5em; display:flex; align-items:center; gap:15px;">' +
                            '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg><span>Назад</span></div>');
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
                        var info_text = isFile ? 'Видеофайл' : 'Папка / Сезон';
                        var quality = '';
                        if (isFile && jd.quality) {
                            var q = typeof jd.quality === 'object' ? Object.keys(jd.quality)[0] : jd.quality;
                            quality = '<span style="background:#3b82f6; padding:2px 6px; border-radius:4px; font-size:10px;">' + q + '</span>';
                        }

                        var item = Lampa.Template.get('fx_prestige_item', { 
                            title: jd.text, 
                            info: info_text,
                            badge: quality
                        });

                        // Загрузка постера (backdrop)
                        var img = item.find('img')[0];
                        if (object.movie.backdrop_path) {
                            img.src = Lampa.TMDB.image('t/p/w300' + object.movie.backdrop_path);
                            img.onload = function() { $(img).parent().addClass('online-prestige__img--loaded'); };
                        } else {
                            $(img).parent().hide();
                        }

                        // Прогресс и отметка "Просмотрено"
                        var hash = Lampa.Utils.hash(object.movie.id + jd.text);
                        var viewed = Lampa.Storage.cache('online_view', 5000, []);
                        if (viewed.indexOf(hash) !== -1) {
                            item.find('.online-prestige__body').append('<div class="online-prestige__viewed" style="top:10px; right:10px; position:absolute;"><svg width="18" height="18" viewBox="0 0 24 24" fill="#3b82f6"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></div>');
                        }

                        item.on('hover:enter', function () {
                            if (!isFile) {
                                history.push({ url: url, title: title });
                                self.load(jd.url, jd.text);
                            } else {
                                // Пометка просмотренного
                                if (viewed.indexOf(hash) === -1) {
                                    viewed.push(hash);
                                    Lampa.Storage.set('online_view', viewed);
                                }
                                Lampa.Storage.set('fx_last_view_' + object.movie.id, { name: jd.text, url: jd.url });
                                
                                self.play(jd, data.items);
                            }
                        }).on('hover:focus', function (e) {
                            active_item = items.indexOf(item);
                            scroll.update($(e.target), true);
                        }).on('hover:long', function() {
                            // Контекстное меню как в SHARA
                            Lampa.Select.show({
                                title: jd.text,
                                items: [
                                    { title: 'Сбросить отметку просмотра', action: 'clear_mark' },
                                    { title: 'Очистить историю для этого фильма', action: 'clear_history' }
                                ],
                                onSelect: function(a) {
                                    if (a.action === 'clear_mark') {
                                        Lampa.Arrays.remove(viewed, hash);
                                        Lampa.Storage.set('online_view', viewed);
                                        Lampa.Noty.show('Отметка удалена');
                                    }
                                    if (a.action === 'clear_history') {
                                        Lampa.Storage.remove('fx_last_view_' + object.movie.id);
                                        Lampa.Noty.show('История очищена');
                                    }
                                }
                            });
                        });

                        container.append(item);
                        items.push(item);
                    });

                    this.start();
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
                    container.empty().append('<div class="selector" style="padding:60px; text-align:center; opacity:0.6;">' + msg + '</div>');
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