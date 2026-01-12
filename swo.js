(function () {
    'use strict';
    
    /**
     * Filmix Nexus (Legacy Support) v2.3.7
     * - ИСПРАВЛЕНО: Ошибка сети 503 через автоматическую ротацию прокси
     * - ИСПРАВЛЕНО: Сохранение последнего рабочего прокси в Lampa.Storage
     * - ОБНОВЛЕНО: Новый список прокси (swo.js)
     * - ИСПРАВЛЕНО: Приоритет использования ID вместо поиска по названию
     * - ДОБАВЛЕНО: Параметры s=1&p=2 для правильных запросов
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
        
        // Загружаем сохранённый индекс прокси или начинаем с 0
        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0'));
        if (isNaN(currentProxyIdx) || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;
        
        function sign(url) {
            url = url + '';
            if (url.indexOf('uid=') == -1)
                url = Lampa.Utils.addUrlComponent(url, 'uid=' + WORKING_UID);
            if (url.indexOf('showy_token=') == -1)
                url = Lampa.Utils.addUrlComponent(url, 'showy_token=' + WORKING_TOKEN);
            if (url.indexOf('rjson=') == -1)
                url = Lampa.Utils.addUrlComponent(url, 'rjson=False');
            // Добавляем обязательные параметры s и p
            if (url.indexOf('s=') == -1)
                url = Lampa.Utils.addUrlComponent(url, 's=1');
            if (url.indexOf('p=') == -1)
                url = Lampa.Utils.addUrlComponent(url, 'p=2');
            return url;
        }
        
        function toggleLoading(show) {
            try {
                if (typeof Lampa.Loading === 'function')
                    Lampa.Loading(show);
                else if (Lampa.Loading && Lampa.Loading.show)
                    show ? Lampa.Loading.show() : Lampa.Loading.hide();
            } catch (e) {}
        }
        
        function loadFilmix(movie) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            
            // Собираем все возможные ID
            var kinopoisk_id = movie.kinopoisk_id || movie.kp_id;
            var imdb_id = movie.imdb_id;
            var tmdb_id = movie.tmdb_id;
            
            console.log('ShowyPro Initialize called');
            console.log('ShowyPro Movie object:', 
                'id:', movie.id,
                'kinopoisk_id:', kinopoisk_id, 
                'imdb_id:', imdb_id,
                'tmdb_id:', tmdb_id
            );
            
            var url = BASE_DOMAIN + '/lite/fxapi?';
            var params = [];
            
            // Приоритет использования ID вместо названия
            if (kinopoisk_id) {
                console.log('ShowyPro Using kinopoisk_id:', kinopoisk_id);
                params.push('kinopoisk_id=' + kinopoisk_id);
            }
            if (imdb_id) {
                console.log('ShowyPro Using imdb_id:', imdb_id);
                params.push('imdb_id=' + imdb_id);
            }
            if (tmdb_id) {
                console.log('ShowyPro Using tmdb_id:', tmdb_id);
                params.push('tmdb_id=' + tmdb_id);
            }
            
            // Если нет ни одного ID - используем название
            if (!kinopoisk_id && !imdb_id && !tmdb_id) {
                console.log('ShowyPro No ID found, searching by title');
                var title = movie.title || movie.name || movie.original_title || movie.original_name;
                params.push('query=' + encodeURIComponent(title));
            }
            
            url += params.join('&');
            
            var attempts = 0;
            
            var fetchWithRetry = function(targetUrl) {
                var proxy = PROXIES[currentProxyIdx];
                console.log('ShowyPro Requesting', proxy + sign(targetUrl));
                toggleLoading(true);
                
                network.native(
                    proxy + sign(targetUrl),
                    function (res) {
                        toggleLoading(false);
                        // Запоминаем рабочий прокси для текущей сессии
                        Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                        console.log('ShowyPro Success with proxy:', proxy);
                        displayFilmix(res, movie, fetchWithRetry);
                    },
                    function (err) {
                        attempts++;
                        console.log('ShowyPro Proxy', proxy, 'failed, attempt', attempts);
                        
                        if (attempts < PROXIES.length) {
                            // Ротация прокси: берем следующий из списка
                            currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                            fetchWithRetry(targetUrl);
                        } else {
                            toggleLoading(false);
                            console.log('ShowyPro All proxies failed');
                            Lampa.Noty.show('ShowyPro: Ошибка сети (все прокси недоступны)');
                        }
                    },
                    false,
                    { dataType: 'text' }
                );
            };
            
            fetchWithRetry(url);
        }
        
        function displayFilmix(res, movie, fetchCallback) {
            try {
                console.log('ShowyPro FULL RESPONSE:', res);
                
                var $dom = $('<div>' + res + '</div>');
                var items = [];
                
                // Парсинг HTML ответа
                $dom.find('.playlist-item').each(function() {
                    var $item = $(this);
                    var quality = $item.find('.quality').text().trim();
                    var translation = $item.find('.translation').text().trim();
                    var url = $item.attr('data-file') || $item.find('a').attr('href');
                    
                    if (url) {
                        items.push({
                            title: translation || 'Перевод',
                            quality: quality,
                            url: url
                        });
                    }
                });
                
                if (items.length > 0) {
                    console.log('ShowyPro Found', items.length, 'results');
                    // Здесь добавьте свою логику отображения результатов
                    // Например, через Lampa.Select или собственный интерфейс
                } else {
                    console.log('ShowyPro No results found');
                    Lampa.Noty.show('ShowyPro: Ничего не найдено');
                }
            } catch (e) {
                console.error('ShowyPro Error parsing response:', e);
            }
        }
        
        // Регистрация плагина в Lampa
        if (window.Lampa) {
            var manifest = {
                type: 'video',
                version: '2.3.7',
                name: 'ShowyPro',
                description: 'Онлайн просмотр через ShowyPro API',
                component: 'showypro'
            };
            
            Lampa.Manifest.plugins = Lampa.Manifest.plugins || [];
            Lampa.Manifest.plugins.push(manifest);
            
            // Добавляем кнопку в меню карточки
            Lampa.Listener.follow('full', function(e) {
                if (e.type == 'complite') {
                    var button = $('<div class="full-start__button selector">').text('ShowyPro');
                    button.on('hover:enter', function() {
                        loadFilmix(e.data.movie);
                    });
                    $('.view--full .full-start__buttons').append(button);
                }
            });
            
            console.log('ShowyPro plugin loaded successfully');
        }
    }
    
    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
