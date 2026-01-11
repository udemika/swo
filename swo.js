(function () {
    'use strict';

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

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0')) || 0;

        function sign(url) {
            if (!url) return '';
            var signed = url + '';
            if (signed.indexOf('uid=') == -1) signed = Lampa.Utils.addUrlComponent(signed, 'uid=' + WORKING_UID);
            if (signed.indexOf('showy_token=') == -1) signed = Lampa.Utils.addUrlComponent(signed, 'showy_token=' + WORKING_TOKEN);
            if (signed.indexOf('rjson=') == -1) signed = Lampa.Utils.addUrlComponent(signed, 'rjson=False');
            return signed;
        }

        function toggleLoading(show) {
            try {
                if (typeof Lampa.Loading === 'function') Lampa.Loading(show);
                else if (Lampa.Loading && Lampa.Loading.show) show ? Lampa.Loading.show() : Lampa.Loading.hide();
            } catch (e) {}
        }

        function parseHtmlToItems(htmlString) {
            var items = [];
            var $dom = $('<div>' + htmlString + '</div>');

            $dom.find('.selector, .videos__item, .videos__button, .videos__season').each(function() {
                var el = $(this);
                var jsonStr = el.attr('data-json');
                if(!jsonStr) return;

                try {
                    var json = JSON.parse(jsonStr);
                    var link = json.url || json.play;
                    var title = el.find('.videos__item-title, .videos__season-title, .videos__button-title').text().trim() || 
                                el.text().trim() || 
                                json.title || 'Видео';

                    items.push({
                        title: title,
                        subtitle: json.quality || json.maxquality || '',
                        url: link,
                        is_folder: (json.method === 'link'),
                        template: 'selectbox_item'
                    });
                } catch(e) {}
            });
            return items;
        }

        function loadFilmix(movie, targetUrl, stepTitle) {
            var url = targetUrl || (BASE_DOMAIN + '/lite/fxapi?' + (movie.kinopoisk_id ? 'kinopoisk_id=' + movie.kinopoisk_id : 'postid=' + movie.id));
            
            toggleLoading(true);

            var network = new (Lampa.Request || Lampa.Reguest)();
            var proxy = PROXIES[currentProxyIdx];
            var finalUrl = proxy + sign(url);

            network.native(finalUrl, function (res) {
                toggleLoading(false);
                var items = parseHtmlToItems(res);

                if (items.length > 0) {
                    var options = {
                        title: stepTitle || (movie.title || 'Filmix'),
                        items: items,
                        onSelect: function(item) {
                            if (item.is_folder) {
                                // Рекурсивный вызов: открываем следующий уровень (озвучки/серии)
                                loadFilmix(movie, item.url, item.title);
                            } else {
                                var playUrl = sign(item.url);
                                Lampa.Player.play({
                                    url: playUrl,
                                    title: item.title,
                                    movie: movie
                                });
                                Lampa.Player.playlist([{
                                    url: playUrl,
                                    title: item.title
                                }]);
                            }
                        },
                        onBack: function() {
                            Lampa.Controller.toggle('full');
                        }
                    };
                    
                    // Важный момент: Lampa.Select.show автоматически обновляет содержимое, 
                    // если вызывается повторно при активном контроллере select.
                    Lampa.Select.show(options);
                    
                } else {
                    Lampa.Noty.show('Filmix: Данные не найдены');
                }
            }, function () {
                toggleLoading(false);
                currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                Lampa.Storage.set('fx_nexus_proxy_idx', currentProxyIdx.toString());
                loadFilmix(movie, url, stepTitle);
            }, false, { dataType: 'text' });
        }

        function addButton(render, movie) {
            if (render.find('.fx-nexus-native').length) return;
            // Ищем стандартные кнопки, чтобы пристроиться рядом
            var target = render.find('.view--torrent, .view--online, .button--play, .full-start__buttons').last();
            if (target.length) {
                var btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Filmix</span></div>');
                btn.on('hover:enter', function () { 
                    loadFilmix(movie); 
                });
                
                if(target.hasClass('full-start__buttons')) target.append(btn);
                else target.after(btn);

                // Обновляем навигацию контроллера, чтобы кнопка стала кликабельной
                if (Lampa.Controller.toggle) Lampa.Controller.toggle(Lampa.Controller.enabled().name);
            }
        }

        // Слушатели отрисовки карточки
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                addButton(e.object.activity.render(), e.data.movie);
            }
        });

        // Дополнительная проверка при переключении вкладок внутри карточки
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