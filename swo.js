(function () {
    'use strict';

    function startPlugin() {
        if (window.showypro_plugin_loaded) return;
        window.showypro_plugin_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'showypro.com/lite/fxapi';

        var PROXIES = [
            'https://cors.byskaz.ru/',
            'http://85.198.110.239:8975/',
            'http://91.184.245.56:8975/',
            'https://apn10.akter-black.com/',
            'https://apn5.akter-black.com/',
            'https://cors557.deno.dev/'
        ];

        var currentProxyIdx = 0;

        function sign(url) {
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            return url;
        }

        var Network = Lampa.Request || Lampa.Reguest;

        function component(object) {
            var network = new Network();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var files = new Lampa.Explorer(object);
            var filter = new Lampa.Filter(object);
            var last;
            var attempts = 0;
            var images = [];
            var current_kinopoisk_id = null;
            var current_season = null;
            var current_voice = null;
            var voice_params = [];
            var similar_movies = []; // Для хранения похожих фильмов
            var selected_movie_url = null; // URL выбранного фильма из похожих

            var filter_translate = { 
                season: 'Сезон', 
                voice: 'Озвучка',
                movie: 'Фильм' // Добавляем фильтр для выбора фильма
            };
            var filter_find = { 
                season: [], 
                voice: [],
                movie: [] // Для списка похожих фильмов
            };

            this.requestWithProxy = function(url, onSuccess, onError) {
                var _this = this;
                var proxy = PROXIES[currentProxyIdx];
                var fullUrl = proxy + url;

                console.log('[ShowyPro] Requesting:', fullUrl);

                network.native(fullUrl, function(res) {
                    console.log('[ShowyPro] Response received, length:', res.length);

                    if (res.length < 100) {
                        console.log('[ShowyPro] Response too short, trying next proxy');
                        attempts++;
                        if (attempts < PROXIES.length) {
                            currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                            _this.requestWithProxy(url, onSuccess, onError);
                            return;
                        }
                    }

                    attempts = 0;
                    onSuccess(res);
                }, function(err) {
                    attempts++;
                    console.log('[ShowyPro] Proxy failed, attempt:', attempts);

                    if (attempts < PROXIES.length) {
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        _this.requestWithProxy(url, onSuccess, onError);
                    } else {
                        console.log('[ShowyPro] All proxies failed');
                        attempts = 0;
                        onError(err);
                    }
                }, false, { dataType: 'text' });
            };

            this.initialize = function() {
                var _this = this;

                console.log('[ShowyPro] Initialize');
                console.log('[ShowyPro] Movie object:', object.movie);

                filter.onBack = function() {
                    _this.start();
                };

                filter.onSelect = function(type, a, b) {
                    if (type == 'filter') {
                        if (a.stype == 'movie') {
                            // Пользователь выбрал фильм из похожих
                            selected_movie_url = filter_find.movie[b.index].url;
                            console.log('[ShowyPro] Selected movie URL:', selected_movie_url);

                            // Загружаем выбранный фильм
                            var url = selected_movie_url;
                            url = sign(url);

                            _this.requestWithProxy(url, function(html) {
                                _this.parseSelectedMovie(html);
                            }, function() {
                                _this.empty('Ошибка загрузки фильма');
                            });
                        } else if (a.stype == 'season') {
                            current_season = filter_find.season[b.index].season;
                            current_voice = 0;
                            filter_find.voice = [];
                            voice_params = [];
                            _this.loadSeason(current_season);
                        } else if (a.stype == 'voice') {
                            current_voice = b.index;
                            console.log('[ShowyPro] Voice selected index:', current_voice, 'param t:', voice_params[current_voice]);
                            _this.loadVoice(voice_params[current_voice]);
                        }

                        setTimeout(Lampa.Select.close, 10);
                    }
                };

                scroll.body().addClass('torrent-list');
                files.appendFiles(scroll.render());
                files.appendHead(filter.render());
                scroll.minus(files.render().find('.explorer__files-head'));
                scroll.body().append(Lampa.Template.get('lampac_content_loading'));

                Lampa.Controller.enable('content');

                // Пробуем запрос по kinopoisk_id
                if (object.movie.kinopoisk_id || object.movie.kp_id) {
                    current_kinopoisk_id = object.movie.kinopoisk_id || object.movie.kp_id;
                    var url = 'http://' + BASE_DOMAIN + '?kinopoisk_id=' + current_kinopoisk_id;
                    url = sign(url);

                    console.log('[ShowyPro] Using kinopoisk_id:', current_kinopoisk_id);
                    console.log('[ShowyPro] Request URL:', url);

                    _this.requestWithProxy(url, function(html) {
                        // Проверяем, есть ли контент или это ошибка
                        if (html.indexOf('videos__line') > -1 || html.indexOf('videos__item') > -1) {
                            _this.parseInitial(html);
                        } else {
                            console.log('[ShowyPro] No content by kinopoisk_id, trying by title');
                            _this.searchByTitle();
                        }
                    }, function() {
                        console.log('[ShowyPro] Request by kinopoisk_id failed, trying by title');
                        _this.searchByTitle();
                    });
                } else {
                    _this.searchByTitle();
                }
            };

            this.searchByTitle = function() {
                var _this = this;
                var title = object.movie.title || object.movie.name || '';

                if (!title) {
                    _this.empty('Название не найдено');
                    return;
                }

                var url = 'http://' + BASE_DOMAIN + '?title=' + encodeURIComponent(title) + '&s=1';
                url = sign(url);

                console.log('[ShowyPro] Searching by title:', title);
                console.log('[ShowyPro] Request URL:', url);

                _this.requestWithProxy(url, function(html) {
                    _this.parseSearchResults(html);
                }, function() {
                    _this.empty('Ошибка поиска по названию');
                });
            };

            this.parseSearchResults = function(html) {
                var _this = this;
                console.log('[ShowyPro] parseSearchResults - parsing HTML');

                try {
                    var $dom = $('<div>' + html + '</div>');

                    // Ищем videos__season - это похожие фильмы/сериалы
                    var $seasons = $dom.find('.videos__season');

                    if ($seasons.length > 0) {
                        console.log('[ShowyPro] Found', $seasons.length, 'similar movies');

                        similar_movies = [];
                        filter_find.movie = [];

                        $seasons.each(function(index) {
                            var $item = $(this);
                            var dataJson = $item.attr('data-json');

                            if (dataJson) {
                                try {
                                    var data = JSON.parse(dataJson);
                                    var title = $item.find('.videos__season-title').text().trim();

                                    similar_movies.push({
                                        title: title,
                                        url: data.url || '',
                                        year: data.year || '',
                                        index: index
                                    });

                                    filter_find.movie.push({
                                        title: title,
                                        url: data.url || ''
                                    });

                                    console.log('[ShowyPro] Movie:', title, 'URL:', data.url);
                                } catch(e) {
                                    console.log('[ShowyPro] Error parsing movie data:', e);
                                }
                            }
                        });

                        if (similar_movies.length > 0) {
                            _this.updateFilterMenu();
                            scroll.body().empty();

                            // Показываем сообщение о необходимости выбора
                            var msg = $('<div class="broadcast__text" style="padding: 20px; text-align: center;">Найдено ' + similar_movies.length + ' вариантов. Откройте фильтр и выберите нужный фильм.</div>');
                            scroll.body().append(msg);

                            Lampa.Controller.enable('content');
                        } else {
                            _this.empty('Фильмы не найдены');
                        }
                    } else {
                        // Если нет videos__season, возможно сразу контент
                        _this.parseInitial(html);
                    }
                } catch(e) {
                    console.log('[ShowyPro] Parse search error:', e);
                    _this.empty('Ошибка парсинга результатов поиска');
                }
            };

            this.parseSelectedMovie = function(html) {
                var _this = this;
                console.log('[ShowyPro] parseSelectedMovie - parsing selected movie HTML');

                // После выбора фильма парсим его как обычно
                _this.parseInitial(html);
            };

            this.parseInitial = function(html) {
                var _this = this;
                console.log('[ShowyPro] parseInitial - parsing HTML');

                try {
                    var $dom = $('<div>' + html + '</div>');

                    // Ищем videos__season-title для сериалов (сезоны)
                    var $seasons = $dom.find('.videos__season-title');
                    var seasons = [];

                    $seasons.each(function() {
                        var title = $(this).text().trim();
                        var seasonMatch = title.match(/(\d+)/);
                        var seasonNum = seasonMatch ? parseInt(seasonMatch[1]) : seasons.length + 1;

                        seasons.push({
                            title: title,
                            season: seasonNum
                        });
                    });

                    console.log('[ShowyPro] Seasons found:', seasons.length);

                    if (seasons.length > 0) {
                        // Это сериал с сезонами
                        filter_find.season = seasons;
                        filter_find.movie = []; // Очищаем список фильмов
                        current_season = 1;
                        current_voice = 0;
                        _this.updateFilterMenu();
                        _this.loadSeason(1);
                    } else {
                        // Это фильм или прямой список озвучек
                        filter_find.movie = []; // Очищаем список фильмов
                        _this.parseContent(html);
                    }
                } catch(e) {
                    console.log('[ShowyPro] Parse error:', e);
                    _this.empty('Ошибка парсинга');
                }
            };

            this.loadSeason = function(seasonNum) {
                var _this = this;
                console.log('[ShowyPro] Loading season:', seasonNum);

                var url = 'http://' + BASE_DOMAIN + '?kinopoisk_id=' + current_kinopoisk_id + '&season=' + seasonNum;
                url = sign(url);

                _this.requestWithProxy(url, function(html) {
                    _this.parseContent(html);
                }, function() {
                    _this.empty('Ошибка загрузки сезона');
                });
            };

            this.loadVoice = function(voiceParam) {
                var _this = this;
                console.log('[ShowyPro] Loading voice with param t:', voiceParam);

                var url = 'http://' + BASE_DOMAIN + '?kinopoisk_id=' + current_kinopoisk_id;
                if (current_season) {
                    url += '&season=' + current_season;
                }
                if (voiceParam) {
                    url += '&t=' + voiceParam;
                }
                url = sign(url);

                console.log('[ShowyPro] Voice request URL:', url);

                _this.requestWithProxy(url, function(html) {
                    _this.parseContent(html, true); // true = только эпизоды, не обновлять озвучки
                }, function() {
                    _this.empty('Ошибка загрузки озвучки');
                });
            };

            this.parseContent = function(html, onlyEpisodes) {
                var _this = this;
                console.log('[ShowyPro] parseContent - parsing content, onlyEpisodes:', onlyEpisodes);

                try {
                    var $dom = $('<div>' + html + '</div>');

                    // Парсим озвучки только если не onlyEpisodes
                    if (!onlyEpisodes) {
                        var $voices = $dom.find('.videos__button');
                        var voices = [];
                        voice_params = [];

                        $voices.each(function() {
                            var $btn = $(this);
                            var title = $btn.text().trim();
                            var dataJson = $btn.attr('data-json');

                            if (dataJson) {
                                try {
                                    var data = JSON.parse(dataJson);
                                    var tParam = data.t || '';

                                    voices.push({
                                        title: title,
                                        t: tParam
                                    });
                                    voice_params.push(tParam);

                                    console.log('[ShowyPro] Voice:', title, 't:', tParam);
                                } catch(e) {
                                    console.log('[ShowyPro] Error parsing voice:', e);
                                }
                            }
                        });

                        if (voices.length > 0) {
                            filter_find.voice = voices;
                            console.log('[ShowyPro] Voices found:', voices.length);
                        }

                        _this.updateFilterMenu();
                    }

                    // Парсим эпизоды или озвучки фильма
                    _this.displayEpisodes($dom);

                } catch(e) {
                    console.log('[ShowyPro] Parse content error:', e);
                    _this.empty('Ошибка парсинга контента');
                }
            };

            this.updateFilterMenu = function() {
                var filter_items = [];

                // Добавляем фильтр выбора фильма если есть похожие
                if (filter_find.movie.length > 0) {
                    filter_items.push({
                        title: 'Фильм',
                        subtitle: filter_find.movie.length + ' вариантов',
                        items: filter_find.movie,
                        stype: 'movie'
                    });
                }

                // Добавляем фильтр сезонов если есть
                if (filter_find.season.length > 0) {
                    filter_items.push({
                        title: 'Сезон',
                        subtitle: filter_find.season.length + ' сезонов',
                        items: filter_find.season,
                        stype: 'season'
                    });
                }

                // Добавляем фильтр озвучек если есть
                if (filter_find.voice.length > 0) {
                    filter_items.push({
                        title: 'Озвучка',
                        subtitle: filter_find.voice.length + ' озвучек',
                        items: filter_find.voice,
                        stype: 'voice'
                    });
                }

                filter.set('filter', filter_items);
                filter.chosen('filter', [current_season - 1, current_voice]);
            };

            this.displayEpisodes = function($dom) {
                var _this = this;
                scroll.body().empty();

                var $items = $dom.find('.videos__movie, .videos__item-episode');
                console.log('[ShowyPro] Episodes/movies found:', $items.length);

                if ($items.length === 0) {
                    _this.empty('Контент не найден');
                    return;
                }

                $items.each(function() {
                    var $item = $(this);
                    var dataJson = $item.attr('data-json');

                    if (dataJson) {
                        try {
                            var data = JSON.parse(dataJson);
                            var title = data.translate || data.title || $item.find('.videos__item-title').text().trim();
                            var quality = data.maxquality || '';

                            var episode = {
                                title: title,
                                quality: quality,
                                info: quality,
                                url: data.url,
                                quality_obj: data.quality || {}
                            };

                            var item = Lampa.Template.get('lampac_prestige_folder', episode);

                            item.on('hover:enter', function() {
                                _this.playVideo(episode);
                            });

                            scroll.append(item);
                        } catch(e) {
                            console.log('[ShowyPro] Error parsing episode:', e);
                        }
                    }
                });

                Lampa.Controller.enable('content');
            };

            this.playVideo = function(episode) {
                var playlist = [];
                var qualityObj = episode.quality_obj;

                for (var quality in qualityObj) {
                    if (qualityObj.hasOwnProperty(quality)) {
                        playlist.push({
                            title: episode.title + ' ' + quality,
                            url: qualityObj[quality],
                            quality: parseInt(quality) || 0,
                            timeline: 0,
                            subtitles: []
                        });
                    }
                }

                // Сортируем по качеству
                playlist.sort(function(a, b) {
                    return b.quality - a.quality;
                });

                if (playlist.length === 0 && episode.url) {
                    playlist.push({
                        title: episode.title,
                        url: episode.url,
                        quality: 0,
                        timeline: 0,
                        subtitles: []
                    });
                }

                if (playlist.length > 0) {
                    Lampa.Player.play(playlist[0]);
                    Lampa.Player.playlist(playlist);
                } else {
                    Lampa.Noty.show('Видео не найдено');
                }
            };

            this.empty = function(msg) {
                scroll.body().empty();
                var empty = Lampa.Template.get('lampac_does_not_answer', { title: msg || 'Пусто', clarification: 'ShowyPro' });
                scroll.append(empty);
                Lampa.Controller.enable('content');
            };

            this.clearImages = function() {
                images.forEach(function(img) {
                    img.onerror = function() {};
                    img.onload = function() {};
                    img.src = '';
                });
                images = [];
            };

            this.create = function() {
                this.initialize();
                return this.render();
            };

            this.start = function() {
                Lampa.Controller.add('content', {
                    invisible: true,
                    toggle: function() {
                        Lampa.Controller.collectionSet(scroll.render());
                        Lampa.Controller.collectionFocus(last || false, scroll.render());
                    },
                    left: function() {
                        if (Navigator.canmove('left')) Navigator.move('left');
                        else Lampa.Controller.toggle('menu');
                    },
                    right: function() {
                        Navigator.move('right');
                    },
                    up: function() {
                        if (Navigator.canmove('up')) Navigator.move('up');
                        else Lampa.Controller.toggle('head');
                    },
                    down: function() {
                        if (Navigator.canmove('down')) Navigator.move('down');
                    },
                    back: this.back.bind(this)
                });

                Lampa.Controller.toggle('content');
            };

            this.render = function() {
                return scroll.render();
            };

            this.back = function() {
                Lampa.Activity.backward();
            };

            this.pause = function() {};

            this.stop = function() {};

            this.destroy = function() {
                network.clear();
                this.clearImages();
                scroll.destroy();
                files.destroy();
                filter.destroy();
            };
        }

        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'complite') {
                var btn = $(
                    '<div class="full-start__button selector view--online_mod">' +
                        '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 128 128" xml:space="preserve">' +
                        '<path d="M20 23h88v82H20z" fill="currentColor"/>' +
                        '<path d="M93 39.2H35c-3.3 0-6 2.7-6 6v32.5c0 3.3 2.7 6 6 6h20.3l-2.1 6.1h-3.3c-1.1 0-2 .9-2 2s.9 2 2 2h28c1.1 0 2-.9 2-2s-.9-2-2-2h-3.3l-2.1-6.1H93c3.3 0 6-2.7 6-6V45.2c0-3.3-2.7-6-6-6Zm-20.6 50.6H55.5l2.1-6.1h12.7l2.1 6.1ZM95 77.7c0 1.1-.9 2-2 2H35c-1.1 0-2-.9-2-2V45.2c0-1.1.9-2 2-2h58c1.1 0 2 .9 2 2v32.5Z" fill="#fff"/>' +
                        '<path d="M89 49.3H39c-1.1 0-2 .9-2 2v20.4c0 1.1.9 2 2 2h50c1.1 0 2-.9 2-2V51.3c0-1.1-.9-2-2-2Z" fill="#fff"/>' +
                        '<path d="M98 48H108V68H98V48Z" fill="currentColor"/>' +
                        '</svg>' +
                        '<span>ShowyPro</span>' +
                    '</div>'
                );

                btn.on('hover:enter', function() {
                    Lampa.Component.add('showypro', component);
                    Lampa.Activity.push({
                        url: '',
                        title: 'ShowyPro',
                        component: 'showypro',
                        movie: e.data.movie,
                        page: 1
                    });
                });

                e.object.activity.render().find('.view--torrent').after(btn);
            }
        });

        console.log('[ShowyPro] Plugin v10.0 loaded - Added fallback to title search and similar movies selection');
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
