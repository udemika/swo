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
            var items = [], filters = [];

            $dom.find('.videos__button, .selector[data-json*="link"]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    filters.push({ title: $(this).text().trim(), url: json.url });
                } catch(e) {}
            });

            $dom.find('.videos__item, .selector[data-json*="play"]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    items.push({
                        title: $(this).find('.videos__item-title').text().trim() || json.title || 'Р’РёРґРµРѕ',
                        quality: json.maxquality || 'HD',
                        url: sign(json.url)
                    });
                } catch(e) {}
            });

            if (typeof Lampa.Interaction !== 'undefined') {
                var interaction = new Lampa.Interaction({
                    card: movie,
                    filter: filters.length > 0
                });

                interaction.onPlay = function(item) {
                    Lampa.Player.play({ url: item.url, title: item.title, movie: movie });
                };

                interaction.onFilter = function() {
                    Lampa.Select.show({
                        title: 'Р¤РёР»СЊС‚СЂ',
                        items: filters.map(function(f) { return { title: f.title, value: f.url }; }),
                        onSelect: function(item) { fetchCallback(item.value); }
                    });
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

                if (filters.length > 0) {
                    Lampa.Select.show({
                        title: 'Р’С‹Р±РѕСЂ РІР°СЂРёР°РЅС‚Р°',
                        items: filters.map(function(f) { return { title: f.title, value: f.url }; }),
                        onSelect: function(item) { fetchCallback(item.value); },
                        onBack: function() { showList(); }
                    });
                } else {
                    showList();
                }
            }
        }

        // --- РћР‘РќРћР’Р›Р•РќРќРђРЇ Р›РћР“РРљРђ Р”РћР‘РђР’Р›Р•РќРРЇ РљРќРћРџРљР ---
        function addButton(render, movie) {
            if (render.find('.fx-nexus-native').length) return;
            var target = render.find('.view--torrent, .view--online, .button--play, .full-start__buttons').last();
            if (target.length) {
                var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Filmix</span></div>');
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