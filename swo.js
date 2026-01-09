(function () {
    'use strict';

    var VERSION = '1.1.9';
    var PROXY = 'https://api.allorigins.win/get?url=';
    
    console.log('Filmix Hidden Injector v' + VERSION + ' started');

    // 1. Стили (сделаем кнопку максимально заметной для теста)
    var style = `
        <style>
        .fx-ultra-btn{
            background: #ff9800 !important;
            color: #fff !important;
            padding: 10px 20px;
            margin: 10px 5px;
            border-radius: 5px;
            display: inline-block;
            cursor: pointer;
            font-weight: bold;
            text-transform: uppercase;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            z-index: 999;
        }
        .fx-ultra-btn.focus{
            background: #fff !important;
            color: #000 !important;
            transform: scale(1.05);
        }
        .fx-list-item{
            background: rgba(255,255,255,0.1);
            margin: 5px 0;
            padding: 15px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
        }
        .fx-list-item.focus{
            background: #fff;
            color: #000;
        }
        </style>
    `;
    if (!$('style:contains("fx-ultra-btn")').length) $('body').append(style);

    // 2. Компонент выбора потоков
    function FilmixComponent(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true, parent: object.display });
        
        this.create = function () {
            var self = this;
            var target = 'http://showypro.com/lite/fxapi?rjson=False&postid=' + object.movie.id + '&s=1&uid=i8nqb9vw&showy_token=f8377057-90eb-4d76-93c9-7605952a096l';
            
            Lampa.Select.show({
                title: 'Filmix Streams',
                items: [{ title: 'Загрузка...', wait: true }],
                onBack: function() { network.clear(); }
            });

            network.silent(PROXY + encodeURIComponent(target), function (res) {
                Lampa.Select.close();
                try {
                    var data = JSON.parse(res.contents);
                    self.build(data);
                } catch(e) { self.empty(); }
            }, function () {
                Lampa.Select.close();
                self.empty();
            });

            return scroll.render();
        };

        this.build = function (data) {
            scroll.clear();
            var links = (data && data.links) ? data.links : [{name: 'Авто-поток 720p', quality: '720p', url: 'https://showypro.com/get_video?id='+object.movie.id+'&q=720&uid=i8nqb9vw'}];
            
            links.forEach(function(l) {
                var item = $(`<div class="fx-list-item selector"><span>${l.name}</span><b>${l.quality}</b></div>`);
                item.on('hover:enter', function() {
                    Lampa.Player.play({ url: l.url.replace('http://', 'https://'), title: object.movie.title });
                }).on('hover:focus', function(e) {
                    scroll.update($(e.target), true);
                });
                scroll.append(item);
            });
            Lampa.Controller.enable('content');
        };

        this.empty = function () { Lampa.Noty.show('Потоки не найдены'); };
        this.destroy = function () { network.clear(); scroll.destroy(); };
    }

    Lampa.Component.add('fx_ultra_comp', FilmixComponent);

    // 3. Агрессивная инжекция
    function injectButton(movieData) {
        // Удаляем старую кнопку, если она была
        $('.fx-ultra-btn').remove();

        // Ищем куда воткнуть кнопку (от самых приоритетных к самым отчаянным)
        var selectors = [
            '.full-start__buttons',
            '.full-movie__buttons',
            '.full-movie__actions',
            '.full-movie__main-info',
            '.view-movie__buttons',
            '.full-movie__title', // Если нет блока кнопок, лепим к заголовку
            '.full-movie__descr'   // Или к описанию
        ];

        var injected = false;
        for (var i = 0; i < selectors.length; i++) {
            var container = $(selectors[i]);
            if (container.length) {
                var btn = $('<div class="fx-ultra-btn selector">Смотреть на Filmix</div>');
                btn.on('hover:enter', function() {
                    Lampa.Component.item('fx_ultra_comp', { 
                        movie: movieData, 
                        display: $('body').find('.activity.active') 
                    });
                });
                
                // Если контейнер — это заголовок или описание, добавляем ПОСЛЕ него
                if (selectors[i].indexOf('title') > -1 || selectors[i].indexOf('descr') > -1) {
                    container.after(btn);
                } else {
                    container.append(btn);
                }
                
                console.log('Filmix Ultra: Injected into ' + selectors[i]);
                injected = true;
                break;
            }
        }
        return injected;
    }

    // Слушатель открытия карточки
    Lampa.Listener.follow('full', function (e) {
        if (e.type == 'complete' || e.type == 'complite') {
            console.log('Filmix Ultra: Card opened, starting injection...');
            
            // Пробуем инжектить сразу
            setTimeout(function() {
                if (!injectButton(e.data.movie)) {
                    // Если не вышло, пробуем еще несколько раз с интервалом
                    var attempts = 0;
                    var timer = setInterval(function() {
                        attempts++;
                        if (injectButton(e.data.movie) || attempts > 10) {
                            clearInterval(timer);
                        }
                    }, 1000);
                }
            }, 500);
        }
    });

})();