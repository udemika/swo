
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
        var Network = Lampa.Request || Lampa.Reguest;

        function sign(url) {
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            return url;
        }

        function component(object) {
            var html = $('<div></div>');
            var scroll = new Lampa.Scroll({mask: true, over: true});
            var network = new Network();
            var filter = new Lampa.Filter(object);
            var last;

            var current_kinopoisk_id = null;
            var current_season = 1;
            var current_voice = 0;
            var attempts = 0;

            filter.onSearch = function(){};
            filter.onBack = function(){};
            filter.render().find('.selector').on('hover:focus', function(e){ last = e.target; });

            html.append(filter.render());
            html.append(scroll.render());

            this.create = function() {
                console.log('[ShowyPro] create()');
                Lampa.Controller.add('content', {
                    toggle: function() { 
                        Lampa.Controller.collectionSet(scroll.render());
                        Lampa.Controller.collectionFocus(last || false, scroll.render());
                    },
                    back: this.back
                });
                this.initialize();
                Lampa.Controller.toggle('content');
                return this.render();
            };

            this.initialize = function() {
                console.log('[ShowyPro] Initialize');
                console.log('[ShowyPro] Movie:', object.movie);

                if (object.movie.kinopoisk_id || object.movie.kp_id) {
                    current_kinopoisk_id = object.movie.kinopoisk_id || object.movie.kp_id;
                    var url = 'http://' + BASE_DOMAIN + '?kinopoisk_id=' + current_kinopoisk_id;
                    if (object.movie.title) url = Lampa.Utils.addUrlComponent(url, 'title=' + encodeURIComponent(object.movie.title));
                    url = sign(url);

                    console.log('[ShowyPro] Request:', url);
                    this.requestWithProxy(url, this.parse.bind(this));
                } else {
                    this.empty('Нет Kinopoisk ID');
                }
            };

            this.requestWithProxy = function(url, success, error) {
                var proxy = PROXIES[currentProxyIdx];
                var fullUrl = proxy + url;

                console.log('[ShowyPro] Proxy[' + currentProxyIdx + ']:', fullUrl);

                network.timeout(5000);
                network.silent(fullUrl, function(html) {
                    console.log('[ShowyPro] Response length:', html.length);
                    if (html.length > 100) {
                        success(html);
                    } else {
                        this.nextProxy(error);
                    }
                }.bind(this), function() {
                    this.nextProxy(error);
                }.bind(this));
            };

            this.nextProxy = function(error) {
                attempts++;
                currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                if (attempts < PROXIES.length) {
                    console.log('[ShowyPro] Next proxy, attempt:', attempts);
                    this.initialize();
                } else {
                    attempts = 0;
                    error ? error() : this.empty('Все прокси не работают');
                }
            };

            this.parse = function(html) {
                console.log('[ShowyPro] parse - HTML length:', html.length);
                try {
                    var $dom = $('<div>').html(html);

                    // Похожие фильмы
                    var similar = $dom.find('.videos__item.videos__season[data-json*="similar"]').first();
                    if (similar.length) {
                        console.log('[ShowyPro] Similar movies detected');
                        this.showSimilar($dom.find('.videos__item.videos__season'));
                        return;
                    }

                    // Сезоны
                    var seasons = [];
                    $dom.find('.videos__season-title').each(function() {
                        var title = $(this).text().trim();
                        var num = title.match(/(\d+)/)?.[1] || seasons.length + 1;
                        seasons.push({title: title, num: parseInt(num)});
                    });

                    console.log('[ShowyPro] Seasons:', seasons.length);

                    if (seasons.length) {
                        filter_find.season = seasons;
                        this.showSeasons(seasons);
                    } else {
                        this.parseContent(html);
                    }
                } catch(e) {
                    console.log('[ShowyPro] Parse error:', e);
                    this.empty('Ошибка парсинга');
                }
            };

            this.showSimilar = function(items) {
                scroll.clear();
                items.each((i, el) => {
                    var $item = $(el);
                    var title = $item.find('.videos__season-title').text().trim();
                    var data = $item.attr('data-json');

                    var card = $(`
                        <div class="selector" style="padding: 1rem; border-bottom: 1px solid #444; cursor: pointer;">
                            <div style="font-size: 1.3em; color: white;">${title}</div>
                        </div>
                    `);

                    card.on('hover:enter', () => {
                        try {
                            var json = JSON.parse(data);
                            if (json.url) {
                                var postid = json.url.match(/postid=(\d+)/)?.[1];
                                if (postid) this.loadPost(postid);
                            }
                        } catch(e) {
                            console.log('[ShowyPro] Similar parse error:', e);
                        }
                    });

                    scroll.append(card);
                });
            };

            this.showSeasons = function(seasons) {
                scroll.clear();

                seasons.forEach((season, i) => {
                    var card = $(`
                        <div class="selector" style="padding: 1rem; border-bottom: 1px solid #444;">
                            <div style="font-size: 1.3em; color: white;">${season.title}</div>
                        </div>
                    `);

                    card.on('hover:enter', () => this.loadSeason(season.num));
                    scroll.append(card);
                });
            };

            this.loadSeason = function(num) {
                scroll.clear().append('<div style="padding: 2rem; text-align: center; color: #999;">Загрузка...</div>');
                var url = 'http://' + BASE_DOMAIN + '?kinopoisk_id=' + current_kinopoisk_id + '&s=' + num;
                url = sign(url);
                this.requestWithProxy(url, html => this.parseContent(html));
            };

            this.loadPost = function(postid) {
                scroll.clear().append('<div style="padding: 2rem; text-align: center; color: #999;">Загрузка...</div>');
                var url = 'http://' + BASE_DOMAIN + '?postid=' + postid;
                url = Lampa.Utils.addUrlComponent(url, 'kinopoisk_id=' + current_kinopoisk_id);
                url = sign(url);
                this.requestWithProxy(url, this.parse.bind(this));
            };

            this.parseContent = function(html) {
                console.log('[ShowyPro] parseContent');
                try {
                    var $dom = $('<div>').html(html);
                    var episodes = [];

                    $dom.find('.videos__item.videos__movie').each((i, el) => {
                        var $item = $(el);
                        var data = $item.attr('data-json');
                        var title = $item.find('.videos__item-title').text().trim();

                        try {
                            var json = JSON.parse(data);
                            if (json.url) {
                                episodes.push({
                                    title: title,
                                    url: json.url,
                                    quality: json.quality || {}
                                });
                            }
                        } catch(e) {}
                    });

                    console.log('[ShowyPro] Episodes:', episodes.length);
                    this.showEpisodes(episodes);
                } catch(e) {
                    console.log('[ShowyPro] Content parse error:', e);
                    this.empty('Нет серий');
                }
            };

            this.showEpisodes = function(episodes) {
                scroll.clear();

                episodes.forEach(episode => {
                    var qualities = Object.keys(episode.quality);
                    var qtext = qualities.join(', ') || 'HD';

                    var card = $(`
                        <div class="selector" style="padding: 1rem; border-bottom: 1px solid #444;">
                            <div style="font-size: 1.3em; color: white;">${episode.title}</div>
                            <div style="color: #999; font-size: 0.9em;">${qtext}</div>
                        </div>
                    `);

                    card.on('hover:enter', () => this.play(episode));
                    scroll.append(card);
                });
            };

            this.play = function(episode) {
                var urls = [];
                for (var q in episode.quality) {
                    urls.push({
                        title: episode.title + ' [' + q + ']',
                        url: episode.quality[q]
                    });
                }

                if (!urls.length && episode.url) {
                    urls.push({title: episode.title, url: episode.url});
                }

                if (urls.length) {
                    Lampa.Player.play(urls[0]);
                    if (urls.length > 1) Lampa.Player.playlist(urls);
                } else {
                    Lampa.Noty.show('Нет ссылок');
                }
            };

            this.empty = function(msg) {
                scroll.clear().append('<div style="padding: 4rem; text-align: center; color: #999; font-size: 1.2em;">' + msg + '</div>');
            };

            this.render = function() {
                return html;
            };

            this.back = function() {
                Lampa.Activity.backward();
            };
        }

        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'complite') {
                var btn = $(`
                    <div class="full-start__button selector" style="margin-left: 1rem;">
                        <div style="font-size: 1.2em; padding: 1rem;">ShowyPro</div>
                    </div>
                `);

                btn.on('hover:enter', function() {
                    Lampa.Component.add('showypro', component);
                    Lampa.Activity.push({
                        url: '',
                        title: 'ShowyPro',
                        component: 'showypro',
                        movie: e.data.movie
                    });
                });

                e.object.activity.render().find('.view--torrent').after(btn);
                console.log('[ShowyPro] Button added');
            }
        });

        console.log('[ShowyPro] v10.2 loaded - OLD Lampac compatible');
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', function(e) { if (e.type == 'ready') startPlugin(); });
})();
