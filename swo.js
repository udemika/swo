(function () {
    'use strict';

    var VERSION = '1.2.2';
    var PROXY = 'https://api.allorigins.win/get?url=';
    
    console.log('Filmix Ultra Injector v' + VERSION + ' - Initializing...');

    // 1. Сначала регистрируем компонент в системе Lampa
    function FilmixComponent(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Explorer(object);

        this.create = function () {
            var self = this;
            files.appendFiles(scroll.render());
            
            var target = 'http://showypro.com/lite/fxapi?rjson=False&postid=' + object.movie.id + '&s=1&uid=i8nqb9vw&showy_token=f8377057-90eb-4d76-93c9-7605952a096l';
            
            // Открываем селект для визуализации процесса
            if (Lampa.Select) {
                Lampa.Select.show({
                    title: 'Filmix Ultra',
                    items: [{ title: 'Поиск потоков...', wait: true }],
                    onBack: function() { 
                        network.clear(); 
                        Lampa.Activity.backward();
                    }
                });
            }

            network.silent(PROXY + encodeURIComponent(target), function (res) {
                if (Lampa.Select) Lampa.Select.close();
                try {
                    var data = JSON.parse(res.contents);
                    self.build(data);
                } catch(e) { 
                    console.error('Filmix Ultra: Parse Error', e);
                    self.empty(); 
                }
            }, function () {
                if (Lampa.Select) Lampa.Select.close();
                self.empty();
            });

            return files.render();
        };

        this.build = function (data) {
            scroll.clear();
            var links = (data && data.links && data.links.length) ? data.links : [{name: 'Авто-поток 720p', quality: '720p', url: 'https://showypro.com/get_video?id='+object.movie.id+'&q=720&uid=i8nqb9vw'}];
            
            links.forEach(function(l) {
                var item = $(`
                    <div class="online-fx-item selector" style="padding:1.2em; margin:0.5em 0; background:rgba(255,255,255,0.05); border-radius:0.3em; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:1.3em;">${l.name}</span>
                        <b style="background:#ff9800; color:#fff; padding:0.2em 0.6em; border-radius:0.2em; font-size:1em;">${l.quality}</b>
                    </div>
                `);

                item.on('hover:enter', function() {
                    Lampa.Player.play({ 
                        url: l.url.replace('http://', 'https://'), 
                        title: object.movie.title || object.movie.name 
                    });
                }).on('hover:focus', function(e) {
                    scroll.update($(e.target), true);
                });
                scroll.append(item);
            });

            Lampa.Controller.enable('content');
        };

        this.empty = function () { 
            Lampa.Noty.show('Потоки не найдены');
            Lampa.Activity.backward();
        };

        this.render = function() { return files.render(); };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { 
            network.clear(); 
            scroll.destroy(); 
            files.destroy();
        };
    }

    // Регистрация компонента СТРОГО до его вызова
    Lampa.Component.add('fx_ultra_v2', FilmixComponent);

    // 2. Логика инжекции кнопки
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
            console.log('Filmix Ultra: Button clicked, launching activity...');
            try {
                Lampa.Activity.push({
                    url: '',
                    title: 'Онлайн - Filmix',
                    component: 'fx_ultra_v2',
                    movie: movie,
                    page: 1
                });
            } catch(e) {
                console.error('Filmix Ultra: Activity push failed', e);
                Lampa.Noty.show('Ошибка запуска компонента');
            }
        });

        // Вставка после кнопки торрентов
        var torrentBtn = render.find('.view--torrent');
        if (torrentBtn.length) {
            torrentBtn.after(btn);
        } else {
            var container = render.find('.full-start__buttons, .full-movie__buttons, .buttons-list').first();
            if (container.length) container.append(btn);
        }
    }

    // Слушатель событий карточки
    Lampa.Listener.follow('full', function (e) {
        if (e.type == 'complete' || e.type == 'complite') {
            injectButton(e);
        }
    });

    console.log('Filmix Ultra v' + VERSION + ' - Ready');
})();