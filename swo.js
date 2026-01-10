(function () {
    'use strict';

    /*
     FULL SHARA FXAPI + ОЗВУЧКИ (минимальные изменения)
     - Кнопка "Смотреть" должна вернуться
     - Добавлено меню выбора озвучки (если есть .videos__button)
     - Сервер: 146.103.111.209 (как в оригинале)
    */

    var Defined = {
        name: 'SHARA',
        video_host: 'http://146.103.111.209/',
        uid: 'p8nqb9ii',
        showy_token: 'ik377033-90eb-4d76-93c9-7605952a096l'
    };

    var Network = Lampa.Reguest;

    function component(object) {
        var network = new Network();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Explorer(object);

        var last;
        var raw_data = [];
        var voice_links = {};

        function buildUrl(custom) {
            if (!object.movie || !object.movie.kinopoisk_id) return null;

            var base = Defined.video_host + 'lite/fxapi?rjson=False' +
                       '&kinopoisk_id=' + object.movie.kinopoisk_id +
                       '&s=1' +
                       '&uid=' + Defined.uid +
                       '&showy_token=' + Defined.showy_token;

            if (custom) base += custom;
            return base;
        }

        function parseHtml(str) {
            var html = $('<div>' + str + '</div>');
            var items = [];

            // Собираем озвучки
            voice_links = {};
            html.find('.videos__button').each(function () {
                var el = $(this);
                var json = el.attr('data-json');
                if (!json) return;
                try {
                    json = JSON.parse(json);
                    var name = el.text().trim();
                    if (json.method === 'link' && json.url && name) {
                        voice_links[name] = json.url;
                    }
                } catch(e) {}
            });

            // Серии
            html.find('.videos__item').each(function () {
                var el = $(this);
                var json = el.attr('data-json');
                if (!json) return;
                try {
                    json = JSON.parse(json);
                    if (json.method === 'play') {
                        json.title = el.find('.videos__item-title').text() || json.title || 'Серия';
                        json.voice_name = json.translate || 'Стандарт';
                        items.push(json);
                    }
                } catch(e) {}
            });

            return items;
        }

        function play(item) {
            Lampa.Player.play({
                title: item.title,
                url: item.url,
                quality: item.quality || {},
                voice_name: item.voice_name,
                isonline: true
            });
        }

        function render(videos) {
            scroll.clear();

            videos.forEach(function (item) {
                var html = Lampa.Template.get('lampac_prestige_full', {
                    title: item.title,
                    time: '',
                    info: item.voice_name,
                    quality: item.quality ? Object.keys(item.quality).join(', ') : ''
                });

                html.on('hover:enter', function () {
                    play(item);
                });

                html.on('hover:focus', function (e) {
                    last = e.target;
                    scroll.update($(e.target), true);
                });

                scroll.append(html);
            });

            if (videos.length === 0) {
                scroll.append('<div style="padding:60px; text-align:center; opacity:0.5;">Нет серий</div>');
            }

            Lampa.Controller.enable('content');
        }

        function load(custom) {
            var url = buildUrl(custom);
            if (!url) return;

            network.native(url, function (str) {
                var videos = parseHtml(str);

                if (videos.length > 0) {
                    render(videos);
                } else if (Object.keys(voice_links).length > 0) {
                    // Показываем меню озвучек
                    var voices = ['Любой'].concat(Object.keys(voice_links));
                    Lampa.Select.show({
                        title: 'Выбор озвучки',
                        items: voices.map(v => ({title: v, value: v})),
                        onSelect: function(item) {
                            if (item.value === 'Любой') {
                                load();
                            } else {
                                var url = voice_links[item.value];
                                if (url) {
                                    load(url.replace(Defined.video_host, ''));
                                }
                            }
                        }
                    });
                } else {
                    empty();
                }
            }, empty, false, { dataType: 'text' });
        }

        function empty() {
            scroll.clear();
            scroll.append(Lampa.Template.get('lampac_does_not_answer', {}));
        }

        this.start = function () {
            load();

            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render(), files.render());
                    Lampa.Controller.collectionFocus(last || false, scroll.render());
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });

            Lampa.Controller.toggle('content');
        };

        this.render = function () {
            return files.render();
        };

        this.destroy = function () {
            network.clear();
            scroll.destroy();
            files.destroy();
        };
    }

    function startPlugin() {
        Lampa.Component.add('SHARA', component);

        Lampa.Manifest.plugins = {
            type: 'video',
            name: 'SHARA',
            description: 'SHARA FXAPI FULL + Озвучки',
            component: 'SHARA',
            onContextMenu: function () {
                return {
                    name: 'Смотреть онлайн',
                    description: 'SHARA'
                };
            },
            onContextLauch: function (object) {
                Lampa.Activity.push({
                    title: 'SHARA',
                    component: 'SHARA',
                    movie: object
                });
            }
        };
    }

    startPlugin();
})();