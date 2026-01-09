(function () {
    'use strict';

    var VERSION = '1.2.5';
    // Список прокси, оптимизированных для Lampa
    var PROXIES = [
        'https://cors.lampa.stream/',
        'https://cors.byskaz.ru/',
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest='
    ];
    var currentProxyIdx = 0;
    
    console.log('Filmix Ultra v' + VERSION + ' - Initializing with Lampa Proxies...');

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

        this.load = function() {
            var self = this;
            var targetUrl = 'http://showypro.com/lite/fxapi?rjson=False&postid=' + object.movie.id + '&s=1&uid=i8nqb9vw&showy_token=f8377057-90eb-4d76-93c9-7605952a096l';
            
            if (Lampa.Select) {
                Lampa.Select.show({
                    title: 'Filmix Ultra',
                    items: [{ title: 'Прокси: ' + (PROXIES[currentProxyIdx].split('/')[2]) + '...', wait: true }],
                    onBack: function() { 
                        network.clear(); 
                        Lampa.Activity.backward();
                    }
                });
            }

            // Формируем URL запроса. Для большинства Lampa прокси это просто префикс.
            var reqUrl = PROXIES[currentProxyIdx] + targetUrl;

            network.silent(reqUrl, function (res) {
                if (Lampa.Select) Lampa.Select.close();
                try {
                    var json;
                    if (typeof res === 'string') {
                        // Если прокси вернул строку (иногда бывает двойная сериализация)
                        try { json = JSON.parse(res); } catch(e) { json = res; }
                    } else {
                        json = res;
                    }

                    // Обработка оберток типа AllOrigins
                    var content = json.contents || json;
                    if (typeof content === 'string' && content.indexOf('{') !== -1) {
                        content = JSON.parse(content);
                    }
                    
                    if (content && (content.links || content.url)) {
                        self.build(content);
                    } else {
                        console.error('Filmix Ultra: Invalid content structure', content);
                        self.retryOrError('Данные не найдены');
                    }
                } catch(e) { 
                    console.error('Filmix Ultra: Parse error', e);
                    self.retryOrError('Ошибка обработки'); 
                }
            }, function () {
                self.retryOrError('Ошибка сети');
            });
        };

        this.retryOrError = function(msg) {
            if (currentProxyIdx < PROXIES.length - 1) {
                currentProxyIdx++;
                console.log('Filmix Ultra: Switch to proxy ' + PROXIES[currentProxyIdx]);
                this.load();
            } else {
                if (Lampa.Select) Lampa.Select.close();
                this.empty(msg + '. Все прокси недоступны.');
            }
        };

        this.build = function (data) {
            var self = this;
            container.empty();
            items = [];
            
            var links = (data && data.links && data.links.length) ? data.links : [];
            
            // Если массив пустой, но есть одиночная ссылка (некоторые API так отдают)
            if (links.length === 0 && data.url) {
                links.push({name: 'Прямой поток (SD)', quality: '720p', url: data.url});
            }
            
            if (links.length === 0) return this.empty('Потоки не найдены');

            links.forEach(function(l, i) {
                if (!l.url) return;
                var item = $(`
                    <div class="online-fx-item selector" style="padding:1.2em; margin:0.5em 0; background:rgba(255,255,255,0.05); border-radius:0.3em; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:1.3em; pointer-events:none;">${l.name}</span>
                        <b style="background:#ff9800; color:#fff; padding:0.2em 0.6em; border-radius:0.2em; font-size:1em; pointer-events:none;">${l.quality || 'Auto'}</b>
                    </div>
                `);

                item.on('hover:enter', function() {
                    Lampa.Player.play({ 
                        url: l.url.replace('http://', 'https://'), 
                        title: object.movie.title || object.movie.name 
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
            var errorBtn = $(`<div class="selector" style="padding:2em; text-align:center; color:#ff9800;">${msg}<br><br><small style="color:#fff; opacity:0.5">Нажмите "Назад" для выхода</small></div>`);
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

    Lampa.Component.add('fx_ultra_v5', FilmixComponent);

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
                title: 'Онлайн - Filmix',
                component: 'fx_ultra_v5',
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

    console.log('Filmix Ultra v' + VERSION + ' - Ready');
})();