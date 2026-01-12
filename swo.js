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
                    console.log('[ShowyPro] Response length:', res.length);
                    console.log('[ShowyPro] FULL RESPONSE:', res);
                    
                    if (res.length < 100 || res.indexOf('videos__') === -1) {
                        console.log('[ShowyPro] Invalid response, trying next proxy');
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

            this.parseHtml = function(html, selector, parseFunc) {
                var results = [];
                try {
                    var $dom = $('<div>' + html + '</div>');
                    var elements = $dom.find(selector);
                    
                    elements.each(function() {
                        var data = parseFunc($(this));
                        if (data) results.push(data);
                    });
                } catch(e) {
                    console.log('[ShowyPro] Parse error:', e);
                }
                return results;
            };

            this.initialize = function() {
                var _this = this;
                
                console.log('[ShowyPro] Initialize');
                console.log('[ShowyPro] Movie:', object.movie);
                
                filter.onBack = function() {
                    _this.start();
                };

                filter.onSelect = function(type, a, b) {
                    if (type == 'filter') {
                        if (a.stype == 'season') {
                            current_season = b.index + 1;
                            current_voice = null;
                            filter_find.voice = [];
                            _this.loadSeason(current_season);
                        } else if (a.stype == 'voice') {
                            current_voice = b.index;
                            _this.loadVoice(current_voice);
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

                // Используем kinopoisk_id если есть
                if (object.movie.kinopoisk_id || object.movie.kp_id) {
                    current_kinopoisk_id = object.movie.kinopoisk_id || object.movie.kp_id;
                    var url = 'http://' + BASE_DOMAIN + '?kinopoisk_id=' + current_kinopoisk_id;
                    url = sign(url);
                    
                    console.log('[ShowyPro] Using kinopoisk_id:', current_kinopoisk_id);
                    
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
                console.log('[ShowyPro] parseInitial');
                
                var seasons = this.parseHtml(html, '.videos__season', function($elem) {
                    var title = $elem.find('.videos__season-title').text().trim();
                    var seasonNum = parseInt(title) || 1;
                    return { title: title, season: seasonNum };
                });

                console.log('[ShowyPro] Seasons found:', seasons.length);

                if (seasons.length > 0) {
                    filter_find.season = seasons;
                    current_season = 1;
                    this.updateFilterMenu();
                    this.loadSeason(1);
                } else {
                    // Это фильм, парсим сразу озвучки и видео
                    this.parseSeasonContent(html);
                }
            };

            this.loadSeason = function(seasonNum) {
                var _this = this;
                scroll.clear();
                scroll.body().append(Lampa.Template.get('lampac_content_loading'));
                
                var url = 'http://' + BASE_DOMAIN + '?kinopoisk_id=' + current_kinopoisk_id + '&s=' + seasonNum;
                url = sign(url);
                
                console.log('[ShowyPro] Loading season:', seasonNum);
                
                this.requestWithProxy(url, function(html) {
                    _this.parseSeasonContent(html);
                }, function() {
                    _this.empty('Ошибка загрузки сезона');
                });
            };

            this.loadVoice = function(voiceIdx) {
                var _this = this;
                scroll.clear();
                scroll.body().append(Lampa.Template.get('lampac_content_loading'));
                
                var url = 'http://' + BASE_DOMAIN + '?kinopoisk_id=' + current_kinopoisk_id;
                if (current_season) url += '&s=' + current_season;
                url += '&t=' + voiceIdx;
                url = sign(url);
                
                console.log('[ShowyPro] Loading voice:', voiceIdx);
                
                this.requestWithProxy(url, function(html) {
                    _this.parseSeasonContent(html);
                }, function() {
                    _this.empty('Ошибка загрузки озвучки');
                });
            };

            this.parseSeasonContent = function(html) {
                console.log('[ShowyPro] parseSeasonContent');
                
                // Парсим озвучки
                var voices = this.parseHtml(html, '.videos__button', function($elem) {
                    var title = $elem.text().trim();
                    return { title: title };
                });

                // Парсим серии
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
                    } catch(e) { 
                        console.log('[ShowyPro] Episode parse error:', e);
                        return null; 
                    }
                });

                console.log('[ShowyPro] Voices:', voices.length, 'Episodes:', episodes.length);

                if (voices.length > 0 && filter_find.voice.length === 0) {
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
                    var seasonIdx = current_season ? current_season - 1 : 0;
                    select.push({
                        title: filter_translate.season,
                        subtitle: filter_find.season[seasonIdx].title,
                        items: filter_find.season.map(function(s, i) {
                            return { title: s.title, selected: i === seasonIdx, index: i };
                        }),
                        stype: 'season'
                    });
                }

                if (filter_find.voice.length > 0) {
                    var voiceIdx = current_voice !== null ? current_voice : 0;
                    select.push({
                        title: filter_translate.voice,
                        subtitle: filter_find.voice[voiceIdx].title,
                        items: filter_find.voice.map(function(v, i) {
                            return { title: v.title, selected: i === voiceIdx, index: i };
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
                    var quality_text = qualities.length > 0 ? qualities[0] : '';

                    var html = $('<div class="online-prestige selector">' +
                        '<div class="online-prestige__body">' +
                            '<div class="online-prestige__title">' + element.title + '</div>' +
                            '<div class="online-prestige__info">' + 
                                (element.season ? 'S' + element.season : '') +
                                (element.episode ? 'E' + element.episode : '') +
                                (quality_text ? ' • ' + quality_text : '') +
                            '</div>' +
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

                console.log('[ShowyPro] Episodes displayed:', videos.length);
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
                } else {
                    Lampa.Noty.show('Нет доступных ссылок');
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
                console.log('[ShowyPro] create()');
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
                    Lampa.Component.add('showypro', component);
                    Lampa.Activity.push({
                        url: '',
                        title: 'ShowyPro',
                        component: 'showypro',
                        movie: e.object,
                        page: 1
                    });
                });

                e.object.activity.render().find('.view--torrent').after(btn);
            }
        });

        console.log('[ShowyPro] Plugin v5.0 loaded (fixed API structure)');
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
