(function () {
    'use strict';

    var VERSION = '1.2.8';
    var PROXIES = [
        'https://cors.lampa.stream/',
        'https://cors.kp556.workers.dev:8443/',
        'https://cors.byskaz.ru/',
        'https://corsproxy.io/?'
    ];
    
    var savedIdx = Lampa.Storage.get('fx_ultra_proxy_idx', '0');
    var currentProxyIdx = parseInt(savedIdx);
    if (isNaN(currentProxyIdx) || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

    function FilmixComponent(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Explorer(object);
        var container = $('<div class="fx-ultra-list"></div>');
        var items = [];
        var active_item = 0;
        var attempts = 0;

        this.create = function () {
            files.appendFiles(scroll.render());
            scroll.append(container);
            this.load();
            return files.render();
        };

        function safeParse(str) {
            if (typeof str === 'object') return str;
            if (!str || typeof str !== 'string') return null;
            try {
                if (str.trim().indexOf('<') === 0) return null;
                var clean = str.replace(/^\ufeff/g, '').trim();
                return JSON.parse(clean);
            } catch(e) {
                return null;
            }
        }

        this.load = function() {
            var self = this;
            var targetUrl = 'http://showypro.com/lite/fxapi?rjson=False&postid=' + object.movie.id + '&s=1&uid=i8nqb9vw&showy_token=f8377057-90eb-4d76-93c9-7605952a096l';
            var proxyUrl = PROXIES[currentProxyIdx];
            var displayProxy = proxyUrl.split('/')[2] || 'proxy';

            if (Lampa.Select) {
                Lampa.Select.show({
                    title: 'Filmix Ultra v' + VERSION,
                    items: [{ title: 'Подключение: ' + displayProxy, wait: true }],
                    onBack: function() { 
                        network.clear(); 
                        Lampa.Activity.backward();
                    }
                });
            }

            network.native(proxyUrl + targetUrl, function (res) {
                var data = safeParse(res);
                if (data && data.contents) data = safeParse(data.contents);

                if (data && (data.links || data.url)) {
                    if (Lampa.Select) Lampa.Select.close();
                    Lampa.Storage.set('fx_ultra_proxy_idx', currentProxyIdx.toString());
                    self.build(data);
                } else {
                    self.retryOrError();
                }
            }, function () {
                self.retryOrError();
            }, false, { 
                dataType: 'text',
                timeout: 8000
            });
        };

        this.retryOrError = function() {
            attempts++;
            if (attempts < PROXIES.length) {
                currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                this.load();
            } else {
                if (Lampa.Select) Lampa.Select.close();
                this.empty('Сервер Filmix временно недоступен или прокси заблокированы.');
            }
        };

        this.build = function (data) {
            var self = this;
            container.empty();
            items = [];
            
            var links = (data.links && data.links.length) ? data.links : [];
            if (links.length === 0 && data.url) {
                links.push({name: 'Основной поток', quality: '720p', url: data.url});
            }
            
            if (links.length === 0) return this.empty('Видео не найдено');

            links.forEach(function(l, i) {
                var item = $(`
                    <div class="online-fx-item selector" style="padding:1.1em; margin:0.4em 0; background:rgba(255,255,255,0.05); border-radius:0.4em; display:flex; justify-content:space-between; align-items:center; border: 1px solid rgba(255,255,255,0.03);">
                        <span style="font-size:1.1em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${l.name}</span>
                        <b style="background:#ff9800; color:#000; padding:0.1em 0.5em; border-radius:0.2em; font-size:0.8em; flex-shrink:0; margin-left:10px;">${l.quality || 'Auto'}</b>
                    </div>
                `);

                item.on('hover:enter', function() {
                    Lampa.Player.play({ 
                        url: l.url.replace('http://', 'https://'), 
                        title: (object.movie.title || object.movie.name) + ' - ' + l.name
                    });
                }).on('hover:focus', function(e) {
                    active_item = i;
                    scroll.update($(e.target), true);
                });
                
                container.append(item);
                items.push(item);
            });

            this.start();
        };

        this.empty = function (msg) { 
            container.empty();
            var errorBtn = $(`<div class="selector" style="padding:2em; text-align:center; color:#ff9800;">${msg}<br><br><small style="color:#fff; opacity:0.3">Нажмите OK чтобы выйти</small></div>`);
            errorBtn.on('hover:enter', function() { Lampa.Activity.backward(); });
            container.append(errorBtn);
            this.start();
        };

        this.start = function () {
            Lampa.Controller.add('fx_ultra_ctrl', {
                toggle: function () {
                    Lampa.Controller.collectionSet(container);
                    Lampa.Controller.collectionFocus(items[active_item] ? items[active_item][0] : container.find('.selector')[0], container);
                },
                up: function () {
                    if (active_item > 0) active_item--;
                    else Lampa.Controller.toggle('head');
                },
                down: function () {
                    if (active_item < items.length - 1) active_item++;
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });
            Lampa.Controller.enable('fx_ultra_ctrl');
        };

        this.render = function() { return files.render(); };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { 
            network.clear(); 
            scroll.destroy(); 
            files.destroy();
            container.remove();
        };
    }

    Lampa.Component.add('fx_ultra_v8', FilmixComponent);

    function injectButton(event) {
        $('.fx-ultra-native').remove();
        var movie = event.data.movie;
        var render = event.object.activity.render();
        
        var btn = $(`
            <div class="full-start__button selector view--online fx-ultra-native" data-subtitle="Ultra v${VERSION}">
                <svg width="135" height="147" viewBox="0 0 135 147" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M121.5 96.8823C139.5 86.49 139.5 60.5092 121.5 50.1169L41.25 3.78454C23.25 -6.60776 0.750004 6.38265 0.750001 27.1673L0.75 51.9742C4.70314 35.7475 23.6209 26.8138 39.0547 35.7701L94.8534 68.1505C110.252 77.0864 111.909 97.8693 99.8725 109.369L121.5 96.8823Z" fill="currentColor"/>
                </svg>
                <span>Онлайн</span>
            </div>
        `);

        btn.on('hover:enter', function() {
            Lampa.Activity.push({
                url: '',
                title: 'Filmix Ultra',
                component: 'fx_ultra_v8',
                movie: movie,
                page: 1
            });
        });

        var torrentBtn = render.find('.view--torrent');
        if (torrentBtn.length) torrentBtn.after(btn);
        else render.find('.full-start__buttons').append(btn);
    }

    Lampa.Listener.follow('full', function (e) {
        if (e.type == 'complete' || e.type == 'complite') injectButton(e);
    });
})();