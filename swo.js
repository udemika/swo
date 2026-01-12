(function () {
    'use strict';

    function startPlugin() {
        if (window.showypro_plugin_loaded) return;
        window.showypro_plugin_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'showypro.com';
        
        var PROXIES = [
            'https://api.allorigins.win/raw?url=',
            'https://cors.byskaz.ru/',
            'https://corsproxy.io/?'
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('showypro_proxy_idx', '0'));
        if (isNaN(currentProxyIdx) || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

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
            var episodes_data = [];
            
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
                var fullUrl = proxy + 'http://' + sign(url);
                
                console.log('ShowyPro: Requesting:', fullUrl);
                
                network.native(fullUrl, function(res) {
                    console.log('ShowyPro: Response received, length:', res.length);
                    console.log('ShowyPro: First 200 chars:', res.substring(0, 200));
                    
                    // Проверка на ошибку от ShowyPro
                    if (res.length < 100 || res.indexOf('videos__') === -1) {
                        console.log('ShowyPro: Invalid response, trying next proxy');
                        attempts++;
                        if (attempts < PROXIES.length) {
                            currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                            _this.requestWithProxy(url, onSuccess, onError);
                            return;
                        }
                    }
                    
                    attempts = 0;
                    Lampa.Storage.set('showypro_proxy_idx', currentProxyIdx.toString());
                    onSuccess(res);
                }, function(err) {
                    attempts++;
                    console.log('ShowyPro: Proxy ' + proxy + ' failed, attempt ' + attempts);
                    if (attempts < PROXIES.length) {
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        _this.requestWithProxy(url, onSuccess, onError);
                    } else {
                        console.log('ShowyPro: All proxies failed');
                        onError(err);
                    }
                }, false, { dataType: 'text' });
            };

            this.parseHtml = function(html, selector, parseFunc) {
                var results = [];
                try {
                    var $dom = $('<div>' + html + '</div>');
                    console.log('ShowyPro: Searching for selector:', selector);
                    var elements = $dom.find(selector);
                    console.log('ShowyPro: Found elements:', elements.length);
                    
                    elements.each(function() {
                        var data = parseFunc($(this));
                        if (data) results.push(data);
                    });
                    
                    console.log('ShowyPro: Parsed results:', results.length);
                } catch(e) {
                    console.log('ShowyPro parse error:', e);
                }
                return results;
            };

            this.searchByTitle = function(title, callback) {
                var _this = this;
                var searchUrl = BASE_DOMAIN + '/lite/fxapi?query=' + encodeURIComponent(title);
                
                console.log('ShowyPro: Searching by title:', title);
                
                _this.requestWithProxy(searchUrl, function(html) {
                    // Ищем первый результат поиска
                    var results = _this.parseHtml(html, '.videos__item[data-json]', function($elem) {
                        try {
                            var dataJson = $elem.attr('data-json');
                            var jsonData = JSON.parse(dataJson);
                            return jsonData;
                        } catch(e) { return null; }
                    });
                    
                    if (results.length > 0) {
                        console.log('ShowyPro: Search found results:', results.length);
                        callback(results[0].url);
                    } else {
                        console.log('ShowyPro: No search results');
                        callback(null);
                    }
                }, function() {
                    callback(null);
                });
            };

            this.initialize = function() {
                var _this = this;
                
                console.log('ShowyPro: Initialize called');
                console.log('ShowyPro: Movie object:', object.movie);
                
                filter.onBack = function() {
                    _this.start();
                };

                filter.onSelect = function(type, a, b) {
                    if (type == 'filter') {
                        var url = filter_find[a.stype][b.index].url;
                        
                        if (a.stype == 'season') {
                            _this.loadSeasonContent(url);
                        } else if (a.stype == 'voice') {
                            _this.loadVoiceContent(url);
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

                // Приоритет: kinopoisk_id > imdb_id > название
                var url = null;
                
                if (object.movie.kinopoisk_id || object.movie.kp_id) {
                    var kpId = object.movie.kinopoisk_id || object.movie.kp_id;
                    url = BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + kpId;
                    console.log('ShowyPro: Using kinopoisk_id:', kpId);
                } else if (object.movie.imdb_id) {
                    url = BASE_DOMAIN + '/lite/fxapi?imdb_id=' + object.movie.imdb_id;
                    console.log('ShowyPro: Using imdb_id:', object.movie.imdb_id);
                } else {
                    // Поиск по названию
                    var title = object.movie.title || object.movie.name || object.movie.original_title || object.movie.original_name;
                    console.log('ShowyPro: No ID found, searching by title:', title);
                    
                    _this.searchByTitle(title, function(foundUrl) {
                        if (foundUrl) {
                            _this.requestWithProxy(foundUrl, function(html) {
                                _this.parseInitial(html);
                            }, function() {
                                _this.empty('Ошибка загрузки данных');
                            });
                        } else {
                            _this.empty('Контент не найден');
                        }
                    });
                    return;
                }

                console.log('ShowyPro: API URL:', 'http://' + url);

                _this.requestWithProxy(url, function(html) {
                    _this.parseInitial(html);
                }, function() {
                    _this.empty('Ошибка загрузки данных');
                });
            };

            this.parseInitial = function(html) {
                console.log('ShowyPro: parseInitial started');
                
                var seasons = this.parseHtml(html, '.videos__season', function($elem) {
                    try {
                        var dataJson = $elem.attr('data-json');
                        console.log('ShowyPro: Season data-json:', dataJson);
                        var jsonData = JSON.parse(dataJson);
                        var title = $elem.find('.videos__season-title').text().trim();
                        return { title: title, url: jsonData.url };
                    } catch(e) { 
                        console.log('ShowyPro: Season parse error:', e);
                        return null; 
                    }
                });

                var voices = this.parseHtml(html, '.videos__button', function($elem) {
                    try {
                        var dataJson = $elem.attr('data-json');
                        var jsonData = JSON.parse(dataJson);
                        var title = $elem.text().trim();
                        return { title: title, url: jsonData.url };
                    } catch(e) { return null; }
                });

                var episodes = this.parseHtml(html, '.videos__movie', function($elem) {
                    try {
                        var dataJson = $elem.attr('data-json');
                        var jsonData = JSON.parse(dataJson);
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

                console.log('ShowyPro: Seasons found:', seasons.length);
                console.log('ShowyPro: Voices found:', voices.length);
                console.log('ShowyPro: Episodes found:', episodes.length);

                if (seasons.length > 0) {
                    filter_find.season = seasons;
                    this.updateFilterMenu();
                    this.loadSeasonContent(seasons[0].url);
                    return;
                }

                if (voices.length > 0) {
                    filter_find.voice = voices;
                    this.updateFilterMenu();
                }

                if (episodes.length > 0) {
                    this.displayEpisodes(episodes);
                } else {
                    this.empty('Контент не найден');
                }
            };

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

                if (voices.length > 0) {
                    filter_find.voice = voices;
                    this.updateFilterMenu();
                }

                console.log('ShowyPro: Displaying episodes:', episodes.length);
                
                if (episodes.length > 0) {
                    this.displayEpisodes(episodes);
                } else {
                    this.empty('Серии не найдены');
                }
            };

            this.updateFilterMenu = function() {
                var select = [];
                
                if (filter_find.season.length > 0) {
                    select.push({
                        title: filter_translate.season,
                        subtitle: filter_find.season[0].title,
                        items: filter_find.season.map(function(s, i) {
                            return { title: s.title, selected: i === 0, index: i };
                        }),
                        stype: 'season'
                    });
                }

                if (filter_find.voice.length > 0) {
                    select.push({
                        title: filter_translate.voice,
                        subtitle: filter_find.voice[0].title,
                        items: filter_find.voice.map(function(v, i) {
                            return { title: v.title, selected: i === 0, index: i };
                        }),
                        stype: 'voice'
                    });
                }

                filter.set('filter', select);
            };

            this.displayEpisodes = function(videos) {
                var _this = this;
                scroll.clear();
                
                episodes_data = videos;

                videos.forEach(function(element, index) {
                    var quality_text = '';
                    if (element.quality && Object.keys(element.quality).length > 0) {
                        quality_text = Object.keys(element.quality)[0];
                    }

                    var html = $('<div class="online-prestige selector">' +
                        '<div class="online-prestige__body">' +
                            '<div class="online-prestige__title">' + element.title + '</div>' +
                            '<div class="online-prestige__info">Серия ' + element.episode + (quality_text ? ' • ' + quality_text : '') + '</div>' +
                        '</div>' +
                    '</div>');

                    html.on('hover:enter', function() {
                        _this.playVideo(element);
                    });

                    html.on('hover:focus', function(e) {
                        last = e.target;
                        scroll.update(e.target, true);
                    });

                    scroll.append(html);
                });

                console.log('ShowyPro: Episodes added to scroll:', videos.length);
                Lampa.Controller.enable('content');
            };

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

            this.empty = function(msg) {
                var html = Lampa.Template.get('lampac_does_not_answer', {});
                html.find('.online-empty__title').text(msg || 'Нет данных');
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
                console.log('ShowyPro: create() called');
                this.initialize();
                return this.render();
            };

            this.start = function() {
                var _this = this;
                if (Lampa.Activity.active().activity !== _this.activity) return;
                
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
                var btn = $(
                    '<div class="full-start__button selector view--filmix">' +
                        '<svg width="128" height="118" viewBox="0 0 128 118" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                            '<rect y="33" width="128" height="52" rx="5" fill="white"/>' +
                            '<path d="M20 48H26V68H20V48Z" fill="currentColor"/>' +
                            '<path d="M34 48H54V54H40V56H52V62H40V68H34V48Z" fill="currentColor"/>' +
                            '<path d="M62 48H72L76 58L80 48H90V68H84V56L78 68H74L68 56V68H62V48Z" fill="currentColor"/>' +
                            '<path d="M98 48H108V68H98V48Z" fill="currentColor"/>' +
                        '</svg>' +
                        '<span>ShowyPro</span>' +
                    '</div>'
                );

                btn.on('hover:enter', function() {
                    var movieData = {
                        id: e.object.id,
                        kinopoisk_id: e.object.kinopoisk_id,
                        kp_id: e.object.kp_id,
                        imdb_id: e.object.imdb_id,
                        tmdb_id: e.object.tmdb_id,
                        title: e.object.title,
                        name: e.object.name,
                        original_title: e.object.original_title,
                        original_name: e.object.original_name
                    };

                    Lampa.Component.add('showypro', component);
                    Lampa.Activity.push({
                        url: '',
                        title: 'ShowyPro - ' + (movieData.title || movieData.name),
                        component: 'showypro',
                        movie: movieData,
                        page: 1
                    });
                });

                e.object.activity.render().find('.view--torrent').after(btn);
            }
        });

        console.log('ShowyPro plugin v4.8 loaded (search by title support)');
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
