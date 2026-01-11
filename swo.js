(function () {
    'use strict';

    /**
     * Filmix Nexus (Legacy Support)
     * - Фильтр как в on.js: правая системная панель Lampa.Filter
     *   + внутри неё системный Select для выбора значения
     * - Отдельно сезоны и переводы
     * - Чек в корневом окне на последнем изменённом пункте
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

            // Сезоны: .videos__item.videos__season -> method:link
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

            // Переводы: .videos__button -> method:link
            $dom.find('.videos__button[data-json]').each(function () {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    if (json && json.method === 'link' && json.url) {
                        voices.push({ title: $(this).text().trim(), url: json.url });
                    }
                } catch (e) {}
            });

            // Видео: .videos__item[data-json] -> method:play
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

            // Если ответ — только список сезонов, сразу переходим в сохранённый сезон
            if (!items.length && seasons.length && !voices.length) {
                if (savedSeasonIdx >= seasons.length) savedSeasonIdx = 0;
                Lampa.Storage.set('fx_nexus_season_idx', String(savedSeasonIdx));
                fetchCallback(seasons[savedSeasonIdx].url);
                return;
            }

            if (savedSeasonIdx >= seasons.length) savedSeasonIdx = 0;
            if (savedVoiceIdx >= voices.length) savedVoiceIdx = 0;

            function openFilterPanel() {
                // Важно: именно Lampa.Filter (системная правая панель как в on.js)
                var enabled = Lampa.Controller.enabled().name;
                var panel = new Lampa.Filter({});

                var select = [];

                select.push({ title: 'Сбросить фильтр', reset: true });

                if (voices.length) {
                    select.push({
                        title: 'Перевод',
                        subtitle: (voices[savedVoiceIdx] ? voices[savedVoiceIdx].title : ''),
                        stype: 'voice',
                        selected: last === 'voice',
                        items: voices.map(function (v, i) {
                            return { title: v.title, selected: i === savedVoiceIdx, index: i };
                        })
                    });
                }

                if (seasons.length) {
                    select.push({
                        title: 'Сезон',
                        subtitle: (seasons[savedSeasonIdx] ? seasons[savedSeasonIdx].title : ''),
                        stype: 'season',
                        selected: last === 'season',
                        items: seasons.map(function (s, i) {
                            return { title: s.title, selected: i === savedSeasonIdx, index: i };
                        })
                    });
                }

                panel.set('filter', select);

                panel.onBack = function () {
                    Lampa.Controller.toggle(enabled);
                };

                panel.onSelect = function (type, a, b) {
                    if (type !== 'filter') return;

                    // b.index приходит из системного Select внутри Lampa.Filter
                    if (a && a.reset) {
                        savedSeasonIdx = 0;
                        savedVoiceIdx = 0;
                        last = 'season';
                        Lampa.Storage.set('fx_nexus_last_filter', last);
                        Lampa.Storage.set('fx_nexus_season_idx', '0');
                        Lampa.Storage.set('fx_nexus_voice_idx', '0');

                        setTimeout(function () { Lampa.Select.close(); }, 10);
                        Lampa.Controller.toggle(enabled);

                        if (seasons[0]) fetchCallback(seasons[0].url);
                        else if (voices[0]) fetchCallback(voices[0].url);
                        return;
                    }

                    if (a && a.stype === 'season') {
                        var si = (b && typeof b.index !== 'undefined') ? b.index : 0;
                        if (si < 0 || si >= seasons.length) si = 0;

                        savedSeasonIdx = si;
                        last = 'season';
                        Lampa.Storage.set('fx_nexus_last_filter', last);
                        Lampa.Storage.set('fx_nexus_season_idx', String(savedSeasonIdx));

                        setTimeout(function () { Lampa.Select.close(); }, 10);
                        Lampa.Controller.toggle(enabled);

                        fetchCallback(seasons[savedSeasonIdx].url);
                        return;
                    }

                    if (a && a.stype === 'voice') {
                        var vi = (b && typeof b.index !== 'undefined') ? b.index : 0;
                        if (vi < 0 || vi >= voices.length) vi = 0;

                        savedVoiceIdx = vi;
                        last = 'voice';
                        Lampa.Storage.set('fx_nexus_last_filter', last);
                        Lampa.Storage.set('fx_nexus_voice_idx', String(savedVoiceIdx));

                        setTimeout(function () { Lampa.Select.close(); }, 10);
                        Lampa.Controller.toggle(enabled);

                        fetchCallback(voices[savedVoiceIdx].url);
                        return;
                    }
                };

                panel.show('Фильтр', panel);
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
                    openFilterPanel();
                };

                Lampa.Activity.push({
                    component: 'interaction',
                    title: 'Filmix',
                    object: interaction,
                    onBack: function () { Lampa.Activity.backward(); }
                });

                interaction.content(items);
            } else {
                // Fallback
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
