
(function () {
    'use strict';

    function startPlugin() {
        if (window.showypro_plugin_loaded) return;
        window.showypro_plugin_loaded = true;

        console.log('[ShowyPro] v11.0 loading...');

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

        var Network = Lampa.Request || Lampa.Reguest;

        function sign(url) {
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            return url;
        }

        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'complite') {
                var btn = $('<div class="full-start__button selector" style="margin-left:1rem;"><div style="font-size:1.2em;padding:1rem;">ShowyPro</div></div>');
                btn.on('hover:enter', function() {
                    Lampa.Component.add('showypro', showypro_component);
                    Lampa.Activity.push({
                        url: '',
                        title: 'ShowyPro',
                        component: 'showypro',
                        movie: e.data.movie,
                        page: 1
                    });
                });
                e.object.activity.render().find('.view--torrent').after(btn);
                console.log('[ShowyPro] Button OK');
            }
        });

        var showypro_component = function(object) {
            var network = new Network();
            var scroll = new Lampa.Scroll({mask: true, over: true});
            var html = $('<div></div>');
            var last;

            var current_kinopoisk_id = null;

            this.create = function() {
                console.log('[ShowyPro] create()');
                html.append(scroll.render());
                scroll.append('<div style="padding:2rem;text-align:center;color:#999">Загрузка...</div>');
                Lampa.Controller.add('content', {
                    toggle: function() { 
                        Lampa.Controller.collectionSet(scroll.render());
                        Lampa.Controller.collectionFocus(last, scroll.render());
                    },
                    right: function() { Lampa.Controller.toggle('menu'); },
                    left: function() { if (Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu'); },
                    back: this.back
                });
                this.activityLoader();
                return html;
            };

            this.start = function() {
                console.log('[ShowyPro] start()');
                Lampa.Controller.toggle('content');
            };

            this.activityLoader = function() {
                if (object.movie.kinopoisk_id || object.movie.kp_id) {
                    current_kinopoisk_id = object.movie.kinopoisk_id || object.movie.kp_id;
                    var url = 'http://' + BASE_DOMAIN + '?kinopoisk_id=' + current_kinopoisk_id;
                    if (object.movie.title) url = Lampa.Utils.addUrlComponent(url, 'title=' + encodeURIComponent(object.movie.title));
                    url = sign(url);

                    console.log('[ShowyPro] URL:', url);
                    this.requestProxy(url);
                } else {
                    scroll.clear().append('<div style="padding:4rem;text-align:center;color:#999;font-size:1.2em">Нет Kinopoisk ID</div>');
                }
            };

            this.requestProxy = function(url, success, error) {
                var proxy = PROXIES[0]; // Только первый рабочий
                var fullUrl = proxy + url;

                console.log('[ShowyPro] Fetch:', fullUrl);

                network.native(fullUrl, (html) => {
                    console.log('[ShowyPro] HTML length:', html.length);
                    if (html.length > 500) {
                        this.parseHTML(html);
                    } else {
                        this.empty('Пустой ответ сервера');
                    }
                }, () => {
                    this.empty('Ошибка сети');
                }, false, {dataType: 'text'});
            };

            this.parseHTML = function(html) {
                console.log('[ShowyPro] Parsing...');
                try {
                    var $dom = $('<div>').html(html);

                    // Похожие фильмы
                    var similarItems = $dom.find('.videos__item.videos__season');
                    if (similarItems.length) {
                        console.log('[ShowyPro] Similar movies:', similarItems.length);
                        this.showList(similarItems, 'Похожие фильмы', (item) => {
                            var data = item.attr('data-json');
                            try {
                                var json = JSON.parse(data);
                                if (json.url) {
                                    var postid = json.url.match(/postid=(\d+)/);
                                    if (postid) this.loadContent('postid=' + postid[1]);
                                }
                            } catch(e) {}
                        });
                        return;
                    }

                    // Эпизоды
                    var episodes = $dom.find('.videos__item.videos__movie');
                    console.log('[ShowyPro] Episodes:', episodes.length);
                    if (episodes.length) {
                        this.showEpisodes(episodes);
                    } else {
                        this.empty('Контент не найден');
                    }
                } catch(e) {
                    console.log('[ShowyPro] Parse error:', e);
                    this.empty('Ошибка парсинга');
                }
            };

            this.showList = function(items, title, onclick) {
                scroll.clear();
                if (items.length) {
                    items.each((i, el) => {
                        var $item = $(el);
                        var text = $item.find('.videos__season-title,.videos__item-title').first().text().trim();
                        var card = $(`<div class="selector" style="padding:1.2rem;border-bottom:1px solid #444"><div style="font-size:1.3em;color:white">${text}</div></div>`);
                        card.on('hover:enter', () => onclick($item));
                        card.on('hover:focus', (e) => last = e.target);
                        scroll.append(card);
                    });
                } else {
                    scroll.append(`<div style="padding:3rem;text-align:center;color:#999">${title} не найдены</div>`);
                }
            };

            this.showEpisodes = function(items) {
                scroll.clear();
                items.each((i, el) => {
                    var $item = $(el);
                    var title = $item.find('.videos__item-title').text().trim();
                    var data = $item.attr('data-json');

                    var card = $(`<div class="selector" style="padding:1.2rem;border-bottom:1px solid #444"><div style="font-size:1.3em;color:white">${title}</div></div>`);

                    card.on('hover:enter', () => {
                        try {
                            var json = JSON.parse(data);
                            if (json.url) {
                                Lampa.Player.play(json.url);
                            } else if (json.quality) {
                                var q = Object.keys(json.quality)[0];
                                Lampa.Player.play(json.quality[q]);
                            }
                        } catch(e) {
                            Lampa.Noty.show('Ошибка воспроизведения');
                        }
                    });

                    card.on('hover:focus', (e) => last = e.target);
                    scroll.append(card);
                });
            };

            this.loadContent = function(params) {
                scroll.clear().append('<div style="padding:2rem;text-align:center;color:#999">Загрузка...</div>');
                var url = 'http://' + BASE_DOMAIN + '?' + params + '&kinopoisk_id=' + current_kinopoisk_id;
                url = sign(url);
                this.requestProxy(url);
            };

            this.empty = function(msg) {
                scroll.clear().append('<div style="padding:4rem;text-align:center;color:#999;font-size:1.2em">' + msg + '</div>');
            };

            this.render = function() {
                return html;
            };

            this.back = function() {
                Lampa.Activity.backward();
            };
        };

        console.log('[ShowyPro] v11.0 ready');
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
