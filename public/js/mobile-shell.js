(function () {
    if (!window.__SOLARA_IS_MOBILE) return;
    var $ = function (id) { return document.getElementById(id); };
    var d = $;
    var body = document.body;
    var shell = $("mobileShell");
    if (!shell) return;
    shell.setAttribute("aria-hidden", "false");

    var state = { activeView: "home", actionSong: null };

    var text = function (song) {
        return Array.isArray(song && song.artist) ? song.artist.join(", ") : (song && song.artist) || "\u672a\u77e5\u827a\u672f\u5bb6";
    };
    var current = function () { return window.SolaraState && window.SolaraState.currentSong; };

    function syncArtwork(target, source) {
        if (!target) return;
        var image = source && source.querySelector("img");
        target.innerHTML = image ? "" : '<i class="fas fa-music"><\/i>';
        if (image) {
            var clone = image.cloneNode(true);
            clone.alt = "";
            target.appendChild(clone);
        }
    }

    function syncPlayer() {
        var song = current();
        if (!song) return;
        var name = song.name || "\u672a\u77e5\u6b4c\u66f2";
        var artist = text(song);
        var els = [$("mobileHomeSong"), $("mobileMiniTitle"), $("mobileFullTitle")];
        for (var i = 0; i < els.length; i++) { if (els[i]) els[i].textContent = name; }
        els = [$("mobileHomeArtist"), $("mobileMiniArtist"), $("mobileFullArtist")];
        for (var j = 0; j < els.length; j++) { if (els[j]) els[j].textContent = artist; }
        syncArtwork($("mobileMiniArtwork"), window.SolaraDom && window.SolaraDom.albumCover);
        syncArtwork($("mobileFullArtwork"), window.SolaraDom && window.SolaraDom.albumCover);
        var play = window.SolaraDom && window.SolaraDom.playPauseBtn;
        var icon = play && play.querySelector("i");
        var miniIcon = $("mobileMiniPlayIcon");
        var fullIcon = $("mobileFullPlay") && $("mobileFullPlay").querySelector("i");
        var playing = icon && icon.classList.contains("fa-pause");
        var icons = [miniIcon, fullIcon];
        for (var k = 0; k < icons.length; k++) {
            if (icons[k]) {
                icons[k].classList.toggle("fa-play", !playing);
                icons[k].classList.toggle("fa-pause", playing);
            }
        }
        var srcBar = window.SolaraDom && window.SolaraDom.progressBar;
        var fullBar = $("mobileFullProgress");
        if (srcBar && fullBar) { fullBar.max = srcBar.max || 0; fullBar.value = srcBar.value || 0; }
        var t = window.SolaraDom && window.SolaraDom.currentTimeDisplay;
        var d = window.SolaraDom && window.SolaraDom.durationDisplay;
        if ($("mobileFullCurrent") && t) $("mobileFullCurrent").textContent = t.textContent;
        if ($("mobileFullDuration") && d) $("mobileFullDuration").textContent = d.textContent;
    }

    function switchView(view) {
        state.activeView = view;
        var labels = { home: "\u9996\u9875", search: "\u641c\u7d22", favorites: "\u6536\u85cf", queue: "\u961f\u5217", settings: "\u8bbe\u7f6e" };
        if ($("mobileShellTitle")) $("mobileShellTitle").textContent = labels[view] || "\u9996\u9875";
        var navs = document.querySelectorAll("[data-mobile-nav]");
        for (var i = 0; i < navs.length; i++) {
            navs[i].classList.toggle("is-active", navs[i].dataset.mobileNav === view);
        }
        if (view === "home") {
            if (window.closeAllMobileOverlays) window.closeAllMobileOverlays();
            else { body.classList.remove("mobile-search-open", "mobile-panel-open"); }
        }
        if (view === "search") {
            if (window.openMobileSearch) window.openMobileSearch();
        } else if (view === "queue") {
            if (window.openMobilePanel) window.openMobilePanel("playlist");
        } else if (view === "favorites") {
            if (window.openMobilePanel) window.openMobilePanel("favorites");
        } else if (view === "settings") {
            if (window.openSettingsModal) window.openSettingsModal();
            var homeNav = document.querySelector('[data-mobile-nav="home"]');
            if (homeNav) homeNav.classList.add("is-active");
            var settingsNav = document.querySelector('[data-mobile-nav="settings"]');
            if (settingsNav) settingsNav.classList.remove("is-active");
            state.activeView = "home";
        }
    }

    function openFullPlayer() {
        body.classList.add("mobile-full-player-open");
        var fp = d("mobileFullPlayer");
        if (fp) fp.setAttribute("aria-hidden", "false");
        syncPlayer();
    }
    function closeFullPlayer() {
        body.classList.remove("mobile-full-player-open");
        var fp = d("mobileFullPlayer");
        if (fp) fp.setAttribute("aria-hidden", "true");
    }

    function openActions(song) {
        state.actionSong = song || current();
        if (!state.actionSong) return;
        body.classList.add("mobile-action-sheet-open", "mobile-shell-modal-open");
        var as = d("mobileActionSheet");
        if (as) as.setAttribute("aria-hidden", "false");
    }
    function closeActions() {
        body.classList.remove("mobile-action-sheet-open", "mobile-shell-modal-open");
        var as = d("mobileActionSheet");
        if (as) as.setAttribute("aria-hidden", "true");
        state.actionSong = null;
    }

    function relocatePanels() {
        var searchArea = $("searchArea");
        var mobilePanel = d("mobilePanel");
        var scrim = $("mobileOverlayScrim");
        if (searchArea && searchArea.parentElement && searchArea.parentElement.id === "mainContainer") {
            document.body.appendChild(searchArea);
        }
        if (mobilePanel && mobilePanel.parentElement) {
            document.body.appendChild(mobilePanel);
        }
        if (scrim && scrim.parentElement && scrim.parentElement.id === "mainContainer") {
            document.body.appendChild(scrim);
        }
    }

    function bind() {
        relocatePanels();
        var navs = document.querySelectorAll("[data-mobile-nav]");
        for (var i = 0; i < navs.length; i++) {
            navs[i].addEventListener("click", function () { switchView(this.dataset.mobileNav); });
        }
        var mp = d("mobileMiniPlayer"); if (mp) mp.addEventListener("click", openFullPlayer);
        var hp = d("mobileHomePlayer"); if (hp) hp.addEventListener("click", openFullPlayer);
        var fpc = d("mobileFullPlayerClose"); if (fpc) fpc.addEventListener("click", closeFullPlayer);
        var fpm = d("mobileFullPlayerMore"); if (fpm) fpm.addEventListener("click", function () { openActions(); });
        var ss = d("mobileShellSearch"); if (ss) ss.addEventListener("click", function () { switchView("search"); });
        var sset = d("mobileShellSettings"); if (sset) sset.addEventListener("click", function () { switchView("settings"); });
        var mst = d("mobileSearchToggle"); if (mst) mst.addEventListener("click", function () { switchView("search"); });
        var meb = d("mobileExploreButton"); if (meb) meb.addEventListener("click", function () {
            if (typeof exploreOnlineMusic === "function") exploreOnlineMusic();
        });
        var mse = d("mobileShellExplore"); if (mse) mse.addEventListener("click", function () {
            if (typeof exploreOnlineMusic === "function") exploreOnlineMusic();
        });
        var fp = d("mobileFullPlay"); if (fp) fp.addEventListener("click", function () { if (window.togglePlayPause) window.togglePlayPause(); });
        var fprev = d("mobileFullPrevious"); if (fprev) fprev.addEventListener("click", function () { if (window.playPrevious) window.playPrevious(); });
        var fnext = d("mobileFullNext"); if (fnext) fnext.addEventListener("click", function () { if (window.playNext) window.playNext(); });
        var fprog = d("mobileFullProgress"); if (fprog) fprog.addEventListener("input", function (e) {
            var bar = window.SolaraDom && window.SolaraDom.progressBar;
            if (bar) { bar.value = e.target.value; bar.dispatchEvent(new Event("input", { bubbles: true })); }
        });
        var fle = d("mobileLyricsEntry"); if (fle) fle.addEventListener("click", function () {
            if (window.openMobilePanel) window.openMobilePanel("lyrics");
        });
        var scrim = d("mobileOverlayScrim"); if (scrim) scrim.addEventListener("click", closeActions);
        var as = d("mobileActionSheet");
        if (as) as.addEventListener("click", function (event) {
            var btn = event.target.closest("[data-mobile-action]");
            if (!btn) return;
            var action = btn.dataset.mobileAction;
            var song = state.actionSong;
            closeActions();
            if (action === "play" && song && window.playSong) window.playSong(song);
            if (action === "favorite" && song && window.toggleFavorite) window.toggleFavorite(song);
            if (action === "queue" && song && window.addSongToPlaylist) window.addSongToPlaylist(song);
        });
        if (d("albumCover") && typeof MutationObserver !== "undefined") {
            var observer = new MutationObserver(syncPlayer);
            observer.observe(d("albumCover"), { childList: true, subtree: true, attributes: true });
        }
        var audio = d("audioPlayer");
        if (audio) {
            var events = ["timeupdate", "play", "pause", "loadedmetadata"];
            for (var j = 0; j < events.length; j++) {
                audio.addEventListener(events[j], syncPlayer);
            }
        }
        syncPlayer();
    }

    window.addEventListener("solara:song-updated", syncPlayer);
    window.SolaraMobileShell = {
        openFullPlayer: openFullPlayer,
        closeFullPlayer: closeFullPlayer,
        openActions: openActions,
        syncPlayer: syncPlayer,
        switchView: switchView
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bind, { once: true });
    } else {
        bind();
    }
})();
