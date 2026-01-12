(function () {
    'use strict';

    /**
     * Filmix UHD (showypro.com)
     * UI: использовать системные окна Lampa.Select (НЕ Lampa.Filter боковую панель).
     * Навигация данных showypro:
     * - .videos__item.videos__season[data-json] -> {method:"link", url:...} (сезоны)
     * - .videos__button[data-json] -> {method:"link", url:...} (переводы)
     * - .videos__item.videos__movie[data-json] -> {method:"play", url:..., quality:{...}} (серии)
     */

    function startPlugin() {
        if (window.filmix_uhd_loaded) return;
        window.filmix_uhd_loaded = true;

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

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_uhd_proxy_idx', '0'));
        if (isNaN(currentProxyIdx) || currentProxyIdx < 0 || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

        function sign(url) {
            url = url + '';
            if (url.indexOf('uid=') === -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') === -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') === -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
            return url;
        }

        function toggleLoading(show) {
            try {
                if (Lampa.Loading && Lampa.Loading.start && Lampa.Loading.stop) {
                    show ? Lampa.Loading.start() : Lampa.Loading.stop();
                } else if (typeof Lampa.Loading === 'function') {
                    Lampa.Loading(show);
                }
            } catch (e) { }
        }

        function parseResponse(resText) {
            var $dom = $('<div>' + resText + '</div>');

            var seasons = [];
            var voices = [];
            var items = [];

            // Сезоны
            $dom.find('.videos__item.videos__season[data-json]').each(function () {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    if (json && json.method === 'link' && json.url) {
                        seasons.push({
                            title: ($(this).find('.videos__season-title').text().trim() || $(this).text().trim() || 'Сезон'),
                            url: json.url
                        });
                    }
                } catch (e) { }
            });

            // Переводы
            $dom.find('.videos__button[data-json]').each(function () {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    if (json && json.method === 'link' && json.url) {
                        voices.push({
                            title: ($(this).text().trim() || 'Перевод'),
                            url: json.url
                        });
                    }
                } catch (e) { }
            });

            // Серии
            $dom.find('.videos__item.videos__movie[data-json], .videos__item[data-json]').each(function () {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    if (!json || json.method !== 'play' || !json.url) return;

                    var sAttr = $(this).attr('s');
                    var eAttr = $(this).attr('e');

                    var season = sAttr ? parseInt(sAttr, 10) : undefined;
                    var episode = eAttr ? parseInt(eAttr, 10) : undefined;

                    var title = ($(this).find('.videos__item-title').text().trim() || json.title || 'Видео');
                    title = title.replace(/\s+/g, ' ').trim();

                    items.push({
                        title: title,
                        url: sign(json.url),
                        qualityMap: json.quality || null,
                        season: season,
                        episode: episode
                    });
                } catch (e) { }
            });

            return { seasons: seasons, voices: voices, items: items };
        }

        function pickQualityUrl(item) {
            var url = item.url;
            try {
                if (item.qualityMap) {
                    // В Lampa дефолт качества хранится в storage (часто как video_quality_default)
                    var q = Lampa.Storage.get('video_quality_default');
                    if (q && item.qualityMap[q]) url = sign(item.qualityMap[q]);
                }
            } catch (e) { }
            return url;
        }

        function loadFilmix(movie) {
            var network = new (Lampa.Request || Lampa.Reguest)();

            var kp = movie.kinopoisk_id || movie.kinopoiskid || movie.kinopoisk || movie.kp_id || movie.kp;
            var id = kp || movie.id;

            var url = BASE_DOMAIN + '/lite/fxapi?kinopoisk_id=' + encodeURIComponent(id);

            var attempts = 0;

            var fetchWithRetry = function (targetUrl) {
                var proxy = PROXIES[currentProxyIdx];
                toggleLoading(true);

                network.native(proxy + sign(targetUrl), function (res) {
                    toggleLoading(false);
                    Lampa.Storage.set('fx_uhd_proxy_idx', currentProxyIdx.toString());
                    displayFilmix(res, movie, fetchWithRetry);
                }, function () {
                    attempts++;
                    if (attempts < PROXIES.length) {
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        fetchWithRetry(targetUrl);
                    } else {
                        toggleLoading(false);
                        Lampa.Noty.show('Filmix UHD: Ошибка сети (все прокси недоступны)');
                    }
                }, false, { dataType: 'text' });
            };

            fetchWithRetry(url);
        }

        function displayFilmix(resText, movie, fetchCallback) {
            var parsed = parseResponse(resText);

            var seasons = parsed.seasons;
            var voices = parsed.voices;
            var items = parsed.items;

            var savedSeasonIdx = parseInt(Lampa.Storage.get('fx_uhd_season_idx', '0'));
            if (isNaN(savedSeasonIdx) || savedSeasonIdx < 0) savedSeasonIdx = 0;

            var savedVoiceIdx = parseInt(Lampa.Storage.get('fx_uhd_voice_idx', '0'));
            if (isNaN(savedVoiceIdx) || savedVoiceIdx < 0) savedVoiceIdx = 0;

            var lastFilter = Lampa.Storage.get('fx_uhd_last_filter', 'season'); // 'season' | 'voice'

            if (savedSeasonIdx >= seasons.length) savedSeasonIdx = 0;
            if (savedVoiceIdx >= voices.length) savedVoiceIdx = 0;

            // Если пришёл только список сезонов — автоматически загружаем сохранённый сезон
            if (!items.length && seasons.length && !voices.length) {
                Lampa.Storage.set('fx_uhd_season_idx', String(savedSeasonIdx));
                Lampa.Storage.set('fx_uhd_last_filter', 'season');
                fetchCallback(seasons[savedSeasonIdx].url);
                return;
            }

            function openSystemFilterSelect() {
                var enabled = Lampa.Controller.enabled().name;

                function closeSelectAndReload(url) {
                    setTimeout(function () { try { Lampa.Select.close(); } catch (e) { } }, 10);
                    try { Lampa.Controller.toggle(enabled); } catch (e) { }
                    fetchCallback(url);
                }

                function openRoot() {
                    var list = [];

                    list.push({ title: 'Сбросить фильтр', reset: true });

                    if (seasons.length) {
                        list.push({
                            title: 'Сезон',
                            subtitle: seasons[savedSeasonIdx] ? seasons[savedSeasonIdx].title : '',
                            stype: 'season',
                            selected: lastFilter === 'season'
                        });
                    }

                    if (voices.length) {
                        list.push({
                            title: 'Перевод',
                            subtitle: voices[savedVoiceIdx] ? voices[savedVoiceIdx].title : '',
                            stype: 'voice',
                            selected: lastFilter === 'voice'
                        });
                    }

                    // Если нет сезонов/переводов — нечего открывать
                    if (list.length === 1) {
                        Lampa.Noty.show('Filmix UHD: Нет фильтров');
                        return;
                    }

                    Lampa.Select.show({
                        title: 'Фильтр',
                        items: list,
                        onBack: function () {
                            try { Lampa.Controller.toggle(enabled); } catch (e) { }
                        },
                        onSelect: function (a) {
                            if (a.reset) {
                                savedSeasonIdx = 0;
                                savedVoiceIdx = 0;
                                lastFilter = 'season';
                                Lampa.Storage.set('fx_uhd_season_idx', '0');
                                Lampa.Storage.set('fx_uhd_voice_idx', '0');
                                Lampa.Storage.set('fx_uhd_last_filter', lastFilter);

                                if (seasons[0]) return closeSelectAndReload(seasons[0].url);
                                if (voices[0]) return closeSelectAndReload(voices[0].url);
                                return;
                            }

                            if (a.stype === 'season') return openSeasons();
                            if (a.stype === 'voice') return openVoices();
                        }
                    });
                }

                function openSeasons() {
                    Lampa.Select.show({
                        title: 'Сезон',
                        items: seasons.map(function (s, i) {
                            return {
                                title: s.title,
                                index: i,
                                selected: i === savedSeasonIdx
                            };
                        }),
                        onBack: function () { openRoot(); },
                        onSelect: function (a) {
                            var si = typeof a.index !== 'undefined' ? a.index : 0;
                            if (si < 0 || si >= seasons.length) si = 0;

                            savedSeasonIdx = si;
                            lastFilter = 'season';
                            Lampa.Storage.set('fx_uhd_season_idx', String(savedSeasonIdx));
                            Lampa.Storage.set('fx_uhd_last_filter', lastFilter);

                            closeSelectAndReload(seasons[savedSeasonIdx].url);
                        }
                    });
                }

                function openVoices() {
                    Lampa.Select.show({
                        title: 'Перевод',
                        items: voices.map(function (v, i) {
                            return {
                                title: v.title,
                                index: i,
                                selected: i === savedVoiceIdx
                            };
                        }),
                        onBack: function () { openRoot(); },
                        onSelect: function (a) {
                            var vi = typeof a.index !== 'undefined' ? a.index : 0;
                            if (vi < 0 || vi >= voices.length) vi = 0;

                            savedVoiceIdx = vi;
                            lastFilter = 'voice';
                            Lampa.Storage.set('fx_uhd_voice_idx', String(savedVoiceIdx));
                            Lampa.Storage.set('fx_uhd_last_filter', lastFilter);

                            closeSelectAndReload(voices[savedVoiceIdx].url);
                        }
                    });
                }

                // Открывать сразу последний изменённый раздел, чтобы было ближе к UX on.js
                if (lastFilter === 'voice' && voices.length) openVoices();
                else if (lastFilter === 'season' && seasons.length) openSeasons();
                else openRoot();
            }

            function playItem(item) {
                var url = pickQualityUrl(item);

                // Плейлист (все серии текущего ответа)
                var playlist = [];
                items.forEach(function (it) {
                    playlist.push({
                        title: it.title,
                        url: pickQualityUrl(it),
                        movie: movie,
                        isonline: true,
                        season: it.season,
                        episode: it.episode
                    });
                });

                var element = {
                    title: item.title,
                    url: url,
                    movie: movie,
                    isonline: true,
                    season: item.season,
                    episode: item.episode,
                    playlist: playlist
                };

                Lampa.Player.play(element);
            }

            // UI карточки
            if (typeof Lampa.Interaction !== 'undefined') {
                var interaction = new Lampa.Interaction({
                    card: movie,
                    filter: (seasons.length > 0 || voices.length > 0)
                });

                interaction.onPlay = function (item) {
                    playItem(item);
                };

                interaction.onFilter = function () {
                    openSystemFilterSelect();
                };

                Lampa.Activity.push({
                    component: 'interaction',
                    title: 'Filmix UHD',
                    object: interaction,
                    onBack: function () { Lampa.Activity.backward(); }
                });

                interaction.content(items);
            } else {
                // Fallback: просто системный список серий
                Lampa.Select.show({
                    title: (movie.title || movie.name || 'Filmix UHD'),
                    items: items.map(function (i) { return { title: i.title, value: i }; }),
                    onSelect: function (a) { playItem(a.value); }
                });
            }
        }

        function addButton(render, movie) {
            if (render.find('.fx-uhd-btn').length) return;

            var target = render.find('.view--torrent, .view--online, .button--play, .full-start__buttons').last();
            if (!target.length) return;

            var btn = $('<div class="full-start__button selector view--online fx-uhd-btn"><span>Filmix UHD</span></div>');
            btn.on('hover:enter', function () { loadFilmix(movie); });

            if (target.hasClass('full-start__buttons')) target.append(btn);
            else target.after(btn);

            try { Lampa.Controller.toggle(Lampa.Controller.enabled().name); } catch (e) { }
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complete' || e.type === 'complite') {
                try { addButton(e.object.activity.render(), e.data.movie); } catch (err) { }
            }
        });

        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                var active = Lampa.Activity.active();
                if (active && (active.component === 'full_start' || active.component === 'select')) {
                    var card = active.card || (active.object && active.object.movie);
                    if (card) addButton(active.activity.render(), card);
                }
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
