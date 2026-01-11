
swo_fixed.js
(function () {
    'use strict';

    /**
     * Filmix Nexus (Legacy Support) v2.3.6
     * - ИСПРАВЛЕНО: Ошибка сети 503 через автоматическую ротацию прокси
     * - ИСПРАВЛЕНО: Сохранение последнего рабочего прокси в Lampa.Storage
     * - ОБНОВЛЕНО: Новый список прокси (swo.js)
     * - ИЗМЕНЕНО: Название кнопки "Filmix UHD" с иконкой плея
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
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                    displayFilmix(res, movie, fetchWithRetry);
                }, function (err) {
                    attempts++;
                    console.log('Filmix: Proxy ' + proxy + ' failed. Switching...');
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
            var $dom = $('<div class="watching__body" style="z-index: 1;"></div>');
            var seasons = [];

            try {
                res = JSON.parse(res);
                if (res.seasons) seasons = res.seasons;
            } catch (e) {
                console.log('Error parsing response', e);
            }

            if (!seasons.length) {
                Lampa.Noty.show('Filmix: Данные не найдены');
                return;
            }

            var allEpisodes = [];
            var $playlist = $('<ul class="selector watching__select" style="margin-bottom: 10px;"></ul>');

            seasons.forEach(function (season, idx) {
                var $seasonBtn = $('<li class="selector__item" data-season="' + idx + '" style="padding: 8px 12px; margin-right: 5px; background: #1e9b97; border-radius: 4px; cursor: pointer; font-weight: bold;">' + (season.name || 'Сезон ' + (idx + 1)) + '</li>');
                $playlist.append($seasonBtn);

                var seasonEpisodes = [];
                if (season.series) {
                    season.series.forEach(function (ep, epIdx) {
                        seasonEpisodes.push({
                            title: (ep.name || 'Эпизод ' + (epIdx + 1)) + ' - ' + season.name,
                            url: ep.link
                        });
                    });
                }
                allEpisodes.push(seasonEpisodes);
            });

            $dom.append($playlist);

            function updateEpisodes(seasonIdx) {
                var $episodes = $dom.find('.episodes-list');
                if ($episodes.length) $episodes.remove();

                var $epList = $('<ul class="selector watching__select" style="max-height: 300px; overflow-y: auto;"></ul>');
                allEpisodes[seasonIdx].forEach(function (ep, idx) {
                    var $epBtn = $('<li class="selector__item" data-episode="' + idx + '" style="padding: 8px 12px; margin-right: 5px; background: rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer;">' + ep.title + '</li>');
                    $epBtn.on('click', function () {
                        Lampa.Activity.push({
                            url: 'overlay',
                            component: {
                                name: 'player',
                                data: {
                                    url: ep.url,
                                    title: ep.title,
                                    subtitle: 'Filmix UHD'
                                }
                            }
                        });
                    });
                    $epList.append($epBtn);
                });

                $epList.addClass('episodes-list');
                $dom.append($epList);
            }

            $playlist.on('click', '.selector__item', function () {
                var seasonIdx = $(this).data('season');
                updateEpisodes(seasonIdx);
            });

            if (allEpisodes.length > 0) {
                updateEpisodes(0);
            }

            Lampa.Activity.push({
                url: 'overlay',
                component: {
                    name: 'visible',
                    data: {
                        html: $dom
                    }
                }
            });
        }

        // Регистрируем плагин в Lampa
        Lampa.Plugins.register('Filmix_Nexus', function (p) {
            p.render = function (item) {
                var buttons = [];
                buttons.push({
                    title: 'Filmix UHD',
                    icon: '⏵',
                    onSelect: function () {
                        loadFilmix(item);
                    }
                });
                return buttons;
            };
        });

        startPlugin();
    }

    // Инициализация
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startPlugin);
    } else {
        startPlugin();
    }

})();