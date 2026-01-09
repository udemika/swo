(function () {
    'use strict';

    var VERSION = '1.3.5';
    
    if (window.filmix_ultra_loaded) return;
    window.filmix_ultra_loaded = true;

    if (typeof Lampa === 'undefined') return;

    var PROXIES = [
        'https://cors.lampa.stream/',
        'https://cors.kp556.workers.dev:8443/',
        'https://cors.byskaz.ru/',
        'https://corsproxy.io/?'
    ];
    
    var savedIdx = Lampa.Storage.get('fx_ultra_proxy_idx', '0');
    var currentProxyIdx = parseInt(savedIdx);
    if (isNaN(currentProxyIdx) || currentProxyIdx >= PROXIES.length) currentProxyIdx = 0;

    function FilmixComponent(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Explorer(object);
        var container = $('<div class="fx-ultra-list"></div>');
        var items = [];
        var active_item = 0;
        var attempts = 0;

        this.create = function () {
            files.appendFiles(scroll.render());
            scroll.append(container);
            this.load();
            return files.render();
        };

        function extractLinks(res) {
            var found = [];
            if (!res) return found;
            try {
                var json = typeof res === 'string' ? JSON.parse(res) : res;
                if (json.contents) json = JSON.parse(json.contents);
                if (json.links) return json.links;
                if (json.url) return [{name: 'Поток', url: json.url, quality: '720p'}];
            } catch(e) {}
            var wrapper = $('<div>').append(res);
            wrapper.find('[data-json]').each(function() {
                try {
                    var jd = JSON.parse($(this).attr('data-json'));
                    if (jd.method === 'play' && jd.url) {
                        var name = $(this).find('.videos__item-title').text() || jd.title || 'Файл';
                        var quality = 'Auto';
                        if (jd.quality) {
                            if (typeof jd.quality === 'string') quality = jd.quality;
                            else quality = Object.keys(jd.quality)[0] || 'Auto';
                        }
                        found.push({ name: name.trim(), url: jd.url, quality: quality });
                    }
                } catch(e) {}
            });
            return found;
        }

        this.load = function() {
            var self = this;
            var targetUrl = 'http://showypro.com/lite/fxapi?rjson=False&postid=' + object.movie.id + '&s=1&uid=i8nqb9vw&showy_token=f8377057-90eb-4d76-93c9-7605952a096l';
            var proxyUrl = PROXIES[currentProxyIdx];
            if (Lampa.Select) {
                Lampa.Select.show({
                    title: 'Filmix Ultra v' + VERSION,
                    items: [{ title: 'Линия: ' + (proxyUrl.split('/')[2] || 'Default'), wait: true }],
                    onBack: function() { network.clear(); Lampa.Activity.backward(); }
                });
            }
            network.native(proxyUrl + targetUrl, function (res) {
                var links = extractLinks(res);
                if (links.length > 0) {
                    if (Lampa.Select) Lampa.Select.close();
                    Lampa.Storage.set('fx_ultra_proxy_idx', currentProxyIdx.toString());
                    self.build(links);
                } else self.retryOrError();
            }, function () { self.retryOrError(); }, false, { dataType: 'text', timeout: 8000 });
        };

        this.retryOrError = function() {
            attempts++;
            if (attempts < PROXIES.length) {
                currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
                this.load();
            } else {
                if (Lampa.Select) Lampa.Select.close();
                this.empty('Источник Filmix недоступен (ошибка сети)');
            }
        };

        this.build = function (links) {
            var self = this;
            container.empty();
            items = [];
            links.forEach(function(l, i) {
                var item = $('<div class="online-fx-item selector" style="padding:1.1em; margin:0.4em 0; background:rgba(255,255,255,0.05); border-radius:0.4em; display:flex; justify-content:space-between; align-items:center;"><span>'+l.name+'</span><b style="background:#ff9800; color:#000; padding:0.1em 0.5em; border-radius:0.2em; font-size:0.8em; margin-left:10px;">'+l.quality+'</b></div>');
                item.on('hover:enter', function() {
                    Lampa.Player.play({ url: l.url.replace('http://', 'https://'), title: (object.movie.title || object.movie.name) + ' - ' + l.name });
                }).on('hover:focus', function(e) { active_item = i; scroll.update($(e.target), true); });
                container.append(item);
                items.push(item);
            });
            this.start();
        };

        this.empty = function (msg) { 
            container.empty();
            var errorBtn = $('<div class="selector" style="padding:2em; text-align:center; color:#ff9800;">'+msg+'</div>');
            errorBtn.on('hover:enter', function() { Lampa.Activity.backward(); });
            container.append(errorBtn);
            this.start();
        };

        this.start = function () {
            Lampa.Controller.add('fx_ultra_ctrl', {
                toggle: function () {
                    Lampa.Controller.collectionSet(container);
                    Lampa.Controller.collectionFocus(items[active_item] ? items[active_item][0] : container.find('.selector')[0], container);
                },
                up: function () { if (active_item > 0) active_item--; else Lampa.Controller.toggle('head'); },
                down: function () { if (active_item < items.length - 1) active_item++; },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.enable('fx_ultra_ctrl');
        };

        this.render = function() { return files.render(); };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { network.clear(); scroll.destroy(); files.destroy(); container.remove(); };
    }

    try {
        Lampa.Component.add('fx_ultra_v8', FilmixComponent);
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complete' || e.type == 'complite') {
                $('.fx-ultra-native').remove();
                var btn = $('<div class="full-start__button selector view--online fx-ultra-native" data-subtitle="Ultra v'+VERSION+'"><span>Онлайн</span></div>');
                btn.on('hover:enter', function() { Lampa.Activity.push({ url: '', title: 'Filmix Ultra', component: 'fx_ultra_v8', movie: e.data.movie, page: 1 }); });
                var tBtn = e.object.activity.render().find('.view--torrent');
                if (tBtn.length) tBtn.after(btn); else e.object.activity.render().find('.full-start__buttons').append(btn);
            }
        });
    } catch(e) {}
})();

// ############################################################################
// #                                                                          #
// #                       !!! КОНЕЦ ФАЙЛА ПЛАГИНА !!!                        #
// #                       ВЕРСИЯ СБОРКИ: 1.3.5                               #
// #                                                                          #
// ############################################################################
/* 
   ЗАЩИТНЫЙ КОММЕНТАРИЙ ОТ LAMPY. ВСЕ ЧТО БУДЕТ НИЖЕ - СТАНЕТ ЧАСТЬЮ ЭТОГО ТЕКСТА 
   И НЕ ПОВРЕДИТ РАБОТЕ ПЛАГИНА.

   DEBUG LOG PROTECTION ZONE START --------------------------------------------
*/
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
/* DEBUG LOG PROTECTION ZONE END ---------------------------------------------- */