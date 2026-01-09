(function () {
    'use strict';

    var VERSION = '1.2.7';
    var PROXIES = [
        'https://cors.lampa.stream/',
        'https://cors.kp556.workers.dev:8443/',
        'https://cors.byskaz.ru/',
        'https://corsproxy.io/?'
    ];
    var currentProxyIdx = 0;
    
    console.log('Filmix Ultra v' + VERSION + ' - Safe JSON Parser Enabled');

    function FilmixComponent(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Explorer(object);
        var container = $('<div class="fx-ultra-list"></div>');
        var items = [];
        var active_item = 0;

        this.create = function () {
            var self = this;
            files.appendFiles(scroll.render());
            scroll.append(container);
            this.load();
            return files.render();
        };

        // Безопасный парсинг JSON с удалением мусора
        function safeParse(str) {
            if (typeof str === 'object') return str;
            try {
                // Удаляем BOM и невидимые символы в начале/конце
                var clean = str.replace(/^\ufeff/g, '').trim();
                return JSON.parse(clean);
            } catch(e) {
                console.error('Filmix Ultra: SafeParse failed', e, str.substring(0, 100));
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
                    title: 'Filmix Ultra',
                    items: [{ title: 'Прокси: ' + displayProxy + ' (v' + VERSION + ')', wait: true }],
                    onBack: function() { 
                        network.clear(); 
                        Lampa.Activity.backward();
                    }
                });
            }

            // Используем native с явным указанием dataType: text
            network.native(proxyUrl + targetUrl, function (res) {
                if (Lampa.Select) Lampa.Select.close();
                
                var data = safeParse(res);
                
                // Если прокси (например, AllOrigins) оборачивает ответ в .contents
                if (data && data.contents) data = safeParse(data.contents);

                if (data && (data.links || data.url)) {
                    self.build(data);
                } else {
                    console.warn('Filmix Ultra: No links in data', data);
                    self.retryOrError('Данные не найдены');
                }
            }, function (err) {
                console.error('Filmix Ultra: Network error on ' + displayProxy, err);
                self.retryOrError('Ошибка сети');
            }, false, { 
                dataType: 'text', // Критически важно для обхода внутренней ошибки Lampa
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
        };

        this.retryOrError = function(msg) {
            if (currentProxyIdx < PROXIES.length - 1) {
                currentProxyIdx++;
                console.log('Filmix Ultra: Switching to next proxy index ' + currentProxyIdx);
                this.load();
            } else {
                if (Lampa.Select) Lampa.Select.close();
                this.empty('Ошибка: ' + msg + '. Все прокси были опрошены.');
            }
        };

        this.build = function (data) {
            var self = this;
            container.empty();
            items = [];
            
            var links = (data.links && data.links.length) ? data.links : [];
            if (links.length === 0 && data.url) {
                links.push({name: 'Прямой поток', quality: '720p', url: data.url});
            }
            
            if (links.length === 0) return this.empty('Видео не найдено');

            links.forEach(function(l, i) {
                var item = $(`
                    <div class="online-fx-item selector" style="padding:1.1em; margin:0.4em 0; background:rgba(255,255,255,0.05); border-radius:0.4em; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:1.2em; overflow:hidden; text-overflow:ellipsis;">${l.name}</span>
                        <b style="background:#ff9800; color:#000; padding:0.1em 0.5em; border-radius:0.2em; font-size:0.9em; flex-shrink:0;">${l.quality || 'Auto'}</b>
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
            var errorBtn = $(`<div class="selector" style="padding:2em; text-align:center; color:#ff9800;">${msg}<br><br><small style="color:#fff; opacity:0.5">Нажмите ОК для возврата</small></div>`);
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

    Lampa.Component.add('fx_ultra_v7', FilmixComponent);

    function injectButton(event) {
        $('.fx-ultra-native').remove();
        var movie = event.data.movie;
        var render = event.object.activity.render();
        
        var btn = $(`
            <div class="full-start__button selector view--online fx-ultra-native" data-subtitle="v${VERSION}">
                <svg width="135" height="147" viewBox="0 0 135 147" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M121.5 96.8823C139.5 86.49 139.5 60.5092 121.5 50.1169L41.25 3.78454C23.25 -6.60776 0.750004 6.38265 0.750001 27.1673L0.75 51.9742C4.70314 35.7475 23.6209 26.8138 39.0547 35.7701L94.8534 68.1505C110.252 77.0864 111.909 97.8693 99.8725 109.369L121.5 96.8823Z" fill="currentColor"/>
                </svg>
                <span>Filmix Ultra</span>
            </div>
        `);

        btn.on('hover:enter', function() {
            Lampa.Activity.push({
                url: '',
                title: 'Онлайн - Filmix',
                component: 'fx_ultra_v7',
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