(function () {
    (function () {
        'use strict';

        var VERSION = '1.7.1';
        var PLUGIN_NAME = 'Filmix Focus';

        function startPlugin() {
            if (window.filmix_nexus_loaded_v171) return;
            window.filmix_nexus_loaded_v171 = true;

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

            var savedIdx = Lampa.Storage.get('fx_nexus_proxy_idx', '0');
            var currentProxyIdx = parseInt(savedIdx);
            if (isNaN(currentProxyIdx) || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

            var loader = {
                show: function() {
                    try {
                        if (Lampa.Loading && typeof Lampa.Loading.show === 'function') Lampa.Loading.show();
                        else if (Lampa.Loading && typeof Lampa.Loading.start === 'function') Lampa.Loading.start();
                    } catch(e) {}
                },
                hide: function() {
                    try {
                        if (Lampa.Loading && typeof Lampa.Loading.hide === 'function') Lampa.Loading.hide();
                        else if (Lampa.Loading && typeof Lampa.Loading.stop === 'function') Lampa.Loading.stop();
                    } catch(e) {}
                }
            };

            $('<style>.fx-badge { background: #10b981; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; } .fx-nexus-status { padding: 12px; background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; margin-bottom: 15px; border-radius: 6px; } .online-fx-item.focus { background: rgba(255,255,255,0.15) !important; border: 1px solid #10b981; }</style>').appendTo('head');

            Lampa.Template.add('fx_nexus_button', '<div class="full-start__button selector view--online fx-nexus-native" data-subtitle="' + PLUGIN_NAME + ' v' + VERSION + '"><span>Онлайн</span></div>');
            Lampa.Template.add('fx_nexus_item', '<div class="online-fx-item selector" style="padding:1.2em; margin:0.5em 0; background:rgba(255,255,255,0.05); border-radius:0.5em; display:flex; justify-content:space-between; align-items:center;">' +
                '<div style="display:flex; align-items:center; gap:14px;">{icon}<span style="font-size:1.15em;">{name}</span></div>' +
                '<div style="display:flex; gap:10px; align-items:center;">{badge}</div>' +
            '</div>');

            function FilmixComponent(object) {
                var network = new (Lampa.Request || Lampa.Reguest)();
                var scroll = new Lampa.Scroll({ mask: true, over: true });
                var files = new Lampa.Explorer(object);
                var container = $('<div class="fx-nexus-list" style="padding-bottom: 100px; min-height: 100%;"></div>');
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

                function extractItems(res) {
                    var found = [];
                    if (!res || typeof res !== 'string') return found;
                    try {
                        var wrapper = $('<div>').append(res);
                        wrapper.find('[data-json]').each(function () {
                            try {
                                var jd = JSON.parse($(this).attr('data-json'));
                                var name = $(this).find('.videos__item-title').text() || $(this).text() || jd.title || 'Элемент';
                                name = name.trim();
                                
                                var type = (jd.method === 'play' || (jd.url && (jd.url.indexOf('.mp4') !== -1 || jd.url.indexOf('.m3u8') !== -1))) ? 'file' : 'folder';
                                var badgeText = '';
                                var iconColor = type === 'folder' ? '#f59e0b' : '#10b981';
                                var icon = type === 'folder' ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="'+iconColor+'"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="'+iconColor+'"><path d="M8 5v14l11-7z"/></svg>';

                                if (type === 'file') {
                                    if (jd.quality) {
                                        if (typeof jd.quality === 'object') badgeText = Object.keys(jd.quality)[0];
                                        else badgeText = jd.quality;
                                    }
                                } else badgeText = 'Папка';

                                found.push({ name: name, url: jd.url, jd: jd, type: type, icon: icon, badge: badgeText ? '<span class="fx-badge">'+badgeText+'</span>' : '' });
                            } catch (e) {}
                        });
                    } catch (e) {}
                    return found;
                }

                this.load = function (url, title) {
                    var self = this;
                    if (url.indexOf('http') !== 0) url = BASE_DOMAIN + (url.indexOf('/') === 0 ? '' : '/') + url;
                    if (url.indexOf('showy_token') === -1) url += (url.indexOf('?') === -1 ? '?' : '&') + 'uid=' + WORKING_UID + '&showy_token=' + WORKING_TOKEN + '&rchtype=cors';

                    var proxyUrl = PROXIES[currentProxyIdx];
                    var finalUrl = proxyUrl + url;
                    if (proxyUrl.includes('allorigins')) finalUrl = proxyUrl + encodeURIComponent(url);

                    loader.show();
                    network.native(finalUrl, function (res) {
                        loader.hide();
                        retry_count = 0;
                        Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                        
                        var list = extractItems(res);
                        if (list.length > 0) self.build(list, title, url);
                        else self.empty('Список пуст. Сервер не вернул контент для данного раздела.');
                    }, function (err) {
                        retry_count++;
                        if (retry_count < PROXIES.length) {
                            currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                            self.load(url, title);
                        } else {
                            loader.hide();
                            retry_count = 0;
                            self.empty('Ошибка 503: Не удалось получить ответ от Filmix. Проверьте прокси или KP-ID.');
                        }
                    }, false, { dataType: 'text', timeout: 12000 });
                };

                this.build = function (list, title, url) {
                    var self = this;
                    container.empty();
                    items = [];
                    active_item = 0;

                    var info = $('<div class="fx-nexus-status">' +
                        '<div style="font-size:10px; opacity:0.7; text-transform:uppercase; font-weight:bold;">Focus Engine v1.7.1</div>' +
                        '<div style="font-weight:bold; margin-top:2px; font-size:1.2em;">' + title + '</div>' +
                    '</div>');
                    container.append(info);

                    if (history.length > 0) {
                        var back = Lampa.Template.get('fx_nexus_item', { name: '.. Назад', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>', badge: '' });
                        back.on('hover:enter', function () {
                            var prev = history.pop();
                            self.load(prev.url, prev.title);
                        });
                        container.append(back);
                        items.push(back);
                    }

                    list.forEach(function (l) {
                        var item = Lampa.Template.get('fx_nexus_item', l);
                        item.on('hover:enter', function () {
                            if (l.type === 'folder') {
                                history.push({ url: url, title: title });
                                self.load(l.url, l.name);
                            } else self.selectQuality(l);
                        }).on('hover:focus', function (e) {
                            active_item = items.indexOf(item);
                            scroll.update($(e.target), true);
                        });
                        container.append(item);
                        items.push(item);
                    });

                    // Критический фикс для динамического контента:
                    this.start();
                    setTimeout(function() {
                        if (scroll.update) scroll.update();
                        scroll.scrollTo(0); // Всегда в начало при смене папки
                    }, 50);
                };

                this.selectQuality = function (item) {
                    var qualities = [];
                    if (item.jd.quality && typeof item.jd.quality === 'object') {
                        for (var q in item.jd.quality) qualities.push({ title: q, url: item.jd.quality[q] });
                    } else qualities.push({ title: 'Смотреть', url: item.url });

                    Lampa.Select.show({
                        title: item.name,
                        items: qualities,
                        onSelect: function (q) {
                            Lampa.Player.play({
                                url: q.url.replace('http://', 'https://'), 
                                title: object.movie.title + ' - ' + item.name
                            });
                        }
                    });
                };

                this.empty = function (msg) {
                    container.empty();
                    var err = $('<div class="selector" style="padding:40px; text-align:center; background:rgba(255,255,255,0.03); border-radius:15px; border:1px solid #10b981; margin:10px;">' +
                        '<div style="color:#10b981; font-weight:bold; margin-bottom:10px; font-size:1.2em;">SYSTEM STATUS</div>' +
                        '<div style="font-size:1em; opacity:0.8; line-height:1.4;">' + msg + '</div>' +
                    '</div>');
                    err.on('hover:enter', function () { Lampa.Activity.backward(); });
                    container.append(err);
                    this.start();
                };

                this.start = function () {
                    Lampa.Controller.add('fx_nexus_ctrl', {
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
                    Lampa.Controller.enable('fx_nexus_ctrl');
                };

                this.render = function () { return files.render(); };
                this.pause = function () { };
                this.stop = function () { };
                this.destroy = function () { network.clear(); scroll.destroy(); files.destroy(); container.remove(); loader.hide(); };
            }

            Lampa.Component.add('fx_hybrid_v9', FilmixComponent);

            function injectButton(render, movie) {
                if (render.find('.fx-nexus-native').length) return;
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