
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
            var voice_params = []; // Массив параметров t для озвучек

            var filter_translate = {
                season: 'Сезон',
                voice: 'Озвучка'
            };

            var filter_find = {
                season: [],
                voice: []
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
                }, false, {
                    dataType: 'text'
                });
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
                        if (a.stype == 'season') {
                            current_season = filter_find.season[b.index].season;
                            current_voice = 0;
                            filter_find.voice = [];
                            voice_params = [];

                            _this.loadSeason(current_season);
                        } else if (a.stype == 'voice') {
                            current_voice = b.index;
                            console.log('[ShowyPro] Voice selected index:', current_voice, 'param t:', voice_params[current_voice]);

                            // Делаем новый запрос с выбранной озвучкой используя параметр t
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

                if (object.movie.kinopoisk_id || object.movie.kp_id) {
                    current_kinopoisk_id = object.movie.kinopoisk_id || object.movie.kp_id;
                    var url = 'http://' + BASE_DOMAIN + '?kinopoisk_id=' + current_kinopoisk_id;

                    if (object.movie.title) {
                        url = Lampa.Utils.addUrlComponent(url, 'title=' + encodeURIComponent(object.movie.title).replace(/%20/g, '+'));
                    }

                    url = sign(url);

                    console.log('[ShowyPro] Using kinopoisk_id:', current_kinopoisk_id);
                    console.log('[ShowyPro] Request URL:', url);

                    _this.requestWithProxy(url, function(html) {
                        _this.parseInitial(html);
                    }, function() {
                        _this.empty('Ошибка загрузки');
                    });
                } else {
                    _this.empty('Kinopoisk ID не найден');
                }
            };

            this.parseInitial = function(html) {
                var _this = this;
                console.log('[ShowyPro] parseInitial - parsing HTML');

                try {
                    var $dom = $('<div>' + html + '</div>');

                    // Проверяем первый элемент на наличие флага similar
                    var firstItem = $dom.find('.videos__item.videos__season').first();
                    if (firstItem.length > 0) {
                        var dataJson = firstItem.attr('data-json');
                        if (dataJson) {
                            try {
                                var jsonData = JSON.parse(dataJson);
                                if (jsonData.similar === true) {
                                    console.log('[ShowyPro] Detected similar movies');
                                    _this.parseSimilarMovies(html);
                                    return;
                                }
                            } catch(e) {
                                console.log('[ShowyPro] JSON parse error:', e);
                            }
                        }
                    }

                    // Обычная логика для сезонов
                    var seasons = [];
                    var $seasons = $dom.find('.videos__season-title');

                    $seasons.each(function() {
                        var title = $(this).text().trim();
                        var seasonMatch = title.match(/(\d+)/);
                        var seasonNum = seasonMatch ? parseInt(seasonMatch[1]) : (seasons.length + 1);

                        seasons.push({
                            title: title,
                            season: seasonNum
                        });
                    });

                    console.log('[ShowyPro] Seasons found:', seasons.length);

                    if (seasons.length > 0) {
                        filter_find.season = seasons;
                        current_season = 1;
                        current_voice = 0;

                        _this.updateFilterMenu();
                        _this.loadSeason(1);
                    } else {
                        _this.parseContent(html);
                    }
                } catch(e) {
                    console.log('[ShowyPro] Parse error:', e);
                    _this.empty('Ошибка парсинга');
                }
            };

            this.parseSimilarMovies = function(html) {
                var _this = this;
                console.log('[ShowyPro] parseSimilarMovies');

                try {
                    var $dom = $('<div>' + html + '</div>');
                    var items = $dom.find('.videos__item.videos__season');

                    var movies = [];

                    items.each(function() {
                        var $item = $(this);
                        var dataJson = $item.attr('data-json');
                        var title = $item.find('.videos__season-title').text().trim();

                        if (dataJson) {
                            try {
                                var jsonData = JSON.parse(dataJson);

                                if (jsonData.similar === true && jsonData.url) {
                                    var postidMatch = jsonData.url.match(/postid=(\d+)/);
                                    var postid = postidMatch ? postidMatch[1] : null;

                                    movies.push({
                                        title: title + (jsonData.year ? ' (' + jsonData.year + ')' : ''),
                                        postid: postid,
                                        year: jsonData.year
                                    });
                                }
                            } catch(e) {
                                // ignore parse error
                            }
                        }
                    });

                    console.log('[ShowyPro] Similar movies:', movies.length);

                    if (movies.length > 0) {
                        _this.showSimilarMoviesList(movies);
                    } else {
                        _this.empty('Похожие фильмы не найдены');
                    }
                } catch(e) {
                    console.log('[ShowyPro] Parse similar error:', e);
                    _this.empty('Ошибка парсинга');
                }
            };

            this.showSimilarMoviesList = function(movies) {
                var _this = this;
                console.log('[ShowyPro] showSimilarMoviesList');

                scroll.clear();

                movies.forEach(function(movie) {
                    // ✅ ИСПРАВЛЕНО: folder → episode (пульт Google TV работает)
                    var item = Lampa.Template.get('lampac_prestige_episode', { title: movie.title });

                    item.on('hover:enter', function() {
                        console.log('[ShowyPro] Selected:', movie.title, 'postid:', movie.postid);
                        _this.loadSimilarMovie(movie.postid);
                    });

                    scroll.append(item);
                });

                scroll.render().find('.selector').on('hover:focus', function(e) {
                    last = $(e.target)[0];
                });
            };

            this.loadSimilarMovie = function(postid) {
                var _this = this;

                scroll.clear();
                scroll.body().append(Lampa.Template.get('lampac_content_loading'));

                // URL с postid
                var url = 'http://' + BASE_DOMAIN + '?postid=' + postid;
                url = Lampa.Utils.addUrlComponent(url, 'kinopoisk_id=' + current_kinopoisk_id);

                if (object.movie.title) {
                    url = Lampa.Utils.addUrlComponent(url, 'title=' + encodeURIComponent(object.movie.title).replace(/%20/g, '+'));
                }

                // uid и showy_token добавятся через sign
                url = sign(url);

                console.log('[ShowyPro] Loading similar movie:', url);

                _this.requestWithProxy(url, function(html) {
                    var $dom = $('<div>' + html + '</div>');
                    var seasons = $dom.find('.videos__season-title');

                    if (seasons.length > 0) {
                        console.log('[ShowyPro] Similar movie has seasons');
                        _this.parseInitial(html);
                    } else {
                        console.log('[ShowyPro] Similar movie - direct content');
                        _this.parseContent(html);
                    }
                }, function() {
                    _this.empty('Ошибка загрузки');
                });
            };

            this.loadSeason = function(seasonNum) {
                var _this = this;

                scroll.clear();
                scroll.body().append(Lampa.Template.get('lampac_content_loading'));

                var url = 'http://' + BASE_DOMAIN + '?kinopoisk_id=' + current_kinopoisk_id;

                if (object.movie.title) {
                    url = Lampa.Utils.addUrlComponent(url, 'title=' + encodeURIComponent(object.movie.title).replace(/%20/g, '+'));
                }

                url = Lampa.Utils.addUrlComponent(url, 's=' + seasonNum);
                url = sign(url);

                console.log('[ShowyPro] Loading season:', seasonNum);
                console.log('[ShowyPro] Request URL:', url);

                _this.requestWithProxy(url, function(html) {
                    _this.parseContent(html);
                }, function() {
                    _this.empty('Ошибка загрузки');
                });
            };

            this.loadVoice = function(voiceParam) {
                var _this = this;

                scroll.clear();
                scroll.body().append(Lampa.Template.get('lampac_content_loading'));

                // Используем параметр t для озвучки
                var url = 'http://' + BASE_DOMAIN + '?kinopoisk_id=' + current_kinopoisk_id;

                if (object.movie.title) {
                    url = Lampa.Utils.addUrlComponent(url, 'title=' + encodeURIComponent(object.movie.title).replace(/%20/g, '+'));
                }

                if (current_season) {
                    url = Lampa.Utils.addUrlComponent(url, 's=' + current_season);
                }

                url = Lampa.Utils.addUrlComponent(url, 't=' + voiceParam);
                url = sign(url);

                console.log('[ShowyPro] Loading voice with t:', voiceParam);
                console.log('[ShowyPro] Request URL:', url);

                _this.requestWithProxy(url, function(html) {
                    _this.parseContent(html, true); // true = не перезаписывать список озвучек
                }, function() {
                    _this.empty('Ошибка загрузки');
                });
            };

            this.parseContent = function(html, keepVoices) {
                var _this = this;
                console.log('[ShowyPro] parseContent - parsing episodes and voices');

                try {
                    var $dom = $('<div>' + html + '</div>');

                    // Парсим озвучки (если не keepVoices)
                    if (!keepVoices) {
                        var voiceButtons = $dom.find('.videos__button');
                        var voices = [];
                        voice_params = [];

                        voiceButtons.each(function() {
                            var $btn = $(this);
                            var title = $btn.text().trim();
                            var dataJson = $btn.attr('data-json');

                            if (title && dataJson) {
                                try {
                                    var jsonData = JSON.parse(dataJson);
                                    var url = jsonData.url;

                                    // Извлекаем параметр t из URL
                                    var tMatch = url.match(/[?&]t=(\d+)/);
                                    var tParam = tMatch ? parseInt(tMatch[1]) : voices.length;

                                    voices.push({ title: title });
                                    voice_params.push(tParam);

                                    console.log('[ShowyPro] Voice:', title, 't=' + tParam);
                                } catch(e) {
                                    console.log('[ShowyPro] Voice button parse error:', e);
                                }
                            }
                        });

                        console.log('[ShowyPro] Voices found:', voices.length);
                        console.log('[ShowyPro] Voice params:', voice_params);

                        if (voices.length > 0) {
                            filter_find.voice = voices;
                            if (current_voice === null) current_voice = 0;
                        }
                    }

                    // Парсим эпизоды
                    var episodes = [];
                    var $episodes = $dom.find('.videos__item.videos__movie');

                    $episodes.each(function() {
                        try {
                            var $item = $(this);
                            var dataJson = $item.attr('data-json');

                            if (!dataJson) return;

                            var jsonData = JSON.parse(dataJson);
                            var title = $item.find('.videos__item-title').text().trim();
                            var season = parseInt($item.attr('s')) || current_season || 0;
                            var episode = parseInt($item.attr('e')) || 0;

                            if (jsonData.url) {
                                episodes.push({
                                    title: title,
                                    episode: episode,
                                    url: jsonData.url,
                                    quality: jsonData.quality || {},
                                    season: season,
                                    episode: episode
                                });
                            }
                        } catch(e) {
                            console.log('[ShowyPro] Episode parse error:', e);
                        }
                    });

                    console.log('[ShowyPro] Episodes found:', episodes.length);

                    if (episodes.length > 0) {
                        _this.updateFilterMenu();
                        _this.displayEpisodes(episodes);
                    } else {
                        _this.empty('Эпизоды не найдены');
                    }
                } catch(e) {
                    console.log('[ShowyPro] Parse content error:', e);
                    _this.empty('Ошибка парсинга');
                }
            };

            this.updateFilterMenu = function() {
                var select = [];

                if (filter_find.season.length > 0) {
                    var seasonIdx = 0;

                    if (current_season) {
                        for (var i = 0; i < filter_find.season.length; i++) {
                            if (filter_find.season[i].season === current_season) {
                                seasonIdx = i;
                                break;
                            }
                        }
                    }

                    select.push({
                        title: filter_translate.season,
                        subtitle: filter_find.season[seasonIdx].title,
                        items: filter_find.season.map(function(s, i) {
                            return {
                                title: s.title,
                                selected: i === seasonIdx,
                                index: i
                            };
                        }),
                        stype: 'season'
                    });
                }

                if (filter_find.voice.length > 0) {
                    var voiceIdx = (current_voice !== null) ? current_voice : 0;

                    select.push({
                        title: filter_translate.voice,
                        subtitle: filter_find.voice[voiceIdx].title,
                        items: filter_find.voice.map(function(v, i) {
                            return {
                                title: v.title,
                                selected: i === voiceIdx,
                                index: i
                            };
                        }),
                        stype: 'voice'
                    });
                }

                filter.set('filter', select);
                filter.render();
            };

            this.displayEpisodes = function(videos) {
                var _this = this;

                scroll.clear();

                videos.forEach(function(element) {
                    var qualities = Object.keys(element.quality);
                    var qualitytext = qualities.length > 0 ? qualities.join(', ') : '';

                    var html = $(`
                        <div class="online-prestige selector">
                            <div class="online-prestige__body">
                                <div class="online-prestige__title">${element.title}</div>
                                <div class="online-prestige__info">${element.season ? 'S' + element.season : ''}${element.episode ? 'E' + element.episode : ''} ${qualitytext ? qualitytext : ''}</div>
                            </div>
                        </div>
                    `);

                    html.on('hover:enter', function() {
                        _this.playVideo(element);
                    });

                    html.on('hover:focus', function(e) {
                        last = e.target;
                        scroll.update(e.target, true);
                    });

                    scroll.append(html);
                });

                console.log('[ShowyPro] Episodes displayed:', videos.length);

                Lampa.Controller.enable('content');
            };

            this.playVideo = function(element) {
                var playlist = [];
                var streams = element.quality;

                if (Object.keys(streams).length > 0) {
                    for (var quality in streams) {
                        playlist.push({
                            title: element.title + ' [' + quality + ']',
                            url: streams[quality],
                            quality: quality,
                            season: element.season,
                            episode: element.episode
                        });
                    }
                } else {
                    playlist.push({
                        title: element.title,
                        url: element.url,
                        season: element.season,
                        episode: element.episode
                    });
                }

                if (playlist.length > 0) {
                    Lampa.Player.play(playlist[0]);

                    if (playlist.length > 1) {
                        Lampa.Player.playlist(playlist);
                    }
                } else {
                    Lampa.Noty.show('Нет доступных потоков');
                }
            };

            this.empty = function(msg) {
                var html = Lampa.Template.get('lampac_does_not_answer', {});
                html.find('.online-empty__title').text(msg);
                html.find('.online-empty__buttons').remove();

                scroll.clear();
                scroll.append(html);
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
                console.log('[ShowyPro] create()');
                this.initialize();
                return this.render();
            };

            this.start = function() {
                var _this = this;

                if (Lampa.Activity.active().activity !== this.activity) return;

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
                        else filter.show('Фильтр', 'filter');
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

        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'complite') {
                var btn = $(`
                    <div class="full-start__button selector view--showypro">
                        <svg width="128" height="118" viewBox="0 0 128 118" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect y="33" width="128" height="52" rx="5" fill="white"></rect>
                            <path d="M20 48H26V68H20V48Z" fill="currentColor"></path>
                            <path d="M34 48H54V54H40V56H52V62H40V68H34V48Z" fill="currentColor"></path>
                            <path d="M62 48H72L76 58L80 48H90V68H84V56L78 68H74L68 56V68H62V48Z" fill="currentColor"></path>
                            <path d="M98 48H108V68H98V48Z" fill="currentColor"></path>
                        </svg>
                        <span>ShowyPro</span>
                    </div>
                `);

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

        console.log('[ShowyPro] Plugin v9.0 loaded - Fixed voice parameter t instead of p');
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') startPlugin();
        });
    }

})();
