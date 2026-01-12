(function () {
    'use strict';

    function startPlugin() {
        if (window.showypro_plugin_loaded) return;
        window.showypro_plugin_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'showypro.com'; // БЕЗ http://
        
        // НОВЫЕ ПРОКСИ (проверенные)
        var PROXIES = [
            'https://corsproxy.io/?',
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://cors.byskaz.ru/',
            'https://corsproxy.org/?'
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('showypro_proxy_idx', '0'));
        if (isNaN(currentProxyIdx) || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

        function sign(url) {
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') == -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
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
                
                // ПРАВИЛЬНЫЙ ФОРМАТ: proxy + encodeURIComponent(http://url)
                var fullUrl = proxy + encodeURIComponent('http://' + sign(url));
                
                console.log('ShowyPro: Requesting:', fullUrl);
                
                network.native(fullUrl, function(res) {
                    console.log('ShowyPro: Response received, length:', res.length);
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

                var id = object.movie.kinopoisk_id || object.movie.kp_id || object.movie.id;
                var url = BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + id;
                
                if (!object.movie.kinopoisk_id && !object.movie.kp_id) {
                    url = BASE_DOMAIN + '/lite/fxapi?postid=' + id;
                }

                console.log('ShowyPro: API URL:', url);

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
                        var jsonData = JSON.parse(dataJson);
                        var title = $elem.find('.videos__season-title').text().trim();
                        return { title: title, url: jsonData.url };
                    } catch(e) { return null; }
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

                console.log('ShowyPro: Seasons:', seasons.length, 'Voices:', voices.length, 'Episodes:', episodes.length);

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

                videos.forEach(function(element) {
                    var quality_text = '';
                    if (element.quality && Object.keys(element.quality).length > 0) {
                        quality_text = Object.keys(element.quality)[0];
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
                        else filter.show('Фильтр', filter);
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
                    '<div class="full-start__button selector view--filmix_uhd">' +
                        '<svg width="128" height="118" viewBox="0 0 128 118" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                            '<rect y="33" width="128" height="52" rx="5" fill="white"/>' +
                            '<path d="M20 48H26V68H20V48Z" fill="currentColor"/>' +
                            '<path d="M34 48H54V54H40V56H52V62H40V68H34V48Z" fill="currentColor"/>' +
                            '<path d="M62 48H72L76 58L80 48H90V68H84V56L78 68H74L68 56V68H62V48Z" fill="currentColor"/>' +
                            '<path d="M98 48H108V68H98V48Z" fill="currentColor"/>' +
                            '<path d="M46 76L54 86L62 76H46Z" fill="white"/>' +
                            '<path d="M36 90C36 87.7909 37.7909 86 40 86H88C90.2091 86 92 87.7909 92 90V108C92 110.209 90.2091 112 88 112H40C37.7909 112 36 110.209 36 108V90Z" fill="white"/>' +
                            '<path d="M46 96V102H52V96H58V102H64V96H70V108H64V104H58V108H52V104H46V108H40V96H46Z" fill="currentColor"/>' +
                            '<path d="M78 96H88V100H84V102H88V106H84V108H78V96Z" fill="currentColor"/>' +
                        '</svg>' +
                        '<span>Filmix UHD</span>' +
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

        console.log('ShowyPro plugin v4.6 loaded (fixed proxy format)');
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
