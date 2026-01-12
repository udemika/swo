(function () {
    'use strict';

    /**
     * ShowyPro Plugin для Lampa v4.0
     * - Окно на весь экран как в on.js
     * - Кнопки "Источник" и "Фильтр" сверху
     * - Боковое меню открывается при нажатии "Фильтр"
     */

    function startPlugin() {
        if (window.showypro_plugin_loaded) return;
        window.showypro_plugin_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'http://showypro.com';
        var PROXIES = [
            'https://cors.byskaz.ru/',
            'http://85.198.110.239:8975/',
            'http://91.184.245.56:8975/',
            'https://apn10.akter-black.com/',
            'https://apn5.akter-black.com/',
            'https://cors557.deno.dev/'
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('showypro_proxy_idx', '0'));
        if (isNaN(currentProxyIdx) || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

        function sign(url) {
            url = url + '';
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') == -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
            return url;
        }

        var Network = Lampa.Request || Lampa.Reguest;

        // ========== КОМПОНЕНТ КАК В ON.JS ==========
        function component(object) {
            var network = new Network();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var files = new Lampa.Explorer(object);
            var filter = new Lampa.Filter(object);
            
            var last;
            var attempts = 0;
            var images = [];
            
            var filter_translate = {
                season: 'Сезон',
                voice: 'Озвучка'
            };
            
            var filter_find = {
                season: [],
                voice: []
            };

            // Запрос с ротацией прокси
            this.requestWithProxy = function(url, onSuccess, onError) {
                var _this = this;
                var proxy = PROXIES[currentProxyIdx];
                
                network.native(proxy + sign(url), function(res) {
                    attempts = 0;
                    Lampa.Storage.set('showypro_proxy_idx', currentProxyIdx.toString());
                    onSuccess(res);
                }, function(err) {
                    attempts++;
                    console.log('ShowyPro: Proxy ' + proxy + ' failed');
                    if (attempts < PROXIES.length) {
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        _this.requestWithProxy(url, onSuccess, onError);
                    } else {
                        onError(err);
                    }
                }, false, { dataType: 'text' });
            };

            // Парсинг HTML
            this.parseHtml = function(html, selector, parseFunc) {
                var results = [];
                try {
                    var $dom = $('<div>' + html + '</div>');
                    $dom.find(selector).each(function() {
                        var data = parseFunc($(this));
                        if (data) results.push(data);
                    });
                } catch(e) {
                    console.log('ShowyPro parse error:', e);
                }
                return results;
            };

            // Инициализация (КАК В ON.JS)
            this.initialize = function() {
                var _this = this;
                
                // Настройка обработчиков фильтра
                filter.onBack = function() {
                    _this.start();
                };

                filter.onSelect = function(type, a, b) {
                    if (type == 'filter') {
                        // Обработка выбора сезона или озвучки
                        var url = filter_find[a.stype][b.index].url;
                        
                        if (a.stype == 'season') {
                            _this.loadSeasonContent(url);
                        } else if (a.stype == 'voice') {
                            _this.loadVoiceContent(url);
                        }
                        
                        setTimeout(Lampa.Select.close, 10);
                    }
                };

                // Сборка интерфейса КАК В ON.JS
                scroll.body().addClass('torrent-list');
                files.appendFiles(scroll.render());
                files.appendHead(filter.render()); // Кнопки сверху!
                scroll.minus(files.render().find('.explorer__files-head'));
                scroll.body().append(Lampa.Template.get('lampac_content_loading'));
                
                Lampa.Controller.enable('content');

                // Загрузка начальных данных
                var id = object.movie.kinopoisk_id || object.movie.kp_id || object.movie.id;
                var url = BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + id;
                
                if (!object.movie.kinopoisk_id && !object.movie.kp_id) {
                    url = BASE_DOMAIN + '/lite/fxapi?postid=' + id;
                }

                _this.requestWithProxy(url, function(html) {
                    _this.parseInitial(html);
                }, function() {
                    _this.empty('Ошибка загрузки данных');
                });
            };

            // Парсинг начального ответа
            this.parseInitial = function(html) {
                var seasons = this.parseHtml(html, '.videos__season', function($elem) {
                    try {
                        var jsonData = JSON.parse($elem.attr('data-json'));
                        var title = $elem.find('.videos__season-title').text().trim();
                        return { title: title, url: jsonData.url };
                    } catch(e) { return null; }
                });

                var voices = this.parseHtml(html, '.videos__button', function($elem) {
                    try {
                        var jsonData = JSON.parse($elem.attr('data-json'));
                        var title = $elem.text().trim();
                        return { title: title, url: jsonData.url };
                    } catch(e) { return null; }
                });

                var episodes = this.parseHtml(html, '.videos__movie', function($elem) {
                    try {
                        var jsonData = JSON.parse($elem.attr('data-json'));
                        var title = $elem.find('.videos__item-title').text().trim();
                        var season = parseInt($elem.attr('s')) || 0;
                        var episode = parseInt($elem.attr('e')) || 0;
                        
                        return {
                            title: title,
                            url: jsonData.url,
                            quality: jsonData.quality || {},
                            season: season,
                            episode: episode
                        };
                    } catch(e) { return null; }
                });

                // Если есть сезоны - сохраняем и загружаем первый
                if (seasons.length > 0) {
                    filter_find.season = seasons;
                    this.updateFilterMenu();
                    this.loadSeasonContent(seasons[0].url);
                    return;
                }

                // Если есть озвучки - сохраняем
                if (voices.length > 0) {
                    filter_find.voice = voices;
                    this.updateFilterMenu();
                }

                // Если есть серии - отображаем
                if (episodes.length > 0) {
                    this.displayEpisodes(episodes);
                } else {
                    this.empty('Контент не найден');
                }
            };

            // Загрузка контента сезона
            this.loadSeasonContent = function(url) {
                var _this = this;
                scroll.clear();
                scroll.body().append(Lampa.Template.get('lampac_content_loading'));
                
                this.requestWithProxy(url, function(html) {
                    _this.parseSeasonContent(html);
                }, function() {
                    _this.empty('Ошибка загрузки сезона');
                });
            };

            // Загрузка контента озвучки
            this.loadVoiceContent = function(url) {
                var _this = this;
                scroll.clear();
                scroll.body().append(Lampa.Template.get('lampac_content_loading'));
                
                this.requestWithProxy(url, function(html) {
                    _this.parseSeasonContent(html);
                }, function() {
                    _this.empty('Ошибка загрузки озвучки');
                });
            };

            // Парсинг контента сезона/озвучки
            this.parseSeasonContent = function(html) {
                var voices = this.parseHtml(html, '.videos__button', function($elem) {
                    try {
                        var jsonData = JSON.parse($elem.attr('data-json'));
                        var title = $elem.text().trim();
                        return { title: title, url: jsonData.url };
                    } catch(e) { return null; }
                });

                var episodes = this.parseHtml(html, '.videos__movie', function($elem) {
                    try {
                        var jsonData = JSON.parse($elem.attr('data-json'));
                        var title = $elem.find('.videos__item-title').text().trim();
                        var season = parseInt($elem.attr('s')) || 0;
                        var episode = parseInt($elem.attr('e')) || 0;
                        
                        return {
                            title: title,
                            url: jsonData.url,
                            quality: jsonData.quality || {},
                            season: season,
                            episode: episode
                        };
                    } catch(e) { return null; }
                });

                // Обновляем озвучки если есть
                if (voices.length > 0) {
                    filter_find.voice = voices;
                    this.updateFilterMenu();
                }

                // Отображаем серии
                if (episodes.length > 0) {
                    this.displayEpisodes(episodes);
                } else {
                    this.empty('Серии не найдены');
                }
            };

            // Обновление меню фильтров (для бокового меню)
            this.updateFilterMenu = function() {
                var select = [];
                
                if (filter_find.season.length > 0) {
                    select.push({
                        title: filter_translate.season,
                        subtitle: filter_find.season[0].title,
                        items: filter_find.season.map(function(s, i) {
                            return { 
                                title: s.title, 
                                selected: i === 0, 
                                index: i 
                            };
                        }),
                        stype: 'season'
                    });
                }

                if (filter_find.voice.length > 0) {
                    select.push({
                        title: filter_translate.voice,
                        subtitle: filter_find.voice[0].title,
                        items: filter_find.voice.map(function(v, i) {
                            return { 
                                title: v.title, 
                                selected: i === 0, 
                                index: i 
                            };
                        }),
                        stype: 'voice'
                    });
                }

                filter.set('filter', select);
                filter.chosen('filter', []);
            };

            // Отображение серий (КАК В ON.JS)
            this.displayEpisodes = function(videos) {
                var _this = this;
                scroll.clear();

                videos.forEach(function(element) {
                    var quality_text = '';
                    if (element.quality && Object.keys(element.quality).length > 0) {
                        var keys = Object.keys(element.quality);
                        quality_text = keys[0];
                    }

                    var html = Lampa.Template.get('online_prestige_full', {
                        title: element.title,
                        quality: quality_text,
                        info: 'Серия ' + element.episode
                    });

                    html.on('hover:enter', function() {
                        _this.playVideo(element);
                    });

                    html.on('hover:focus', function(e) {
                        last = e.target;
                        scroll.update(e.target, true);
                    });

                    scroll.append(html);
                });

                Lampa.Controller.enable('content');
            };

            // Воспроизведение видео
            this.playVideo = function(element) {
                var playlist = [];
                var streams = element.quality || { 'Авто': element.url };
                
                for (var quality in streams) {
                    playlist.push({
                        title: element.title + ' [' + quality + ']',
                        url: streams[quality],
                        quality: quality,
                        season: element.season,
                        episode: element.episode
                    });
                }

                if (playlist.length > 0) {
                    Lampa.Player.play(playlist[0]);
                    if (playlist.length > 1) {
                        Lampa.Player.playlist(playlist);
                    }
                }
            };

            // Пустой экран
            this.empty = function(msg) {
                var html = Lampa.Template.get('lampac_does_not_answer', {});
                html.find('.online-empty__title').text(msg || 'Нет данных');
                html.find('.online-empty__buttons').remove();
                scroll.clear();
                scroll.append(html);
            };

            // Очистка изображений
            this.clearImages = function() {
                images.forEach(function(img) {
                    img.onerror = function() {};
                    img.onload = function() {};
                    img.src = '';
                });
                images = [];
            };

            // Старт контроллера (КАК В ON.JS)
            this.start = function() {
                Lampa.Controller.add('content', {
                    toggle: function() {
                        Lampa.Controller.collectionSet(scroll.render(), files.render());
                        Lampa.Controller.collectionFocus(last || false, scroll.render());
                    },
                    left: function() {
                        if (Navigator.canmove('left')) Navigator.move('left');
                        else Lampa.Controller.toggle('menu');
                    },
                    right: function() {
                        if (Navigator.canmove('right')) Navigator.move('right');
                        else filter.show('Фильтр', filter); // БОКОВОЕ МЕНЮ!
                    },
                    up: function() {
                        if (Navigator.canmove('up')) Navigator.move('up');
                        else Lampa.Controller.toggle('head');
                    },
                    down: function() {
                        Navigator.move('down');
                    },
                    back: this.back.bind(this)
                });

                Lampa.Controller.toggle('content');
            };

            this.render = function() {
                return files.render();
            };

            this.back = function() {
                Lampa.Activity.backward();
            };

            this.pause = function() {};
            
            this.stop = function() {};
            
            this.destroy = function() {
                network.clear();
                this.clearImages();
                files.destroy();
                scroll.destroy();
            };
        }

        // ========== РЕГИСТРАЦИЯ ПЛАГИНА ==========
        var manifest = {
            type: 'video',
            version: '4.0',
            name: 'ShowyPro',
            description: 'Онлайн просмотр ShowyPro',
            component: 'showypro',
            onContextMenu: function(object) {
                return {
                    name: 'ShowyPro',
                    description: ''
                };
            },
            onContextLauch: function(object) {
                Lampa.Component.add('showypro', component);
                Lampa.Activity.push({
                    url: '',
                    title: 'ShowyPro - ' + (object.title || object.name),
                    component: 'showypro',
                    movie: object,
                    page: 1
                });
            }
        };

        Lampa.Manifest.plugins = manifest;
        
        console.log('ShowyPro plugin v4.0 loaded (Full screen with filter menu)');
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
