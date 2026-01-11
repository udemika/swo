(function () {
    'use strict';

    /**
     * Filmix Nexus (Legacy Support) v2.3.6
     * - РРЎРџР РђР’Р›Р•РќРћ: РћС€РёР±РєР° СЃРµС‚Рё 503 С‡РµСЂРµР· Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєСѓСЋ СЂРѕС‚Р°С†РёСЋ РїСЂРѕРєСЃРё
     * - РРЎРџР РђР’Р›Р•РќРћ: РЎРѕС…СЂР°РЅРµРЅРёРµ РїРѕСЃР»РµРґРЅРµРіРѕ СЂР°Р±РѕС‡РµРіРѕ РїСЂРѕРєСЃРё РІ Lampa.Storage
     * - РћР‘РќРћР’Р›Р•РќРћ: РќРѕРІС‹Р№ СЃРїРёСЃРѕРє РїСЂРѕРєСЃРё (swo.js)
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

        // Р—Р°РіСЂСѓР¶Р°РµРј СЃРѕС…СЂР°РЅРµРЅРЅС‹Р№ РёРЅРґРµРєСЃ РїСЂРѕРєСЃРё РёР»Рё РЅР°С‡РёРЅР°РµРј СЃ 0
        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0'));
        if (isNaN(currentProxyIdx) || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

        function sign(url) {
            url = url + '';
            if (url.indexOf('uid=') == -1) url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1) url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') == -1) url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
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
            var fetchWithRetry = function(targetUrl) {
                var proxy = PROXIES[currentProxyIdx];
                toggleLoading(true);

                network.native(proxy + sign(targetUrl), function (res) {
                    toggleLoading(false);
                    // Р—Р°РїРѕРјРёРЅР°РµРј СЂР°Р±РѕС‡РёР№ РїСЂРѕРєСЃРё РґР»СЏ С‚РµРєСѓС‰РµР№ СЃРµСЃСЃРёРё
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                    displayFilmix(res, movie, fetchWithRetry);
                }, function (err) {
                    attempts++;
                    console.log('Filmix: Proxy ' + proxy + ' failed. Switching...');

                    if (attempts < PROXIES.length) {
                        // Р РѕС‚Р°С†РёСЏ РїСЂРѕРєСЃРё: Р±РµСЂРµРј СЃР»РµРґСѓСЋС‰РёР№ РёР· СЃРїРёСЃРєР°
                        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                        fetchWithRetry(targetUrl);
                    } else {
                        toggleLoading(false);
                        Lampa.Noty.show('Filmix: РћС€РёР±РєР° СЃРµС‚Рё (РІСЃРµ РїСЂРѕРєСЃРё РЅРµРґРѕСЃС‚СѓРїРЅС‹)');
                    }
                }, false, { dataType: 'text' });
            };

            fetchWithRetry(url);
        }

        function displayFilmix(res, movie, fetchCallback) {
            var $dom = $('<div>' + res + '</div>');

            // два независимых фильтра: сезон и перевод
            var seasons = [], voices = [], items = [];

            var savedSeasonIdx = parseInt(Lampa.Storage.get('fx_nexus_season_idx', '0'));
            if (isNaN(savedSeasonIdx) || savedSeasonIdx < 0) savedSeasonIdx = 0;

            var savedVoiceIdx = parseInt(Lampa.Storage.get('fx_nexus_voice_idx', '0'));
            if (isNaN(savedVoiceIdx) || savedVoiceIdx < 0) savedVoiceIdx = 0;

            // сезоны (как в твоём примере: .videos__item.videos__season + method:link)
            $dom.find('.videos__item.videos__season').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    seasons.push({
                        title: $(this).find('.videos__season-title').text().trim() || $(this).find('.videos__item-title').text().trim() || $(this).text().trim(),
                        url: json.url
                    });
                } catch(e) {}
            });

            // переводы (как в твоём примере: .videos__button + method:link)
            $dom.find('.videos__button').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    voices.push({ title: $(this).text().trim(), url: json.url });
                } catch(e) {}
            });

            // серии/видео (method:play)
            $dom.find('.videos__item.videos__movie, .selector[data-json*="play"]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));

                    var s = $(this).attr('s');
                    var e = $(this).attr('e');

                    var it = {
                        title: $(this).find('.videos__item-title').text().trim() || json.title || 'Р’РёРґРµРѕ',
                        quality: json.maxquality || 'HD',
                        url: sign(json.url)
                    };

                    if (typeof s !== 'undefined') it.season = parseInt(s);
                    if (typeof e !== 'undefined') it.episode = parseInt(e);

                    items.push(it);
                } catch(e) {}
            });

            // Если открыли карточку и получили только список сезонов — сразу уходим в выбранный сезон
            if (!items.length && seasons.length && !voices.length) {
                if (savedSeasonIdx >= seasons.length) savedSeasonIdx = 0;
                Lampa.Storage.set('fx_nexus_season_idx', savedSeasonIdx.toString());
                fetchCallback(seasons[savedSeasonIdx].url);
                return;
            }

            // --- системная шторка фильтра (как в Online/Lampac) ---
            function openSystemFilterPanel() {
                if (!seasons.length && !voices.length) return;

                // если в сборке нет Lampa.Filter — простой запасной вариант через Select
                if (typeof Lampa.Filter === 'undefined') {
                    var first = [];
                    if (voices.length) first.push({ title: 'Перевод', value: 'voice' });
                    if (seasons.length) first.push({ title: 'Сезон', value: 'season' });

                    Lampa.Select.show({
                        title: 'Фильтр',
                        items: first,
                        onSelect: function(a) {
                            if (a.value == 'voice') {
                                Lampa.Select.show({
                                    title: 'Перевод',
                                    items: voices.map(function(v, i){ return { title: v.title, value: i }; }),
                                    onSelect: function(b){
                                        var idx = b.value;
                                        if (idx < 0) idx = 0;
                                        if (idx >= voices.length) idx = 0;
                                        savedVoiceIdx = idx;
                                        Lampa.Storage.set('fx_nexus_voice_idx', savedVoiceIdx.toString());
                                        fetchCallback(voices[savedVoiceIdx].url);
                                    }
                                });
                            }
                            if (a.value == 'season') {
                                Lampa.Select.show({
                                    title: 'Сезон',
                                    items: seasons.map(function(s, i){ return { title: s.title, value: i }; }),
                                    onSelect: function(b){
                                        var idx = b.value;
                                        if (idx < 0) idx = 0;
                                        if (idx >= seasons.length) idx = 0;
                                        savedSeasonIdx = idx;
                                        Lampa.Storage.set('fx_nexus_season_idx', savedSeasonIdx.toString());
                                        fetchCallback(seasons[savedSeasonIdx].url);
                                    }
                                });
                            }
                        }
                    });
                    return;
                }

                var enabled = Lampa.Controller.enabled().name;
                var panel = new Lampa.Filter({});

                var seasonIdx = savedSeasonIdx;
                if (seasonIdx >= seasons.length) seasonIdx = 0;

                var voiceIdx = savedVoiceIdx;
                if (voiceIdx >= voices.length) voiceIdx = 0;

                var select = [];

                select.push({
                    title: 'Сбросить фильтр',
                    reset: true
                });

                if (voices.length) {
                    select.push({
                        title: 'Перевод',
                        subtitle: (voices[voiceIdx] ? voices[voiceIdx].title : ''),
                        stype: 'voice',
                        items: voices.map(function(v, i) {
                            return { title: v.title, selected: i === voiceIdx, index: i };
                        })
                    });
                }

                if (seasons.length) {
                    select.push({
                        title: 'Сезон',
                        subtitle: (seasons[seasonIdx] ? seasons[seasonIdx].title : ''),
                        stype: 'season',
                        items: seasons.map(function(s, i) {
                            return { title: s.title, selected: i === seasonIdx, index: i };
                        })
                    });
                }

                panel.set('filter', select);

                panel.onBack = function () {
                    Lampa.Controller.toggle(enabled);
                };

                panel.onSelect = function (type, a, b) {
                    if (type == 'filter') {
                        if (a && a.reset) {
                            savedSeasonIdx = 0;
                            savedVoiceIdx = 0;
                            Lampa.Storage.set('fx_nexus_season_idx', '0');
                            Lampa.Storage.set('fx_nexus_voice_idx', '0');

                            setTimeout(function () { Lampa.Select.close(); }, 10);
                            Lampa.Controller.toggle(enabled);

                            // После сброса логично вернуться на выбранный сезон (или на первый),
                            // чтобы заново отрисовать список переводов/серий.
                            if (seasons.length && seasons[0] && seasons[0].url) fetchCallback(seasons[0].url);
                            else if (voices.length && voices[0] && voices[0].url) fetchCallback(voices[0].url);
                            return;
                        }

                        if (a && a.stype == 'season') {
                            var idx = b && typeof b.index !== 'undefined' ? b.index : 0;
                            if (idx < 0) idx = 0;
                            if (idx >= seasons.length) idx = 0;

                            savedSeasonIdx = idx;
                            Lampa.Storage.set('fx_nexus_season_idx', savedSeasonIdx.toString());

                            var url = seasons[savedSeasonIdx] ? seasons[savedSeasonIdx].url : '';

                            setTimeout(function () { Lampa.Select.close(); }, 10);
                            Lampa.Controller.toggle(enabled);

                            if (url) fetchCallback(url);
                            return;
                        }

                        if (a && a.stype == 'voice') {
                            var idx = b && typeof b.index !== 'undefined' ? b.index : 0;
                            if (idx < 0) idx = 0;
                            if (idx >= voices.length) idx = 0;

                            savedVoiceIdx = idx;
                            Lampa.Storage.set('fx_nexus_voice_idx', savedVoiceIdx.toString());

                            var url = voices[savedVoiceIdx] ? voices[savedVoiceIdx].url : '';

                            setTimeout(function () { Lampa.Select.close(); }, 10);
                            Lampa.Controller.toggle(enabled);

                            if (url) fetchCallback(url);
                            return;
                        }
                    }

                    setTimeout(function () { Lampa.Select.close(); }, 10);
                    Lampa.Controller.toggle(enabled);
                };

                panel.show('Фильтр', panel);
            }
            // -----------------------------------------------

            if (typeof Lampa.Interaction !== 'undefined') {
                var interaction = new Lampa.Interaction({
                    card: movie,
                    filter: (seasons.length > 0 || voices.length > 0)
                });

                interaction.onPlay = function(item) {
                    Lampa.Player.play({ url: item.url, title: item.title, movie: movie });
                };

                // Открываем шторку фильтра как в Online/Lampac
                interaction.onFilter = function() {
                    openSystemFilterPanel();
                };

                Lampa.Activity.push({
                    component: 'interaction',
                    title: 'Filmix',
                    object: interaction,
                    onBack: function() { Lampa.Activity.backward(); }
                });

                interaction.content(items);
            } else {
                var showList = function() {
                    Lampa.Select.show({
                        title: movie.title || movie.name || 'Filmix',
                        items: items.map(function(i) { return { title: i.title + ' ['+i.quality+']', value: i }; }),
                        onSelect: function(item) {
                            Lampa.Player.play({ url: item.value.url, title: item.value.title, movie: movie });
                        },
                        onBack: function() {
                            Lampa.Controller.toggle('full_start');
                        }
                    });
                };

                showList();
            }
        }

        // --- РћР‘РќРћР’Р›Р•РќРќРђРЇ Р›РћР“РРљРђ Р”РћР‘РђР’Р›Р•РќРРЇ РљРќРћРџРљР ---
        function addButton(render, movie) {
            if (render.find('.fx-nexus-native').length) return;
            var target = render.find('.view--torrent, .view--online, .button--play, .full-start__buttons').last();
            if (target.length) {
                var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:6px"><circle cx="12" cy="12" r="11" fill="#fff"/><polygon points="10,8 17,12 10,16" fill="#000"/></svg>Filmix UHD</span></div>');
                btn.on('hover:enter', function () { 
                    loadFilmix(movie); 
                });

                if(target.hasClass('full-start__buttons')) target.append(btn);
                else target.after(btn);

                if (Lampa.Controller.toggle) Lampa.Controller.toggle(Lampa.Controller.enabled().name);
            }
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                addButton(e.object.activity.render(), e.data.movie);
            }
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
        // --------------------------------------------
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();
