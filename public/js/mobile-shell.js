(function () {
    if (!window.__SOLARA_IS_MOBILE) return;
    const $ = (id) => document.getElementById(id);
    const body = document.body;
    const shell = $("mobileShell");
    if (!shell) return;
    const state = { activeView: "home", actionSong: null };
    const text = (song) => Array.isArray(song && song.artist) ? song.artist.join(", ") : (song && song.artist) || "未知艺术家";
    const current = () => window.SolaraState && window.SolaraState.currentSong;
    const setOpen = (id, className, open) => { const el = $(id); if (!el) return; body.classList.toggle(className, open); el.setAttribute("aria-hidden", open ? "false" : "true"); };
    const syncArtwork = (target, source) => { if (!target) return; const image = source && source.querySelector("img"); target.innerHTML = image ? "" : '<i class="fas fa-music"></i>'; if (image) { const clone = image.cloneNode(true); clone.alt = ""; target.appendChild(clone); } };
    function syncPlayer() {
        const song = current(); if (!song) return;
        const name = song.name || "选择一首歌曲"; const artist = text(song);
        [$("mobileHomeSong"), $("mobileMiniTitle"), $("mobileFullTitle")].forEach((el) => { if (el) el.textContent = name; });
        [$("mobileHomeArtist"), $("mobileMiniArtist"), $("mobileFullArtist")].forEach((el) => { if (el) el.textContent = artist; });
        syncArtwork($("mobileMiniArtwork"), window.SolaraDom && window.SolaraDom.albumCover);
        syncArtwork($("mobileFullArtwork"), window.SolaraDom && window.SolaraDom.albumCover);
        const play = window.SolaraDom && window.SolaraDom.playPauseBtn;
        const icon = play && play.querySelector("i"); const miniIcon = $("mobileMiniPlayIcon"); const fullIcon = $("mobileFullPlay") && $("mobileFullPlay").querySelector("i");
        const playing = icon && icon.classList.contains("fa-pause");
        [miniIcon, fullIcon].forEach((el) => { if (el) { el.classList.toggle("fa-play", !playing); el.classList.toggle("fa-pause", playing); } });
        const source = window.SolaraDom && window.SolaraDom.progressBar;
        const full = $("mobileFullProgress");
        if (source && full) { full.max = source.max || 0; full.value = source.value || 0; }
        const time = window.SolaraDom && window.SolaraDom.currentTimeDisplay; const duration = window.SolaraDom && window.SolaraDom.durationDisplay;
        if ($("mobileFullCurrent") && time) $("mobileFullCurrent").textContent = time.textContent;
        if ($("mobileFullDuration") && duration) $("mobileFullDuration").textContent = duration.textContent;
    }
    function switchView(view) {
        state.activeView = view;
        const labels = { home: "首页", search: "搜索", favorites: "收藏", queue: "队列", settings: "设置" };
        $("mobileShellTitle").textContent = labels[view] || "首页";
        document.querySelectorAll("[data-mobile-nav]").forEach((button) => button.classList.toggle("is-active", button.dataset.mobileNav === view));
        if (view === "search") window.openMobileSearch && window.openMobileSearch();
        else if (view === "queue") window.openMobilePanel && window.openMobilePanel("playlist");
        else if (view === "favorites") window.openMobilePanel && window.openMobilePanel("favorites");
        else if (view === "settings") window.openSettingsModal && window.openSettingsModal();
    }
    function openFullPlayer() { body.classList.add("mobile-full-player-open"); $("mobileFullPlayer").setAttribute("aria-hidden", "false"); syncPlayer(); }
    function closeFullPlayer() { body.classList.remove("mobile-full-player-open"); $("mobileFullPlayer").setAttribute("aria-hidden", "true"); }
    function openActions(song) { state.actionSong = song || current(); if (!state.actionSong) return; body.classList.add("mobile-action-sheet-open", "mobile-shell-modal-open"); $("mobileActionSheet").setAttribute("aria-hidden", "false"); }
    function closeActions() { body.classList.remove("mobile-action-sheet-open", "mobile-shell-modal-open"); $("mobileActionSheet").setAttribute("aria-hidden", "true"); state.actionSong = null; }
    function bind() {
        document.querySelectorAll("[data-mobile-nav]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.mobileNav)));
        [$("mobileMiniPlayer"), $("mobileHomePlayer")].forEach((el) => el && el.addEventListener("click", openFullPlayer));
        $("mobileFullPlayerClose").addEventListener("click", closeFullPlayer);
        $("mobileFullPlayerMore").addEventListener("click", () => openActions());
        $("mobileShellSearch").addEventListener("click", () => switchView("search"));
        $("mobileSearchToggle").addEventListener("click", () => switchView("search"));
        $("mobileShellSettings").addEventListener("click", () => switchView("settings"));
        $("mobileShellExplore").addEventListener("click", () => window.loadOnlineBtn && window.loadOnlineBtn.click());
        $("mobileFullPlay").addEventListener("click", () => window.togglePlayPause && window.togglePlayPause());
        $("mobileFullPrevious").addEventListener("click", () => window.playPrevious && window.playPrevious());
        $("mobileFullNext").addEventListener("click", () => window.playNext && window.playNext());
        $("mobileFullProgress").addEventListener("input", (event) => { const bar = window.SolaraDom && window.SolaraDom.progressBar; if (bar) { bar.value = event.target.value; bar.dispatchEvent(new Event("input", { bubbles: true })); } });
        $("mobileLyricsEntry").addEventListener("click", () => window.openMobileInlineLyrics && window.openMobileInlineLyrics());
        $("mobileOverlayScrim").addEventListener("click", closeActions);
        $("mobileActionSheet").addEventListener("click", (event) => { const action = event.target.closest("[data-mobile-action]") && event.target.closest("[data-mobile-action]").dataset.mobileAction; const song = state.actionSong; if (!action) return; if (action === "play" && song && window.playSong) window.playSong(song); if (action === "favorite" && song && window.toggleFavorite) window.toggleFavorite(song); if (action === "queue" && song && window.addSongToPlaylist) window.addSongToPlaylist(song); closeActions(); });
        const observer = new MutationObserver(syncPlayer); observer.observe($("albumCover"), { childList: true, subtree: true, attributes: true });
        ["timeupdate", "play", "pause", "loadedmetadata"].forEach((event) => $("audioPlayer").addEventListener(event, syncPlayer));
        syncPlayer();
    }
    window.addEventListener("solara:song-updated", syncPlayer);
    window.SolaraMobileShell = { openFullPlayer, closeFullPlayer, openActions, syncPlayer };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true }); else bind();
})();
