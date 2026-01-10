(function () {
    'use strict';

    /**
     * Filmix Nexus (Series Pro Fix) v2.1.0 – STABLE
     * - Приоритет серий: если есть .videos__item → сразу показываем
     * - Меню озвучек только если серий нет вообще
     * - Фильтрация по translate отключена полностью
     * - Исправлены ошибки render/pause/stop
     */
    function startPlugin() {
        if (window.filmix_nexus_loaded) return;
        window.filmix_nexus_loaded = true;

        var WORKING_UID = 'i8nqb9vw';
        var WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
        var BASE_DOMAIN = 'http://showypro.com';

        var PROXIES = [
            'https://cors.lampa.stream/',
            'https://cors.byskaz.ru/',
            'https://corsproxy.io/?'
        ];

        var currentProxyIdx = parseInt(Lampa.Storage.get('fx_nexus_proxy_idx', '0')) || 0;

        var safeLoading = {
            show: function() { try { Lampa.Loading?.show(); } catch(e){} },
            hide: function() { try { Lampa.Loading?.hide(); } catch(e){} }
        };

        $('<style>\
            .fx-nexus-header { display:flex; align-items:center; gap:10px; padding:12px 20px; background:rgba(0,0,0,0.8); border-bottom:1px solid rgba(255,255,255,0.1); position:sticky; top:0; z-index:10; }\
            .fx-nexus-pill { background:rgba(255,255,255,0.12); padding:8px 18px; border-radius:8px; font-size:14px; font-weight:700; border:1px solid rgba(255,255,255,0.1); cursor:pointer; color:#fff; white-space:nowrap; }\
            .fx-nexus-pill.focus { background:#fff; color:#000; transform:scale(1.05); }\
            .fx-nexus-title { font-size:12px; color:rgba(255,255,255,0.4); margin-left:auto; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:250px; }\
            .fx-card-play { width:36px; height:36px; background:#ff0000; border-radius:50%; display:flex; align-items:center; justify-content:center; }\
        </style>').appendTo('head');

        function FilmixComponent(object) {
            var network = new (Lampa.Request || Lampa.Reguest)();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var html = $('<div class="fx-nexus-component"></div>');
            var container = $('<div class="fx-nexus-list" style="padding-bottom:80px;"></div>');
            var header = $('<div class="fx-nexus-header"></div>');

            var items = [], header_items = [], active_item = 0, current_mode = 'content';

            var filters = {
                season: '1 сезон',
                voice: 'Любой',
                voice_url: ''
            };

            var raw_data = [], voice_links = {};
            var total_seasons = object.movie.number_of_seasons || (object.movie.seasons?.length || 0);

            this.create = function() {
                html.append(header).append(scroll.render());
                scroll.append(container);
                this.loadContent();
                return html;
            };

            this.updateHeader = function() {
                header.empty(); header_items = [];

                if (total_seasons > 0) {
                    var s_btn = $(`<div class="fx-nexus-pill selector focusable">${filters.season}</div>`);
                    s_btn.on('hover:enter', () => this.showSeasonMenu());
                    header.append(s_btn);
                    header_items.push(s_btn);
                }

                var voices = this.getAvailableVoices();
                if (voices.length > 1) {
                    var v_btn = $(`<div class="fx-nexus-pill selector focusable">Озвучка: ${filters.voice}</div>`);
                    v_btn.on('hover:enter', () => this.showVoiceMenu(voices));
                    header.append(v_btn);
                    header_items.push(v_btn);
                }

                header.append(`<div class="fx-nexus-title">${object.movie.title || object.movie.name || ''}</div>`);
            };

            this.getAvailableVoices = function() {
                var v = ['Любой'];
                Object.keys(voice_links).forEach(n => { if (!v.includes(n)) v.push(n); });
                return v;
            };

            this.showSeasonMenu = function() {
                var menu = [];
                for (let i = 1; i <= total_seasons; i++) menu.push({title: i + ' сезон', value: i});
                Lampa.Select.show({
                    title: 'Выбор сезона',
                    items: menu,
                    onSelect: item => {
                        filters.season = item.title;
                        filters.voice = 'Любой';
                        filters.voice_url = '';
                        this.loadContent();
                    },
                    onBack: () => Lampa.Controller.toggle('fx_nexus_ctrl')
                });
            };

            this.showVoiceMenu = function(voices) {
                Lampa.Select.show({
                    title: 'Выбор перевода',
                    items: voices.map(v => ({title: v, value: v})),
                    onSelect: item => {
                        filters.voice = item.value;
                        if (voice_links[item.value]) {
                            filters.voice_url = voice_links[item.value];
                            this.loadContent(filters.voice_url);
                        } else {
                            this.renderList();
                        }
                    },
                    onBack: () => Lampa.Controller.toggle('fx_nexus_ctrl')
                });
            };

            this.loadContent = function(custom_url) {
                const s_num = (filters.season.match(/\d+/) || [1])[0];
                const kp_id = object.movie.kinopoisk_id || object.movie.kp_id;
                const id_param = kp_id ? `kinopoisk_id=${kp_id}` : `postid=${object.movie.id}`;
                
                let url = custom_url || `${BASE_DOMAIN}/lite/fxapi?rjson=False&${id_param}&s=${s_num}&uid=${WORKING_UID}&showy_token=${WORKING_TOKEN}&rchtype=cors`;

                safeLoading.show();
                network.native(PROXIES[currentProxyIdx] + url, res => {
                    safeLoading.hide();
                    this.parseData(res);
                }, () => {
                    safeLoading.hide();
                    this.empty('Ошибка сети');
                }, false, {dataType: 'text'});
            };

            this.parseData = function(res) {
                raw_data = [];
                voice_links = {};

                const $dom = $('<div>' + res + '</div>');

                // Кнопки озвучек
                $dom.find('.videos__button').each(function() {
                    try {
                        const json = JSON.parse($(this).attr('data-json') || '{}');
                        const name = $(this).text().trim();
                        if (json.method === 'link' && json.url && name) {
                            voice_links[name] = json.url;
                        }
                    } catch(e) {}
                });

                // Серии
                $dom.find('.videos__item').each(function() {
                    try {
                        const json = JSON.parse($(this).attr('data-json') || '{}');
                        if (json.method === 'play' && json.url) {
                            raw_data.push(json);
                        }
                    } catch(e) {}
                });

                // Если есть серии → показываем сразу
                if (raw_data.length > 0) {
                    this.renderList();
                }
                // Только если серий нет, но есть озвучки → меню
                else if (Object.keys(voice_links).length > 0) {
                    this.showVoiceMenu(this.getAvailableVoices());
                }
                else {
                    this.empty('Ничего не найдено');
                }
            };

            this.renderList = function() {
                container.empty();
                items = [];
                active_item = 0;

                this.updateHeader();

                raw_data.forEach(data => {
                    let title = data.title?.trim() || `Серия ${data.e || '?'}`;

                    if (filters.voice !== 'Любой') {
                        title = filters.voice + ' • ' + title;
                    }

                    const card = $(`
                        <div class="selector focusable" style="padding:16px; margin:8px 20px; background:rgba(255,255,255,0.05); border-radius:12px; display:flex; align-items:center; gap:16px; border:1px solid rgba(255,255,255,0.03);">
                            <div class="fx-card-play"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>
                            <div style="flex:1; overflow:hidden;">
                                <div style="font-size:16px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
                                <div style="font-size:11px; opacity:0.4; margin-top:4px;">${data.quality ? Object.keys(data.quality).join(', ') : 'HD'}</div>
                            </div>
                        </div>
                    `);

                    card.on('hover:enter', () => {
                        Lampa.Player.play({ url: data.url, title: title, movie: object.movie });
                    });

                    container.append(card);
                    items.push(card);
                });

                if (!items.length) {
                    container.append('<div style="padding:60px; text-align:center; opacity:0.3;">Серии не найдены</div>');
                }

                this.start();
            };

            this.empty = function(msg) {
                container.empty().append(`<div style="padding:100px 20px; text-align:center; opacity:0.4;">${msg}</div>`);
                this.updateHeader();
                this.start();
            };

            this.start = function() {
                Lampa.Controller.add('fx_nexus_ctrl', {
                    toggle: () => {
                        if (current_mode === 'header' && header_items.length) {
                            Lampa.Controller.collectionSet(header);
                            Lampa.Controller.collectionFocus(header_items[0][0], header);
                        } else {
                            Lampa.Controller.collectionSet(container);
                            const f = items[active_item]?.[0] || container.find('.selector')[0];
                            if (f) Lampa.Controller.collectionFocus(f, container);
                        }
                    },
                    up: () => {
                        if (current_mode === 'content') {
                            if (active_item > 0) active_item--;
                            else if (header_items.length) {
                                current_mode = 'header';
                                Lampa.Controller.toggle('fx_nexus_ctrl');
                            }
                        }
                    },
                    down: () => {
                        if (current_mode === 'header' && items.length) {
                            current_mode = 'content';
                            Lampa.Controller.toggle('fx_nexus_ctrl');
                        } else if (active_item < items.length - 1) active_item++;
                    },
                    back: () => Lampa.Activity.backward()
                });
                Lampa.Controller.enable('fx_nexus_ctrl');
            };

            // Обязательные методы для избежания ошибок
            this.pause = function() {};
            this.stop = function() {};
            this.render = function() { return html; };

            this.destroy = function() {
                network.clear();
                scroll.destroy();
                html.remove();
                safeLoading.hide();
                Lampa.Controller.enable('content');
            };
        }

        Lampa.Component.add('fx_hybrid_v9', FilmixComponent);

        Lampa.Listener.follow('full', e => {
            if (e.type === 'complete' || e.type === 'complite') {
                const render = e.object.activity.render();
                if (render.find('.fx-nexus-native').length) return;

                const btn = $('<div class="full-start__button selector view--online fx-nexus-native"><span>Смотреть</span></div>');
                btn.on('hover:enter', () => Lampa.Activity.push({component: 'fx_hybrid_v9', movie: e.data.movie}));

                const target = render.find('.view--torrent');
                target.length ? target.after(btn) : render.find('.full-start__buttons').append(btn);
            }
        });
    }

    if (typeof Lampa !== 'undefined') startPlugin();
})();