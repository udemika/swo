(function () {
    'use strict';

    /**
     * Filmix Nexus (Legacy Support)
     * - Системное окно фильтра (Lampa.Select)
     * - Отдельно сезоны и переводы
     * - Чек в корневом окне на последнем изменённом пункте
     * - Фикс: убран jQuery-селектор с кавычками (Syntax error, unrecognized expression)
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'http://showypro.com';

        var PROXIES = [
            'https://cors.byskaz.ru/',
            'http://85.198.110.239:8975/',
            'http://91.184.245.56:8975/',
            'https://apn10.akter-black.com/',
            'https://apn5.akter-black.com/',
            'https://cors557.deno.dev/'
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0'));
        if (isNaN(currentProxyIdx) || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

        function sign(url) {
            url = url + '';
            if (url.indexOf('uid=') === -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') === -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') === -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
            return url;
        }

        function toggleLoading(show) {
            try {
                if (typeof Lampa.Loading === 'function') Lampa.Loading(show);
                else if (Lampa.Loading && Lampa.Loading.show) show ? Lampa.Loading.show() : Lampa.Loading.hide();
            } catch (e) {}
        }

        function loadFilmix(movie) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var id = movie.kinopoisk_id || movie.kp_id || movie.id;
            var url = BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + id;
            if (!movie.kinopoisk_id && !movie.kp_id) url = BASE_DOMAIN + '/lite/fxapi?postid=' + id;

            var attempts = 0;

            var fetchWithRetry = function (targetUrl) {
                var proxy = PROXIES[currentProxyIdx];
                toggleLoading(true);

                network.native(proxy + sign(targetUrl), function (res) {
                    toggleLoading(false);
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                    displayFilmix(res, movie, fetchWithRetry);
                }, function () {
                    attempts++;
                    if (attempts < PROXIES.length) {
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        fetchWithRetry(targetUrl);
                    } else {
                        toggleLoading(false);
                        Lampa.Noty.show('Filmix: Ошибка сети (все прокси недоступны)');
                    }
                }, false, { dataType: 'text' });
            };

            fetchWithRetry(url);
        }

        function displayFilmix(res, movie, fetchCallback) {
            var $dom = $('<div>' + res + '</div>');

            var seasons = [];
            var voices = [];
            var items = [];

            var savedSeasonIdx = parseInt(Lampa.Storage.get('fx_nexus_season_idx', '0'));
            if (isNaN(savedSeasonIdx) || savedSeasonIdx < 0) savedSeasonIdx = 0;

            var savedVoiceIdx = parseInt(Lampa.Storage.get('fx_nexus_voice_idx', '0'));
            if (isNaN(savedVoiceIdx) || savedVoiceIdx < 0) savedVoiceIdx = 0;

            var last = Lampa.Storage.get('fx_nexus_last_filter', 'season'); // 'season' | 'voice'

            // Сезоны: строго по классу videos__season
            $dom.find('.videos__item.videos__season[data-json]').each(function () {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    if (json && json.method === 'link' && json.url) {
                        seasons.push({
                            title: ($(this).find('.videos__season-title').text().trim() || $(this).text().trim()),
                            url: json.url
                        });
                    }
                } catch (e) {}
            });

            // Переводы: строго по videos__button
            $dom.find('.videos__button[data-json]').each(function () {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    if (json && json.method === 'link' && json.url) {
                        voices.push({ title: $(this).text().trim(), url: json.url });
                    }
                } catch (e) {}
            });

            // Видео: парсим JSON и берём method === 'play' без сложных CSS-селекторов
            $dom.find('.videos__item[data-json]').each(function () {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    if (!json || json.method !== 'play' || !json.url) return;

                    items.push({
                        title: $(this).find('.videos__item-title').text().trim() || json.title || 'Видео',
                        quality: json.maxquality || 'HD',
                        url: sign(json.url)
                    });
                } catch (e) {}
            });

            // Если пришли только сезоны — сразу уходим в выбранный сезон
            if (!items.length && seasons.length && !voices.length) {
                if (savedSeasonIdx >= seasons.length) savedSeasonIdx = 0;
                Lampa.Storage.set('fx_nexus_season_idx', String(savedSeasonIdx));
                fetchCallback(seasons[savedSeasonIdx].url);
                return;
            }

            if (savedSeasonIdx >= seasons.length) savedSeasonIdx = 0;
            if (savedVoiceIdx >= voices.length) savedVoiceIdx = 0;

            function openSystemFilterSelect() {
                var enabled = Lampa.Controller.enabled().name;

                function closeAll() {
                    setTimeout(function () { Lampa.Select.close(); }, 10);
                    Lampa.Controller.toggle(enabled);
                }

                function openSeasons() {
                    Lampa.Select.show({
                        title: 'Сезон',
                        items: seasons.map(function (s, i) {
                            return { title: s.title, index: i, selected: i === savedSeasonIdx };
                        }),
                        onBack: openRoot,
                        onSelect: function (a) {
                            savedSeasonIdx = a.index || 0;
                            last = 'season';
                            Lampa.Storage.set('fx_nexus_last_filter', last);
                            Lampa.Storage.set('fx_nexus_season_idx', String(savedSeasonIdx));
                            closeAll();
                            fetchCallback(seasons[savedSeasonIdx].url);
                        }
                    });
                }

                function openVoices() {
                    Lampa.Select.show({
                        title: 'Перевод',
                        items: voices.map(function (v, i) {
                            return { title: v.title, index: i, selected: i === savedVoiceIdx };
                        }),
                        onBack: openRoot,
                        onSelect: function (a) {
                            savedVoiceIdx = a.index || 0;
                            last = 'voice';
                            Lampa.Storage.set('fx_nexus_last_filter', last);
                            Lampa.Storage.set('fx_nexus_voice_idx', String(savedVoiceIdx));
                            closeAll();
                            fetchCallback(voices[savedVoiceIdx].url);
                        }
                    });
                }

                function openRoot() {
                    var root = [];

                    root.push({ title: 'Сбросить фильтр', reset: true });

                    if (voices.length) {
                        root.push({
                            title: 'Перевод',
                            subtitle: voices[savedVoiceIdx] ? voices[savedVoiceIdx].title : '',
                            voice: true,
                            selected: last === 'voice'
                        });
                    }

                    if (seasons.length) {
                        root.push({
                            title: 'Сезон',
                            subtitle: seasons[savedSeasonIdx] ? seasons[savedSeasonIdx].title : '',
                            season: true,
                            selected: last === 'season'
                        });
                    }

                    Lampa.Select.show({
                        title: 'Фильтр',
                        items: root,
                        onBack: function () { Lampa.Controller.toggle(enabled); },
                        onSelect: function (a) {
                            if (a.reset) {
                                savedSeasonIdx = 0;
                                savedVoiceIdx = 0;
                                last = 'season';
                                Lampa.Storage.set('fx_nexus_last_filter', last);
                                Lampa.Storage.set('fx_nexus_season_idx', '0');
                                Lampa.Storage.set('fx_nexus_voice_idx', '0');
                                closeAll();
                                if (seasons[0]) fetchCallback(seasons[0].url);
                                else if (voices[0]) fetchCallback(voices[0].url);
                                return;
                            }

                            if (a.voice) return openVoices();
                            if (a.season) return openSeasons();
                        }
                    });
                }

                openRoot();
            }

            if (typeof Lampa.Interaction !== 'undefined') {
                var interaction = new Lampa.Interaction({
                    card: movie,
                    filter: (seasons.length > 0 || voices.length > 0)
                });

                interaction.onPlay = function (item) {
                    Lampa.Player.play({ url: item.url, title: item.title, movie: movie });
                };

                interaction.onFilter = function () {
                    openSystemFilterSelect();
                };

                Lampa.Activity.push({
                    component: 'interaction',
                    title: 'Filmix',
                    object: interaction,
                    onBack: function () { Lampa.Activity.backward(); }
                });

                interaction.content(items);
            } else {
                Lampa.Select.show({
                    title: (movie.title || movie.name || 'Filmix'),
                    items: items.map(function (i) { return { title: i.title + ' [' + i.quality + ']', value: i }; }),
                    onSelect: function (a) { Lampa.Player.play({ url: a.value.url, title: a.value.title, movie: movie }); },
                    onBack: function () { Lampa.Controller.toggle('full_start'); }
                });
            }
        }

        function addButton(render, movie) {
            if (render.find('.fx-nexus-native').length) return;

            var target = render.find('.view--torrent, .view--online, .button--play, .full-start__buttons').last();
            if (!target.length) return;

            var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Filmix UHD</span></div>');
            btn.on('hover:enter', function () { loadFilmix(movie); });

            if (target.hasClass('full-start__buttons')) target.append(btn);
            else target.after(btn);

            if (Lampa.Controller.toggle) Lampa.Controller.toggle(Lampa.Controller.enabled().name);
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') addButton(e.object.activity.render(), e.data.movie);
        });

        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') {
                var active = Lampa.Activity.active();
                if (active && (active.component == 'full_start' || active.component == 'select')) {
                    var card = active.card || (active.object && active.object.movie);
                    if (card) addButton(active.activity.render(), card);
                }
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
