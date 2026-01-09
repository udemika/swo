(function () {
    'use strict';

    var VERSION = '1.2.3';
    // Используем несколько прокси для надежности
    var PROXIES = [
        'https://api.allorigins.win/get?url=',
        'https://corsproxy.io/?'
    ];
    var currentProxyIdx = 0;
    
    console.log('Filmix Ultra v' + VERSION + ' - Initializing...');

    function FilmixComponent(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Explorer(object);
        var container = $('<div class="fx-ultra-list"></div>');
        var items = [];
        var active_item = 0;

        this.create = function () {
            var self = this;
            
            // Настройка скролла
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
                    items: [{ title: 'Загрузка потоков...', wait: true }],
                    onBack: function() { 
                        network.clear(); 
                        Lampa.Activity.backward();
                    }
                });
            }

            var reqUrl = PROXIES[currentProxyIdx] + encodeURIComponent(targetUrl);

            network.silent(reqUrl, function (res) {
                if (Lampa.Select) Lampa.Select.close();
                try {
                    // Обработка разных форматов ответа прокси
                    var json = typeof res === 'string' ? JSON.parse(res) : res;
                    var content = json.contents || json;
                    if (typeof content === 'string') content = JSON.parse(content);
                    
                    self.build(content);
                } catch(e) { 
                    console.error('Filmix Ultra: JSON Error', e);
                    self.empty('Ошибка данных'); 
                }
            }, function () {
                // Если первый прокси упал, пробуем второй (однократно)
                if (currentProxyIdx === 0) {
                    currentProxyIdx = 1;
                    self.load();
                } else {
                    if (Lampa.Select) Lampa.Select.close();
                    self.empty('Ошибка сети (CORS)');
                }
            });
        };

        this.build = function (data) {
            var self = this;
            container.empty();
            items = [];
            
            var links = (data && data.links && data.links.length) ? data.links : [
                {name: 'Авто-поток 720p', quality: '720p', url: 'https://showypro.com/get_video?id='+object.movie.id+'&q=720&uid=i8nqb9vw'}
            ];
            
            links.forEach(function(l, i) {
                var item = $(`
                    <div class="online-fx-item selector" style="padding:1.2em; margin:0.5em 0; background:rgba(255,255,255,0.05); border-radius:0.3em; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:1.3em; pointer-events:none;">${l.name}</span>
                        <b style="background:#ff9800; color:#fff; padding:0.2em 0.6em; border-radius:0.2em; font-size:1em; pointer-events:none;">${l.quality}</b>
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
            Lampa.Noty.show(msg || 'Потоки не найдены');
            Lampa.Activity.backward();
        };

        // ОБЯЗАТЕЛЬНЫЙ МЕТОД ДЛЯ LAMPA
        this.start = function () {
            Lampa.Controller.add('fx_ultra_ctrl', {
                toggle: function () {
                    Lampa.Controller.collectionSet(container);
                    Lampa.Controller.collectionFocus(items[active_item] ? items[active_item][0] : false, container);
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

    // Регистрация компонента
    Lampa.Component.add('fx_ultra_v3', FilmixComponent);

    var buttonHTML = `
        <div class="full-start__button selector view--online fx-ultra-native" data-subtitle="Ultra v${VERSION}">
            <svg width="135" height="147" viewBox="0 0 135 147" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M121.5 96.8823C139.5 86.49 139.5 60.5092 121.5 50.1169L41.25 3.78454C23.25 -6.60776 0.750004 6.38265 0.750001 27.1673L0.75 51.9742C4.70314 35.7475 23.6209 26.8138 39.0547 35.7701L94.8534 68.1505C110.252 77.0864 111.909 97.8693 99.8725 109.369L121.5 96.8823Z" fill="currentColor"/>
                <path d="M63 84.9836C80.3333 94.991 80.3333 120.01 63 130.017L39.75 143.44C22.4167 153.448 0.749999 140.938 0.75 120.924L0.750001 94.0769C0.750002 74.0621 22.4167 61.5528 39.75 71.5602L63 84.9836Z" fill="currentColor"/>
            </svg>
            <span>Онлайн</span>
        </div>
    `;

    function injectButton(event) {
        $('.fx-ultra-native').remove();
        var movie = event.data.movie;
        var render = event.object.activity.render();
        var btn = $(buttonHTML);

        btn.on('hover:enter', function() {
            Lampa.Activity.push({
                url: '',
                title: 'Онлайн - Filmix',
                component: 'fx_ultra_v3',
                movie: movie,
                page: 1
            });
        });

        var torrentBtn = render.find('.view--torrent');
        if (torrentBtn.length) {
            torrentBtn.after(btn);
        } else {
            var container = render.find('.full-start__buttons, .full-movie__buttons, .buttons-list').first();
            if (container.length) container.append(btn);
        }
    }

    Lampa.Listener.follow('full', function (e) {
        if (e.type == 'complete' || e.type == 'complite') {
            injectButton(e);
        }
    });

    console.log('Filmix Ultra v' + VERSION + ' - Ready');
})();