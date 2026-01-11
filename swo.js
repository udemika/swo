Для реализации интерфейса, который вы показали на скриншоте, необходимо использовать системный компонент `Lampa.Activity` с типом `interaction`. В вашем текущем коде есть проверка, которая иногда переключает вид на простые выпадающие списки (меню `Lampa.Select`), что визуально отличается от желаемого результата.

Я не трогал логику прокси и токенов, как вы и просили. Я изменил только функцию `displayFilmix`, чтобы она всегда вызывала полноценное системное окно (как на скриншоте) с поддержкой пульта и фильтров.

### Что было изменено:

1. **Удалено:** Ветка кода `else`, которая вызывала простые выпадающие списки вместо красивого меню.
2. **Исправлено:** Принудительный запуск `Lampa.Interaction` (системного интерфейса). Теперь список серий и качества будет выглядеть как нативные списки Lampa (как на вашем скриншоте).
3. **Сохранено:** Управление пультом работает нативно через компонент `Interaction`.

Вот готовый код файла `swo.js`. Вы можете полностью заменить содержимое вашего файла этим кодом:

```javascript
(function () {
    'use strict';

    /**
     * Filmix Nexus (Legacy Support) v2.3.7 - System UI Fix
     * - ИСПРАВЛЕНО: Принудительный вывод через Lampa.Interaction (как на скриншоте)
     * - СОХРАНЕНО: Логика прокси и токенов
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

        // Загружаем сохраненный индекс прокси или начинаем с 0
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
                    // Запоминаем рабочий прокси для текущей сессии
                    Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                    displayFilmix(res, movie, fetchWithRetry);
                }, function (err) {
                    attempts++;
                    console.log('Filmix: Proxy ' + proxy + ' failed. Switching...');
                    
                    if (attempts < PROXIES.length) {
                        // Ротация прокси: берем следующий из списка
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

        // Основное изменение здесь: принудительное использование Interaction
        function displayFilmix(res, movie, fetchCallback) {
            var $dom = $('<div>' + res + '</div>');
            var items = [], filters = [];

            // Парсинг фильтров (сезоны, переводы)
            $dom.find('.videos__button, .selector[data-json*="link"]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    filters.push({ title: $(this).text().trim(), url: json.url });
                } catch(e) {}
            });

            // Парсинг видео
            $dom.find('.videos__item, .selector[data-json*="play"]').each(function() {
                try {
                    var json = JSON.parse($(this).attr('data-json'));
                    items.push({
                        title: $(this).find('.videos__item-title').text().trim() || json.title || 'Видео',
                        quality: json.maxquality || 'HD',
                        url: sign(json.url),
                        // Добавляем subtitle для соответствия стилю скриншота, если есть доп. инфо
                        subtitle: json.quality ? json.quality : (json.maxquality || '')
                    });
                } catch(e) {}
            });

            // Создаем системный интерфейс (Interaction), который выглядит как на скриншоте
            var interaction = new Lampa.Interaction({
                card: movie,
                filter: filters.length > 0 // Включает кнопку фильтра в шапке, если есть варианты
            });

            interaction.onPlay = function(item) {
                Lampa.Player.play({ url: item.url, title: item.title, movie: movie });
            };

            interaction.onFilter = function() {
                Lampa.Select.show({
                    title: 'Фильтр',
                    items: filters.map(function(f) { return { title: f.title, value: f.url }; }),
                    onSelect: function(item) { fetchCallback(item.value); },
                    onBack: function() { 
                         // Возвращаемся в интерфейс activity при закрытии фильтра
                    }
                });
            };

            // Открываем Activity (системное окно)
            Lampa.Activity.push({
                component: 'interaction', // Этот компонент отвечает за вид списка файлов
                title: 'Filmix',
                object: interaction,
                onBack: function() { Lampa.Activity.backward(); }
            });

            // Заполняем данными
            interaction.content(items);
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                var render = e.object.activity.render();
                if (!render) return;

                var inject = function() {
                    if (render.find('.fx-nexus-native').length) return;

                    var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Смотреть Filmix</span></div>');
                    btn.on('hover:enter', function () {
                        loadFilmix(e.data.movie);
                    });

                    var container = render.find('.full-start__buttons, .full-start__actions, .full-start');
                    var watchBtn = render.find('.watch-button, .full-start__button').first();

                    if (watchBtn.length) watchBtn.before(btn);
                    else if (container.length) container.prepend(btn);

                    if (Lampa.Controller.toggle) Lampa.Controller.toggle('full_start');
                };

                inject();
                setTimeout(inject, 200);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();

```