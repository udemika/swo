(function () {
    'use strict';

    if (window.filmix_nexus_loaded) return;
    window.filmix_nexus_loaded = true;

    const VERSION = '1.8.0';
    const PLUGIN_NAME = 'Filmix Nexus';

    const WORKING_UID = 'i8nqb9vw';
    const WORKING_TOKEN = 'f8377057-90eb-4d76-93c9-7605952a096l';
    const BASE_DOMAIN = 'http://showypro.com';

    const PROXIES = [
        'https://cors.byskaz.ru/',
        'https://cors.lampa.stream/',
        'https://corsproxy.io/?',
        'https://thingproxy.freeboard.io/fetch/',
        'https://api.allorigins.win/raw?url='
    ];

    /* ===== AUTO DEVICE DETECT ===== */
    const IS_TV = Lampa.Platform.is('android') || Lampa.Platform.is('tizen') || Lampa.Platform.is('webos');
    const IS_MOUSE = !IS_TV;

    /* ===== STYLES ===== */
    $('<style>')
        .html(`
            .fx-badge {
                background:#3b82f6;color:#fff;
                padding:2px 6px;border-radius:4px;
                font-size:11px;font-weight:bold;
            }
            .fx-nexus-status {
                padding:8px 12px;
                background:rgba(59,130,246,.1);
                border-left:3px solid #3b82f6;
                margin-bottom:10px;
                border-radius:4px;
            }
            .selector.focus,
            .selector.active {
                outline:2px solid #3b82f6 !important;
                background:rgba(59,130,246,.25)!important;
            }
        `)
        .appendTo('head');

    /* ===== TEMPLATES ===== */
    Lampa.Template.add(
        'fx_nexus_button',
        `<div class="full-start__button selector view--online fx-nexus-native"
            data-subtitle="${PLUGIN_NAME} v${VERSION}">
            <span>Онлайн</span>
        </div>`
    );

    Lampa.Template.add(
        'fx_nexus_item',
        `<div class="online-fx-item selector"
            style="padding:1.1em;margin:.4em 0;
            background:rgba(255,255,255,.05);
            border-radius:.4em;
            display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:12px;">
                {icon}<span style="font-size:1.1em">{name}</span>
            </div>
            <div>{badge}</div>
        </div>`
    );

    /* ===== COMPONENT ===== */
    function FilmixComponent(object) {
        let network = new (Lampa.Request || Lampa.Reguest)();
        let scroll = new Lampa.Scroll({ mask: true, over: true });
        let explorer = new Lampa.Explorer(object);
        let container = $('<div></div>');
        let history = [];
        let items = [];
        let active = 0;

        this.create = () => {
            explorer.appendFiles(scroll.render());
            scroll.append(container);

            let kp = object.movie.kinopoisk_id || object.movie.kp_id;
            let param = kp ? `kinopoisk_id=${kp}` : `postid=${object.movie.id}`;

            load(
                `${BASE_DOMAIN}/lite/fxapi?rjson=False&${param}&s=1&uid=${WORKING_UID}&showy_token=${WORKING_TOKEN}`
            );

            return explorer.render();
        };

        function load(url, title = object.movie.title) {
            container.empty();
            items = [];
            active = 0;

            let proxy = PROXIES[Lampa.Storage.get('fx_proxy', 0)];
            let final = proxy.includes('allorigins')
                ? proxy + encodeURIComponent(url)
                : proxy + url;

            Lampa.Loading.start();

            network.native(
                final,
                res => {
                    Lampa.Loading.stop();
                    build(parse(res), title, url);
                },
                () => {
                    let i = (+Lampa.Storage.get('fx_proxy', 0) + 1) % PROXIES.length;
                    Lampa.Storage.set('fx_proxy', i);
                    load(url, title);
                },
                false,
                { dataType: 'text', timeout: 12000 }
            );
        }

        function parse(html) {
            let out = [];
            $('<div>').append(html).find('[data-json]').each(function () {
                try {
                    let jd = JSON.parse($(this).attr('data-json'));
                    let file = jd.url && /\.(mp4|m3u8)/.test(jd.url);
                    out.push({
                        name: jd.title || $(this).text().trim(),
                        url: jd.url,
                        jd,
                        type: file ? 'file' : 'folder',
                        icon: file
                            ? '▶️'
                            : '📁',
                        badge: jd.quality ? `<span class="fx-badge">${Object.keys(jd.quality)[0]}</span>` : ''
                    });
                } catch (e) {}
            });
            return out;
        }

        function build(list, title, url) {
            container.append(
                `<div class="fx-nexus-status">${title}</div>`
            );

            if (history.length) {
                let back = $('<div class="selector">← Назад</div>');
                back.on('hover:enter click', () => {
                    let p = history.pop();
                    load(p.url, p.title);
                });
                container.append(back);
                items.push(back);
            }

            list.forEach(l => {
                let it = Lampa.Template.get('fx_nexus_item', l);
                it.on('hover:enter click', () => {
                    if (l.type === 'folder') {
                        history.push({ url, title });
                        load(l.url, l.name);
                    } else play(l);
                });
                container.append(it);
                items.push(it);
            });

            startController();
        }

        function play(item) {
            if (item.jd.quality && typeof item.jd.quality === 'object') {
                Lampa.Select.show({
                    title: item.name,
                    items: Object.keys(item.jd.quality).map(q => ({
                        title: q,
                        url: item.jd.quality[q]
                    })),
                    onSelect: q => Lampa.Player.play({ url: q.url })
                });
            } else {
                Lampa.Player.play({ url: item.url });
            }
        }

        function startController() {
            Lampa.Controller.add('fx_ctrl', {
                toggle() {
                    Lampa.Controller.collectionSet(container);
                    Lampa.Controller.collectionFocus(items[active][0], container);
                },
                up() {
                    if (active > 0) active--;
                },
                down() {
                    if (active < items.length - 1) active++;
                },
                enter() {
                    items[active].trigger('hover:enter');
                },
                back() {
                    if (history.length) {
                        let p = history.pop();
                        load(p.url, p.title);
                    } else Lampa.Activity.backward();
                }
            });
            Lampa.Controller.enable('fx_ctrl');
        }

        this.destroy = () => {
            network.clear();
            scroll.destroy();
            explorer.destroy();
            container.remove();
        };
    }

    Lampa.Component.add('fx_hybrid_final', FilmixComponent);

    /* ===== BUTTON INJECT ===== */
    Lampa.Listener.follow('full', e => {
        if (e.type !== 'complete') return;

        let render = e.object.activity.render();
        if (render.find('.fx-nexus-native').length) return;

        let btn = Lampa.Template.get('fx_nexus_button');
        btn.on('hover:enter click', () => {
            Lampa.Activity.push({
                component: 'fx_hybrid_final',
                title: PLUGIN_NAME,
                movie: e.data.movie
            });
        });

        render.find('.view--torrent,.full-start__buttons').after(btn);
    });

})();
