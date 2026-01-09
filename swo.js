(function () {
    (function () {
        'use strict';

        var VERSION = '1.6.3';
        var PLUGIN_NAME = 'Filmix Direct';

        function startPlugin() {
            if (window.filmix_direct_loaded) return;
            window.filmix_direct_loaded = true;

            // Первый элемент пустой - для прямого запроса
            var PROXIES = [
                '', 
                'https://cors.lampa.stream/',
                'https://cors.kp556.workers.dev:8443/',
                'https://cors.byskaz.ru/',
                'https://corsproxy.io/?'
            ];

            var savedIdx = Lampa.Storage.get('fx_ultra_proxy_idx', '0');
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

            $('<style>.fx-item-folder { color: #f59e0b !important; } .fx-item-file { color: #fff !important; } .fx-badge { background: #00d2ff; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }</style>').appendTo('head');

            Lampa.Template.add('fx_nexus_button', '<div class="full-start__button selector view--online fx-ultra-native" data-subtitle="' + PLUGIN_NAME + ' v' + VERSION + '"><span>Онлайн</span></div>');
            Lampa.Template.add('fx_nexus_item', '<div class="online-fx-item selector" style="padding:1.1em; margin:0.4em 0; background:rgba(255,255,255,0.05); border-radius:0.4em; display:flex; justify-content:space-between; align-items:center;">' +
                '<div style="display:flex; align-items:center; gap:12px;">{icon}<span style="font-size:1.1em;">{name}</span></div>' +
                '<div style="display:flex; gap:8px; align-items:center;">{badge}</div>' +
            '</div>');

            function FilmixComponent(object) {
                var network = new (Lampa.Request || Lampa.Reguest)();
                var scroll = new Lampa.Scroll({ mask: true, over: true });
                var files = new Lampa.Explorer(object);
                var container = $('<div class="fx-ultra-list" style="padding-bottom: 50px;"></div>');
                var history = [];
                var items = [];
                var active_item = 0;
                var retry_count = 0;

                this.create = function () {
                    files.appendFiles(scroll.render());
                    scroll.append(container);
                    var startUrl = 'http://showypro.com/lite/fxapi?rjson=False&postid=' + object.movie.id + '&s=1&uid=i8nqb9vw&showy_token=f8377057-90eb-4d76-93c9-7605952a096l';
                    this.load(startUrl, object.movie.title || 'Главная');
                    return files.render();
                };

                function extractItems(res) {
                    var found = [];
                    if (!res || typeof res !== 'string') return found;
                    var wrapper = $('<div>').append(res);
                    
                    wrapper.find('[data-json]').each(function () {
                        try {
                            var jd = JSON.parse($(this).attr('data-json'));
                            var name = $(this).find('.videos__item-title').text() || $(this).text() || jd.title || 'Элемент';
                            name = name.trim();
                            
                            var type = (jd.method === 'play') ? 'file' : 'folder';
                            var badgeText = '';
                            var icon = type === 'folder' ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="#00d2ff"><path d="M8 5v14l11-7z"/></svg>';

                            if (type === 'file') {
                                if (jd.quality) {
                                    if (typeof jd.quality === 'object') badgeText = Object.keys(jd.quality)[0];
                                    else badgeText = jd.quality;
                                }
                            } else {
                                badgeText = 'Папка';
                            }

                            found.push({
                                name: name,
                                url: jd.url,
                                jd: jd,
                                type: type,
                                icon: icon,
                                badge: badgeText ? '<span class="fx-badge" style="'+(type==='folder'?'background:#f59e0b':'')+'">'+badgeText+'</span>' : ''
                            });
                        } catch (e) {}
                    });
                    return found;
                }

                this.load = function (url, title) {
                    var self = this;
                    var proxyUrl = PROXIES[currentProxyIdx];
                    loader.show();

                    console.log('Filmix', 'Trying: ' + (proxyUrl || 'DIRECT') + url);

                    network.native(proxyUrl + url, function (res) {
                        loader.hide();
                        retry_count = 0;
                        Lampa.Storage.set('fx_ultra_proxy_idx', currentProxyIdx.toString());
                        var list = extractItems(res);
                        if (list.length > 0) {
                            self.build(list, title, url);
                        } else {
                            self.empty('Раздел пуст. Проверьте подписку или доступ.');
                        }
                    }, function (err) {
                        // Ошибка запроса (таймаут, CORS, 503, 404)
                        console.log('Filmix', 'Error on: ' + (proxyUrl || 'DIRECT') + '. Status: ' + err.status);
                        
                        retry_count++;
                        if (retry_count < PROXIES.length) {
                            // Переключаем на следующий прокси
                            currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                            self.load(url, title);
                        } else {
                            loader.hide();
                            retry_count = 0;
                            self.empty('Все методы (Direct + Proxies) не дали результата. Сервер ShowyPro недоступен.');
                        }
                    }, false, { dataType: 'text', timeout: 6000 });
                };

                this.build = function (list, title, url) {
                    var self = this;
                    container.empty();
                    items = [];
                    active_item = 0;

                    container.append('<div style="padding:10px 15px; background:rgba(255,255,255,0.03); margin-bottom:10px; border-radius:8px; border-left:4px solid #00d2ff;"><span style="opacity:0.6; font-size:12px; text-transform:uppercase; display:block;">'+(PROXIES[currentProxyIdx] ? 'Через прокси' : 'Прямое соединение')+'</span><span style="font-weight:bold; color:#fff;">' + title + '</span></div>');

                    if (history.length > 0) {
                        var back = Lampa.Template.get('fx_nexus_item', { name: '.. Назад', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>', badge: '' });
                        back.on('hover:enter', function () {
                            var prev = history.pop();
                            self.load(prev.url, prev.title);
                        });
                        container.append(back);
                        items.push(back);
                    }

                    list.forEach(function (l) {
                        var item = Lampa.Template.get('fx_nexus_item', l);
                        item.addClass(l.type === 'folder' ? 'fx-item-folder' : 'fx-item-file');
                        
                        item.on('hover:enter', function () {
                            if (l.type === 'folder') {
                                history.push({ url: url, title: title });
                                self.load(l.url, l.name);
                            } else {
                                self.selectQuality(l);
                            }
                        }).on('hover:focus', function (e) {
                            active_item = items.indexOf(item);
                            scroll.update($(e.target), true);
                        });

                        container.append(item);
                        items.push(item);
                    });
                    this.start();
                };

                this.selectQuality = function (item) {
                    var qualities = [];
                    if (item.jd.quality && typeof item.jd.quality === 'object') {
                        for (var q in item.jd.quality) {
                            qualities.push({ title: q, url: item.jd.quality[q] });
                        }
                    } else {
                        qualities.push({ title: 'Stream', url: item.url });
                    }

                    Lampa.Select.show({
                        title: 'Качество: ' + item.name,
                        items: qualities,
                        onSelect: function (q) {
                            Lampa.Player.play({
                                url: q.url.replace('http://', 'https://'),
                                title: (object.movie.title || object.movie.name) + ' - ' + item.name + ' [' + q.title + ']'
                            });
                        }
                    });
                };

                this.empty = function (msg) {
                    container.empty();
                    var errorBtn = $('<div class="selector" style="padding:2em; text-align:center; color:#00d2ff;">' + msg + ' <br><br><span style="font-size:0.8em; opacity:0.6; background:rgba(255,255,255,0.1); padding:0.5em 1em; border-radius:4px;">Нажмите для возврата</span></div>');
                    errorBtn.on('hover:enter', function () { Lampa.Activity.backward(); });
                    container.append(errorBtn);
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
                            if (history.length > 0) {
                                var prev = history.pop();
                                this.load(prev.url, prev.title);
                            } else Lampa.Activity.backward(); 
                        }.bind(this)
                    });
                    Lampa.Controller.enable('fx_nexus_ctrl');
                };

                this.render = function () { return files.render(); };
                this.pause = function () { };
                this.stop = function () { };
                this.destroy = function () { network.clear(); scroll.destroy(); files.destroy(); container.remove(); };
            }

            Lampa.Component.add('fx_ultra_v8', FilmixComponent);

            function injectButton(render, movie) {
                if (render.find('.fx-ultra-native').length) return;
                var btn = Lampa.Template.get('fx_nexus_button');
                btn.on('hover:enter', function () {
                    Lampa.Activity.push({ url: '', title: PLUGIN_NAME, component: 'fx_ultra_v8', movie: movie, page: 1 });
                });
                var target = render.find('.view--torrent');
                if (!target.length) target = render.find('.full-start__buttons');
                if (target.length) {
                    if (target.hasClass('view--torrent')) target.after(btn);
                    else target.append(btn);
                }
            }

            Lampa.Listener.follow('full', function (e) {
                if (e.type == 'complete' || e.type == 'complite') injectButton(e.object.activity.render(), e.data.movie);
            });
            var checkInterval = setInterval(function() {
                try {
                    var active = Lampa.Activity.active();
                    if (active && active.component == 'full') injectButton(active.activity.render(), active.movie);
                } catch(e) {}
            }, 1000);
            setTimeout(function() { clearInterval(checkInterval); }, 10000);
        }

        if (typeof Lampa !== 'undefined') startPlugin();
    })();
})();