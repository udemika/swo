
(function () {
    'use strict';

    function startPlugin() {
        if (window.showypro_plugin_loaded) return;
        window.showypro_plugin_loaded = true;

        console.log('[ShowyPro] v13.0 SUPER FIX');

        var uid = 'i8nqb9vw';
        var token = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var api = 'showypro.com/lite/fxapi';
        var cors = 'https://cors.byskaz.ru/';

        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'complite') {
                var btn = document.createElement('div');
                btn.className = 'full-start__button selector';
                btn.style.marginLeft = '1rem';
                btn.innerHTML = '<div style="font-size:1.2em;padding:1rem;">ShowyPro</div>';

                btn.addEventListener('hover:enter', function() {
                    Lampa.Component.add('showypro', component);
                    Lampa.Activity.push({
                        url: '',
                        title: 'ShowyPro',
                        component: 'showypro',
                        movie: e.data.movie
                    });
                });

                e.object.activity.render().find('.view--torrent')[0].after(btn);
            }
        });

        var component = function(object) {
            var _this = this;
            var network = new Lampa.Request();
            var scroll = new Lampa.Scroll({mask: true, over: true});
            var html = document.createElement('div');
            var last;

            var kp_id = null;

            this.create = function() {
                console.log('[ShowyPro] CREATE v13');
                html.appendChild(scroll.render());
                _this.loading();

                Lampa.Controller.add('content', {
                    toggle: function() {
                        Lampa.Controller.collectionSet(scroll.render());
                        Lampa.Controller.collectionFocus(last, scroll.render());
                    },
                    back: function() { Lampa.Activity.backward(); }
                });

                return html;
            };

            this.start = function() {
                console.log('[ShowyPro] START v13');
                Lampa.Controller.toggle('content');
                _this.load();
            };

            this.loading = function() {
                scroll.clear();
                var div = document.createElement('div');
                div.style.padding = '4rem';
                div.style.textAlign = 'center';
                div.style.color = '#aaa';
                div.style.fontSize = '1.1em';
                div.textContent = '🔄 Загрузка ShowyPro...';
                scroll.append(div);
            };

            this.load = function() {
                if (!object.movie.kinopoisk_id && !object.movie.kp_id) {
                    _this.error('Нет ID фильма');
                    return;
                }

                kp_id = object.movie.kinopoisk_id || object.movie.kp_id;
                var url = 'http://' + api + '?kinopoisk_id=' + kp_id;
                if (object.movie.title) {
                    url = Lampa.Utils.addUrlComponent(url, 'title=' + encodeURIComponent(object.movie.title));
                }
                url = Lampa.Utils.addUrlComponent(url, 'uid=' + uid);
                url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + token);

                console.log('[ShowyPro] LOAD:', url);
                network.timeout(10000);
                network.native(cors + url, function(html) {
                    console.log('[ShowyPro] OK:', html.length);
                    _this.parseHTML(html);
                }, function() {
                    _this.error('Сервер недоступен');
                }, false, {dataType: 'text'});
            };

            this.parseHTML = function(html) {
                try {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(html, 'text/html');
                    var items = doc.querySelectorAll('.videos__item.videos__season, .videos__item.videos__movie');

                    console.log('[ShowyPro] Items:', items.length);

                    if (items.length) {
                        this.showList(items);
                    } else {
                        this.error('Контент не найден');
                    }
                } catch(e) {
                    console.log('[ShowyPro] Parse:', e);
                    this.error('Ошибка разбора');
                }
            };

            this.showList = function(items) {
                scroll.clear();

                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    var title = item.querySelector('.videos__season-title, .videos__item-title');
                    if (!title) continue;

                    var titleText = title.textContent.trim();
                    var dataAttr = item.getAttribute('data-json');

                    var card = document.createElement('div');
                    card.className = 'selector';
                    card.style.padding = '1.5rem';
                    card.style.borderBottom = '1px solid #333';
                    card.style.background = 'rgba(0,0,0,0.4)';
                    card.innerHTML = '<div style="font-size:1.4em;color:#fff;line-height:1.2">' + titleText + '</div>';

                    card.addEventListener('hover:enter', (function(data, title) {
                        return function() {
                            if (data) {
                                try {
                                    var json = JSON.parse(data);
                                    if (json.url) {
                                        Lampa.Player.play(json.url);
                                        return;
                                    }
                                    if (json.quality) {
                                        var qs = Object.keys(json.quality);
                                        if (qs.length) {
                                            Lampa.Player.play(json.quality[qs[0]]);
                                            return;
                                        }
                                    }
                                } catch(e) {}
                            }
                            Lampa.Noty.show('Нет ссылки');
                        };
                    })(dataAttr, titleText));

                    card.addEventListener('hover:focus', function(e) {
                        last = e.target;
                        scroll.update(card, true);
                    });

                    scroll.append(card);
                }
            };

            this.error = function(msg) {
                scroll.clear();
                var div = document.createElement('div');
                div.style.padding = '4rem';
                div.style.textAlign = 'center';
                div.style.color = '#ff6b6b';
                div.style.fontSize = '1.1em';
                div.textContent = '❌ ' + msg;
                scroll.append(div);
            };
        };

        console.log('[ShowyPro] v13 LOADED');
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
