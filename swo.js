(function () {
    'use strict';

    function startPlugin() {
        if (window.showypro_plugin_loaded) return;
        window.showypro_plugin_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'smotretk.com/lite/fxapi';
        
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
            if (url.indexOf('uid=') == -1)
                url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);

            if (url.indexOf('showy_token=') == -1)
                url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);

            return url;
        }

        var Network = Lampa.Request || Lampa.Reguest;

        function component(object) {
            var network = new Network();
            var scroll = new Lampa.Scroll({mask: true, over: true});
            var files = new Lampa.Explorer(object);
            var filter = new Lampa.Filter(object);

            var last;
            var attempts = 0;
            var images = [];

            var current_kinopoisk_id = null;
            var current_postid = null;
            var current_season = null;
            var current_voice = null;
            var voice_params = [];
            var cache = {};

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

                network.native(fullUrl, function(res) {
                    if (res.length < 100) {
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

                    if (attempts < PROXIES.length) {
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        _this.requestWithProxy(url, onSuccess, onError);
                    } else {
                        attempts = 0;
                        onError(err);
                    }
                }, false, {dataType: 'text'});
            };

            this.initialize = function() {
                var _this = this;

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
                }

                var url = 'http://' + BASE_DOMAIN + '?';

                if (object.movie.title) {
                    url = Lampa.Utils.addUrlComponent(url, 'title=' + encodeURIComponent(object.movie.title).replace(/%20/g, '+'));
                }

                if (object.movie.original_title) {
                    url = Lampa.Utils.addUrlComponent(url, 'original_title=' + encodeURIComponent(object.movie.original_title).replace(/%20/g, '+'));
                }

                url = sign(url);

                _this.requestWithProxy(url, function(html) {
                    _this.parseInitial(html);
                }, function() {
                    _this.empty('Ошибка загрузки');
                });
            };

            this.parseInitial = function(html) {
                var _this = this;

                try {
                    var $dom = $('<div>' + html + '</div>');
                    var seasons = [];

                    $dom.find('a[data-season]').each(function() {
                        var season = {
                            season: $(this).attr('data-season'),
                            url: $(this).attr('href'),
                            title: 'Сезон ' + $(this).attr('data-season')
                        };

                        if (seasons.filter(function(s) {
                            return s.season == season.season;
                        }).length == 0) {
                            seasons.push(season);
                        }
                    });

                    filter_find.season = seasons;

                    if (filter_find.season.length) {
                        current_season = filter_find.season[0].season;
                        _this.loadSeason(current_season);
                    } else {
                        _this.empty('Сезоны не найдены');
                    }
                } catch (e) {
                    console.error('Parse error:', e);
                    _this.empty('Ошибка парсинга');
                }
            };

            this.loadSeason = function(season) {
                var _this = this;
                var seasonData = filter_find.season.find(function(s) {
                    return s.season == season;
                });

                if (!seasonData) {
                    _this.empty('Сезон не найден');
                    return;
                }

                _this.requestWithProxy(seasonData.url, function(html) {
                    _this.parseVoices(html);
                }, function() {
                    _this.empty('Ошибка загрузки сезона');
                });
            };

            this.parseVoices = function(html) {
                var _this = this;

                try {
                    var $dom = $('<div>' + html + '</div>');
                    var voices = [];

                    $dom.find('a[data-voice]').each(function() {
                        var voice = {
                            url: $(this).attr('href'),
                            title: $(this).text() || 'Озвучка ' + $(this).attr('data-voice')
                        };

                        if (voices.filter(function(v) {
                            return v.url == voice.url;
                        }).length == 0) {
                            voices.push(voice);
                        }
                    });

                    filter_find.voice = voices;
                    voice_params = voices;

                    if (filter_find.voice.length) {
                        _this.loadVoice(voices[0]);
                    } else {
                        _this.empty('Озвучки не найдены');
                    }
                } catch (e) {
                    console.error('Parse error:', e);
                    _this.empty('Ошибка парсинга озвучек');
                }
            };

            this.loadVoice = function(voiceData) {
                var _this = this;

                _this.requestWithProxy(voiceData.url, function(html) {
                    _this.parseVideos(html);
                }, function() {
                    _this.empty('Ошибка загрузки озвучки');
                });
            };

            this.parseVideos = function(html) {
                var _this = this;

                try {
                    var $dom = $('<div>' + html + '</div>');
                    var videos = [];

                    $dom.find('a[data-video]').each(function() {
                        var $this = $(this);
                        var video = {
                            title: $this.text() || 'Видео',
                            url: $this.attr('href'),
                            method: 'play',
                            quality: {
                                '720p': $this.attr('href')
                            }
                        };

                        videos.push(video);
                    });

                    if (videos.length) {
                        _this.display(videos);
                    } else {
                        _this.empty('Видео не найдено');
                    }
                } catch (e) {
                    console.error('Parse error:', e);
                    _this.empty('Ошибка парсинга видео');
                }
            };

            this.display = function(videos) {
                var _this = this;
                var seasons = filter_find.season.map(function(s) {
                    return s.title;
                });
                var voices = filter_find.voice.map(function(v) {
                    return v.title;
                });

                this.filter({
                    season: seasons,
                    voice: voices
                });

                scroll.clear();

                videos.forEach(function(video, index) {
                    var item = $('<div class="online-prestige selector">' +
                        '<div class="online-prestige__body">' +
                        '<div class="online-prestige__title">' + video.title + '</div>' +
                        '</div>' +
                        '</div>');

                    item.on('hover:enter', function() {
                        Lampa.Player.play({
                            title: video.title,
                            url: video.url,
                            quality: video.quality
                        });
                    });

                    item.on('hover:focus', function(e) {
                        last = e.target;
                        scroll.update($(e.target), true);
                    });

                    scroll.append(item);
                });

                Lampa.Controller.enable('content');
            };

            this.filter = function(filter_items) {
                var select = [];

                if (filter_items.season && filter_items.season.length) {
                    select.push({
                        title: 'Сезон',
                        subtitle: filter_items.season[0],
                        items: filter_items.season.map(function(s, i) {
                            return {
                                title: s,
                                selected: i == 0,
                                index: i
                            };
                        }),
                        stype: 'season'
                    });
                }

                if (filter_items.voice && filter_items.voice.length) {
                    select.push({
                        title: 'Озвучка',
                        subtitle: filter_items.voice[0],
                        items: filter_items.voice.map(function(v, i) {
                            return {
                                title: v,
                                selected: i == 0,
                                index: i
                            };
                        }),
                        stype: 'voice'
                    });
                }

                filter.set('filter', select);
            };

            this.empty = function(message) {
                scroll.clear();
                var html = $('<div class="online-empty">' +
                    '<div class="online-empty__title">' + (message || 'Ничего не найдено') + '</div>' +
                    '</div>');
                scroll.append(html);
                this.loading(false);
            };

            this.loading = function(status) {
                if (status) {
                    this.activity.loader(true);
                } else {
                    this.activity.loader(false);
                }
            };

            this.create = function() {
                return files.render();
            };

            this.start = function() {
                if (Lampa.Activity.active().activity !== this.activity) return;

                Lampa.Controller.add('content', {
                    toggle: function() {
                        Lampa.Controller.collectionSet(scroll.render(), files.render());
                        Lampa.Controller.collectionFocus(last || false, scroll.render());
                    },
                    up: function() {
                        Lampa.Controller.toggle('head');
                    },
                    down: function() {
                        // Navigation down
                    },
                    back: function() {
                        Lampa.Activity.backward();
                    }
                });

                this.initialize();
                Lampa.Controller.toggle('content');
            };

            this.destroy = function() {
                network.clear();
                scroll.destroy();
                files.destroy();
                images = [];
            };
        }

        Lampa.Manifest.plugins = {
            type: 'video',
            name: 'ShowyPro',
            version: '1.0.0',
            component: 'showypro'
        };

        Lampa.Component.add('showypro', component);
    }

    if (!window.showypro_plugin_loaded) {
        startPlugin();
    }
})();